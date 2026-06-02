/**
 * V5.2 Human Approval — Manage approval gates in the TaskGraph
 *
 * Key tasks (MVP Scope, Risk, DEV_SPEC, CODEX_TASK_PACK) require
 * human approval before proceeding.
 */

import type { AgentTaskGraph, HumanApproval } from './taskGraphTypes';
import { generateTaskGraphId } from './taskGraphTypes';
import { getTaskGraph, saveTaskGraph } from './taskGraphStore';

// ─── Create Approval ────────────────────────────────────────────────────────

export function createHumanApproval(input: {
  briefId: string;
  taskId: string;
  title: string;
  description: string;
  requiredBefore: string;
}): { graph: AgentTaskGraph; approval: HumanApproval } {
  const now = new Date().toISOString();
  const approval: HumanApproval = {
    id: generateTaskGraphId('appr'),
    taskId: input.taskId,
    title: input.title,
    description: input.description,
    status: 'pending',
    requiredBefore: input.requiredBefore,
    createdAt: now,
  };

  let graph = getTaskGraph(input.briefId);
  if (!graph) {
    throw new Error(`TaskGraph not found for briefId: ${input.briefId}`);
  }

  // Add approval to graph
  graph = {
    ...graph,
    approvals: [...graph.approvals, approval],
  };

  // Update task status
  graph = {
    ...graph,
    tasks: graph.tasks.map(t =>
      t.id === input.taskId
        ? { ...t, status: 'waiting_approval' as const, approvalId: approval.id }
        : t,
    ),
  };

  saveTaskGraph(graph);
  return { graph, approval };
}

// ─── Approve ────────────────────────────────────────────────────────────────

export function approveHumanApproval(input: {
  briefId: string;
  approvalId: string;
}): AgentTaskGraph {
  const graph = getTaskGraph(input.briefId);
  if (!graph) {
    throw new Error(`TaskGraph not found for briefId: ${input.briefId}`);
  }

  const now = new Date().toISOString();

  // Update approval status
  const updatedApprovals = graph.approvals.map(a =>
    a.id === input.approvalId
      ? { ...a, status: 'approved' as const, resolvedAt: now }
      : a,
  );

  // Find the approval to get taskId
  const approval = updatedApprovals.find(a => a.id === input.approvalId);
  if (!approval) {
    throw new Error(`Approval not found: ${input.approvalId}`);
  }

  // Update task status back to running
  const updatedTasks = graph.tasks.map(t =>
    t.id === approval.taskId
      ? { ...t, status: 'running' as const, approvalId: undefined }
      : t,
  );

  const updated: AgentTaskGraph = {
    ...graph,
    approvals: updatedApprovals,
    tasks: updatedTasks,
    updatedAt: now,
  };

  saveTaskGraph(updated);
  return updated;
}

// ─── Reject ─────────────────────────────────────────────────────────────────

export function rejectHumanApproval(input: {
  briefId: string;
  approvalId: string;
  reason: string;
}): AgentTaskGraph {
  const graph = getTaskGraph(input.briefId);
  if (!graph) {
    throw new Error(`TaskGraph not found for briefId: ${input.briefId}`);
  }

  const now = new Date().toISOString();

  // Update approval status
  const updatedApprovals = graph.approvals.map(a =>
    a.id === input.approvalId
      ? { ...a, status: 'rejected' as const, resolvedAt: now, rejectionReason: input.reason }
      : a,
  );

  // Find the approval to get taskId
  const approval = updatedApprovals.find(a => a.id === input.approvalId);
  if (!approval) {
    throw new Error(`Approval not found: ${input.approvalId}`);
  }

  // Update task status back to running (with rejection noted)
  const updatedTasks = graph.tasks.map(t =>
    t.id === approval.taskId
      ? { ...t, status: 'running' as const, approvalId: undefined }
      : t,
  );

  const updated: AgentTaskGraph = {
    ...graph,
    approvals: updatedApprovals,
    tasks: updatedTasks,
    updatedAt: now,
  };

  saveTaskGraph(updated);
  return updated;
}

// ─── List Pending ───────────────────────────────────────────────────────────

export function listPendingApprovals(briefId: string): HumanApproval[] {
  const graph = getTaskGraph(briefId);
  if (!graph) return [];
  return graph.approvals.filter(a => a.status === 'pending');
}

// ─── Check if task has pending approval ─────────────────────────────────────

export function hasPendingApproval(briefId: string, taskId: string): boolean {
  const graph = getTaskGraph(briefId);
  if (!graph) return false;
  return graph.approvals.some(
    a => a.taskId === taskId && a.status === 'pending',
  );
}
