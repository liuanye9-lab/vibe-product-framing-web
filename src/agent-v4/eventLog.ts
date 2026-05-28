/**
 * Agent Graph V4 Event Log — observable runtime events.
 *
 * Every node start/complete, tool call/result, state update, human interrupt,
 * checkpoint, evaluation, reflection, and error produces an event.
 * This makes the Agent runtime observable, not a black box.
 */

import type { AgentGraphEvent, AgentGraphSession, AgentNodeId } from './types';
import { generateGraphId } from './types';

interface CreateEventInput {
  sessionId: string;
  briefId: string;
  type: AgentGraphEvent['type'];
  nodeId?: AgentNodeId;
  message?: string;
  payload?: Record<string, unknown>;
}

export function createGraphEvent(input: CreateEventInput): AgentGraphEvent {
  return {
    id: generateGraphId('evt'),
    sessionId: input.sessionId,
    briefId: input.briefId,
    type: input.type,
    nodeId: input.nodeId,
    message: input.message,
    payload: input.payload,
    createdAt: new Date().toISOString(),
  };
}

/** Append a single event to a session and return the updated session. */
export function appendGraphEvent(
  session: AgentGraphSession,
  event: AgentGraphEvent,
): AgentGraphSession {
  return {
    ...session,
    events: [...session.events, event],
    updatedAt: new Date().toISOString(),
  };
}

/** Append multiple events at once. */
export function appendGraphEvents(
  session: AgentGraphSession,
  events: AgentGraphEvent[],
): AgentGraphSession {
  if (events.length === 0) return session;
  return {
    ...session,
    events: [...session.events, ...events],
    updatedAt: new Date().toISOString(),
  };
}
