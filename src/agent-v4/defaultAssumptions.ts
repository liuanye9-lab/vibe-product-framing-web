/**
 * Default Assumption Generator — creates low-confidence fills for missing slots.
 *
 * Based on rawIdea keyword matching. All assumptions marked
 * source='agent_assumption' with confidence <= 0.7.
 */

import type { ProductBrief } from '../types';
import type { InfoSlotKey, InfoSlot, AgentNodeId } from './types';

export interface AssumptionResult {
  slotKey: InfoSlotKey;
  value: string;
  confidence: number;
  reason: string;
}

/** Generate default assumptions for missing slots based on idea keywords. */
export function generateDefaultAssumptions(input: {
  brief: ProductBrief;
  phase: AgentNodeId;
  missingSlots: InfoSlot[];
}): AssumptionResult[] {
  const rawIdea = (input.brief.rawIdea || input.brief.ideaInput?.rawIdea || '').toLowerCase();
  const projectType = (input.brief.ideaInput?.projectType || '').toLowerCase();
  const results: AssumptionResult[] = [];

  for (const slot of input.missingSlots) {
    const assumption = generateForSlot(slot.key, rawIdea, projectType);
    if (assumption) results.push(assumption);
  }

  // Also generate mvp assumptions if they're missing and we're in mvp phase
  if (input.phase === 'mvp' || input.phase === 'tech' || input.phase === 'risk' || input.phase === 'handoff') {
    for (const slot of input.missingSlots) {
      if (['mvpMustHave', 'mvpOutOfScope', 'minimumLoop'].includes(slot.key)) {
        const existing = results.find((r) => r.slotKey === slot.key);
        if (!existing) {
          const assumption = generateMvpAssumption(slot.key, rawIdea);
          if (assumption) results.push(assumption);
        }
      }
    }
  }

  return results;
}

function generateForSlot(key: InfoSlotKey, rawIdea: string, _projectType: string): AssumptionResult | null {
  void _projectType;
  switch (key) {
    case 'targetUser':
      return generateTargetUser(rawIdea);
    case 'scenario':
      return generateScenario(rawIdea);
    case 'coreProblem':
      return generateCoreProblem(rawIdea);
    case 'technicalConstraint':
      return generateTechConstraint(rawIdea);
    case 'successCriteria':
      return generateSuccessCriteria(rawIdea);
    default:
      return null;
  }
}

// ---- Rule-based assumption generators ----

function generateTargetUser(rawIdea: string): AssumptionResult {
  if (rawIdea.includes('雅思') || rawIdea.includes('ielts') || rawIdea.includes('生词') || rawIdea.includes('错题')) {
    return { slotKey: 'targetUser', value: '正在备考雅思、需要复盘生词和错题的学生', confidence: 0.6, reason: '从"雅思/生词/错题"关键词推断' };
  }
  if (rawIdea.includes('小程序') || rawIdea.includes('微信')) {
    return { slotKey: 'targetUser', value: '使用微信、需要通过小程序快速访问工具的用户', confidence: 0.5, reason: '从"小程序"关键词推断' };
  }
  if (rawIdea.includes('prompt') || rawIdea.includes('提示词') || rawIdea.includes('生图')) {
    return { slotKey: 'targetUser', value: '需要调优 AIGC 输出的设计学生或创作者', confidence: 0.6, reason: '从"prompt/提示词"关键词推断' };
  }
  if (rawIdea.includes('客服') || rawIdea.includes('质检')) {
    return { slotKey: 'targetUser', value: 'AI 客服产品经理或运营', confidence: 0.6, reason: '从"客服/质检"关键词推断' };
  }
  if (rawIdea.includes('股票') || rawIdea.includes('投资') || rawIdea.includes('复盘')) {
    return { slotKey: 'targetUser', value: '需要系统化复盘交易记录的个人投资者', confidence: 0.6, reason: '从"股票/投资/复盘"关键词推断' };
  }
  // Default
  return { slotKey: 'targetUser', value: '准备使用这个产品解决当前问题的早期用户', confidence: 0.4, reason: '无明确线索，使用通用默认值' };
}

