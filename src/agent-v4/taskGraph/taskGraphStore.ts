/**
 * V5.2 TaskGraph Store — localStorage persistence for AgentTaskGraph
 *
 * Key: vibepilot_agent_task_graphs_v1
 * Format: Record<briefId, AgentTaskGraph>
 *
 * Safety:
 * - Corrupted data never causes white screens
 * - Max 80 tasks, 200 observations, 200 toolCalls per graph
 * - updatedAt always updated on save
 * - progressPercent auto-computed from task statuses
 */

import type {
  AgentTaskGraph,
  AgentTask,
  AgentObservation,
  AgentToolCallRecord,
  HumanApproval,
  AgentTaskStatus,
} from './taskGraphTypes';
import { generateTaskGraphId } from './taskGraphTypes';

const TASK_GRAPH_KEY = 'vibepilot_agent_task_graphs_v1';

const MAX_TASKS = 80;
const MAX_OBSERVATIONS = 200;
const MAX_TOOL_CALLS = 200;

// ─── Sanitize ───────────────────────────────────────────────────────────────

function sanitizeGraph(raw: unknown): AgentTaskGraph | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.briefId !== 'string') return null;

  const tasks = Array.isArray(g.tasks) ? g.tasks as AgentTask[] : [];
  const observations = Array.isArray(g.observations) ? g.observations as AgentObservation[] : [];
  const approvals = Array.isArray(g.approvals) ? g.approvals as HumanApproval[] : [];
  const edges = Array.isArray(g.edges) ? g.edges : [];

  // Sanitize each task
  const safeTasks = tasks.map((t) => {
    const raw = t as unknown as Record<string, unknown>;
    return {
      ...t,
      steps: Array.isArray(raw.steps) ? raw.steps : [],
      toolCalls: Array.isArray(raw.toolCalls) ? raw.toolCalls : [],
      observations: Array.isArray(raw.observations) ? raw.observations : [],
      acceptanceCriteria: Array.isArray(raw.acceptanceCriteria) ? raw.acceptanceCriteria : [],
      status: raw.status || 'todo',
      progressPercent: typeof raw.progressPercent === 'number' ? raw.progressPercent : 0,
    };
  }) as AgentTask[];

  return {
    id: String(g.id),
    briefId: String(g.briefId),
    goal: typeof g.goal === 'string' ? g.goal : '',
    status: (g.status as AgentTaskStatus) || 'todo',
    progressPercent: typeof g.progressPercent === 'number' ? g.progressPercent : 0,
    currentTaskId: typeof g.currentTaskId === 'string' ? g.currentTaskId : undefined,
    tasks: safeTasks,
    edges: edges as AgentTaskGraph['edges'],
    observations,
    approvals,
    createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
    updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : new Date().toISOString(),
    schemaVersion: 'task-graph-v1',
  };
}

// ─── Load All ───────────────────────────────────────────────────────────────

