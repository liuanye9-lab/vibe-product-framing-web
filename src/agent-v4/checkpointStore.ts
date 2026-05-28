/**
 * Agent Graph V4 Checkpoint Store — time travel via snapshots.
 *
 * Inspired by LangGraph's durable execution: every node transition creates
 * a checkpoint. Users can view and restore previous states.
 *
 * This is a lightweight local-only implementation.
 */

import type {
  AgentGraphCheckpoint,
  AgentGraphSession,
  AgentGraphState,
} from './types';
import { generateGraphId, type AgentNodeId } from './types';
import { createGraphEvent } from './eventLog';

/** Create a checkpoint from the current session state. */
export function createCheckpoint(input: {
  session: AgentGraphSession;
  reason: string;
}): { checkpoint: AgentGraphCheckpoint; session: AgentGraphSession } {
  const { session, reason } = input;
  const snapshot: AgentGraphState = JSON.parse(JSON.stringify(session.state));

  const checkpoint: AgentGraphCheckpoint = {
    id: generateGraphId('ckpt'),
    sessionId: session.id,
    briefId: session.briefId,
    nodeId: snapshot.currentNodeId,
    status: snapshot.status,
    snapshot,
    createdAt: new Date().toISOString(),
    reason,
  };

  const event = createGraphEvent({
    sessionId: session.id,
    briefId: session.briefId,
    type: 'checkpoint_created',
    nodeId: session.state.currentNodeId as AgentNodeId,
    message: `Checkpoint: ${reason}`,
    payload: { checkpointId: checkpoint.id },
  });

  return {
    checkpoint,
    session: {
      ...session,
      checkpoints: [...session.checkpoints, checkpoint],
      events: [...session.events, event],
      updatedAt: new Date().toISOString(),
    },
  };
}

/** Restore a session to a previous checkpoint. */
export function restoreCheckpoint(input: {
  session: AgentGraphSession;
  checkpointId: string;
}): AgentGraphSession {
  const { session, checkpointId } = input;
  const target = session.checkpoints.find((c) => c.id === checkpointId);

  if (!target) {
    console.warn('[AgentGraphV4] Checkpoint not found:', checkpointId);
    return session;
  }

  const restoredState: AgentGraphState = JSON.parse(
    JSON.stringify(target.snapshot),
  );
  restoredState.status = 'idle';
  restoredState.updatedAt = new Date().toISOString();

  const event = createGraphEvent({
    sessionId: session.id,
    briefId: session.briefId,
    type: 'state_updated',
    nodeId: restoredState.currentNodeId as AgentNodeId,
    message: `已恢复到 checkpoint: ${target.reason}`,
    payload: { checkpointId, previousNodeId: session.state.currentNodeId },
  });

  return {
    ...session,
    state: restoredState,
    events: [...session.events, event],
    updatedAt: new Date().toISOString(),
  };
}
