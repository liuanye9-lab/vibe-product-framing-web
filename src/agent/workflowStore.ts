/**
 * Agent Workflow Store — localStorage persistence for AgentWorkflowState.
 *
 * Each workflow is keyed by briefId so only one workflow exists per ProductBrief.
 */

import type { AgentWorkflowState, AgentMessage, AgentFinding, WorkflowPhase } from './types';

const AGENT_WORKFLOW_KEY = 'vibepilot_agent_workflows_v1';
const MAX_MESSAGES = 80;

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createInitialPhase(briefId: string): AgentWorkflowState {
  return {
    id: `wf-${briefId}`,
    briefId,
    currentPhase: 'intake' as WorkflowPhase,
    messages: [],
    findings: [],
    acceptedFindings: [],
    rejectedFindings: [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

function loadAllWorkflows(): Record<string, AgentWorkflowState> {
  try {
    const raw = localStorage.getItem(AGENT_WORKFLOW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, AgentWorkflowState>;
  } catch {
    return {};
  }
}

function saveAllWorkflows(workflows: Record<string, AgentWorkflowState>): void {
  try {
    localStorage.setItem(AGENT_WORKFLOW_KEY, JSON.stringify(workflows));
  } catch {
    console.warn('[AgentStore] Failed to save workflows to localStorage');
  }
}

/**
 * Retrieve the AgentWorkflowState for a given ProductBrief ID.
 */
export function getAgentWorkflow(briefId: string): AgentWorkflowState | null {
  try {
    const workflows = loadAllWorkflows();
    const workflow = workflows[briefId];
    if (!workflow) return null;
    // Ensure arrays are actually arrays (guard against corrupted data)
    return {
      ...workflow,
      messages: Array.isArray(workflow.messages) ? workflow.messages : [],
      findings: Array.isArray(workflow.findings) ? workflow.findings : [],
      acceptedFindings: Array.isArray(workflow.acceptedFindings) ? workflow.acceptedFindings : [],
      rejectedFindings: Array.isArray(workflow.rejectedFindings) ? workflow.rejectedFindings : [],
    };
  } catch {
    console.warn('[AgentStore] Corrupted workflow data for briefId:', briefId);
    return null;
  }
}

/**
 * Save (create or update) an AgentWorkflowState.
 */
export function saveAgentWorkflow(workflow: AgentWorkflowState): void {
  try {
    const workflows = loadAllWorkflows();
    workflows[workflow.briefId] = {
      ...workflow,
      lastUpdatedAt: new Date().toISOString(),
    };
    saveAllWorkflows(workflows);
  } catch {
    console.warn('[AgentStore] Failed to save workflow:', workflow.briefId);
  }
}

/**
 * Create a new AgentWorkflowState for a briefId. Does NOT overwrite existing.
 */
export function createAgentWorkflow(briefId: string): AgentWorkflowState {
  const existing = getAgentWorkflow(briefId);
  if (existing) return existing;
  const workflow = createInitialPhase(briefId);
  saveAgentWorkflow(workflow);
  return workflow;
}

/**
 * Append a message to the workflow and trim to MAX_MESSAGES.
 */
export function appendAgentMessage(
  briefId: string,
  message: AgentMessage,
): AgentWorkflowState {
  const workflows = loadAllWorkflows();
  let workflow = workflows[briefId];
  if (!workflow) {
    workflow = createInitialPhase(briefId);
  }

  const messages = [...workflow.messages, message];
  // Keep the first few messages (system/context) and trim middle/old ones
  const trimmed = messages.length > MAX_MESSAGES
    ? [messages[0], ...messages.slice(messages.length - MAX_MESSAGES + 1)]
    : messages;

  workflow = {
    ...workflow,
    messages: trimmed,
    lastUpdatedAt: new Date().toISOString(),
  };

  workflows[briefId] = workflow;
  saveAllWorkflows(workflows);
  return workflow;
}

/**
 * Add an AgentFinding to the workflow.
 */
export function addAgentFinding(
  briefId: string,
  finding: AgentFinding,
): AgentWorkflowState {
  const workflows = loadAllWorkflows();
  let workflow = workflows[briefId];
  if (!workflow) {
    workflow = createInitialPhase(briefId);
  }

  // Replace existing finding from same agent+phase, or append
  const existingIdx = workflow.findings.findIndex(
    (f) => f.agentRole === finding.agentRole && f.phase === finding.phase,
  );

  const findings = existingIdx >= 0
    ? workflow.findings.map((f, i) => i === existingIdx ? finding : f)
    : [...workflow.findings, finding];

  workflow = {
    ...workflow,
    findings,
    lastUpdatedAt: new Date().toISOString(),
  };

  workflows[briefId] = workflow;
  saveAllWorkflows(workflows);
  return workflow;
}

/**
 * Update the current phase of the workflow.
 */
export function updateWorkflowPhase(
  briefId: string,
  phase: WorkflowPhase,
): AgentWorkflowState {
  const workflows = loadAllWorkflows();
  let workflow = workflows[briefId];
  if (!workflow) {
    workflow = createInitialPhase(briefId);
  }

  workflow = {
    ...workflow,
    currentPhase: phase,
    lastUpdatedAt: new Date().toISOString(),
  };

  workflows[briefId] = workflow;
  saveAllWorkflows(workflows);
  return workflow;
}

/**
 * Accept a finding by ID.
 */
export function acceptFinding(
  briefId: string,
  findingId: string,
): AgentWorkflowState {
  const workflows = loadAllWorkflows();
  let workflow = workflows[briefId];
  if (!workflow) return createInitialPhase(briefId);

  workflow = {
    ...workflow,
    acceptedFindings: [...workflow.acceptedFindings.filter((id) => id !== findingId), findingId],
    rejectedFindings: workflow.rejectedFindings.filter((id) => id !== findingId),
    lastUpdatedAt: new Date().toISOString(),
  };

  workflows[briefId] = workflow;
  saveAllWorkflows(workflows);
  return workflow;
}

/**
 * Reject a finding by ID.
 */
export function rejectFinding(
  briefId: string,
  findingId: string,
): AgentWorkflowState {
  const workflows = loadAllWorkflows();
  let workflow = workflows[briefId];
  if (!workflow) return createInitialPhase(briefId);

  workflow = {
    ...workflow,
    rejectedFindings: [...workflow.rejectedFindings.filter((id) => id !== findingId), findingId],
    acceptedFindings: workflow.acceptedFindings.filter((id) => id !== findingId),
    lastUpdatedAt: new Date().toISOString(),
  };

  workflows[briefId] = workflow;
  saveAllWorkflows(workflows);
  return workflow;
}

export { generateId };

/**
 * List all agent workflows, sorted by lastUpdatedAt descending.
 * Filters out corrupted entries.
 */
export function listAgentWorkflows(): AgentWorkflowState[] {
  try {
    const workflows = loadAllWorkflows();
    return Object.values(workflows)
      .filter((w) => w && w.briefId && Array.isArray(w.messages))
      .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime());
  } catch {
    return [];
  }
}

/**
 * Delete the agent workflow for a given briefId.
 */
export function deleteAgentWorkflow(briefId: string): void {
  try {
    const workflows = loadAllWorkflows();
    delete workflows[briefId];
    saveAllWorkflows(workflows);
  } catch {
    console.warn('[AgentStore] Failed to delete workflow:', briefId);
  }
}

/**
 * Get a lightweight summary of the agent workflow for a given briefId.
 * Designed for HistoryPage — avoids parsing the full workflow.
 */
export function getAgentWorkflowSummary(briefId: string): {
  exists: boolean;
  currentPhase?: WorkflowPhase;
  messageCount: number;
  findingCount: number;
  lastUpdatedAt?: string;
} {
  const wf = getAgentWorkflow(briefId);
  if (!wf) return { exists: false, messageCount: 0, findingCount: 0 };

  return {
    exists: true,
    currentPhase: wf.currentPhase,
    messageCount: Array.isArray(wf.messages) ? wf.messages.filter((m) => m.role !== 'system').length : 0,
    findingCount: Array.isArray(wf.findings) ? wf.findings.length : 0,
    lastUpdatedAt: wf.lastUpdatedAt,
  };
}
