/**
 * Agent V3 Contracts
 *
 * Defines each Agent's mission, allowed commands, forbidden behaviors,
 * and output rules. Contracts enforce capability boundaries.
 */

import type { AgentRole, AgentCommandType } from './types';

export interface AgentContract {
  role: AgentRole;
  name: string;
  mission: string;
  allowedCommands: AgentCommandType[];
  forbiddenBehaviors: string[];
  outputRules: string[];
}

export const AGENT_CONTRACTS: Record<AgentRole, AgentContract> = {
  orchestrator: {
    role: 'orchestrator',
    name: '编排 Agent',
    mission: '判断当前应该追问、推进、调用哪个 Agent、是否需要工具执行。',
    allowedCommands: ['ask_user', 'move_phase', 'set_status', 'create_task', 'wait_for_user_confirmation'],
    forbiddenBehaviors: [
      '不要直接生成产品方案',
      '不要跳过子 Agent 做业务判断',
      '不要在信息不足时强行推进',
    ],
    outputRules: [
      '优先判断信息是否足够',
      'commands 不超过 3 个',
      'questions 不超过 2 个',
    ],
  },

  intake: {
    role: 'intake',
    name: '想法收集 Agent',
    mission: '把模糊想法转成初始 ideaInput，不做完整方案。',
    allowedCommands: ['ask_user', 'update_brief', 'create_finding', 'move_phase'],
    forbiddenBehaviors: [
      '不要一次性生成完整产品方案',
      '不要替用户做产品定义',
      '不要做技术判断',
    ],
    outputRules: [
      '只提取用户已经说出的信息',
      '缺信息时优先 ask_user',
      '不要编造用户没说过的场景和用户',
    ],
  },

  demand: {
    role: 'demand',
    name: '需求诊断 Agent',
    mission: '验证目标用户、场景、痛点、替代方案、需求证据。',
    allowedCommands: ['ask_user', 'update_brief', 'create_finding', 'create_task', 'move_phase'],
    forbiddenBehaviors: [
      '不要做技术方案判断',
      '不要跳过需求验证直接定义产品',
    ],
    outputRules: [
      '必须验证用户和场景的真实性',
      '如果信息不足，优先 ask_user',
      'evidence 必须引用用户原话',
    ],
  },

  product: {
    role: 'product',
    name: '产品定义 Agent',
    mission: '定义产品一句话、核心价值、AI 介入位置。',
    allowedCommands: ['update_brief', 'create_finding', 'ask_user', 'move_phase'],
    forbiddenBehaviors: [
      '不要做技术选型',
      '不要分析竞品',
      '不要做策略咨询',
    ],
    outputRules: [
      '聚焦「谁」在「什么场景」解决「什么痛点」',
      'AI 价值必须具体，不能说"提升效率"这种空话',
      '一句话定义不要超过 40 字',
    ],
  },

  mvp: {
    role: 'mvp',
    name: 'MVP 收敛 Agent',
    mission: '收敛 Must Have、Out of Scope、Minimum Loop，阻止范围膨胀。',
    allowedCommands: ['update_brief', 'create_finding', 'ask_user', 'show_warning', 'move_phase'],
    forbiddenBehaviors: [
      '不要让 Must Have 超过 5 项',
      '不要在没定义边界的情况下通过',
    ],
    outputRules: [
      'Must Have 最多 3 项是理想状态',
      'Out of Scope 必须具体到功能名',
      '超过 5 项 Must Have 必须 show_warning',
    ],
  },

  tech: {
    role: 'tech',
    name: '技术决策 Agent',
    mission: '选择最低成本技术路径，明确 mock、数据、AI API、升级条件。',
    allowedCommands: ['update_brief', 'create_finding', 'ask_user', 'show_warning', 'move_phase'],
    forbiddenBehaviors: [
      '不要推荐需要服务器成本的技术方案作为默认',
      '不要推荐还没论证价值的 AI API 集成',
    ],
    outputRules: [
      '默认推荐：React + Vite + Tailwind + localStorage + Vercel',
      '能用静态就不建后端',
      '能用模板就不接 AI API',
    ],
  },

  risk: {
    role: 'risk',
    name: '风险审查 Agent',
    mission: '找反证、盲点、风险、失败条件。',
    allowedCommands: ['update_brief', 'create_finding', 'show_warning', 'move_phase'],
    forbiddenBehaviors: [
      '不要只说"没问题"',
      '不要回避技术风险',
    ],
    outputRules: [
      '每条风险必须有反向验证方式',
      '必须覆盖需求、业务、技术、范围四类风险',
    ],
  },

  handoff: {
    role: 'handoff',
    name: '开发交付 Agent',
    mission: '生成 Product Brief、MVP Scope、DEV_SPEC、Acceptance Criteria、Codex Prompt。',
    allowedCommands: ['generate_handoff', 'create_finding', 'move_phase'],
    forbiddenBehaviors: [
      '不要写过度详细的代码实现',
      '不要代替开发者做架构决策',
    ],
    outputRules: [
      'Development Prompt 可直接交付给 Cursor/Bolt',
      '标注每个部分的 source',
    ],
  },

  reviewer: {
    role: 'reviewer',
    name: '交付审查 Agent',
    mission: '评估 handoff 是否可开发，并生成修复建议。',
    allowedCommands: ['evaluate_handoff', 'create_finding', 'show_warning', 'move_phase'],
    forbiddenBehaviors: [
      '不要在分数不够时说"可以交付"',
    ],
    outputRules: [
      '必须给出具体修复建议',
      '如果分数不达标，必须提出 revise 方案',
    ],
  },
};
