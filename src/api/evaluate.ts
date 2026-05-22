import type {
  AiSuggestion,
  BusinessFramingState,
  CopilotStages,
  EvaluateIdeaResult,
  FinalHandoff,
  FramingStage,
  IdeaInputState,
  MvpScopeState,
  ProductBrief,
  ProductFramingState,
  StepData,
  SuggestionValue,
  TechnicalPlanningState,
} from '../types';
import type { StepConfig } from '../data/steps';

// --- AI Configuration (from localStorage) ---

export interface AIConfig {
  apiUrl: string;     // e.g. https://api.openai.com
  apiKey: string;     // e.g. sk-xxx
  model: string;      // e.g. gpt-4o
}

const AI_CONFIG_KEY = 'vibepilot_ai_config';

export function getAIConfig(): AIConfig | null {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as AIConfig;
    if (!config.apiUrl || !config.apiKey || !config.model) return null;
    return config;
  } catch {
    return null;
  }
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

export function clearAIConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY);
}

// --- Request Types ---

interface EvaluateRequest {
  step: StepConfig;
  userAnswer: string;
  rawIdea: string;
  allSteps: Record<string, StepData>;
  mode?: 'evaluate' | 'hint' | 'followup';
  previousEvaluation?: string;
}

interface EvaluateResponse {
  evaluation: string;
  quality: 'specific' | 'ok' | 'vague';
  followUp: string;
}

// --- Direct AI Call (OpenAI-compatible via same-origin proxy) ---

export function extractAIContent(data: Record<string, unknown>): string {
  let content = '';
  const choices = data.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0] as Record<string, unknown>;
    // Standard OpenAI format
    if (firstChoice.message && typeof (firstChoice.message as Record<string, unknown>).content === 'string') {
      content = (firstChoice.message as Record<string, unknown>).content as string;
    }
    // Some providers wrap in delta
    else if (firstChoice.delta && typeof (firstChoice.delta as Record<string, unknown>).content === 'string') {
      content = (firstChoice.delta as Record<string, unknown>).content as string;
    }
    // Direct content field
    else if (typeof firstChoice.content === 'string') {
      content = firstChoice.content;
    }
  }
  // Gemini / some providers may return content directly
  else if (typeof data.content === 'string') {
    content = data.content;
  }
  // Some providers return candidates
  else if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const candidate = data.candidates[0] as Record<string, unknown>;
    const candidateContent = candidate.content;
    if (candidateContent && typeof (candidateContent as Record<string, unknown>).text === 'string') {
      content = (candidateContent as Record<string, unknown>).text as string;
    } else if (candidateContent && Array.isArray((candidateContent as Record<string, unknown>).parts)) {
      content = ((candidateContent as Record<string, unknown>).parts as Array<Record<string, unknown>>)
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
    }
  }

  return content.trim();
}

async function callAIProxy(config: AIConfig, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  console.log('[VibePilot] AI Proxy Request:', { apiUrl: config.apiUrl, model: body.model });

  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      body,
    }),
  });

  const rawText = await response.text();
  console.log('[VibePilot] AI Proxy Raw Response:', rawText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`AI API 返回错误 (${response.status}): ${rawText.slice(0, 300)}`);
  }

  try {
    return JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    throw new Error('AI API 返回的不是有效 JSON');
  }
}

