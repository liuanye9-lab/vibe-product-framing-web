/**
 * Agent Graph V4 Store — localStorage persistence for AgentGraphSession.
 *
 * - Each briefId maps to one AgentGraphSession.
 * - events capped at 200, checkpoints capped at 20.
 * - Corrupted data recovery: returns empty result instead of crashing.
 */

import type { AgentGraphSession } from './types';
import type { ProductBrief } from '../types';

const AGENT_GRAPH_KEY = 'vibepilot_agent_graph_sessions_v4';
const MAX_EVENTS = 200;
const MAX_CHECKPOINTS = 20;

function loadAll(): Record<string, AgentGraphSession> {
  try {
    const raw = localStorage.getItem(AGENT_GRAPH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, AgentGraphSession>;
  } catch {
    return {};
  }
}

function saveAll(sessions: Record<string, AgentGraphSession>): void {
  try {
    localStorage.setItem(AGENT_GRAPH_KEY, JSON.stringify(sessions));
  } catch {
    console.warn('[AgentGraphV4] Failed to save sessions to localStorage');
  }
}

/** Normalize a session after load — ensure arrays exist. */
function sanitize(session: AgentGraphSession): AgentGraphSession {
  return {
    ...session,
    events: Array.isArray(session.events) ? session.events : [],
    checkpoints: Array.isArray(session.checkpoints) ? session.checkpoints : [],
  };
}

/** Create a new AgentGraphSession for a ProductBrief. */
export function createGraphSession(brief: ProductBrief): AgentGraphSession {
  const now = new Date().toISOString();
  const sessionId = `gs-${brief.id}`;
  const session: AgentGraphSession = {
    id: sessionId,
    briefId: brief.id,
    title: (brief.rawIdea || brief.ideaInput?.rawIdea || '').slice(0, 60) || 'Untitled',
    state: {
      sessionId,
      briefId: brief.id,
      status: 'idle',
      currentNodeId: 'intake',
      activeAgentName: 'orchestrator',
      userGoal: brief.rawIdea || brief.ideaInput?.rawIdea || '',
      tasks: [],
      findings: [],
      pendingQuestions: [],
      pendingCommands: [],
      workingMemory: {},
      createdAt: now,
      updatedAt: now,
      schemaVersion: 'agent-graph-v4',
    },
    events: [],
    checkpoints: [],
    createdAt: now,
    updatedAt: now,
    schemaVersion: 'agent-graph-v4',
  };

  const sessions = loadAll();
  sessions[brief.id] = session;
  saveAll(sessions);
  return session;
}

/** Get an existing session by briefId. Returns null if not found or corrupted. */
export function getGraphSession(briefId: string): AgentGraphSession | null {
  try {
    const sessions = loadAll();
    const session = sessions[briefId];
    if (!session) return null;
    return sanitize(session);
  } catch {
    return null;
  }
}

/** Save (upsert) a session. Caps events and checkpoints. */
export function saveGraphSession(session: AgentGraphSession): void {
  try {
    const sessions = loadAll();
    const capped: AgentGraphSession = {
      ...session,
      events: (session.events || []).slice(-MAX_EVENTS),
      checkpoints: (session.checkpoints || []).slice(-MAX_CHECKPOINTS),
      updatedAt: new Date().toISOString(),
    };
    sessions[session.briefId] = capped;
    saveAll(sessions);
  } catch {
    console.warn('[AgentGraphV4] Failed to save session:', session.briefId);
  }
}

/** List all sessions sorted by updatedAt descending. */
export function listGraphSessions(): AgentGraphSession[] {
  try {
    const sessions = loadAll();
    return Object.values(sessions)
      .filter((s) => s && s.briefId)
      .map(sanitize)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

/** Delete a session by briefId. */
export function deleteGraphSession(briefId: string): void {
  try {
    const sessions = loadAll();
    delete sessions[briefId];
    saveAll(sessions);
  } catch {
    console.warn('[AgentGraphV4] Failed to delete session:', briefId);
  }
}

/** Get a lightweight summary of a session. */
export function getGraphSessionSummary(briefId: string): {
  exists: boolean;
  currentNodeId?: string;
  status?: string;
  taskCount: number;
  findingCount: number;
  eventCount: number;
  checkpointCount: number;
  updatedAt?: string;
} {
  const session = getGraphSession(briefId);
  if (!session) {
    return {
      exists: false,
      taskCount: 0,
      findingCount: 0,
      eventCount: 0,
      checkpointCount: 0,
    };
  }
  return {
    exists: true,
    currentNodeId: session.state.currentNodeId,
    status: session.state.status,
    taskCount: session.state.tasks.length,
    findingCount: session.state.findings.length,
    eventCount: session.events.length,
    checkpointCount: session.checkpoints.length,
    updatedAt: session.updatedAt,
  };
}
