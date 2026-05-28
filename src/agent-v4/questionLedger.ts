/**
 * Question Ledger — tracks which questions have been asked
 * to prevent repeat-asking the same thing.
 *
 * Rules:
 * 1. One pending question per slotKey at a time.
 * 2. Same question text asked >= 2 times → block (create assumption instead).
 * 3. Answer/skip/assume resolves pending questions.
 */

import type { AgentGraphState, AgentQuestionRecord, InfoSlotKey } from './types';

function qId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function ensureLedger(state: AgentGraphState): AgentQuestionRecord[] {
  return state.questionLedger ?? [];
}

/** Add a question to the ledger. If that slotKey already has a pending question, don't duplicate. */
export function addQuestionRecord(input: {
  state: AgentGraphState;
  slotKey?: InfoSlotKey;
  question: string;
}): { state: AgentGraphState; alreadyAsked: boolean } {
  const ledger = [...ensureLedger(input.state)];

  // Check if same slotKey already has a pending question
  if (input.slotKey) {
    const existing = ledger.find(
      (r) => r.slotKey === input.slotKey && r.status === 'pending',
    );
    if (existing) return { state: input.state, alreadyAsked: true };
  }

  // Check if same question text was asked before
  const sameText = ledger.filter((r) => r.question === input.question);
  if (sameText.length >= 2) return { state: input.state, alreadyAsked: true };

  const record: AgentQuestionRecord = {
    id: qId(),
    slotKey: input.slotKey,
    question: input.question,
    askedAt: new Date().toISOString(),
    status: 'pending',
  };

  return {
    state: { ...input.state, questionLedger: [...ledger, record] },
    alreadyAsked: false,
  };
}

/** Mark pending questions for a slot as answered. */
export function answerQuestionRecord(input: {
  state: AgentGraphState;
  slotKey?: InfoSlotKey;
  answer: string;
}): AgentGraphState {
  const ledger = ensureLedger(input.state).map((r) => {
    if (input.slotKey && r.slotKey === input.slotKey && r.status === 'pending') {
      return { ...r, status: 'answered' as const, answeredAt: new Date().toISOString() };
    }
    // Also answer any pending question without slotKey if it matches
    if (!input.slotKey && r.status === 'pending') {
      return { ...r, status: 'answered' as const, answeredAt: new Date().toISOString() };
    }
    return r;
  });
  return { ...input.state, questionLedger: ledger };
}

/** Mark all pending questions as skipped. */
export function markAllQuestionsSkipped(state: AgentGraphState): AgentGraphState {
  const ledger = ensureLedger(state).map((r) =>
    r.status === 'pending' ? { ...r, status: 'skipped' as const } : r,
  );
  return { ...state, questionLedger: ledger, pendingQuestions: [] };
}

/** Mark pending questions as assumed. */
export function markAllQuestionsAssumed(state: AgentGraphState, _assumption: string): AgentGraphState {
  void _assumption;
  const ledger = ensureLedger(state).map((r) =>
    r.status === 'pending' ? { ...r, status: 'assumed' as const } : r,
  );
  return { ...state, questionLedger: ledger, pendingQuestions: [] };
}

/** Check if a question was recently asked (status pending and same text). */
export function hasRecentlyAskedQuestion(input: {
  state: AgentGraphState;
  question: string;
  maxCount?: number;
}): boolean {
  const max = input.maxCount ?? 1;
  const ledger = ensureLedger(input.state);
  const count = ledger.filter((r) => r.question === input.question).length;
  return count > max;
}

/** Get all currently pending questions. */
export function getPendingLedgerQuestions(state: AgentGraphState): AgentQuestionRecord[] {
  return ensureLedger(state).filter((r) => r.status === 'pending');
}

/** Count how many times a slot has been asked. */
export function getSlotAskCount(state: AgentGraphState, slotKey: InfoSlotKey): number {
  return ensureLedger(state).filter((r) => r.slotKey === slotKey).length;
}
