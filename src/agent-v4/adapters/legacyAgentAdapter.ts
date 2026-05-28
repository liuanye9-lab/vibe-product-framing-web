/**
 * Legacy Agent Adapter — bridge between agent-v3 and agent-v4.
 *
 * Allows migration from old AgentSession to new AgentGraphSession.
 */

import type { AgentSession } from '../../agent-v3/types';
import type {
  AgentGraphSession,
  AgentGraphState,
  AgentGraphTask,
  AgentGraphFinding,
} from '../types';
import { getGraphSession, saveGraphSession } from '../graphStore';

export async function migrateV3ToV4(brief: { id: string; rawIdea?: string }): Promise<AgentGraphSession | null> {
  // Check if v4 session already exists
  const existing = getGraphSession(brief.id);
  if (existing) return existing;

  // Try to load v3 session
  let v3Session: AgentSession | null = null;
  try {
    // Dynamic import at runtime
    const mod = await import('../../agent-v3/sessionStore');
    v3Session = mod.getAgentSession(brief.id);
  } catch {
    // v3 not available
  }

  if (!v3Session) return null;

  // Create v4 session
  const now = new Date().toISOString();
  const sessionId = `gs-${brief.id}`;

  const tasks: AgentGraphTask[] = (v3Session.tasks || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    ownerNode: (t.phase || 'intake') as AgentGraphTask['ownerNode'],
    status: (t.status as AgentGraphTask['status']) || 'todo',
    phase: (t.phase || 'intake') as AgentGraphTask['phase'],
    required: t.required,
    createdAt: t.createdAt || now,
    updatedAt: t.updatedAt || now,
  }));

  const findings: AgentGraphFinding[] = (v3Session.findings || []).map((f) => ({
    id: f.id,
    title: f.title,
    summary: f.summary,
    nodeId: (f.phase || 'demand') as AgentGraphFinding['nodeId'],
    evidence: f.evidence || [],
    risks: f.risks || [],
    missingInfo: f.missingInfo || [],
    suggestions: f.suggestions || [],
    confidence: f.confidence || 0.5,
    createdAt: f.createdAt || now,
  }));

  const state: AgentGraphState = {
    sessionId,
    briefId: brief.id,
    status: 'idle',
    currentNodeId: (v3Session.currentPhase || 'intake') as AgentGraphState['currentNodeId'],
    activeAgentName: v3Session.activeAgent || 'orchestrator',
    userGoal: brief.rawIdea || '',
    tasks,
    findings,
    pendingQuestions: v3Session.pendingQuestions || [],
    pendingCommands: [],
    workingMemory: {},
    createdAt: v3Session.createdAt || now,
    updatedAt: now,
    schemaVersion: 'agent-graph-v4',
  };

  const session: AgentGraphSession = {
    id: sessionId,
    briefId: brief.id,
    title: v3Session.title || brief.rawIdea?.slice(0, 60) || 'Untitled',
    state,
    events: [],
    checkpoints: [],
    createdAt: v3Session.createdAt || now,
    updatedAt: now,
    schemaVersion: 'agent-graph-v4',
  };

  saveGraphSession(session);
  return session;
}
