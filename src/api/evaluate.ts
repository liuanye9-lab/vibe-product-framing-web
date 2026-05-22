import type { StepData } from '../types';
import type { StepConfig } from '../data/steps';

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

// --- Check if running in production (Vercel) with API ---
function hasBackend(): boolean {
  return typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
}

// --- AI API Call (to Vercel Edge Function) ---
async function callAI(req: EvaluateRequest): Promise<EvaluateResponse> {
  const allStepsSummary: Record<string, { userAnswer: string; aiQuality: string }> = {};
  for (const [key, val] of Object.entries(req.allSteps)) {
    allStepsSummary[key] = {
      userAnswer: val.userAnswer,
      aiQuality: val.aiQuality || 'vague',
    };
  }

  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stepKey: req.step.key,
      stepTitle: req.step.title,
      stepQuestion: req.step.question,
      userAnswer: req.userAnswer,
      rawIdea: req.rawIdea,
      allSteps: allStepsSummary,
      mode: req.mode || 'evaluate',
      previousEvaluation: req.previousEvaluation,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// --- Local Mock (Fallback) ---

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

// Multiple template variants per step x quality for rotation
const EVAL_TEMPLATES: Record<string, Record<string, { evaluation: string; followUp: string }[]>> = {
  targetUser: {
    specific: [
      { evaluation: '很清晰！你描述了用户的身份、经验和当前困境，这个用户画像足够具体。', followUp: '这类用户最有可能通过什么渠道发现你的产品？' },
      { evaluation: '用户画像很具体。我能想象出这个人——知道他是谁、做什么、遇到了什么困难。', followUp: '他们的付费意愿和能力如何？他们愿意为解决这个问题花多少钱？' },
    ],
    ok: [
      { evaluation: '方向对了，但还可以更具体。尝试补充用户的经验水平和当前使用的工具。', followUp: '他们的经验水平是什么？当前用什么方式解决类似问题？' },
      { evaluation: '大致描述了用户群体，但缺少关键细节。好的用户画像应该让你能想象出一个真实的人。', followUp: '试着补充：最大障碍是什么？他们每天花多少时间在这个问题上？' },
    ],
    vague: [
      { evaluation: '这个描述太宽泛了。"所有人"或"需要XX的人"不是用户画像。如果你的产品给所有人用，等于给没人用。', followUp: '闭上眼睛，想象你的第一个真实用户——他叫什么、做什么工作、今天遇到了什么？' },
      { evaluation: '太模糊了，你几乎可以用同样的描述套到任何产品上。需要聚焦到一个具体的群体。', followUp: '如果你只能把产品推荐给一个朋友，你会推荐给谁？描述他的一天。' },
    ],
  },
  scenario: {
    specific: [
      { evaluation: '场景很清晰！我能想象出用户在那个时刻遇到了什么障碍。', followUp: '在这个场景中，从发现障碍到解决，用户会经历哪几个步骤？哪一步最耗时？' },
      { evaluation: '非常具体的场景描述。有了这个画面，你就知道第一版应该做什么功能。', followUp: '用户在这个场景中的情绪是什么？焦虑？烦躁？无所谓？' },
    ],
    ok: [
      { evaluation: '大致场景有了，但缺少情境细节。好的场景描述应该让人感到"我确实遇到过"。', followUp: '用户在哪里（物理位置/数字平台）？他正在用什么工具？被打断前在做什么？' },
      { evaluation: '场景方向对，但像在写功能需求而不是使用场景。', followUp: '用"微电影"思维重写：镜头从哪里开始？用户在做什么？转折点在哪？' },
    ],
    vague: [
      { evaluation: '这不是场景描述。场景应该是"用户在XX时刻，正在做XX事，遇到了XX问题"。', followUp: '想象你的用户今天打开电脑，他做的第一件事是什么？在哪里卡住了？' },
      { evaluation: '太抽象了。场景需要具体到时间、地点、人物、动作。', followUp: '用一句话格式重写：[谁]在[什么时候][做什么]的时候，[遇到了什么问题]。' },
    ],
  },
  painPoint: {
    specific: [
      { evaluation: '痛点很真实！你描述了具体的困难、量化的影响。这种痛点值得用产品去解决。', followUp: '这个痛点发生的频率有多高？用户每次要花多久解决？' },
      { evaluation: '痛点的描述既有具体现象又有量化影响，说明你真的了解用户。', followUp: '用户对这个问题的容忍度是多少？他们会主动寻找解决方案吗？' },
    ],
    ok: [
      { evaluation: '痛点方向对了，但需要更具体。"效率低""不好用"是感受，不是痛点。', followUp: '试着量化：做这件事要多久？出错率多高？一周遇到几次？' },
      { evaluation: '描述了困难的存在，但缺少量化数据让痛点成立。', followUp: '如果用户遇到这个问题但不解决，代价是什么？' },
    ],
    vague: [
      { evaluation: '这不是痛点，这是口号。"体验不好""效率不高"无法验证也无法解决。', followUp: '想象用户今天刚遇到这个问题——具体发生了什么？他在哪一步卡住了？' },
      { evaluation: '没有具体信息，几乎适用于任何产品。需要回到具体用户的具体困难。', followUp: '找 3 个潜在用户，问他们"最近一次遇到这个问题是什么时候？发生了什么？"' },
    ],
  },
  alternatives: {
    specific: [
      { evaluation: '很好！你清楚列出了用户的替代方案，说明做过调研。', followUp: '在这么多替代方案中，用户最不满意哪个？为什么？' },
      { evaluation: '替代方案列表很全面，连"不做"的选项都考虑到了。', followUp: '哪个替代方案的使用成本最低？你的产品能在哪个点上打败它？' },
    ],
    ok: [
      { evaluation: '方向对了，但可能遗漏了一些替代方案。Excel、微信群、"忍着不做"都是替代方案。', followUp: '除了列出的，有没有用户选择"不做这件事"的情况？' },
      { evaluation: '列出了部分替代方案，但还不够全面。', followUp: '问一个真实用户："你现在怎么解决这个问题？" 他的回答就是你的替代方案。' },
    ],
    vague: [
      { evaluation: '几乎不存在"完全没有替代方案"的事。如果你想不到，说明还没了解用户。', followUp: '问一个真实潜在用户："你现在怎么解决XX问题？"' },
      { evaluation: '替代方案描述太空泛，没有具体到工具或方法。', followUp: '把替代方案分成 3 类：工具类、人工类、"不做"类。每类列一个。' },
    ],
  },
  aiValue: {
    specific: [
      { evaluation: '很清晰！你说明了 AI 介入的具体环节、输入输出、以及相比不用 AI 的优势。', followUp: '如果 AI 生成的结果不好，用户有退路吗？' },
      { evaluation: 'AI 的价值定位很精准。不是"为了 AI 而 AI"，而是确实解决了具体问题。', followUp: '这个环节如果换成人工做，需要多久？AI 能提升多少？' },
    ],
    ok: [
      { evaluation: '大致说明了 AI 的作用，但还需要更具体。需要说清楚输入输出是什么。', followUp: '补充：AI 接收什么信息？输出什么结果？出错影响有多大？' },
      { evaluation: 'AI 的作用方向对，但边界不够清晰。', followUp: '去掉所有"智能""AI"的词，用大白话说：用户输入什么→系统做什么→得到什么？' },
    ],
    vague: [
      { evaluation: '"智能分析""自动推荐"是空话。你需要说清楚 AI 在哪个环节做什么。', followUp: '用"输入→处理→输出"的格式重写，不要用任何"智能"之类的词。' },
      { evaluation: '没有说明 AI 的具体价值，看起来像是在堆 buzzword。', followUp: '回答一个问题：如果去掉 AI 功能，这个产品还成立吗？如果成立，AI 的价值在哪？' },
    ],
  },
  mvpScope: {
    specific: [
      { evaluation: '功能范围清晰，优先级划分合理。MVP 应该让用户走完一个完整闭环。', followUp: '只保留 P0，用户能走完完整流程吗？' },
      { evaluation: 'P0/P1/P2 划分很合理，P0 数量克制。这就是好的 MVP 思维。', followUp: '做完 P0 以后，你用什么指标判断产品值得继续做？' },
    ],
    ok: [
      { evaluation: '功能列表有了，但优先级可能不够清晰。P0 应该是"没有就不成立"。', followUp: '砍掉一半功能，只能保留 2-3 个，你留哪几个？' },
      { evaluation: '功能规划有了雏形，但部分功能的优先级需要重新考虑。', followUp: '哪个功能如果不做，用户会立刻放弃？那个就是 P0。' },
    ],
    vague: [
      { evaluation: '这不是 MVP，这是完整产品规划。V1 的 P0 不应超过 3 个。', followUp: '假设只有 3 天时间，你只能做一件事让产品能用，你做哪个？' },
      { evaluation: '功能太多，说明还没有做减法。MVP 的核心是克制。', followUp: '用"功能裁剪法"：每个功能问"没有它产品还能跑吗？"不能的留下，能的砍掉。' },
    ],
  },
  outOfScope: {
    specific: [
      { evaluation: '很好！说清不做什么和说清做什么一样重要。', followUp: '在你列出的"不做"中，有没有哪个是你内心很想要的？什么时候可以做？' },
      { evaluation: '"不做"列表很清晰，每项都给出了理由。产品边界非常明确。', followUp: '第一个"不做"的功能，如果用户强烈要求，你会在什么条件下加入？' },
    ],
    ok: [
      { evaluation: '方向对了，但可以更坚定。每加一个"不做"都是在为 MVP 减负。', followUp: '再加 2 个"不做"的功能——哪个最花钱/最耗时/最复杂？' },
      { evaluation: '列了一些不做的功能，但理由可以更充分。', followUp: '对每个"不做"的回答：为什么 V1 不做？什么条件下会做？' },
    ],
    vague: [
      { evaluation: '如果你觉得"什么都不排除"，说明 MVP 还是太大。', followUp: '在所有想要的功能中，哪个最花钱/最耗时/最复杂？标记为"V1 不做"。' },
      { evaluation: '"不做"列表太短或太空泛。克制是产品经理最重要的能力之一。', followUp: '强迫自己列出 5 个"不做"的功能，并给每个一个理由。' },
    ],
  },
  techStack: {
    specific: [
      { evaluation: '技术栈选择很务实！简单、可落地、低成本启动。这是 V1 最正确的策略。', followUp: '这个技术栈中你最不熟悉的部分是什么？需要先做技术验证吗？' },
      { evaluation: '技术选型很清晰，每个部分都有明确的选择和理由。', followUp: '部署成本预估多少？能否控制在免费额度内？' },
    ],
    ok: [
      { evaluation: '大致方向有了，但可以更具体。需要明确前端、后端、数据、部署分别用什么。', followUp: '回答 4 个问题：前端？后端？数据存哪？怎么部署？' },
      { evaluation: '技术栈有方向但不够完整，某些部分还需要细化。', followUp: 'AI 调用是通过前端直接调还是后端代理？为什么这么选？' },
    ],
    vague: [
      { evaluation: '"现代技术"不是架构方案。需要明确每个部分用什么技术。', followUp: '回答 4 个问题：1) 前端用什么？2) 需要后端吗？3) 数据存哪？4) 怎么部署？' },
      { evaluation: '技术栈描述太模糊，无法据此开始开发。', followUp: '推荐你用最熟悉的 1-2 个技术，列出完整的组合方案。' },
    ],
  },
  dataStructure: {
    specific: [
      { evaluation: '数据结构清晰！有了它，代码组织就有了骨架。', followUp: '这些实体之间有关系吗？一对多、多对多？' },
      { evaluation: '实体和字段定义很明确，开发时不用反复猜数据结构。', followUp: '有没有必填字段？有没有默认值？字段的最大长度需要考虑吗？' },
    ],
    ok: [
      { evaluation: '方向对了，但字段可以更具体。需要包含每个字段的名字和类型。', followUp: '补充每个实体的字段：id 类型？必填字段？默认值？' },
      { evaluation: '数据结构有雏形但不够完整，某些关键字段可能缺失。', followUp: '你的产品最核心的操作是什么？这个操作需要哪些数据？' },
    ],
    vague: [
      { evaluation: '这不是数据结构，这是功能列表。数据结构要描述实体和字段。', followUp: '你的产品管理什么"东西"？给它起个英文名，列出它的属性。' },
      { evaluation: '太笼统了，无法据此建表或定义类型。', followUp: '用格式：实体名 { 字段名: 类型, 字段名: 类型 } 重写。' },
    ],
  },
  acceptanceCriteria: {
    specific: [
      { evaluation: '验收标准很具体！每条都可测试、可判断。有了这些就知道"做完"是什么意思。', followUp: '谁来判断这些条件满足？你自己还是真实用户？' },
      { evaluation: '非常好的验收标准，每条都可以直接写成自动化测试用例。', followUp: '有没有条件是"做了但用户不满意"的？如何预防？' },
    ],
    ok: [
      { evaluation: '方向对了，但部分标准不够具体。"体验好""页面好看"不是验收条件。', followUp: '把每条改成"Given...When...Then..."格式，这会迫使你写得更具体。' },
      { evaluation: '验收标准有雏形，但部分条件还是主观的。', followUp: '把每条标准改为：任何新人看了都能判断"做了"或"没做"。' },
    ],
    vague: [
      { evaluation: '"体验流畅""设计精美"无法测试。验收标准必须具体、可观察。', followUp: '把"体验好"改成：用户从打开到完成不超过 X 步、不超过 Y 秒。' },
      { evaluation: '这些不是验收标准，是愿望清单。验收标准必须是可判断的。', followUp: '对每条标准问自己："一个完全不认识这个项目的人，看了能判断吗？"' },
    ],
  },
};

const STEP_HINTS: Record<string, string[]> = {
  targetUser: [
    '试着回答：1) 用户做什么工作？2) 工作多久了？3) 最大烦恼是什么？4) 用什么工具？5) 用一句话怎么向朋友介绍你的用户？',
    '想象你坐在一个咖啡厅，你的目标用户坐在对面。你会怎么向朋友描述这个人？他的穿着、表情、正在做的事情是什么？',
  ],
  scenario: [
    '想象一部微电影：用户坐在电脑前，打开了什么网站？他在找什么？点了几次没找到？最后放弃了还是用了别的方法？把这段"剧情"写下来。',
    '用"时间+地点+人物+动作+障碍"五要素重写。例如"周一上午，小王在办公室用 Excel 整理数据时，发现…"',
  ],
  painPoint: [
    '量化你的痛点：1) 做这件事要多久？2) 一周做几次？3) 出错率？4) 出错后要多久修复？5) 有没有因为这个跟同事抱怨过？',
    '找 3 个真实用户，问他们"做这件事最让你抓狂的是什么？"，把他们的原话记下来。',
  ],
  alternatives: [
    '做个小调查：找到 3 个目标用户，问"你现在怎么解决XX问题？"把他们的回答原封不动记下来。',
    '分成 3 类思考：1) 他们用什么工具？2) 他们请谁帮忙？3) 他们干脆不做了吗？',
  ],
  aiValue: [
    '画一个流程图：用户输入什么→系统怎么处理→用户得到什么。然后问：中间"系统怎么处理"这一步，换成人工要多久？',
    '回答 3 个问题：1) AI 的输入是什么？2) AI 输出什么？3) 不用 AI 的话，用户要多花多少时间/金钱？',
  ],
  mvpScope: [
    '减法游戏：写下所有功能，然后问——如果用户只能用 1 个功能，他选哪个？那就是 P0。以此类推。',
    '把功能写在便利贴上，每次拿走一张，问"没有它产品还能跑吗？"能跑的就不是 P0。',
  ],
  outOfScope: [
    '反向思考：看 MVP 列表，哪个最耗时？哪个最复杂？哪个"以后也能加"？标记为 V1 不做。',
    '强迫自己列出 5 个"不做"的功能。如果列不出 5 个，说明你的 MVP 太大了。',
  ],
  techStack: [
    '回答 4 个问题：1) 前端？2) 需要后端吗？3) 数据存哪？4) 怎么部署？（推荐：Vite + localStorage + Vercel）',
    '想想你目前最熟悉的技术是什么？V1 用最熟悉的技术，别学新的。',
  ],
  dataStructure: [
    '你的产品管理什么核心"东西"？给起个英文名（如 Task、User），列出属性。再想想有第二个核心实体吗？',
    '用 JSON 格式写：{ "实体名": { "字段1": "类型", "字段2": "类型" } }。至少写 2 个实体。',
  ],
  acceptanceCriteria: [
    '想象给朋友演示。你说"你看，这个产品可以…"——把每句话变成一条验收标准。',
    '对每个 P0 功能写一条验收：用户做了什么→看到了什么→结果是什么。',
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
  // Try AI first if in production
  if (hasBackend()) {
    try {
      const result = await callAI(req);
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 300)); // minimum feel
      return result;
    } catch (err) {
      console.warn('AI API failed, falling back to mock:', err);
      // Fall through to mock
    }
  }

  // Local mock with simulated delay
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
  return buildMockResponse(req.step, req.userAnswer);
}

export async function getStepHint(step: StepConfig): Promise<string> {
  // Try AI first
  if (hasBackend()) {
    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepKey: step.key,
          stepTitle: step.title,
          stepQuestion: step.question,
          userAnswer: '',
          rawIdea: '',
          allSteps: {},
          mode: 'hint',
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.hint;
      }
    } catch {
      // Fall through to mock
    }
  }

  // Mock hint
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
  const hints = STEP_HINTS[step.key];
  return hints ? getRandomItem(hints) : '试着想象一个具体的用户场景，然后把你看到的写下来。';
}

export async function askFollowUp(req: EvaluateRequest): Promise<string> {
  // Try AI first
  if (hasBackend()) {
    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepKey: req.step.key,
          stepTitle: req.step.title,
          stepQuestion: req.step.question,
          userAnswer: req.userAnswer,
          rawIdea: req.rawIdea,
          allSteps: req.allSteps,
          mode: 'followup',
          previousEvaluation: req.previousEvaluation,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.followUp;
      }
    } catch {
      // Fall through to mock
    }
  }

  // Mock follow-up
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
