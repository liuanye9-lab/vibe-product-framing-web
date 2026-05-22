import type { StepData } from '../types';
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

// --- Direct AI Call (OpenAI-compatible) ---

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

  // Normalize API URL: remove trailing slash
  const baseUrl = config.apiUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/v1/chat/completions`;

  const systemPrompt = buildSystemPrompt(req);

  const userMessage = req.mode === 'evaluate'
    ? req.userAnswer
    : req.mode === 'hint'
      ? '我不知道怎么回答这个问题，请给我一些提示方向。'
      : '我想继续追问，请帮我深入思考。';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: req.mode === 'evaluate' ? 500 : 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API 返回错误 (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

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
      const baseUrl = config.apiUrl.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/v1/chat/completions`;

      const hintSystemPrompt = buildSystemPrompt({
        step,
        userAnswer: '',
        rawIdea: '',
        allSteps: {},
        mode: 'hint',
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: hintSystemPrompt },
            { role: 'user', content: '我不知道怎么回答这个问题，请给我一些提示方向。' },
          ],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        if (content) return content;
      }
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
