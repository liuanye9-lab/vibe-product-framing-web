/**
 * Agent V4 Types — Agent Graph Runtime & Decision OS
 *
 * Inspired by LangGraph (stateful graph, durable execution, human-in-the-loop,
 * checkpoints), AutoGen (event-driven multi-agent), and CrewAI (agents, tasks,
 * flows, guardrails).
 *
 * Key rules:
 * - All types must be serializable (no functions in state).
 * - No full API responses in state — only summaries.
 * - schemaVersion: 'agent-graph-v4'
 */

import type { ProductBrief } from '../types';

export type AgentNodeId =
  | 'orchestrator'
  | 'intake'
  | 'demand'
  | 'product'
  | 'mvp'
  | 'tech'
  | 'risk'
  | 'handoff'
  | 'reviewer'
  | 'reflection'
  | 'human_interrupt'
  | 'end';

export type AgentGraphStatus =
  | 'idle'
  | 'running'
  | 'waiting_user'
  | 'interrupted'
  | 'completed'
  | 'failed';

export type AgentDecision =
  | 'ask_user'
  | 'continue'
  | 'call_agent'
  | 'call_tool'
  | 'evaluate'
  | 'reflect'
  | 'generate_handoff'
  | 'stop';

// --------------- Events ---------------

export interface AgentGraphEvent {
  id: string;
  sessionId: string;
  briefId: string;
  type:
    | 'user_message'
    | 'agent_message'
    | 'node_started'
    | 'node_completed'
    | 'tool_called'
    | 'tool_completed'
    | 'state_updated'
    | 'human_interrupt'
    | 'checkpoint_created'
    | 'evaluation_completed'
    | 'reflection_created'
    | 'slot_asked'
    | 'slot_answered'
    | 'slot_assumed'
    | 'slot_skipped'
    | 'phase_advanced'
    | 'repeated_question_prevented'
    | 'user_action_clicked'
    | 'error';
  nodeId?: AgentNodeId;
  message?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

// --------------- Commands ---------------

export interface AgentGraphCommand {
  id: string;
  type:
    | 'ASK_USER'
    | 'UPDATE_BRIEF'
    | 'CREATE_TASK'
    | 'COMPLETE_TASK'
    | 'CREATE_FINDING'
    | 'MOVE_NODE'
    | 'CALL_TOOL'
    | 'CREATE_CHECKPOINT'
    | 'CREATE_MEMORY'
    | 'CREATE_SKILL'
    | 'GENERATE_HANDOFF'
    | 'EVALUATE_HANDOFF'
    | 'INTERRUPT_FOR_USER'
    | 'FINISH';
  reason: string;
  payload: Record<string, unknown>;
  requiresUserConfirmation?: boolean;
}

// --------------- Node Results ---------------

export interface AgentGraphNodeResult {
  nodeId: AgentNodeId;
  reply: string;
  commands: AgentGraphCommand[];
  nextNodeId?: AgentNodeId;
  shouldInterrupt: boolean;
  interruptReason?: string;
  confidence: number;
}

// --------------- Tasks & Findings ---------------

export interface AgentGraphTask {
  id: string;
  title: string;
  description: string;
  ownerNode: AgentNodeId;
  status: 'todo' | 'doing' | 'blocked' | 'done' | 'skipped';
  phase: AgentNodeId;
  required: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGraphFinding {
  id: string;
  title: string;
  summary: string;
  nodeId: AgentNodeId;
  evidence: string[];
  risks: string[];
  missingInfo: string[];
  suggestions: string[];
  confidence: number;
  createdAt: string;
}

// --------------- Checkpoints ---------------

export interface AgentGraphCheckpoint {
  id: string;
  sessionId: string;
  briefId: string;
  nodeId: AgentNodeId;
  status: AgentGraphStatus;
  snapshot: AgentGraphState;
  createdAt: string;
  reason: string;
}

// --------------- State ---------------

export interface AgentGraphState {
  sessionId: string;
  briefId: string;
  status: AgentGraphStatus;
  currentNodeId: AgentNodeId;
  previousNodeId?: AgentNodeId;
  activeAgentName: string;
  userGoal: string;
  tasks: AgentGraphTask[];
  findings: AgentGraphFinding[];
  pendingQuestions: string[];
  pendingCommands: AgentGraphCommand[];
  workingMemory: Record<string, unknown>;
  lastEvaluation?: {
    score: number;
    readiness: string;
    issues: string[];
    suggestions: string[];
  };
  /** V4.1: Slot filling state to prevent repeated questions */
  slotFilling?: SlotFillingState;
  /** V4.1: Question ledger to track asked/answered/skipped questions */
  questionLedger?: AgentQuestionRecord[];
  /** V4.1: Count how many times user advanced the flow */
  advancementCount?: number;
  /** V4.1: Current blocking reason, if any */
  blockReason?: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 'agent-graph-v4';
}

// --------------- Session ---------------

export interface AgentGraphSession {
  id: string;
  briefId: string;
  title: string;
  state: AgentGraphState;
  events: AgentGraphEvent[];
  checkpoints: AgentGraphCheckpoint[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: 'agent-graph-v4';
}

// --------------- Run Result ---------------

export interface AgentGraphRunResult {
  session: AgentGraphSession;
  briefPatch?: Partial<ProductBrief>;
  events: AgentGraphEvent[];
  userVisibleReply: string;
  interrupted: boolean;
}

// --------------- Slot Filling ---------------

export type InfoSlotKey =
  | 'rawIdea'
  | 'targetUser'
  | 'scenario'
  | 'coreProblem'
  | 'currentAlternative'
  | 'mvpMustHave'
  | 'mvpOutOfScope'
  | 'minimumLoop'
  | 'technicalConstraint'
  | 'successCriteria';

export type InfoSlotStatus =
  | 'unknown'
  | 'asked'
  | 'answered'
  | 'assumed'
  | 'skipped';

export interface InfoSlot {
  key: InfoSlotKey;
  label: string;
  value?: string;
  status: InfoSlotStatus;
  askedCount: number;
  lastAskedAt?: string;
  source?: 'user' | 'agent_assumption' | 'legacy_brief' | 'local_rule';
  confidence: number;
}

export interface SlotFillingState {
  slots: Record<InfoSlotKey, InfoSlot>;
  updatedAt: string;
}

// --------------- Question Ledger ---------------

export interface AgentQuestionRecord {
  id: string;
  slotKey?: InfoSlotKey;
  question: string;
  askedAt: string;
  answeredAt?: string;
  status: 'pending' | 'answered' | 'assumed' | 'skipped';
}

// --------------- Action Card V4.1 Types ---------------

export interface AgentActionCardV4 {
  id: string;
  type: 'missing_info' | 'assumption' | 'phase_ready' | 'blocked' | 'handoff_ready';
  title: string;
  description: string;
  items?: Array<{ label: string; value: string; status: InfoSlotStatus }>;
  actions: Array<{ id: string; label: string; intent: string }>;
}

// --------------- Helpers ---------------

export function generateGraphId(prefix = 'agv4'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const AGENT_NODE_LABELS: Record<AgentNodeId, string> = {
  orchestrator: '编排器',
  intake: '想法收集',
  demand: '需求诊断',
  product: '产品定义',
  mvp: 'MVP 范围',
  tech: '技术方案',
  risk: '风险审查',
  handoff: '开发交付',
  reviewer: '交付审查',
  reflection: '反思',
  human_interrupt: '等待用户',
  end: '完成',
};

export const AGENT_NODE_DESCRIPTIONS: Record<AgentNodeId, string> = {
  orchestrator: '解析意图，路由到合适的业务节点，不直接生成完整内容。',
  intake: '抽取核心想法、目标用户、场景、问题，信息不足时追问。',
  demand: '判断需求真实性、痛点频率、替代方案、需求证据。',
  product: '生成产品一句话、AI 价值、核心使用场景。',
  mvp: '生成 Must Have、Out of Scope、Minimum Loop，检测范围膨胀。',
  tech: '判断最低成本技术路径、mock 策略、升级条件。',
  risk: '需求风险、技术风险、商业风险、范围风险、反证。',
  handoff: '生成 Developer Handoff 交付文档。',
  reviewer: '评估 Handoff 质量，检查分维度得分。',
  reflection: '总结失败原因、被拒绝的判断、生成反思记忆和可复用 skill。',
  human_interrupt: '等待用户输入或确认，需要人工介入。',
  end: '工作流已完成，所有节点已处理。',
};
