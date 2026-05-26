import type { HandoffSnapshot } from './types';

export interface HandoffSnapshotCompare {
  from?: HandoffSnapshot;
  to?: HandoffSnapshot;
  scoreDelta?: number;
  readinessChange?: string;
  changedSections: string[];
  appliedFixIds: string[];
}

const SECTIONS = [
  'productBrief',
  'mvpScope',
  'devSpec',
  'technicalArchitecture',
  'dataStructure',
  'acceptanceCriteria',
  'developmentPrompt',
] as const;

export function compareLatestSnapshots(snapshots: HandoffSnapshot[]): HandoffSnapshotCompare {
  const [to, from] = snapshots;
  if (!from || !to) return { from, to, changedSections: [], appliedFixIds: to?.appliedFixIds || [] };
  return {
    from,
    to,
    scoreDelta: to.score - from.score,
    readinessChange: `${from.readiness} -> ${to.readiness}`,
    changedSections: SECTIONS.filter((section) => from.handoff[section] !== to.handoff[section]),
    appliedFixIds: to.appliedFixIds || [],
  };
}
