import type { HandoffTrace } from './types';

const TRACE_KEY = 'vibepilot_handoff_traces_v1';
const MAX_TRACES = 50;

function isTrace(value: unknown): value is HandoffTrace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.briefId === 'string' && typeof row.createdAt === 'string';
}

function normalizeTrace(value: HandoffTrace): HandoffTrace {
  return {
    ...value,
    retrievedDocIds: Array.isArray(value.retrievedDocIds) ? value.retrievedDocIds : [],
    appliedFixIds: Array.isArray(value.appliedFixIds) ? value.appliedFixIds : undefined,
    remainingIssues: Array.isArray(value.remainingIssues) ? value.remainingIssues : undefined,
  };
}

export function saveHandoffTrace(trace: HandoffTrace): void {
  try {
    const traces = listHandoffTraces();
    const next = [trace, ...traces.filter((item) => item.id !== trace.id)].slice(0, MAX_TRACES);
    localStorage.setItem(TRACE_KEY, JSON.stringify(next));
  } catch {
    // Trace is diagnostic only and must not block handoff generation.
  }
}

export function listHandoffTraces(briefId?: string): HandoffTrace[] {
  try {
    const raw = localStorage.getItem(TRACE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const traces = parsed.filter(isTrace).map(normalizeTrace);
    return briefId ? traces.filter((trace) => trace.briefId === briefId) : traces;
  } catch {
    return [];
  }
}
