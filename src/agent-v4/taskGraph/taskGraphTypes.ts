/**
 * V5.2 TaskGraph Types — Real Agent Workflow Data Structures
 *
 * All structures are JSON-serializable. No API keys, no raw API responses.
 * Backward-compatible: old localStorage data must not cause white screens.
 */

// ─── Status Enums ───────────────────────────────────────────────────────────

export type AgentTaskStatus =
  | 'todo'
  | 'planning'
  | 'running'
  | 'waiting_approval'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'skipped';

export type AgentStepStatus =
  | 'pending'
  | 'running'
  | 'observed'
  | 'approved'
  | 'rejected'
  | 'done'
  | 'failed';

export type AgentRole =
  | 'orchestrator'
  | 'problem'
  | 'user_scenario'
  | 'scope'
  | 'risk'
  | 'tech'
  | 'acceptance'
  | 'handoff'
  | 'reviewer'
  | 'memory';

export type ToolPermissionLevel =
  | 'read'
  | 'write_state'
  | 'generate_artifact'
  | 'external_ai'
  | 'dangerous';

export type ToolSideEffect =
  | 'none'
  | 'state_update'
  | 'artifact_generation'
  | 'external_call';

// ─── Core Graph Structure ───────────────────────────────────────────────────

export interface AgentTaskGraph {
  id: string;
  briefId: string;
  goal: string;
  status: AgentTaskStatus;
  progressPercent: number;
  currentTaskId?: string;
  tasks: AgentTask[];
  edges: AgentTaskEdge[];
  observations: AgentObservation[];
  approvals: HumanApproval[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: 'task-graph-v1';
}

// ─── Task ───────────────────────────────────────────────────────────────────

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  ownerAgent: AgentRole;
  status: AgentTaskStatus;
  progressPercent: number;
  inputSummary: string;
  expectedOutput: string;
  acceptanceCriteria: string[];
  steps: AgentStep[];
  toolCalls: AgentToolCallRecord[];
  observations: string[];
  requiresApproval: boolean;
  approvalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Edge ───────────────────────────────────────────────────────────────────

export interface AgentTaskEdge {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  condition: string;
}

// ─── Step ───────────────────────────────────────────────────────────────────

export interface AgentStep {
  id: string;
  taskId: string;
  title: string;
  description: string;
  status: AgentStepStatus;
  toolName?: string;
  input?: Record<string, unknown>;
  observationId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Tool Call Record ───────────────────────────────────────────────────────

export interface AgentToolCallRecord {
  id: string;
  taskId: string;
  stepId?: string;
  toolName: string;
  permissionLevel: ToolPermissionLevel;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  success: boolean;
  error?: string;
  observationId?: string;
  startedAt: string;
  completedAt?: string;
}

// ─── Observation ────────────────────────────────────────────────────────────

export interface AgentObservation {
  id: string;
  taskId: string;
  stepId?: string;
  toolCallId?: string;
  source: 'tool' | 'ai' | 'user' | 'system';
  title: string;
  content: string;
  evidence: string[];
  risks: string[];
  nextSuggestion: string;
  createdAt: string;
}

// ─── Human Approval ─────────────────────────────────────────────────────────

export interface HumanApproval {
  id: string;
  taskId: string;
  title: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  requiredBefore: string;
  createdAt: string;
  resolvedAt?: string;
  rejectionReason?: string;
}

// ─── Runtime Turn Result ────────────────────────────────────────────────────

export interface TaskGraphTurnResult {
  graph: AgentTaskGraph;
  briefPatch?: Partial<import('../../types').ProductBrief>;
  observations: AgentObservation[];
  approvals: HumanApproval[];
  reply: string;
  toolCallCount: number;
  nextAction: 'continue' | 'waiting_approval' | 'completed' | 'failed';
}

// ─── Runtime Progress Event ─────────────────────────────────────────────────

export interface TaskGraphProgressEvent {
  percent: number;
  phase: string;
  message: string;
}

// ─── Planner Output (LLM JSON Response) ─────────────────────────────────────

export interface TaskGraphPlannerOutput {
  reply: string;
  reasoningSummary: string;
  nextToolCalls: PlannerToolCall[];
  taskUpdate?: {
    status?: AgentTaskStatus;
    progressPercent?: number;
  };
  approvalRequest?: {
    required: boolean;
    title: string;
    description: string;
    requiredBefore: string;
  };
  memoryWrite?: {
    shouldWrite: boolean;
    title: string;
    content: string;
    tags: string[];
  };
}

export interface PlannerToolCall {
  toolName: string;
  reason: string;
  input: Record<string, unknown>;
}

// ─── Tool Metadata (for tool registration) ──────────────────────────────────

export interface TaskGraphToolMeta {
  permissionLevel: ToolPermissionLevel;
  sideEffect: ToolSideEffect;
  requiresApproval: boolean;
  outputSchema?: Record<string, unknown>;
}

// ─── ID Generation ──────────────────────────────────────────────────────────

let _taskGraphCounter = 0;

export function generateTaskGraphId(prefix = 'tg'): string {
  _taskGraphCounter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${ts}-${rand}-${_taskGraphCounter}`;
}
