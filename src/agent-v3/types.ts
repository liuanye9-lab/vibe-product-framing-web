/**
 * Agent V3 Types — Real Agent Workflow System
 *
 * V3 upgrades from V2:
 * - AgentSession replaces AgentWorkflowState (adds tasks, commands, toolResults, actionCards)
 * - AgentCommand + Tool Registry for structured tool execution
 * - AgentTask for tracked task management
 * - AgentActionCard for rich user interactions
 * - AgentToolResult for command execution traceability
 * - 9 Agent roles (adds intake, reviewer)
 * - 9 Agent phases (adds review)
 */

import type { ProductBrief } from '../types';

export type AgentRole =
  | 'orchestrator'
  | 'intake'
  | 'demand'
  | 'product'
  | 'mvp'
  | 'tech'
  | 'risk'
  | 'handoff'
  | 'reviewer';

export type AgentPhase =
  | 'intake'
  | 'demand'
  | 'product'
  | 'mvp'
  | 'tech'
  | 'risk'
  | 'handoff'
  | 'review'
  | 'complete';

export type AgentRunStatus =
  | 'idle'
  | 'thinking'
  | 'waiting_user'
  | 'running_tools'
  | 'blocked'
  | 'completed'
  | 'failed';

export type DecisionStatus =
  | 'need_more_info'
  | 'ready'
  | 'risk_detected'
  | 'blocked'
  | 'can_continue'
  | 'completed';

export type AgentCommandType =
  | 'ask_user'
  | 'update_brief'
  | 'create_finding'
  | 'create_task'
  | 'complete_task'
  | 'move_phase'
  | 'set_status'
  | 'generate_handoff'
  | 'evaluate_handoff'
  | 'show_warning'
  | 'wait_for_user_confirmation';

export interface AgentCommand {
  id: string;
  type: AgentCommandType;
  agentRole: AgentRole;
  phase: AgentPhase;
  reason: string;
  payload: Record<string, unknown>;
  requiresUserConfirmation?: boolean;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  phase: AgentPhase;
  ownerAgent: AgentRole;
  status: 'todo' | 'doing' | 'blocked' | 'done' | 'skipped';
  required: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentFinding {
  id: string;
  phase: AgentPhase;
  agentRole: AgentRole;
  title: string;
  summary: string;
  evidence: string[];
  risks: string[];
  missingInfo: string[];
  suggestions: string[];
  decisionStatus: DecisionStatus;
  confidence: number;
  createdAt: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'tool';
  agentRole?: AgentRole;
  phase?: AgentPhase;
  content: string;
  createdAt: string;
  commandIds?: string[];
  toolResultIds?: string[];
  questions?: string[];
  actionCards?: AgentActionCard[];
}

export interface AgentActionCard {
  id: string;
  type:
    | 'question'
    | 'decision'
    | 'warning'
    | 'next_step'
    | 'patch_preview'
    | 'handoff_ready';
  title: string;
  description: string;
  actions: Array<{
    id: string;
    label: string;
    intent:
      | 'answer'
      | 'accept'
      | 'reject'
      | 'continue'
      | 'skip'
      | 'make_assumption'
      | 'edit'
      | 'generate_handoff'
      | 'go_phase';
    value?: string;
  }>;
}

export interface AgentToolResult {
  id: string;
  commandId: string;
  success: boolean;
  message: string;
  data?: unknown;
  createdAt: string;
}

export interface AgentSession {
  id: string;
  briefId: string;
  title: string;
  currentPhase: AgentPhase;
  runStatus: AgentRunStatus;
  decisionStatus: DecisionStatus;
  activeAgent: AgentRole;
  messages: AgentMessage[];
  tasks: AgentTask[];
  findings: AgentFinding[];
  commands: AgentCommand[];
  toolResults: AgentToolResult[];
  pendingQuestions: string[];
  pendingCommands: AgentCommand[];
  acceptedFindingIds: string[];
  rejectedFindingIds: string[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: 'agent-v3';
}

export interface AgentRuntimeResult {
  session: AgentSession;
  briefPatch?: Partial<ProductBrief>;
  userVisibleReply: string;
  actionCards: AgentActionCard[];
  shouldWaitForUser: boolean;
}

// Helper: generate a unique ID
export function generateId(): string {
  return `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