function generateScenario(rawIdea: string): AssumptionResult {
  if (rawIdea.includes('生词') || rawIdea.includes('错题')) {
    return { slotKey: 'scenario', value: '做完真题后整理生词和错题原因，需要形成可复盘的学习闭环', confidence: 0.6, reason: '从学习场景推断' };
  }
  if (rawIdea.includes('prompt') || rawIdea.includes('提示词')) {
    return { slotKey: 'scenario', value: '对比不同 prompt 版本的 AIGC 生成效果时，需要记录和评分', confidence: 0.6, reason: '从 prompt 评测场景推断' };
  }
  if (rawIdea.includes('质检')) {
    return { slotKey: 'scenario', value: '需要检查大模型客服回复的准确性、同理心和合规性', confidence: 0.6, reason: '从质检场景推断' };
  }
  return { slotKey: 'scenario', value: '用户遇到该问题并需要快速完成任务时打开产品', confidence: 0.4, reason: '无明确线索，使用通用默认值' };
}

function generateCoreProblem(rawIdea: string): AssumptionResult {
  if (rawIdea.includes('生词') || rawIdea.includes('错题')) {
    return { slotKey: 'coreProblem', value: '生词和错题分散记录在笔记本或不同 App 中，难以形成可复盘、可量化的学习闭环', confidence: 0.6, reason: '从学习场景推断' };
  }
  if (rawIdea.includes('prompt')) {
    return { slotKey: 'coreProblem', value: '缺少统一的评分标准、版本记录和复盘机制，优化 prompt 全凭感觉', confidence: 0.6, reason: '从 prompt 评测场景推断' };
  }
  if (rawIdea.includes('质检')) {
    return { slotKey: 'coreProblem', value: '只能凭感觉判断大模型回复好坏，缺少证据记录和量化评分标准', confidence: 0.6, reason: '从质检场景推断' };
  }
  return { slotKey: 'coreProblem', value: '当前解决方案分散、低效，缺少结构化流程', confidence: 0.4, reason: '无明确线索，使用通用默认值' };
}

function generateTechConstraint(rawIdea: string): AssumptionResult {
  if (rawIdea.includes('小程序') || rawIdea.includes('微信')) {
    return { slotKey: 'technicalConstraint', value: '优先考虑微信小程序 + 云开发，V1 先用 localStorage 模拟', confidence: 0.5, reason: '从小程序关键词推断' };
  }
  return { slotKey: 'technicalConstraint', value: 'V1 推荐纯前端方案（React + TypeScript），用 localStorage 持久化。不需要后端、数据库、认证。', confidence: 0.5, reason: '产品构思工具默认技术栈' };
}

function generateSuccessCriteria(rawIdea: string): AssumptionResult {
  void rawIdea;
  return { slotKey: 'successCriteria', value: '5 个早期用户中至少 3 个能走完核心流程并获得可用的结果', confidence: 0.4, reason: '通用产品验证标准' };
}

function generateMvpAssumption(key: InfoSlotKey, rawIdea: string): AssumptionResult | null {
  void rawIdea;
  switch (key) {
    case 'mvpMustHave':
      return { slotKey: 'mvpMustHave', value: '核心输入 → AI 分析/生成 → 结构化结果展示 → 复制/导出', confidence: 0.5, reason: '通用 MVP 功能闭环' };
    case 'mvpOutOfScope':
      return { slotKey: 'mvpOutOfScope', value: '登录/注册、支付系统、团队协作、复杂后台、向量数据库、MCP Server', confidence: 0.7, reason: 'V1 不应包含的功能' };
    case 'minimumLoop':
      return { slotKey: 'minimumLoop', value: '用户输入核心信息 → 系统生成第一版可用结果 → 用户复制或导出', confidence: 0.5, reason: '通用最小闭环' };
    default:
      return null;
  }
}
