import type { DecisionLogEntry, CopilotPhase } from '../types';

const LOG_KEY = 'vibepilot_decision_logs';

function loadAll(): DecisionLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(entries: DecisionLogEntry[]): void {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-100)));
  } catch {
    // storage full, ignore
  }
}

export function addDecisionLogEntry(briefId: string, phase: CopilotPhase, summary: string): void {
  const entries = loadAll();
  entries.push({
    id: `dl-${Date.now()}`,
    briefId,
    phase,
    summary,
    createdAt: new Date().toISOString(),
  });
  saveAll(entries);
}

export function listDecisionLogEntries(briefId: string): DecisionLogEntry[] {
  return loadAll().filter((e) => e.briefId === briefId);
}