function buildSystemPrompt(req: EvaluateRequest): string {
  const { step, userAnswer, rawIdea, allSteps, mode, previousEvaluation } = req;
  const stepKey = step.key;
  const stepTitle = step.title;
  const stepQuestion = step.question;

  const prevSteps = Object.entries(allSteps || {})
    .filter(([key, val]) => key !== stepKey && val.userAnswer)
    .map(([key, val]) => `- ${key}: ${val.userAnswer.slice(0, 200)}`)
    .join('\n');

  if (mode === 'hint') {
    return `你是一位资深产品经理，正在指导一个 vibe coding 新手完成产品思考练习。

当前步骤：${stepTitle}
问题描述：${stepQuestion}
用户的原始想法：${rawIdea}

用户说"我不知道怎么写"，请给他一个具体的思考方向提示。
要求：
1. 不要直接给出答案，而是给出思考路径
2. 用 2-3 个具体问题引导用户自己思考
3. 语气友好、鼓励，像一个耐心的高手带徒弟
4. 控制在 100 字以内
5. 用中文回答`;
  }

  if (mode === 'followup') {
    return `你是一位资深产品经理。用户刚刚收到了你的评价，现在在追问环节想继续深入。

当前步骤：${stepTitle}
用户之前的答案：${userAnswer}
你之前的评价：${previousEvaluation}

用户想要继续追问，请给他一个有价值的追问或思考方向。
要求：
1. 基于之前的评价，提出更深一层的问题
2. 不要重复之前的内容
3. 控制在 80 字以内
4. 用中文回答`;
  }

  return `你是一位资深产品经理，正在评价一个 vibe coding 新手的产品思考练习答案。

## 当前步骤
步骤名：${stepTitle}
问题描述：${stepQuestion}

## 用户的原始想法（产品方向）
${rawIdea}

${prevSteps ? `## 用户之前完成的步骤\n${prevSteps}\n` : ''}

## 用户的当前答案
${userAnswer}

## 评价要求

请严格按以下 JSON 格式返回，不要输出任何其他内容：
{
  "quality": "specific" | "ok" | "vague",
  "evaluation": "评价文本",
  "followUp": "追问文本"
}

### quality 判断标准
- specific：答案包含具体的数字、场景细节、特定人群描述、可量化指标，或者结构清晰（使用了列表/编号）
- ok：方向正确但缺少具体细节，只有定性描述没有定量数据，或者覆盖面不够全
- vague：答案过于宽泛（如"所有人""提高效率""智能化"），没有具体信息，或者字数太少（< 20 字）

### evaluation 评价要求
1. 先说结论（好/还行/太模糊），再说原因
2. 引用用户答案中的具体内容（如果有的话），让用户感觉你真的看了他写的东西
3. ${prevSteps ? '检查是否和之前步骤矛盾（比如之前说不需要后端，这里却写了注册登录），如果有矛盾要指出来。' : ''}
4. 给出具体的改进方向，不要空话
5. 控制在 100-150 字
6. 用中文

### followUp 追问要求
1. 提一个具体的、可回答的问题
2. 问题应该引导用户把答案从"ok"提升到"specific"
3. 如果是 vague 等级，追问应该帮用户找到切入点
4. 控制在 50 字以内
5. 用中文`;
}

async function callDirectAI(req: EvaluateRequest, config: AIConfig): Promise<EvaluateResponse> {
  const allStepsSummary: Record<string, { userAnswer: string; aiQuality: string }> = {};
  for (const [key, val] of Object.entries(req.allSteps)) {
    allStepsSummary[key] = {
      userAnswer: val.userAnswer,
      aiQuality: val.aiQuality || 'vague',
    };
  }

  const systemPrompt = buildSystemPrompt(req);

  const userMessage = req.mode === 'evaluate'
    ? req.userAnswer
    : req.mode === 'hint'
      ? '我不知道怎么回答这个问题，请给我一些提示方向。'
      : '我想继续追问，请帮我深入思考。';

  const requestBody: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: req.mode === 'evaluate' ? 500 : 200,
  };

  const data = await callAIProxy(config, requestBody);
  const content = extractAIContent(data);

  console.log('[VibePilot] Extracted content:', content.slice(0, 200));

  if (!content) {
    throw new Error('AI API 返回成功但内容为空，请检查模型名称是否正确。响应结构：' + Object.keys(data).join(', '));
  }

  if (req.mode === 'hint') return { evaluation: content, quality: 'ok', followUp: '' };

  if (req.mode === 'followup') return { evaluation: '', quality: 'ok', followUp: content };

  // Parse JSON from AI response (evaluate mode)
  let result: EvaluateResponse;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
      if (!['specific', 'ok', 'vague'].includes(result.quality)) {
        result.quality = 'ok';
      }
    } else {
      throw new Error('No JSON found');
    }
  } catch {
    const lowerContent = content.toLowerCase();
    let quality: 'specific' | 'ok' | 'vague' = 'ok';
    if (lowerContent.includes('具体') || lowerContent.includes('清晰') || lowerContent.includes('很好')) {
      quality = 'specific';
    } else if (lowerContent.includes('模糊') || lowerContent.includes('宽泛') || lowerContent.includes('太笼统')) {
      quality = 'vague';
    }
    result = {
      quality,
      evaluation: content.replace(/\{[\s\S]*\}/, '').trim() || '评价生成失败，请重试。',
      followUp: '',
    };
  }

  return result;
}

// --- Local Mock (Fallback when no AI config) ---

function judgeQuality(answer: string, stepKey: string): 'specific' | 'ok' | 'vague' {
  if (!answer || answer.trim().length < 10) return 'vague';

  const vaguePatterns = [
    '所有人', '大家', '用户', '提高效率', '更好用', '用户体验',
    '智能化', '自动化', '一站式', '全方位', '综合',
  ];
  const isVague = vaguePatterns.some((p) => answer.includes(p)) && answer.length < 30;

  const hasConcrete =
    (/\d/.test(answer) && answer.length > 30) ||
    (answer.length > 60 && /[，,。.；;]/.test(answer));

  if (stepKey === 'mvpScope' || stepKey === 'acceptanceCriteria') {
    const hasList = /\d[.)）]/.test(answer) || /P0|P1|P2/i.test(answer) || /\n/.test(answer);
    if (hasList && answer.length > 40) return 'specific';
    if (answer.length > 20) return 'ok';
    return 'vague';
  }

  if (stepKey === 'techStack') {
    const hasTech = /react|vue|node|python|tailwind|next|vite|api|数据库|localStorage/i.test(answer);
    if (hasTech && answer.length > 30) return 'specific';
    if (hasTech) return 'ok';
    return 'vague';
  }

  if (stepKey === 'dataStructure') {
    const hasFields = /\{.*\}/.test(answer) || /字段|id|name|email|title/i.test(answer);
    if (hasFields && answer.length > 30) return 'specific';
    if (hasFields) return 'ok';
    return 'vague';
  }

  if (isVague) return 'vague';
  if (hasConcrete) return 'specific';
  if (answer.length > 30) return 'ok';
  return 'vague';
}

const EVAL_TEMPLATES: Record<string, Record<string, { evaluation: string; followUp: string }[]>> = {
  targetUser: {
    specific: [
      { evaluation: '很清晰！你描述了用户的身份、经验和当前困境，这个用户画像足够具体。', followUp: '这类用户最有可能通过什么渠道发现你的产品？' },
      { evaluation: '用户画像很具体。我能想象出这个人——知道他是谁、做什么、遇到了什么困难。', followUp: '他们的付费意愿和能力如何？' },
    ],
    ok: [
      { evaluation: '方向对了，但还可以更具体。尝试补充用户的经验水平和当前使用的工具。', followUp: '他们的经验水平是什么？当前用什么方式解决类似问题？' },
    ],
    vague: [
      { evaluation: '这个描述太宽泛了。"所有人"或"需要XX的人"不是用户画像。', followUp: '闭上眼睛，想象你的第一个真实用户——他叫什么、做什么工作、今天遇到了什么？' },
    ],
  },
  scenario: {
    specific: [
      { evaluation: '场景很清晰！我能想象出用户在那个时刻遇到了什么障碍。', followUp: '用户在这个场景中的情绪是什么？' },
    ],
    ok: [
      { evaluation: '大致场景有了，但缺少情境细节。好的场景描述应该让人感到"我确实遇到过"。', followUp: '用"微电影"思维重写：镜头从哪里开始？转折点在哪？' },
    ],
    vague: [
      { evaluation: '这不是场景描述。场景应该是"用户在XX时刻，正在做XX事，遇到了XX问题"。', followUp: '用一句话格式重写：[谁]在[什么时候][做什么]的时候，[遇到了什么问题]。' },
    ],
  },
  painPoint: {
    specific: [
      { evaluation: '痛点很真实！你描述了具体的困难、量化的影响。', followUp: '这个痛点发生的频率有多高？' },
    ],
    ok: [
      { evaluation: '痛点方向对了，但需要更具体。', followUp: '试着量化：做这件事要多久？出错率多高？' },
    ],
    vague: [
      { evaluation: '这不是痛点，这是口号。', followUp: '想象用户今天刚遇到这个问题——具体发生了什么？' },
    ],
  },
  alternatives: {
    specific: [
      { evaluation: '很好！你清楚列出了用户的替代方案，说明做过调研。', followUp: '用户最不满意哪个替代方案？' },
    ],
    ok: [
      { evaluation: '方向对了，但可能遗漏了一些替代方案。', followUp: '有没有用户选择"不做这件事"的情况？' },
    ],
    vague: [
      { evaluation: '几乎不存在"完全没有替代方案"的事。', followUp: '问一个真实用户："你现在怎么解决XX问题？"' },
    ],
  },
  aiValue: {
    specific: [
      { evaluation: '很清晰！你说明了 AI 介入的具体环节。', followUp: '如果 AI 生成的结果不好，用户有退路吗？' },
    ],
    ok: [
      { evaluation: '大致说明了 AI 的作用，但还需要更具体。', followUp: '去掉所有"智能"的词，用大白话说输入→处理→输出。' },
    ],
    vague: [
      { evaluation: '"智能分析""自动推荐"是空话。你需要说清楚 AI 在哪个环节做什么。', followUp: '用"输入→处理→输出"的格式重写。' },
    ],
  },
  mvpScope: {
    specific: [
      { evaluation: '功能范围清晰，优先级划分合理。', followUp: '只保留 P0，用户能走完完整流程吗？' },
    ],
    ok: [
      { evaluation: '功能列表有了，但优先级可能不够清晰。', followUp: '砍掉一半功能，你留哪几个？' },
    ],
    vague: [
      { evaluation: '这不是 MVP，这是完整产品规划。V1 的 P0 不应超过 3 个。', followUp: '假设只有 3 天时间，你只能做一件事，你做哪个？' },
    ],
  },
  outOfScope: {
    specific: [
      { evaluation: '很好！说清不做什么和说清做什么一样重要。', followUp: '在"不做"中，哪个你内心最想要？' },
    ],
    ok: [
      { evaluation: '方向对了，但可以更坚定。', followUp: '再加 2 个"不做"的功能。' },
    ],
    vague: [
      { evaluation: '如果你觉得"什么都不排除"，说明 MVP 还是太大。', followUp: '哪个功能最花钱/最耗时/最复杂？标记为"V1 不做"。' },
    ],
  },
  techStack: {
    specific: [
      { evaluation: '技术栈选择很务实！简单、可落地、低成本启动。', followUp: '这个技术栈中你最不熟悉的部分是什么？' },
    ],
    ok: [
      { evaluation: '大致方向有了，但可以更具体。', followUp: '回答 4 个问题：前端？后端？数据存哪？怎么部署？' },
    ],
    vague: [
      { evaluation: '"现代技术"不是架构方案。需要明确每个部分用什么技术。', followUp: '推荐你用最熟悉的 1-2 个技术。' },
    ],
  },
  dataStructure: {
    specific: [
      { evaluation: '数据结构清晰！有了它，代码组织就有了骨架。', followUp: '实体之间有关系吗？' },
    ],
    ok: [
      { evaluation: '方向对了，但字段可以更具体。', followUp: '补充每个实体的字段和类型。' },
    ],
    vague: [
      { evaluation: '这不是数据结构，这是功能列表。', followUp: '用格式：实体名 { 字段名: 类型 } 重写。' },
    ],
  },
  acceptanceCriteria: {
    specific: [
      { evaluation: '验收标准很具体！每条都可测试、可判断。', followUp: '谁来判断这些条件满足？' },
    ],
    ok: [
      { evaluation: '方向对了，但部分标准不够具体。', followUp: '把每条改成"Given...When...Then..."格式。' },
    ],
    vague: [
      { evaluation: '"体验流畅""设计精美"无法测试。', followUp: '把"体验好"改成不超过 X 步、不超过 Y 秒。' },
    ],
  },
};

const STEP_HINTS: Record<string, string[]> = {
  targetUser: [
    '试着回答：1) 用户做什么工作？2) 工作多久了？3) 最大烦恼是什么？4) 用什么工具？',
    '想象你坐在咖啡厅，你的目标用户坐在对面。你会怎么描述这个人？',
  ],
  scenario: [
    '想象一部微电影：用户坐在电脑前，打开了什么网站？他在找什么？哪一步卡住了？',
    '用"时间+地点+人物+动作+障碍"五要素重写。',
  ],
  painPoint: [
    '量化你的痛点：做这件事要多久？一周做几次？出错率多高？',
    '找 3 个真实用户，问他们"做这件事最让你抓狂的是什么？"',
  ],
  alternatives: [
    '做个小调查：找到 3 个目标用户，问"你现在怎么解决XX问题？"',
    '分成 3 类思考：1) 工具类 2) 人工类 3) "不做"类。',
  ],
  aiValue: [
    '画一个流程图：用户输入什么→系统怎么处理→用户得到什么。',
    '回答 3 个问题：1) AI 输入什么？2) AI 输出什么？3) 不用 AI 多花多少时间？',
  ],
  mvpScope: [
    '减法游戏：写下所有功能，每次拿走一张，问"没有它产品还能跑吗？"',
  ],
  outOfScope: [
    '反向思考：哪个最耗时？哪个最复杂？标记为 V1 不做。',
  ],
  techStack: [
    '回答 4 个问题：1) 前端？2) 需要后端吗？3) 数据存哪？4) 怎么部署？',
  ],
  dataStructure: [
    '你的产品管理什么核心"东西"？给它起个英文名，列出属性。',
  ],
  acceptanceCriteria: [
    '想象给朋友演示，把每句话变成一条验收标准。',
  ],
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMockResponse(step: StepConfig, answer: string): EvaluateResponse {
  const quality = judgeQuality(answer, step.key);
  const templates = EVAL_TEMPLATES[step.key];
  const variants = templates?.[quality];
  const template = variants ? getRandomItem(variants) : null;

  return {
    evaluation: template?.evaluation || getDefaultEvaluation(quality),
    quality,
    followUp: template?.followUp || getDefaultFollowUp(quality),
  };
}

function getDefaultEvaluation(quality: string): string {
  if (quality === 'specific') return '这个答案很具体，能看出你做了认真的思考。';
  if (quality === 'ok') return '方向不错，但可以更具体。试着加上数字、场景细节或具体案例。';
  return '这个答案太模糊了，几乎适用于任何产品。请想象一个真实用户的具体情况。';
}

function getDefaultFollowUp(quality: string): string {
  if (quality === 'specific') return '这个答案有没有遗漏什么？有没有边界情况没考虑到？';
  if (quality === 'ok') return '试着在答案里加上至少一个数字或具体场景。';
  return '如果只能用一句话、不带任何形容词来描述，你会怎么说？';
}

// --- Copilot AI Capabilities: Evaluate / Suggest / Explain / Optimize ---

export const SCOPE_CREEP_TERMS = [
  '全能', '一站式', '平台', '市场调研', '竞品分析', 'PRD', '原型', '代码生成',
  '项目管理', '团队协作', '上线部署', '数据分析', '商业化',
];

function makeSuggestion<T extends SuggestionValue>(
  value: T,
  reason: string,
  risks: string[] = [],
  alternatives: string[] = []
): AiSuggestion<T> {
  return {
    value,
    reason,
    risks,
    alternatives,
    accepted: false,
    editedByUser: false,
  };
}

function acceptedText(value: AiSuggestion | undefined): string {
  if (!value) return '';
  if (Array.isArray(value.value)) return value.value.join('；');
  return String(value.value || '');
}

function buildBriefContext(brief: ProductBrief): string {
  return JSON.stringify({
    ideaInput: brief.ideaInput,
    product: brief.stages.product,
    business: brief.stages.business,
    technical: brief.stages.technical,
    mvp: brief.stages.mvp,
  }, null, 2);
}

function extractJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callCopilotJson<T>(systemPrompt: string, userContent: string, maxTokens = 1600): Promise<T | null> {
  const config = getAIConfig();
  if (!config) return null;
  try {
    const data = await callAIProxy(config, {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.45,
      max_tokens: maxTokens,
    });
    const content = extractAIContent(data);
    return extractJson<T>(content);
  } catch (err) {
    console.warn('[VibePilot] Copilot AI failed, using mock fallback:', err);
    return null;
  }
}

export function detectScopeCreep(input: string): string[] {
  return SCOPE_CREEP_TERMS.filter((term) => input.toLowerCase().includes(term.toLowerCase()));
}

export async function evaluateIdea(input: IdeaInputState): Promise<EvaluateIdeaResult> {
  const missingFields: string[] = [];
  if (!input.targetUser) missingFields.push('目标用户');
  if (!input.scenario) missingFields.push('使用场景');
  if (!input.problem) missingFields.push('核心问题');
  if (!input.projectType) missingFields.push('产品形态');

  const riskFlags = detectScopeCreep([input.rawIdea, input.problem, input.scenario].filter(Boolean).join(' '));
  const score = Math.max(20, 90 - missingFields.length * 12 - riskFlags.length * 6);

  return {
    score,
    mainIssue: missingFields.length
      ? `信息还不完整：${missingFields.join('、')} 可以先由 AI 做默认假设。`
      : '输入已经具备基本方向，可以进入 AI 辅助构思。',
    missingFields,
    riskFlags,
  };
}

function mockProductSuggestions(brief: ProductBrief): ProductFramingState {
  const idea = brief.ideaInput.rawIdea || '这个产品想法';
  const targetUser = brief.ideaInput.targetUser || '准备使用 AI 编程工具做第一个产品的个人开发者或产品新手';
  const scenario = brief.ideaInput.scenario || '用户有一个模糊产品想法，准备交给 Codex / Claude Code / Cursor 开发前，需要先想清楚需求和边界';
  const problem = brief.ideaInput.problem || '用户知道想做什么，但缺少产品、业务和技术拆解能力，容易把第一版做成大而全的问卷或平台';
  return {
    productOneLiner: makeSuggestion(
      `面向${targetUser}的 AI 产品构思 Copilot，帮助他们在 ${scenario} 时，把“${idea}”收敛成可开发的 V1 方案。`,
      '先用一句话固定用户、场景、任务和结果，避免后续功能发散。',
      ['如果目标用户过宽，后续 MVP 会失焦。'],
      ['先做纯前端构思工具', '先做对话式 Agent']
    ),
    targetUser: makeSuggestion(targetUser, '目标用户越具体，技术和范围判断越容易落地。'),
    scenario: makeSuggestion(scenario, '场景决定用户在哪一步最需要帮助，也决定页面流程。'),
    corePainPoint: makeSuggestion(problem, '痛点绑定到具体任务，而不是泛泛的“效率低”。'),
    alternatives: makeSuggestion(['直接问 ChatGPT', '自己写 PRD', '照着竞品做页面', '直接让 Cursor 开始写代码'], '替代方案说明用户并非没有选择，本产品必须提供更结构化的前期思考价值。'),
    aiValue: makeSuggestion('AI 介入在“补全用户不知道的专业判断”环节：根据用户输入推断产品定义、业务假设、技术架构、数据结构和验收标准。', '这比单纯评价答案更接近 Copilot：AI 主动生成草案，用户负责确认和修正。'),
  };
}

function mockBusinessSuggestions(brief: ProductBrief): BusinessFramingState {
  const product = acceptedText(brief.stages.product.productOneLiner) || brief.ideaInput.rawIdea;
  return {
    userValue: makeSuggestion(`用户可以把模糊想法快速变成结构化开发前说明，减少反复返工和无效编码。`, `围绕“${product}”的核心价值应是降低前期构思成本，而不是堆功能。`),
    ownerValue: makeSuggestion('产品所有者可以验证新手是否愿意在写代码前使用结构化构思工具，并沉淀可复用模板。', 'V1 先验证使用意愿和交付质量，不急于商业化。'),
    valueHypothesis: makeSuggestion('如果 AI 生成的技术规划和 Development Prompt 足够具体，用户会更愿意先完成构思再开始 vibe coding。', '这是本产品最关键的可验证假设。'),
    metrics: makeSuggestion(['完成一次构思流程的比例', '用户接受 AI 建议的比例', '最终复制 Development Prompt 的次数', '用户返回修改建议的次数'], '指标围绕核心闭环，而不是泛泛统计访问量。'),
    monetization: makeSuggestion('V1 不优先商业化；后续可基于高级模板、项目历史、多模型优化和团队协作收费。', '商业化需要建立在用户反复使用和产出质量稳定之后。'),
    risksAndBlindSpots: makeSuggestion(['用户可能仍然想跳过思考直接写代码', 'AI 建议如果太泛会变成另一个问卷', '技术规划需要避免过度工程化'], '业务风险主要来自行为习惯和输出质量。'),
  };
}

function mockTechnicalSuggestions(): TechnicalPlanningState {
  return {
    frontend: makeSuggestion('V1 推荐单页 Web App，使用 React + Vite + TypeScript + CSS/Tailwind。', '构思流程适合表单、卡片、阶段导航和本地状态，SPA 足够验证闭环。', ['页面状态较多，需要做好数据归一化。'], ['Next.js 多页面应用', '纯对话式 Agent 界面']),
    backend: makeSuggestion('V1 本身不需要业务后端；只需要一个同源 AI Proxy 用于隐藏 API 调用和规避 CORS。', '用户配置自己的 API，但浏览器不应直接请求第三方接口。', ['代理需要部署平台支持 serverless function。'], ['完全本地 mock', 'Supabase Edge Function']),
    database: makeSuggestion('V1 暂不需要数据库，使用 localStorage 保存项目历史和用户配置。', '当前主要验证生成流程，不需要跨设备账号和团队协作。', ['浏览器清缓存会丢失数据。'], ['静态 JSON', 'IndexedDB', 'Supabase / PostgreSQL']),
    aiApi: makeSuggestion('需要 AI API，但应由同源 /api/ai-proxy 转发；前端只保存用户配置并调用本项目代理。', 'API key 直接暴露给第三方跨域请求不稳定，也容易遇到 CORS。', ['用户仍需信任本地/部署环境。'], ['后端环境变量统一配置', '完全离线 mock']),
    auth: makeSuggestion('V1 不需要认证。', '单用户本地构思工具先降低使用门槛，账号系统会显著增加范围。', ['无法跨设备同步。'], ['后续接 Supabase Auth', '邮箱 magic link']),
    fileUpload: makeSuggestion('V1 不需要文件上传。', '当前输入主要是文字想法和用户确认，不需要处理文件内容。', ['无法直接读取 PRD 或截图。'], ['V2 支持上传 PRD/截图辅助分析']),
    dataFlow: makeSuggestion('输入 rawIdea → AI 生成 Product/Business/Technical/MVP 建议 → 用户接受或编辑 → Optimize 生成 Final Handoff → 复制/下载 Development Prompt。', '这个流转让 AI 承担专业补全，用户承担确认。'),
    mockStrategy: makeSuggestion('无 API 配置或调用失败时，使用本地 mock suggestion 保证流程可跑通。', 'V1 演示不应被模型配置阻塞。'),
    architectureUpgrade: makeSuggestion('当需要跨设备历史、账号、团队协作、文件上传或付费时，再升级到 Supabase/PostgreSQL + Auth + Storage。', '把升级条件写清楚，可以防止 V1 过度工程化。'),
  };
}

function mockMvpSuggestions(brief: ProductBrief): MvpScopeState {
  const allText = JSON.stringify(brief.ideaInput) + JSON.stringify(brief.stages.product);
  const creep = detectScopeCreep(allText);
  return {
    mustHave: makeSuggestion(['产品想法输入', '产品理解 AI 建议与编辑确认', '技术规划 AI 推荐', 'MVP 范围收敛', '最终 Development Prompt 生成与复制'], 'Must Have 只保留能完成“从想法到开发交付”的闭环。'),
    shouldHave: makeSuggestion(['历史记录', '重新生成建议', '解释推荐原因', 'Markdown 下载'], '这些提升可用性，但不应阻塞核心闭环。'),
    outOfScope: makeSuggestion(['团队协作', '支付系统', '复杂项目管理', '自动代码生成', '上线部署流水线'], '这些会把 V1 做成大平台，暂时排除。'),
    v2Later: makeSuggestion(['账号同步', '多项目空间', '上传 PRD/截图', '竞品对比模板', '多模型评分'], 'V2 再根据用户反馈选择。'),
    minimumLoop: makeSuggestion('用户输入一个模糊想法，AI 生成并解释关键产品/业务/技术/MVP 决策，用户确认后得到可复制的 Development Prompt。', '最小闭环必须能独立产生开发价值。'),
    scopeRisks: makeSuggestion(creep.length ? [`检测到范围膨胀词：${creep.join('、')}`, 'V1 建议压缩为一个核心闭环'] : ['当前范围可控，但仍需避免加入账号、团队和自动部署。'], '范围风险来自“想一次性做完整平台”的倾向。'),
    scopeCreepWarning: creep.length ? '当前想法有范围膨胀风险。V1 建议压缩为一个核心闭环。' : undefined,
  };
}

function normalizeSuggestionMap<T extends Record<string, AiSuggestion | undefined>>(
  fallback: T,
  aiValue: Partial<Record<keyof T, Partial<AiSuggestion>>> | null
): T {
  if (!aiValue) return fallback;
  const output = { ...fallback } as T;
  Object.keys(fallback).forEach((key) => {
    const k = key as keyof T;
    const base = fallback[k];
    const incoming = aiValue[k];
    if (base && incoming?.value !== undefined) {
      output[k] = {
        ...base,
        ...incoming,
        accepted: Boolean(incoming.accepted),
        editedByUser: Boolean(incoming.editedByUser),
      } as T[keyof T];
    }
  });
  return output;
}

export async function suggestStage(stage: 'product', brief: ProductBrief): Promise<ProductFramingState>;
export async function suggestStage(stage: 'business', brief: ProductBrief): Promise<BusinessFramingState>;
export async function suggestStage(stage: 'technical', brief: ProductBrief): Promise<TechnicalPlanningState>;
export async function suggestStage(stage: 'mvp', brief: ProductBrief): Promise<MvpScopeState>;
export async function suggestStage(stage: FramingStage, brief: ProductBrief): Promise<Partial<CopilotStages[FramingStage]>> {
  const fallback = stage === 'product'
    ? mockProductSuggestions(brief)
    : stage === 'business'
      ? mockBusinessSuggestions(brief)
      : stage === 'technical'
        ? mockTechnicalSuggestions()
        : mockMvpSuggestions(brief);

  const ai = await callCopilotJson<Record<string, Partial<AiSuggestion>>>(
    `你是 AI 辅助的 Vibe Coding 产品前期构思 Copilot。请基于用户输入生成 ${stage} 阶段建议。
要求：
1. 只返回 JSON，不要 Markdown。
2. 每个字段格式必须是 {"value": string 或 string[], "reason": string, "risks": string[], "alternatives": string[]}。
3. 技术规划必须包含推荐方案、推荐理由、风险、替代方案，避免过度工程化。
4. MVP 阶段如果发现范围膨胀，必须给出 scopeCreepWarning。`,
    buildBriefContext(brief),
    2200
  );

  return normalizeSuggestionMap(fallback as Record<string, AiSuggestion>, ai) as Partial<CopilotStages[FramingStage]>;
}

export async function explainSuggestion(section: string, brief: ProductBrief): Promise<string> {
  const ai = await callCopilotJson<{ explanation: string }>(
    '你是产品和技术架构导师。请解释为什么推荐这个方案，语言要适合 vibe coding 新手。只返回 JSON：{"explanation":"..."}',
    `要解释的项：${section}\n\n当前项目上下文：\n${buildBriefContext(brief)}`,
    600
  );
  return ai?.explanation || `推荐“${section}”是为了让 V1 先验证核心闭环，避免一开始引入数据库、认证、复杂后端等会拖慢开发的能力。`;
}

function buildMockHandoff(brief: ProductBrief): FinalHandoff {
  const product = brief.stages.product;
  const business = brief.stages.business;
  const technical = brief.stages.technical;
  const mvp = brief.stages.mvp;
  const productBrief = `产品定义：${acceptedText(product.productOneLiner) || brief.ideaInput.rawIdea}\n目标用户：${acceptedText(product.targetUser)}\n使用场景：${acceptedText(product.scenario)}\n核心痛点：${acceptedText(product.corePainPoint)}\nAI 介入价值：${acceptedText(product.aiValue)}`;
  const mvpScope = `Must Have：${acceptedText(mvp.mustHave)}\nShould Have：${acceptedText(mvp.shouldHave)}\nOut of Scope：${acceptedText(mvp.outOfScope)}\n最小闭环：${acceptedText(mvp.minimumLoop)}`;
  const technicalArchitecture = `前端：${acceptedText(technical.frontend)}\n后端：${acceptedText(technical.backend)}\n数据库：${acceptedText(technical.database)}\nAI API：${acceptedText(technical.aiApi)}\n认证：${acceptedText(technical.auth)}\n文件上传：${acceptedText(technical.fileUpload)}\n架构升级条件：${acceptedText(technical.architectureUpgrade)}`;
  const dataStructure = `Core entities:\n- IdeaInput { rawIdea, targetUser?, scenario?, problem?, projectType? }\n- AiSuggestion<T> { value, reason, risks, alternatives, accepted, editedByUser }\n- FinalHandoff { productBrief, mvpScope, technicalArchitecture, dataStructure, acceptanceCriteria, developmentPrompt }\n\n数据流：${acceptedText(technical.dataFlow)}`;
  const acceptanceCriteria = [
    '用户可以只填写 rawIdea 并继续流程。',
    '每个阶段都有 AI 建议、理由、风险和替代方案。',
    '用户可以接受、编辑、重新生成或请求解释建议。',
    '技术规划页不强迫用户手写架构。',
    '最终 Development Prompt 包含产品目标、页面结构、数据结构、技术方案和验收标准。',
  ].join('\n');
  const developmentPrompt = `# Development Prompt\n\n## 产品目标\n${productBrief}\n\n## 业务判断\n用户价值：${acceptedText(business.userValue)}\n产品所有者价值：${acceptedText(business.ownerValue)}\n价值假设：${acceptedText(business.valueHypothesis)}\n指标：${acceptedText(business.metrics)}\n\n## MVP Scope\n${mvpScope}\n\n## Technical Architecture\n${technicalArchitecture}\n\n## Data Structure\n${dataStructure}\n\n## Acceptance Criteria\n${acceptanceCriteria}\n\n## V1 不做\n${acceptedText(mvp.outOfScope)}\n`;
  return { productBrief, mvpScope, technicalArchitecture, dataStructure, acceptanceCriteria, developmentPrompt };
}

