import type { StepData } from '../types';
import type { StepConfig } from '../data/steps';

interface EvaluateRequest {
  step: StepConfig;
  userAnswer: string;
  rawIdea: string;
  allSteps: Record<string, StepData>;
}

interface EvaluateResponse {
  evaluation: string;
  quality: 'specific' | 'ok' | 'vague';
  followUp: string;
}

// --- Quality Judgment ---

function judgeQuality(answer: string, stepKey: string): 'specific' | 'ok' | 'vague' {
  if (!answer || answer.trim().length < 10) return 'vague';

  // Vague signals: generic phrases
  const vaguePatterns = [
    '所有人', '大家', '用户', '提高效率', '更好用', '用户体验',
    '智能化', '自动化', '一站式', '全方位', '综合',
  ];
  const isVague = vaguePatterns.some((p) => answer.includes(p)) && answer.length < 30;

  // Specific signals: numbers, concrete details, specific scenarios
  const hasConcrete =
    (/\d/.test(answer) && answer.length > 30) ||
    (answer.length > 60 && /[，,。.；;]/.test(answer));

  // Step-specific checks
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

// --- Per-step evaluation templates ---

const EVALUATION_TEMPLATES: Record<string, Record<string, { evaluation: string; followUp: string }>> = {
  targetUser: {
    specific: {
      evaluation: '很好！你清楚描述了用户的身份、经验和当前困境。这个用户画像足够具体，可以用来验证产品方向——你可以想象这个人坐在你对面，你知道他叫什么、做什么、遇到了什么困难。',
      followUp: '这类用户最有可能通过什么渠道发现你的产品？他们现在的上网习惯是什么？',
    },
    ok: {
      evaluation: '方向对了，但还可以更具体。你描述了大致的用户群体，但缺少一些关键细节。一个好的用户画像应该让你能想象出一个真实存在的人。',
      followUp: '试着补充：他们的经验水平是什么？当前用什么方式解决问题？最大的障碍是哪一件事？',
    },
    vague: {
      evaluation: '这个描述太宽泛了。"所有人"或"需要XX的人"不是一个用户画像，这是在逃避定义用户。如果你的产品给所有人用，那等于给没人用。',
      followUp: '闭上眼睛，想象你的第一个真实用户——他叫什么、做什么工作、今天遇到了什么具体问题？用一句话描述他。',
    },
  },
  scenario: {
    specific: {
      evaluation: '场景很清晰！我能想象出用户在那个时刻遇到了什么障碍。有了具体场景，你就知道第一版应该优先做什么功能。',
      followUp: '在这个场景中，用户从发现障碍到尝试解决，通常会经历哪几个步骤？哪一步最耗时？',
    },
    ok: {
      evaluation: '大致场景有了，但缺少具体的情境细节。一个好的场景描述应该让读者感受到"我确实遇到过这种情况"。',
      followUp: '补充一下：用户在哪里（物理位置/数字平台）？他正在用什么工具？被打断之前他在做什么？',
    },
    vague: {
      evaluation: '这不是场景描述。场景应该是"用户在XX时刻，正在做XX事，遇到了XX问题"。你写的内容更像是功能需求而不是使用场景。',
      followUp: '想象你的用户今天打开电脑/手机，他做的第一件事是什么？在哪里卡住了？',
    },
  },
  painPoint: {
    specific: {
      evaluation: '痛点很真实！你描述了具体的困难、量化的影响（时间/频率/出错率）。这种痛点是值得用产品去解决的——用户会因为这个痛点愿意尝试新工具。',
      followUp: '这个痛点发生的频率有多高？用户每次遇到要花多长时间解决？他们现在对这个问题的容忍度是多少？',
    },
    ok: {
      evaluation: '痛点方向对了，但还需要更具体。"效率低""不好用"是感受，不是痛点。需要量化——到底低多少？哪里不好用？',
      followUp: '试着回答：用户现在做这件事要花多长时间？出错率多高？一个月会遇到几次？',
    },
    vague: {
      evaluation: '这不是痛点，这是口号。"体验不好""效率不高"无法验证也无法解决。痛点应该是用户在做某件具体事情时遇到的真实困难。',
      followUp: '想象你的用户今天刚遇到这个问题——具体发生了什么？他在哪一步卡住了？最后怎么解决的？',
    },
  },
  alternatives: {
    specific: {
      evaluation: '很好！你清楚列出了用户当前使用的替代方案。这说明你做过调研——知道用户现在怎么解决问题，才能说明你的产品为什么值得切换。',
      followUp: '在这么多替代方案中，你觉得用户最不满意的是哪一个？为什么？',
    },
    ok: {
      evaluation: '方向对了，但你可能遗漏了一些替代方案。用户可能不用任何工具——Excel、微信群、纸笔、甚至"忍着不做"都是替代方案。',
      followUp: '除了你列出的，有没有用户会选择"不做这件事"或"用最笨的方法"的情况？',
    },
    vague: {
      evaluation: '几乎不存在"完全没有替代方案"的事。如果你真的想不出来，说明你还没了解用户现在怎么做这件事。',
      followUp: '问一个真实的潜在用户："你现在怎么解决这个问题？" 他的回答就是你的替代方案。',
    },
  },
  aiValue: {
    specific: {
      evaluation: '很清晰！你说明了 AI 介入的具体环节、输入输出、以及相比不用 AI 的优势。这样你的技术方案就有明确的方向了。',
      followUp: '如果 AI 生成的结果不好，用户有退路吗？这个环节是不是可以用人工替代？',
    },
    ok: {
      evaluation: '大致说明了 AI 的作用，但还不够具体。需要说清楚：AI 的输入是什么？输出是什么？为什么这件事不用 AI 就做不好？',
      followUp: '补充：AI 具体接收什么信息？输出什么结果？如果 AI 输出错误，影响有多大？',
    },
    vague: {
      evaluation: '"智能分析""自动推荐"是空话，不是产品方案。你需要说清楚 AI 在哪个环节、做什么、输入输出是什么。',
      followUp: '去掉所有"智能""AI"这样的词，用大白话说：用户输入什么 → 系统做了什么 → 用户得到什么？',
    },
  },
  mvpScope: {
    specific: {
      evaluation: '功能范围很清晰，优先级划分合理。一个好的 MVP 应该让用户完成一个完整的闭环——从开始到结束。',
      followUp: '如果只保留 P0 功能，用户能走完一个完整的流程吗？如果不能，缺了哪一步？',
    },
    ok: {
      evaluation: '功能列表有了，但优先级可能不够清晰。P0 应该是"没有它产品就不成立"的功能，P1 是"有了更好"、P2 是"以后再说"。',
      followUp: '试着砍掉一半功能——如果只能保留 2-3 个功能，你留哪几个？',
    },
    vague: {
      evaluation: '这不是 MVP，这是一个完整产品规划。V1 的 P0 功能不应该超过 3 个。记住：做完一个功能比做了十个半成品强一百倍。',
      followUp: '假设你只有 3 天时间，你只能做一件事情让产品能用。你做哪个？',
    },
  },
  outOfScope: {
    specific: {
      evaluation: '很好！说清楚不做什么，和说清楚做什么一样重要。这能有效防止功能蔓延，让团队保持聚焦。',
      followUp: '在你列出的"不做"中，有没有哪个是你内心很想要的？你觉得什么时候可以开始做它？',
    },
    ok: {
      evaluation: '方向对了，但可以更坚定。每加一个"不做"的功能，都是在为你的 MVP 减负。',
      followUp: '试着再加 2 个"不做"的功能——有什么功能你觉得"以后再说但其实现在很想做"的？',
    },
    vague: {
      evaluation: '如果你觉得"什么都不排除"，说明你的 MVP 还是太大。不做任何取舍的规划等于没有规划。',
      followUp: '在你想要的所有功能中，哪个最花钱/最耗时/最复杂？把它标记为"V1 不做"。',
    },
  },
  techStack: {
    specific: {
      evaluation: '技术栈选择很务实！简单、可落地、低成本启动。这是 V1 最正确的技术策略。',
      followUp: '这个技术栈中，你最不熟悉的部分是什么？你是否需要先做一个技术验证？',
    },
    ok: {
      evaluation: '大致方向有了，但可以更具体。需要明确：前端用什么框架？是否需要后端？数据怎么存？AI 怎么调？部署在哪？',
      followUp: '补充：你的 AI 调用是通过前端直接调还是需要后端代理？用户数据存在哪里？',
    },
    vague: {
      evaluation: '技术栈描述不够具体。"现代技术"不是一个架构方案。你需要明确每个部分用什么技术。',
      followUp: '回答这 4 个问题：1) 前端用什么？2) 需要后端吗？3) 数据存在哪里？4) 怎么部署？',
    },
  },
  dataStructure: {
    specific: {
      evaluation: '数据结构很清晰！有了明确的数据结构，你的代码组织就有了骨架，开发效率会大大提高。',
      followUp: '这些实体之间有关系吗？比如一对多、多对多？这会影响你怎么设计页面和交互。',
    },
    ok: {
      evaluation: '方向对了，但字段可以更具体。数据结构要包含每个字段的名字和类型，这样开发时不用反复猜。',
      followUp: '补充每个实体的具体字段：id 是什么类型？有没有必填字段？有没有默认值？',
    },
    vague: {
      evaluation: '这不是数据结构，这是功能列表。数据结构要描述实体和字段——比如 User { id: string, name: string, email: string }。',
      followUp: '你的产品最核心的"东西"是什么？给它起个名字，然后列出它有哪些属性。',
    },
  },
  acceptanceCriteria: {
    specific: {
      evaluation: '验收标准很具体！每条都是可测试、可判断的条件。有了这些，你就知道"做完"是什么意思了。',
      followUp: '谁来判断这些条件是否满足？是你自己还是真实用户？有没有条件是"做了但用户不满意的"？',
    },
    ok: {
      evaluation: '方向对了，但部分标准可能还不够具体。"体验好""页面好看"不是验收条件——你需要写出可以直接用自动化测试验证的标准。',
      followUp: '把每条标准改成"Given...When...Then..."格式——这会迫使你写得更具体。',
    },
    vague: {
      evaluation: '"体验流畅""设计精美"无法测试。验收标准必须是具体的、可观察、可判断的——任何人看了都能明确说"做了"或"没做"。',
      followUp: '把"体验好"改成：用户从打开页面到完成操作，不超过 X 步、不超过 Y 秒。这样就能测了。',
    },
  },
};

// --- Step hints for "I don't know how to write" ---

const STEP_HINTS: Record<string, string> = {
  targetUser:
    '试试回答这几个问题：1) 你的用户做什么工作？2) 他工作多久了？3) 他现在的最大烦恼是什么？4) 他平时用什么工具？5) 如果用一句话向朋友介绍你的用户，你会怎么说？',
  scenario:
    '想象一部微电影：你的用户坐在电脑前，他打开了什么网站/APP？他在找什么？他点了几次没找到？他最后放弃了还是用了别的方法？把这段"剧情"写下来。',
  painPoint:
    '试试量化你的痛点：1) 用户做这件事要花多少分钟？2) 一周会做几次？3) 出错的概率有多大？4) 出错后要花多久修复？5) 他有没有因为这个痛点跟同事抱怨过？',
  alternatives:
    '做个小调查：找到 3 个你的目标用户，问他们"你现在怎么解决XX问题？"把他们的回答原封不动记下来——那就是替代方案。',
  aiValue:
    '画一个简单的流程图：用户输入什么 → 系统怎么处理 → 用户得到什么。然后问自己：中间"系统怎么处理"这一步，如果换成人工做，需要多久？AI 能把这一步变快吗？',
  mvpScope:
    '做个减法游戏：写下你想做的所有功能，然后问自己——如果用户只能用 1 个功能，他会选哪个？那就是你的 P0。以此类推。',
  outOfScope:
    '反向思考：看看你的 MVP 功能列表，哪个最耗时？哪个最复杂？哪个"以后也能加"？把这 3 个标记为 V1 不做。',
  techStack:
    '回答 4 个问题：1) 前端用什么？（推荐你熟悉的）2) 需要后端吗？（大多数 MVP 不需要）3) 数据存哪？（localStorage 就够）4) 部署在哪？（Vercel 免费版就行）',
  dataStructure:
    '你的产品核心是管理什么"东西"？给这个"东西"起个英文名（比如 Task、User、Order），然后列出它有哪些属性。再想想有没有第二个核心实体。',
  acceptanceCriteria:
    '想象你做完产品后给朋友演示。你说"你看，这个产品可以…"——把你说的每句话变成一条验收标准。比如"你看，用户可以填资料并保存"就是一条。',
};

function buildResponse(step: StepConfig, answer: string): EvaluateResponse {
  const quality = judgeQuality(answer, step.key);
  const templates = EVALUATION_TEMPLATES[step.key];
  const template = templates?.[quality];

  return {
    evaluation: template?.evaluation || getDefaultEvaluation(quality, answer),
    quality,
    followUp: template?.followUp || getDefaultFollowUp(quality),
  };
}

function getDefaultEvaluation(quality: string, _answer: string): string {
  if (quality === 'specific') return '这个答案很具体，能看出你做了认真的思考。继续保持这种具体化的表达方式。';
  if (quality === 'ok') return '方向不错，但可以更具体。试着加上数字、场景细节或具体案例——越具体越好。';
  return '这个答案太模糊了，几乎适用于任何产品。请回到问题本身，想象一个真实用户的具体情况。';
}

function getDefaultFollowUp(quality: string): string {
  if (quality === 'specific') return '你觉得这个答案有没有遗漏什么？有没有边界情况你没考虑到？';
  if (quality === 'ok') return '试着在答案里加上至少一个具体的数字或场景——这会让答案从"还行"变成"很好"。';
  return '如果只能用一句话、不带任何形容词来描述，你会怎么说？';
}

export async function evaluateStep(req: EvaluateRequest): Promise<EvaluateResponse> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 600));
  return buildResponse(req.step, req.userAnswer);
}

