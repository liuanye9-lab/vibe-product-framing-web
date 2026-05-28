/**
 * Agent Turn Lifecycle — tracks what the Agent is doing in real time.
 *
 * This is a UI-layer concept. Not persisted to localStorage.
 * Provides the data for progress indicators and thinking bubbles.
 */

export type AgentTurnPhase =
  | 'received'
  | 'understanding'
  | 'checking_context'
  | 'planning'
  | 'running_node'
  | 'running_tools'
  | 'updating_state'
  | 'drafting_reply'
  | 'waiting_user'
  | 'completed'
  | 'failed';

export interface AgentTurnProgressStep {
  id: string;
  phase: AgentTurnPhase;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface AgentTurnLifecycle {
  turnId: string;
  briefId: string;
  sessionId: string;
  userMessage: string;
  phase: AgentTurnPhase;
  immediateReply: string;
  progressSteps: AgentTurnProgressStep[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

const PHASE_LABELS: Record<AgentTurnPhase, string> = {
  received: '已收到',
  understanding: '理解意图',
  checking_context: '检查上下文',
  planning: '规划动作',
  running_node: '执行 Agent 节点',
  running_tools: '执行工具',
  updating_state: '更新状态',
  drafting_reply: '生成回复',
  waiting_user: '等待用户',
  completed: '完成',
  failed: '失败',
};

export function getPhaseLabel(phase: AgentTurnPhase): string {
  return PHASE_LABELS[phase] || phase;
}

function stepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeStep(phase: AgentTurnPhase, label: string, desc: string): AgentTurnProgressStep {
  return {
    id: stepId(), phase, label, description: desc,
    status: 'pending', createdAt: new Date().toISOString(),
  };
}

export function createAgentTurnLifecycle(input: {
  briefId: string;
  sessionId: string;
  userMessage: string;
  immediateReply: string;
}): AgentTurnLifecycle {
  return {
    turnId: `turn-${Date.now()}`,
    briefId: input.briefId,
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    phase: 'received',
    immediateReply: input.immediateReply,
    progressSteps: [],
    startedAt: new Date().toISOString(),
  };
}

export function createDefaultProgressSteps(input: {
  userMessage: string;
  currentNodeLabel: string;
}): AgentTurnProgressStep[] {
  const msg = input.userMessage;
  const isContinue = msg.includes('继续') || msg.includes('下一步');
  const isAssume = msg.includes('默认假设') || msg.includes('假设');
  const isSkip = msg.includes('跳过');
  const isHandoff = msg.includes('交付') || msg.includes('Handoff') || msg.includes('Codex');

  const steps: AgentTurnProgressStep[] = [];

  if (isContinue || isSkip || isAssume) {
    steps.push(makeStep('understanding', '解析操作意图', isContinue ? '推进到下一阶段' : isSkip ? '跳过当前阶段' : '做默认假设'));
    steps.push(makeStep('checking_context', '检查当前状态', `当前阶段：${input.currentNodeLabel}`));
    steps.push(makeStep('running_tools', '更新信息槽和阶段', '标记缺失信息并推进'));
  } else if (isHandoff) {
    steps.push(makeStep('understanding', '解析交付请求', '准备生成开发交付文档'));
    steps.push(makeStep('checking_context', '检查信息完整性', '确保必要假设已补齐'));
    steps.push(makeStep('running_node', '生成 Developer Handoff', '整合 Product Brief + MVP + Dev Spec'));
  } else {
    steps.push(makeStep('understanding', '理解你的想法', '分析输入中的关键信息'));
    steps.push(makeStep('checking_context', '检查缺失信息', '判断是否需要补充目标用户、场景等'));
    steps.push(makeStep('planning', '规划下一步动作', '决定继续追问还是用假设推进'));
  }

  steps.push(makeStep('updating_state', '保存工作流状态', '持久化当前进度'));

  return steps;
}

export function updateTurnPhase(input: {
  lifecycle: AgentTurnLifecycle;
  phase: AgentTurnPhase;
}): AgentTurnLifecycle {
  return { ...input.lifecycle, phase: input.phase };
}

export function markProgressStep(input: {
  lifecycle: AgentTurnLifecycle;
  phase: AgentTurnPhase;
  status: AgentTurnProgressStep['status'];
}): AgentTurnLifecycle {
  const now = new Date().toISOString();
  const steps = input.lifecycle.progressSteps.map((s) =>
    s.phase === input.phase
      ? { ...s, status: input.status, completedAt: input.status === 'done' || input.status === 'failed' ? now : s.completedAt }
      : s,
  );
  return { ...input.lifecycle, progressSteps: steps };
}
