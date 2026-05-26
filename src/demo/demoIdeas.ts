import type { IdeaInputState } from '../types';

export const DEMO_IDEAS: Array<{ label: string; ideaInput: IdeaInputState }> = [
  {
    label: '雅思生词错题工具',
    ideaInput: {
      rawIdea: '我想做一个雅思生词和错题管理工具，帮助我记录剑桥雅思真题里的生词、同义替换和错题原因，并能导出复盘内容。',
      targetUser: '正在备考雅思、需要系统复盘阅读和听力错题的学生',
      scenario: '做完剑桥雅思真题后，需要整理生词、同义替换和错题原因',
      problem: '生词和错题分散在纸质笔记、截图和脑子里，无法形成可复盘的词块和错误模式',
      projectType: 'Web App',
    },
  },
  {
    label: 'PromptEval Lab',
    ideaInput: {
      rawIdea: '我想做一个面向设计学生的 Prompt 调优与输出评测系统，用来记录不同版本 prompt 的生图效果、评分和复盘。',
      targetUser: '环境设计、视觉设计、室内设计学生',
      scenario: '使用 AI 生图完成概念图或展板图时',
      problem: 'Prompt 靠感觉写，生成结果不稳定，好图无法复现，也没有评分标准',
      projectType: 'Web App',
    },
  },
  {
    label: 'AI 客服质检',
    ideaInput: {
      rawIdea: '我想做一个 AI 客服回复质量评估工具，判断回复是否准确、有同理心、是否解决用户问题，并给出改写建议。',
      targetUser: '负责 AI 客服产品评测的产品经理或运营',
      scenario: '检查大模型客服回复质量时',
      problem: '只能凭感觉判断回复好坏，缺少评分标准、证据摘录和 Bad Case 复盘',
      projectType: 'Web App',
    },
  },
  {
    label: '股票投资复盘工具',
    ideaInput: {
      rawIdea: '我想做一个股票投资复盘工具，用来记录交易理由、买卖点、情绪状态、错误模式和复盘总结。',
      targetUser: '有主动投资习惯但缺少系统复盘方法的个人投资者',
      scenario: '每次交易后复盘自己的决策过程',
      problem: '交易记录只停留在盈亏结果，无法沉淀自己的错误模式和可改进策略',
      projectType: 'Web App',
    },
  },
];