function loadAll(): Record<string, AgentTaskGraph> {
  try {
    const raw = localStorage.getItem(TASK_GRAPH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, AgentTaskGraph> = {};
    for (const [briefId, val] of Object.entries(parsed)) {
      const safe = sanitizeGraph(val);
      if (safe) result[briefId] = safe;
    }
    return result;
  } catch {
    return {};
  }
}

// ─── Save All ───────────────────────────────────────────────────────────────

function saveAll(graphs: Record<string, AgentTaskGraph>): void {
  try {
    localStorage.setItem(TASK_GRAPH_KEY, JSON.stringify(graphs));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

// ─── Cap Arrays ─────────────────────────────────────────────────────────────

function capGraph(graph: AgentTaskGraph): AgentTaskGraph {
  const capped = { ...graph };

  // Cap tasks
  if (capped.tasks.length > MAX_TASKS) {
    capped.tasks = capped.tasks.slice(-MAX_TASKS);
  }

  // Cap observations
  if (capped.observations.length > MAX_OBSERVATIONS) {
    capped.observations = capped.observations.slice(-MAX_OBSERVATIONS);
  }

  // Cap toolCalls within each task
  capped.tasks = capped.tasks.map(t => ({
    ...t,
    toolCalls: t.toolCalls.length > MAX_TOOL_CALLS
      ? t.toolCalls.slice(-MAX_TOOL_CALLS)
      : t.toolCalls,
  }));

  return capped;
}

// ─── Compute Progress ───────────────────────────────────────────────────────

export function computeTaskGraphProgress(graph: AgentTaskGraph): number {
  if (graph.tasks.length === 0) return 0;

  const statusWeights: Record<AgentTaskStatus, number> = {
    todo: 0,
    planning: 0.1,
    running: 0.3,
    waiting_approval: 0.5,
    blocked: 0.2,
    done: 1,
    failed: 0,
    skipped: 0,
  };

  let totalWeight = 0;
  for (const task of graph.tasks) {
    totalWeight += statusWeights[task.status] ?? 0;
  }

  return Math.round((totalWeight / graph.tasks.length) * 100);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function createTaskGraph(input: {
  briefId: string;
  goal: string;
}): AgentTaskGraph {
  const now = new Date().toISOString();
  const graph: AgentTaskGraph = {
    id: generateTaskGraphId('graph'),
    briefId: input.briefId,
    goal: input.goal,
    status: 'todo',
    progressPercent: 0,
    tasks: [],
    edges: [],
    observations: [],
    approvals: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 'task-graph-v1',
  };

  const all = loadAll();
  all[input.briefId] = graph;
  saveAll(all);
  return graph;
}

export function getTaskGraph(briefId: string): AgentTaskGraph | null {
  const all = loadAll();
  return all[briefId] ?? null;
}

export function saveTaskGraph(graph: AgentTaskGraph): void {
  const capped = capGraph(graph);
  capped.updatedAt = new Date().toISOString();
  capped.progressPercent = computeTaskGraphProgress(capped);

  const all = loadAll();
  all[capped.briefId] = capped;
  saveAll(all);
}

export function updateTaskGraph(
  briefId: string,
  updater: (graph: AgentTaskGraph) => AgentTaskGraph,
): AgentTaskGraph {
  const all = loadAll();
  const existing = all[briefId];
  if (!existing) {
    throw new Error(`TaskGraph not found for briefId: ${briefId}`);
  }

  const updated = updater(existing);
  const capped = capGraph(updated);
  capped.updatedAt = new Date().toISOString();
  capped.progressPercent = computeTaskGraphProgress(capped);

  all[briefId] = capped;
  saveAll(all);
  return capped;
}

export function appendTask(
  graph: AgentTaskGraph,
  task: AgentTask,
): AgentTaskGraph {
  return {
    ...graph,
    tasks: [...graph.tasks, task],
  };
}

export function appendObservation(
  graph: AgentTaskGraph,
  observation: AgentObservation,
): AgentTaskGraph {
  return {
    ...graph,
    observations: [...graph.observations, observation],
  };
}

export function appendToolCall(
  graph: AgentTaskGraph,
  toolCall: AgentToolCallRecord,
): AgentTaskGraph {
  // Also append to the relevant task's toolCalls
  const tasks = graph.tasks.map(t =>
    t.id === toolCall.taskId
      ? { ...t, toolCalls: [...t.toolCalls, toolCall] }
      : t,
  );
  return { ...graph, tasks };
}

export function appendApproval(
  graph: AgentTaskGraph,
  approval: HumanApproval,
): AgentTaskGraph {
  return {
    ...graph,
    approvals: [...graph.approvals, approval],
  };
}

export function deleteTaskGraph(briefId: string): void {
  try {
    const all = loadAll();
    delete all[briefId];
    saveAll(all);
  } catch {
    // ignore
  }
}

export function listTaskGraphs(): AgentTaskGraph[] {
  return Object.values(loadAll());
}
