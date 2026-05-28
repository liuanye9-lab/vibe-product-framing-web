/**
 * Working Memory — session-scoped variables.
 *
 * Holds key variables extracted during agent execution:
 * targetUser, scenario, problem, mvpLoop, outOfScope, technicalChoice, knownRisks.
 *
 * Not persisted separately — lives inside AgentGraphState.workingMemory.
 */

export interface WorkingMemoryVars {
  targetUser: string;
  scenario: string;
  problem: string;
  mvpLoop: string;
  outOfScope: string[];
  technicalChoice: string;
  knownRisks: string[];
}

export function createWorkingMemory(partial?: Partial<WorkingMemoryVars>): WorkingMemoryVars {
  return {
    targetUser: '',
    scenario: '',
    problem: '',
    mvpLoop: '',
    outOfScope: [],
    technicalChoice: '',
    knownRisks: [],
    ...partial,
  };
}

export function updateWorkingMemory(
  current: WorkingMemoryVars,
  patch: Partial<WorkingMemoryVars>,
): WorkingMemoryVars {
  return { ...current, ...patch };
}

export function workingMemoryToRecord(wm: WorkingMemoryVars): Record<string, unknown> {
  return {
    targetUser: wm.targetUser,
    scenario: wm.scenario,
    problem: wm.problem,
    mvpLoop: wm.mvpLoop,
    outOfScope: wm.outOfScope,
    technicalChoice: wm.technicalChoice,
    knownRisks: wm.knownRisks,
  };
}

export function workingMemoryFromRecord(record: Record<string, unknown>): WorkingMemoryVars {
  return {
    targetUser: String(record.targetUser || ''),
    scenario: String(record.scenario || ''),
    problem: String(record.problem || ''),
    mvpLoop: String(record.mvpLoop || ''),
    outOfScope: Array.isArray(record.outOfScope) ? record.outOfScope.map(String) : [],
    technicalChoice: String(record.technicalChoice || ''),
    knownRisks: Array.isArray(record.knownRisks) ? record.knownRisks.map(String) : [],
  };
}
