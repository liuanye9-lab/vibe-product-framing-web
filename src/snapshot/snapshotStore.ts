import type { HandoffSnapshot } from './types';

const SNAPSHOT_KEY = 'vibepilot_handoff_snapshots_v1';
const MAX_SNAPSHOTS = 30;

function isSnapshot(value: unknown): value is HandoffSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.briefId === 'string' && typeof row.createdAt === 'string' && typeof row.handoff === 'object';
}

function normalizeSnapshot(snapshot: HandoffSnapshot): HandoffSnapshot {
  return {
    ...snapshot,
    appliedFixIds: Array.isArray(snapshot.appliedFixIds) ? snapshot.appliedFixIds : undefined,
  };
}

export function saveHandoffSnapshot(snapshot: HandoffSnapshot): void {
  try {
    const snapshots = listHandoffSnapshots();
    const next = [snapshot, ...snapshots.filter((item) => item.id !== snapshot.id)].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
  } catch {
    // Snapshot is diagnostic and should not block the main handoff flow.
  }
}

export function listHandoffSnapshots(briefId?: string): HandoffSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const snapshots = parsed.filter(isSnapshot).map(normalizeSnapshot);
    return briefId ? snapshots.filter((snapshot) => snapshot.briefId === briefId) : snapshots;
  } catch {
    return [];
  }
}