export async function optimizeHandoff(brief: ProductBrief): Promise<FinalHandoff> {
  const fallback = buildMockHandoff(brief);
  const ai = await callCopilotJson<FinalHandoff>(
    `你是资深产品架构师和 AI 编程交付专家。请把用户输入与 AI 建议整合为高质量 Developer Handoff。
只返回 JSON，字段必须为：productBrief, mvpScope, technicalArchitecture, dataStructure, acceptanceCriteria, developmentPrompt。
Development Prompt 必须可直接交给 Codex / Claude Code / Cursor 执行，包含产品目标、技术栈、页面结构、用户流程、功能需求、数据结构、mock data、验收标准、V1 不做事项。`,
    buildBriefContext(brief),
    3200
  );

  return {
    productBrief: ai?.productBrief || fallback.productBrief,
    mvpScope: ai?.mvpScope || fallback.mvpScope,
    technicalArchitecture: ai?.technicalArchitecture || fallback.technicalArchitecture,
    dataStructure: ai?.dataStructure || fallback.dataStructure,
    acceptanceCriteria: ai?.acceptanceCriteria || fallback.acceptanceCriteria,
    developmentPrompt: ai?.developmentPrompt || fallback.developmentPrompt,
  };
}

// --- Public API ---

export async function evaluateStep(req: EvaluateRequest): Promise<EvaluateResponse> {
  const config = getAIConfig();
  if (config) {
    try {
      const result = await callDirectAI(req, config);
      await new Promise((r) => setTimeout(r, 200));
      return result;
    } catch (err) {
      console.warn('AI API failed, falling back to mock:', err);
    }
  }

  // Local mock fallback
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
  return buildMockResponse(req.step, req.userAnswer);
}

