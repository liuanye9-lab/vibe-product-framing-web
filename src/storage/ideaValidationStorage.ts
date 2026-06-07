/**
 * Idea Validation Storage — V6.0
 *
 * localStorage-based persistence for Idea Validation tasks.
 * - Max 100 tasks retained
 * - Read-safe: bad data never crashes the app
 * - No API keys stored
 * - Compatible with HistoryPage
 */

import type {
  IdeaValidationTask,
  IdeaGoalType,
  IdeaValidationNode,
  IdeaValidationNodeKey,
  ValidationNodeStatus,
} from '../types/ideaValidation';

const STORAGE_KEY = 'vibe_idea_validation_tasks_v1';
const MAX_TASKS = 100;
const CURRENT_SCHEMA_VERSION = 'idea-validation-v7';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `iv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function createDefaultNodes(): IdeaValidationNode[] {
  const keys: IdeaValidationNodeKey[] = [
    'idea_intake',
    'clarification',
    'query_planning',
    'github_research',
    'paper_research',
    'competitor_research',
    'opportunity_evaluation',
    'evaluator',
    'decision',
    'handoff',
  ];

  const titles: Record<IdeaValidationNodeKey, string> = {
    idea_intake: '接收想法',
    clarification: '澄清需求',
    query_planning: '规划搜索',
    github_research: 'GitHub 研究',
    paper_research: '论文研究',
    competitor_research: '竞品研究',
    opportunity_evaluation: '机会评估',
    evaluator: 'Evaluator 复核',
    decision: '决策建议',
    handoff: '开发交接',
  };

  return keys.map((key, i) => ({
    id: `node_${key}_${i}`,
    key,
    title: titles[key],
    status: (i === 0 ? 'pending' : 'pending') as ValidationNodeStatus,
    progressPercent: 0,
    input: {},
  }));
}

function normalizeTask(raw: IdeaValidationTask): IdeaValidationTask {
  const defaultNodes = createDefaultNodes();
  const nodeByKey = new Map(raw.nodes?.map((node) => [node.key, node]) ?? []);
  const nodes = defaultNodes.map((defaultNode) => ({
    ...defaultNode,
    ...(nodeByKey.get(defaultNode.key) ?? {}),
  }));

  const version = typeof raw.version === 'number' && Number.isFinite(raw.version)
    ? raw.version
    : 1;

  return {
    ...raw,
    schemaVersion: raw.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    version,
    nodes,
    research: {
      githubRepos: raw.research?.githubRepos ?? [],
      papers: raw.research?.papers ?? [],
      competitors: raw.research?.competitors ?? [],
      evidenceItems: raw.research?.evidenceItems ?? [],
      queryPlan: raw.research?.queryPlan,
    },
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

// ─── Read (safe) ──────────────────────────────────────────────────────────────

function loadRawTasks(): IdeaValidationTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out malformed entries
    return parsed.filter(
      (t: unknown) =>
        t &&
        typeof t === 'object' &&
        typeof (t as IdeaValidationTask).id === 'string' &&
        typeof (t as IdeaValidationTask).rawIdea === 'string',
    ).map((t) => normalizeTask(t as IdeaValidationTask));
  } catch {
    return [];
  }
}

function saveRawTasks(tasks: IdeaValidationTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function createIdeaValidationTask(input: {
  rawIdea: string;
  goalType: IdeaGoalType;
}): IdeaValidationTask {
  const task: IdeaValidationTask = {
    id: generateId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: 1,
    rawIdea: input.rawIdea,
    goalType: input.goalType,
    status: 'pending',
    progressPercent: 0,
    nodes: createDefaultNodes(),
    research: {
      githubRepos: [],
      papers: [],
      competitors: [],
      evidenceItems: [],
    },
    history: [
      {
        id: generateId(),
        version: 1,
        event: 'created',
        nodeKey: 'idea_intake',
        summary: '创建 Idea Validation 任务',
        createdAt: nowISO(),
      },
    ],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  const tasks = loadRawTasks();
  tasks.unshift(task);

  // Enforce max limit
  if (tasks.length > MAX_TASKS) {
    tasks.length = MAX_TASKS;
  }

  saveRawTasks(tasks);
  return task;
}

export function getIdeaValidationTask(id: string): IdeaValidationTask | null {
  const tasks = loadRawTasks();
  return tasks.find((t) => t.id === id) ?? null;
}

export function saveIdeaValidationTask(task: IdeaValidationTask): void {
  const tasks = loadRawTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  const previous = idx >= 0 ? tasks[idx] : null;
  const nextVersion = (previous?.version ?? task.version ?? 1) + 1;
  const updated = normalizeTask({
    ...task,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: nextVersion,
    updatedAt: nowISO(),
    history: [
      ...(task.history ?? []),
      {
        id: generateId(),
        version: nextVersion,
        event: 'saved',
        nodeKey: task.currentNodeId as IdeaValidationNodeKey | undefined,
        summary: `保存任务状态：${task.currentNodeId ?? 'unknown'}`,
        createdAt: nowISO(),
      },
    ].slice(-80),
  });
  if (idx >= 0) {
    tasks[idx] = updated;
  } else {
    tasks.unshift(updated);
  }
  saveRawTasks(tasks);
}

export function updateIdeaValidationTask(
  id: string,
  updater: (task: IdeaValidationTask) => IdeaValidationTask,
): IdeaValidationTask | null {
  const tasks = loadRawTasks();
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx < 0) return null;

  const updated = updater(tasks[idx]);
  updated.updatedAt = nowISO();
  tasks[idx] = updated;
  saveRawTasks(tasks);
  return updated;
}

export function listIdeaValidationTasks(): IdeaValidationTask[] {
  return loadRawTasks().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function deleteIdeaValidationTask(id: string): void {
  const tasks = loadRawTasks();
  const filtered = tasks.filter((t) => t.id !== id);
  saveRawTasks(filtered);
}
