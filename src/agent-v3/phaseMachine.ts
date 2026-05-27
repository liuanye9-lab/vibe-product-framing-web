/**
 * Agent V3 Phase Machine
 *
 * Phase is the primary state machine. Each phase has a dedicated agent role,
 * a label, and canEnterPhase checks. The machine respects user intents
 * (continue/skip/make_assumption) to avoid blocking.
 */

import type { AgentPhase, AgentRole } from './types';
import type { ProductBrief } from '../types';

export const AGENT_PHASE_ORDER: AgentPhase[] = [
  'intake',
  'demand',
  'product',
  'mvp',
  'tech',
  'risk',
  'handoff',
  'review',
  'complete',
];

export function getNextAgentPhase(phase: AgentPhase): AgentPhase {
  const idx = AGENT_PHASE_ORDER.indexOf(phase);
  if (idx < 0 || idx >= AGENT_PHASE_ORDER.length - 1) return phase;
  return AGENT_PHASE_ORDER[idx + 1];
}

export function getPreviousAgentPhase(phase: AgentPhase): AgentPhase {
  const idx = AGENT_PHASE_ORDER.indexOf(phase);
  if (idx <= 0) return AGENT_PHASE_ORDER[0];
  return AGENT_PHASE_ORDER[idx - 1];
}

export function getAgentPhaseLabel(phase: AgentPhase): string {
  switch (phase) {
    case 'intake': return '收集想法';
    case 'demand': return '需求诊断';
    case 'product': return '产品定义';
    case 'mvp': return 'MVP 范围';
    case 'tech': return '技术方案';
    case 'risk': return '风险审查';
    case 'handoff': return '开发交付';
    case 'review': return '交付审查';
    case 'complete': return '已完成';
    default: return phase;
  }
}

export function getAgentRoleForPhase(phase: AgentPhase): AgentRole {
  switch (phase) {
    case 'intake': return 'intake';
    case 'demand': return 'demand';
    case 'product': return 'product';
    case 'mvp': return 'mvp';
    case 'tech': return 'tech';
    case 'risk': return 'risk';
    case 'handoff': return 'handoff';
    case 'review': return 'reviewer';
    case 'complete': return 'orchestrator';
    default: return 'orchestrator';
  }
}

function hasValue(s: string | undefined | null): boolean {
  return Boolean(s && s.trim().length > 0);
}

function hasSuggestionValue(s: { value?: unknown } | undefined): boolean {
  if (!s) return false;
  const v = s.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  return false;
}

export function canEnterPhase(_phase: AgentPhase, brief: ProductBrief, session: { currentPhase: AgentPhase }): {
  allowed: boolean;
  missingInfo: string[];
  reason: string;
} {
  void session; // reserved for future use
  const missingInfo: string[] = [];
  const { stages, ideaInput } = brief;

  // Only check for the brief structure itself
  if (!hasValue(brief.rawIdea) && !hasValue(ideaInput.rawIdea)) {
    return {
      allowed: false,
      missingInfo: ['产品想法'],
      reason: '请先描述你的产品想法。',
    };
  }

  // Check key fields by phase
  if (_phase === 'product') {
    const hasTargetUser = hasValue(ideaInput.targetUser) || hasSuggestionValue(stages.product?.targetUser);
    const hasScenario = hasValue(ideaInput.scenario) || hasSuggestionValue(stages.product?.scenario);
    if (!hasTargetUser) missingInfo.push('目标用户');
    if (!hasScenario) missingInfo.push('使用场景');
  }

  if (_phase === 'mvp') {
    const hasProduct = hasSuggestionValue(stages.product?.productOneLiner);
    if (!hasProduct) missingInfo.push('产品一句话定义');
  }

  if (_phase === 'handoff') {
    const hasMustHave = hasSuggestionValue(stages.mvp?.mustHave);
    if (!hasMustHave) missingInfo.push('MVP Must Have');
  }

  // Always allow entry — just warn about missing info
  return {
    allowed: true,
    missingInfo,
    reason: missingInfo.length > 0
      ? `进入 ${getAgentPhaseLabel(_phase)} 阶段，但还缺：${missingInfo.join('、')}。系统会基于已有信息做出合理假设。`
      : '信息充足，可以进入。',
  };
}