export async function getStepHint(step: StepConfig): Promise<string> {
  const config = getAIConfig();
  if (config) {
    try {
      const hintSystemPrompt = buildSystemPrompt({
        step,
        userAnswer: '',
        rawIdea: '',
        allSteps: {},
        mode: 'hint',
      });

      const data = await callAIProxy(config, {
        model: config.model,
        messages: [
          { role: 'system', content: hintSystemPrompt },
          { role: 'user', content: '我不知道怎么回答这个问题，请给我一些提示方向。' },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });
      const content = extractAIContent(data);
      if (content) return content;
    } catch {
      // Fall through to mock
    }
  }

  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
  const hints = STEP_HINTS[step.key];
  return hints ? getRandomItem(hints) : '试着想象一个具体的用户场景，然后把你看到的写下来。';
}

export async function askFollowUp(req: EvaluateRequest): Promise<string> {
  const config = getAIConfig();
  if (config) {
    try {
      const result = await callDirectAI({ ...req, mode: 'followup' }, config);
      return result.followUp || '';
    } catch {
      // Fall through to mock
    }
  }

  await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
  return '你可以从哪个角度继续深入思考？试着补充一个具体的数字或场景。';
}

export async function generateDevelopmentPrompt(
  rawIdea: string,
  steps: Record<string, StepData>
): Promise<string> {
  await new Promise((r) => setTimeout(r, 800));

  const getAnswer = (key: string) => steps[key]?.userAnswer || '';

  let prompt = `# Development Prompt\n\n`;
  prompt += `## 产品目标\n\n${rawIdea}\n\n---\n\n`;
  prompt += `## 目标用户\n\n${getAnswer('targetUser')}\n\n`;
  prompt += `## 使用场景与核心痛点\n\n`;
  prompt += `**场景**：${getAnswer('scenario')}\n\n`;
  prompt += `**痛点**：${getAnswer('painPoint')}\n\n`;
  prompt += `**现有替代方案**：${getAnswer('alternatives')}\n\n`;
  if (getAnswer('aiValue')) {
    prompt += `## AI 介入价值\n\n${getAnswer('aiValue')}\n\n---\n\n`;
  } else {
    prompt += `---\n\n`;
  }
  prompt += `## MVP 功能范围\n\n${getAnswer('mvpScope')}\n\n`;
  prompt += `## 暂不做的功能\n\n${getAnswer('outOfScope')}\n\n---\n\n`;
  prompt += `## 技术架构\n\n${getAnswer('techStack')}\n\n`;
  prompt += `## 数据结构\n\n${getAnswer('dataStructure')}\n\n---\n\n`;
  prompt += `## 验收标准\n\n${getAnswer('acceptanceCriteria')}\n\n`;
  prompt += `---\n\n*由 VibePilot 生成 — 基于用户自己的思考结果*\n`;
  return prompt;
}
