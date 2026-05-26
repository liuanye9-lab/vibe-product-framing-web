import type { FinalHandoff } from '../types';

export interface HandoffSnapshot {
  id: string;
  briefId: string;
  createdAt: string;
  action: 'generate' | 'apply-fixes';
  schemaVersion: string;
  score: number;
  readiness: 'ready' | 'needs-review' | 'not-ready';
  handoff: FinalHandoff;
  appliedFixIds?: string[];
}
