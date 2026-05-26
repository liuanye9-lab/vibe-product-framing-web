import type { FinalHandoff } from '../types';
import { evaluateHandoff } from './evaluateHandoff';

type FixableSection = Exclude<keyof FinalHandoff, 'knowledgeReferences' | 'evaluation' | 'source' | 'schemaVersion' | 'validationWarnings'>;

export interface ApplyFixesResult {
  handoff: FinalHandoff;
  changed: boolean;
  appliedFixIds: string[];
}

function appendPatch(current: string, patch: string): { value: string; changed: boolean } {
  if (!patch.trim() || current.includes(patch)) return { value: current, changed: false };
  return { value: `${current.trim()}\n\n---\n\n${patch}`.trim(), changed: true };
}

export function applyHandoffFixes(handoff: FinalHandoff): ApplyFixesResult {
  const fixes = handoff.evaluation?.fixSuggestions || [];
  if (!fixes.length) return { handoff, changed: false, appliedFixIds: [] };

  const updated: FinalHandoff = { ...handoff, schemaVersion: 'v1.4' };
  const appliedFixIds: string[] = [];
  fixes.forEach((fix) => {
    const key = fix.targetSection as FixableSection;
    const result = appendPatch(String(updated[key] || ''), fix.patch);
    if (result.changed) {
      updated[key] = result.value;
      appliedFixIds.push(fix.id);
    }
  });

  if (!appliedFixIds.length) return { handoff: updated, changed: false, appliedFixIds };

  return {
    handoff: {
      ...updated,
      evaluation: evaluateHandoff(updated),
      source: handoff.source,
      schemaVersion: 'v1.4',
    },
    changed: true,
    appliedFixIds,
  };
}
