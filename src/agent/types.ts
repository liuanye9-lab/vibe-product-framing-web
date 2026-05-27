/**
 * Agent Workflow Types for Vibe Copilot V2.0
 *
 * These types define the Agent-driven state machine that replaces
 * the earlier single-turn AI generation workflow.
 * AgentWorkflowState lives in localStorage alongside ProductBrief,
 * linked by briefId.
 */

export type AgentRole =
  | 'orchestrator'
  | 'demand'
  | 'product'
  | 'mvp'
  | 'tech'
  | 'risk'
  | 'handoff';

export type AgentDecisionStatus =
  | 'need_more_info'
  | 'ready_to_decide'
  | 'risk_detected'
  | 'can_move_next'
  | 'blocked';

export type WorkflowPhase =
  | 'intake'
  | 'demand'
  | 'product'
  | 'mvp'
  | 'tech'
  | 'risk'
  | 'handoff'
  | 'complete';

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  agentRole?: AgentRole;
  content: string;
  createdAt: string;
  metadata?: {
    phase?: WorkflowPhase;
    decisionStatus?: AgentDecisionStatus;
    referencedFields?: string[];
    toolCalls?: string[];
  };
}

export interface AgentFinding {
  id: string;
  agentRole: AgentRole;
  phase: WorkflowPhase;
  title: string;
  summary: string;
  evidence: string[];
  risks: string[];
  missingInfo: string[];
  suggestions: string[];
  decisionStatus: AgentDecisionStatus;
}

export interface AgentWorkflowState {
  id: string;
  briefId: string;
  currentPhase: WorkflowPhase;
  messages: AgentMessage[];
  findings: AgentFinding[];
  acceptedFindings: string[];
  rejectedFindings: string[];
  lastUpdatedAt: string;
}