export async function getStepHint(step: StepConfig, _rawIdea: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));
  return STEP_HINTS[step.key] || '试着想象一个具体的用户场景，然后把你看到的写下来。不用追求完美，先写再说。';
}

export async function generateDevelopmentPrompt(
  rawIdea: string,
  steps: Record<string, StepData>
): Promise<string> {
  await new Promise((r) => setTimeout(r, 800));

  const getAnswer = (key: string) => steps[key]?.userAnswer || '';

  let prompt = `# Development Prompt\n\n`;
  prompt += `## 产品目标\n\n${rawIdea}\n\n---\n\n`;

  // Target user
  prompt += `## 目标用户\n\n${getAnswer('targetUser')}\n\n`;

  // Scenario & pain point
  prompt += `## 使用场景与核心痛点\n\n`;
  prompt += `**场景**：${getAnswer('scenario')}\n\n`;
  prompt += `**痛点**：${getAnswer('painPoint')}\n\n`;
  prompt += `**现有替代方案**：${getAnswer('alternatives')}\n\n`;

  // AI value
  if (getAnswer('aiValue')) {
    prompt += `## AI 介入价值\n\n${getAnswer('aiValue')}\n\n---\n\n`;
  } else {
    prompt += `---\n\n`;
  }

  // MVP scope
  prompt += `## MVP 功能范围\n\n${getAnswer('mvpScope')}\n\n`;
  prompt += `## 暂不做的功能\n\n${getAnswer('outOfScope')}\n\n---\n\n`;

  // Technical
  prompt += `## 技术架构\n\n${getAnswer('techStack')}\n\n`;
  prompt += `## 数据结构\n\n${getAnswer('dataStructure')}\n\n---\n\n`;

  // Acceptance criteria
  prompt += `## 验收标准\n\n${getAnswer('acceptanceCriteria')}\n\n`;

  prompt += `---\n\n*由 VibePilot 生成 — 基于用户自己的思考结果*\n`;
  return prompt;
}
