/**
 * Slot Filling State — tracks info gaps to prevent repeated questions.
 *
 * Core rules:
 * 1. askedCount >= 2 → never ask again, auto-assume or skip.
 * 2. status answered/assumed/skipped → never ask.
 * 3. continue/skip/make_assumption must resolve missing slots.
 */

import type {
  InfoSlotKey,
  InfoSlot,
  SlotFillingState,
  AgentNodeId,
} from './types';
import type { ProductBrief } from '../types';

const SLOT_LABELS: Record<InfoSlotKey, string> = {
  rawIdea: '原始想法',
  targetUser: '目标用户',
  scenario: '使用场景',
  coreProblem: '核心问题',
  currentAlternative: '当前替代方案',
  mvpMustHave: 'MVP 必做功能',
  mvpOutOfScope: 'MVP 范围外',
  minimumLoop: '最小闭环',
  technicalConstraint: '技术约束',
  successCriteria: '成功标准',
};

/** Which slots are required per phase. */
const PHASE_REQUIRED_SLOTS: Record<string, InfoSlotKey[]> = {
  intake: ['rawIdea'],
  demand: ['targetUser', 'scenario', 'coreProblem'],
  product: ['targetUser', 'scenario', 'coreProblem'],
  mvp: ['mvpMustHave', 'mvpOutOfScope', 'minimumLoop'],
  tech: ['technicalConstraint'],
  risk: ['successCriteria'],
  handoff: [],
  reviewer: [],
  reflection: [],
  end: [],
};

export function getSlotLabel(key: InfoSlotKey): string {
  return SLOT_LABELS[key] || key;
}

export function getRequiredSlotsForPhase(phase: AgentNodeId): InfoSlotKey[] {
  return PHASE_REQUIRED_SLOTS[phase] || [];
}

function makeSlot(key: InfoSlotKey): InfoSlot {
  return {
    key,
    label: SLOT_LABELS[key] || key,
    value: undefined,
    status: 'unknown',
    askedCount: 0,
    confidence: 0,
  };
}

/** Create initial slot filling state with all slots unknown. */
export function createInitialSlotFillingState(): SlotFillingState {
  const slots = {} as Record<InfoSlotKey, InfoSlot>;
  for (const key of Object.keys(SLOT_LABELS) as InfoSlotKey[]) {
    slots[key] = makeSlot(key);
  }
  return { slots, updatedAt: new Date().toISOString() };
}

/** Derive slot state from the brief (what user already filled). */
export function deriveSlotFillingStateFromBrief(input: {
  brief: ProductBrief;
  previous?: SlotFillingState;
}): SlotFillingState {
  const prev = input.previous || createInitialSlotFillingState();
  const { brief } = input;

  // Try to fill from brief data
  const rawIdea = brief.rawIdea || brief.ideaInput?.rawIdea || '';
  if (rawIdea && prev.slots.rawIdea.status === 'unknown') {
    prev.slots.rawIdea = { ...prev.slots.rawIdea, value: rawIdea, status: 'answered', source: 'user' };
  }
  if (brief.ideaInput?.targetUser && prev.slots.targetUser.status === 'unknown') {
    prev.slots.targetUser = { ...prev.slots.targetUser, value: brief.ideaInput.targetUser, status: 'answered', source: 'user' };
  }
  if (brief.ideaInput?.scenario && prev.slots.scenario.status === 'unknown') {
    prev.slots.scenario = { ...prev.slots.scenario, value: brief.ideaInput.scenario, status: 'answered', source: 'user' };
  }
  if (brief.ideaInput?.problem && prev.slots.coreProblem.status === 'unknown') {
    prev.slots.coreProblem = { ...prev.slots.coreProblem, value: brief.ideaInput.problem, status: 'answered', source: 'user' };
  }

  prev.updatedAt = new Date().toISOString();
  return prev;
}

/** Get slots that are required and still missing (unknown or asked). */
export function getMissingRequiredSlots(input: {
  slotState: SlotFillingState;
  phase: AgentNodeId;
}): InfoSlot[] {
  const required = PHASE_REQUIRED_SLOTS[input.phase] || [];
  const state = input.slotState;
  return required
    .map((key) => state.slots[key])
    .filter((s) => s && (s.status === 'unknown' || s.status === 'asked'));
}

/** Mark a slot as asked (user was questioned). */
export function markSlotAsked(input: {
  slotState: SlotFillingState;
  key: InfoSlotKey;
}): SlotFillingState {
  const state = { ...input.slotState, slots: { ...input.slotState.slots } };
  state.slots[input.key] = {
    ...state.slots[input.key],
    status: 'asked',
    askedCount: (state.slots[input.key].askedCount || 0) + 1,
    lastAskedAt: new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Mark a slot as answered by user. */
export function markSlotAnswered(input: {
  slotState: SlotFillingState;
  key: InfoSlotKey;
  value: string;
  source: InfoSlot['source'];
}): SlotFillingState {
  const state = { ...input.slotState, slots: { ...input.slotState.slots } };
  state.slots[input.key] = {
    ...state.slots[input.key],
    value: input.value,
    status: 'answered',
    source: input.source,
    confidence: input.source === 'user' ? 0.9 : 0.7,
  };
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Mark a slot as assumed by agent. */
export function markSlotAssumed(input: {
  slotState: SlotFillingState;
  key: InfoSlotKey;
  value: string;
  confidence?: number;
}): SlotFillingState {
  const state = { ...input.slotState, slots: { ...input.slotState.slots } };
  state.slots[input.key] = {
    ...state.slots[input.key],
    value: input.value,
    status: 'assumed',
    source: 'agent_assumption',
    confidence: input.confidence ?? 0.6,
  };
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Mark a slot as skipped. */
export function markSlotSkipped(input: {
  slotState: SlotFillingState;
  key: InfoSlotKey;
}): SlotFillingState {
  const state = { ...input.slotState, slots: { ...input.slotState.slots } };
  state.slots[input.key] = {
    ...state.slots[input.key],
    status: 'skipped',
    source: 'local_rule',
    confidence: 0.1,
  };
  state.updatedAt = new Date().toISOString();
  return state;
}

/** Should we ask about this slot? Never if asked >= 2 times or status not unknown. */
export function shouldAskSlot(slot: InfoSlot): boolean {
  if (slot.status !== 'unknown' && slot.status !== 'asked') return false;
  if (slot.askedCount >= 2) return false;
  return true;
}

/** Count how many required slots are still missing. */
export function getRequiredSlotStatus(input: {
  slotState: SlotFillingState;
  phase: AgentNodeId;
}): {
  totalRequired: number;
  missing: number;
  assumed: number;
  skipped: number;
  answered: number;
  canAdvance: boolean;
} {
  const required = PHASE_REQUIRED_SLOTS[input.phase] || [];
  if (required.length === 0) return { totalRequired: 0, missing: 0, assumed: 0, skipped: 0, answered: 0, canAdvance: true };

  let missing = 0, assumed = 0, skipped = 0, answered = 0;
  for (const key of required) {
    const s = input.slotState.slots[key];
    if (!s) { missing++; continue; }
    switch (s.status) {
      case 'unknown': case 'asked': missing++; break;
      case 'assumed': assumed++; break;
      case 'skipped': skipped++; break;
      case 'answered': answered++; break;
    }
  }
  return {
    totalRequired: required.length,
    missing, assumed, skipped, answered,
    canAdvance: missing === 0,
  };
}
