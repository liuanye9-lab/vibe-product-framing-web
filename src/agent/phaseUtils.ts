import type { WorkflowPhase } from './types';

export const PHASE_ORDER: WorkflowPhase[] = [
  'intake',
  'demand',
  'product',
  'mvp',
  'tech',
  'risk',
  'handoff',
  'complete',
];

export function getNextPhase(phase: WorkflowPhase): WorkflowPhase {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return phase;
  return PHASE_ORDER[idx + 1];
}

export function getPreviousPhase(phase: WorkflowPhase): WorkflowPhase {
  const idx = PHASE_ORDER.indexOf(phase);
  if (idx <= 0) return PHASE_ORDER[0];
  return PHASE_ORDER[idx - 1];
}

export function canAdvancePhase(phase: WorkflowPhase): boolean {
  return phase !== 'complete';
}

export function getPhaseLabel(phase: WorkflowPhase): string {
  switch (phase) {
    case 'intake': return '收集想法';
    case 'demand': return '需求诊断';
    case 'product': return '产品定义';
    case 'mvp': return 'MVP 范围';
    case 'tech': return '技术方案';
    case 'risk': return '风险审查';
    case 'handoff': return '开发交付';
    case 'complete': return '已完成';
    default: return phase;
  }
}
