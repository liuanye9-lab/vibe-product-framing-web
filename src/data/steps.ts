import type { StepKey } from '../types';

export interface StepConfig {
  key: StepKey;
  title: string;
  question: string;
  whyImportant: string;
  placeholder: string;
  goodExample: string;
  badExample: string;
  badExampleReason: string;
}

export const STEPS: StepConfig[] = [
  {
    key: 'targetUser',
    title: '目标用户',
    question: '请描述你的核心用户是谁',
    whyImportant:
      '没有具体用户，产品就是在为所有人做，等于为没人做。这是 90% vibe coding 产品失败的第一个原因。',
    placeholder: '越具体越好。试着描述他们的职业、经验水平、当前困境……',
    goodExample:
      '工作 2-3 年、刚开始接独立项目的 UI 设计师，主要靠朋友介绍客户，作品集做好了但不知道去哪找第一个付费客户',
    badExample: '需要提升效率的人',
    badExampleReason: '太宽泛，没有任何信息。"效率"对不同的人含义完全不同。',
  },
  {
    key: 'scenario',
    title: '使用场景',
    question: '用户在什么具体情况下需要你的产品？',
    whyImportant:
      '场景决定功能优先级。如果你不知道用户在哪里、什么时候、正在做什么任务，你就不知道第一版该做什么功能。',
    placeholder: '描述一个具体的时刻：用户正在做什么，遇到了什么障碍，为什么会在这个时候需要你的产品……',
    goodExample:
      '设计师完成了作品集网站，想主动找客户但不知道去哪找。打开浏览器搜了"如何找设计客户"，搜到一堆 Freelance 平台但竞争太激烈，不知道怎么冷启动。',
    badExample: '用户需要提高工作效率的时候',
    badExampleReason: '这不是场景，这是空话。"提高效率"可以是任何时间、任何地点。',
  },
  {
    key: 'painPoint',
    title: '核心痛点',
    question: '用户当前最难、最慢或最容易出错的地方是什么？',
    whyImportant:
      '痛点不够痛，就没有理由让用户切换到你这里。如果你的产品只是"稍好一点"，用户不会改变习惯。',
    placeholder: '具体描述：用户现在做这件事要花多长时间？出错率多高？在哪里卡住？',
    goodExample:
      '不知道在哪里找第一个客户，写了 20 封 cold email 只有 2 个回复，报价不知道该怎么定（高了怕吓跑，低了亏本），每次都从零开始沟通需求',
    badExample: '现有的工具不够好用',
    badExampleReason: '你说不清"不够好用"具体是哪里不好用，就没法做出有针对性的功能。',
  },
  {
    key: 'alternatives',
    title: '现有替代方案',
    question: '用户现在怎么解决这个问题？他们用的是什么工具或方法？',
    whyImportant:
      '如果你不知道用户现在怎么解决问题，你就无法说明你的产品为什么值得他们切换。每个"没有替代品"的产品，往往是没有真实需求的产品。',
    placeholder: '列出用户当前使用的工具、平台、人工方法，甚至是"忍着不做"……',
    goodExample:
      '1) 在 Dribbble/Behance 发作品集等客户主动联系（被动，效率低）2) 在 Freelancer/Upwork 投标（竞争激烈，新人没优势）3) 朋友圈/小红书发接单广告（零散，不稳定）4) 找朋友介绍（不可扩展）',
    badExample: '目前没有好的解决方案',
    badExampleReason:
      '几乎不存在"完全没有替代方案"的事。用户即使不用工具，也会用 Excel、微信群、甚至纸笔。',
  },
  {
    key: 'aiValue',
    title: 'AI 是否必要',
    question: '你的产品中，AI 在哪个具体环节介入？如果不用 AI，用户怎么做？',
    whyImportant:
      'AI 不是万能的，乱加 AI 会让产品变复杂、变慢、变贵。你必须能说清楚 AI 具体解决了哪个环节的什么问题。',
    placeholder: '描述 AI 介入的具体环节、输入输出，以及如果不用 AI 用户的替代方案……',
    goodExample:
      'AI 介入环节：根据目标公司所在行业和设计师作品风格，生成个性化 cold email 开场白。如果不用 AI：设计师自己写，但大多数人不擅长写销售文案，20 封只有 2 个回复。',
    badExample: 'AI 智能分析用户需求，自动推荐最佳方案',
    badExampleReason:
      '这是空话。"智能分析""自动推荐"没有说明 AI 具体做什么、输入输出是什么、为什么比不用 AI 好。',
  },
  {
    key: 'mvpScope',
    title: 'MVP 功能范围',
    question: '第一版只做哪些功能？请按优先级排列。',
    whyImportant:
      '第一版永远只做一件事，做完才算完。如果你第一版想做 10 件事，结果就是 10 件事都没做完。',
    placeholder:
      '列出 3-5 个功能，标注每个是 P0（必须有）/P1（最好有）/P2（以后再说）。第一版 P0 不超过 3 个。',
    goodExample:
      'P0: 1) 设计师填写资料（作品集链接、擅长风格）2) 输入目标公司信息，AI 生成 cold email 草稿 3) 编辑和复制生成的邮件\nP1: 发送记录管理\nP2: 回复率统计',
    badExample:
      'P0: 用户注册登录、个人主页、AI 聊天、社区论坛、数据分析看板、支付系统、通知推送',
    badExampleReason: '7 个 P0 功能不是 MVP，这是一个完整产品。第一版不可能做完。',
  },
  {
    key: 'outOfScope',
    title: '暂时不做的功能',
    question: 'V1 明确不做什么？',
    whyImportant:
      '能说清楚不做什么，比说清楚做什么更难。不做什么决定了你的产品边界，防止越做越大。',
    placeholder: '列出至少 3 个你明确不在第一版做的功能，以及为什么以后再做……',
    goodExample:
      '1) 支付系统（V1 先手动确认，验证需求后再加）2) 用户注册/登录（V1 用 localStorage，降低门槛）3) 社区/评论功能（V1 先验证核心功能是否有人用）4) 移动端适配（先做好桌面版）',
    badExample: '暂无',
    badExampleReason: '如果你觉得"什么都不排除"，说明你的 MVP 还是太大。',
  },
  {
    key: 'techStack',
    title: '技术架构',
    question: '推荐使用什么技术栈？是否真的需要后端和数据库？',
    whyImportant:
      'V1 用最简单的技术，不要过度工程化。很多 vibe coding 项目一上来就搞微服务、数据库、Docker，结果产品还没做出来就花了一周搭架构。',
    placeholder: '前端用什么？是否需要后端？是否需要数据库？AI 调用怎么处理？用什么部署？',
    goodExample:
      '前端：React + Vite + Tailwind。后端：不需要，纯前端。数据：localStorage 先跑。AI：直接调用 OpenAI API（Vercel Edge Function 代理）。部署：Vercel 免费版。',
    badExample:
      '前端 React + Next.js，后端 Node.js + Express + PostgreSQL + Redis + Docker + Nginx，CI/CD 用 GitHub Actions',
    badExampleReason:
      '一个人做 MVP 不需要微服务架构。如果你 V1 真的需要这么多东西，说明你的产品可能太复杂了。',
  },
  {
    key: 'dataStructure',
    title: '数据结构',
    question: '核心实体是什么？需要存储哪些字段？',
    whyImportant:
      '核心实体是什么？不想清楚就会写出烂代码。数据结构决定了你的代码怎么组织。',
    placeholder: '列出你的产品中最核心的 1-2 个实体，以及它们包含的字段……',
    goodExample:
      'Designer { id, name, portfolioUrl, style, targetIndustry }\nProspect { id, companyName, contactEmail, industry, generatedEmail, status }',
    badExample: '用户、内容、设置、日志、通知等',
    badExampleReason: '这不是数据结构，这是功能列表。数据结构要说明具体字段和类型。',
  },
  {
    key: 'acceptanceCriteria',
    title: '验收标准',
    question: '什么情况算产品做完了？列出可测试的条件。',
    whyImportant:
      '写不出验收标准，说明你还没想清楚。验收标准不是"体验好""页面好看"，而是具体的、可观察、可测试的条件。',
    placeholder: '列出 4-6 条具体的验收条件，每条都应该是可以明确判断"做了"或"没做"的……',
    goodExample:
      '1) 用户可填写个人资料并保存到 localStorage\n2) 输入公司名称后，AI 在 5 秒内生成邮件草稿\n3) 用户可编辑 AI 生成内容并复制\n4) 已发送记录列表可正确显示\n5) AI 接口失败时显示友好提示',
    badExample: '产品体验流畅、页面设计精美、功能完善',
    badExampleReason:
      '"体验流畅""设计精美"无法测试。验收标准必须是可以明确判断的客观条件。',
  },
];

export const STEP_KEYS: StepKey[] = STEPS.map((s) => s.key);
