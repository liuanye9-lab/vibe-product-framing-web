/**
 * Agent V3 Session Store — localStorage persistence for AgentSession.
 * Each briefId has exactly one active session.
 */

import type {
  AgentSession,
  AgentMessage,
  AgentCommand,
  AgentToolResult,
  AgentPhase,
  AgentRole,
  AgentRunStatus,
  DecisionStatus,
} from './types';
import type { ProductBrief } from '../types';

const AGENT_SESSION_KEY = 'vibepilot_agent_sessions_v3';
const MAX_MESSAGES = 120;
const MAX_COMMANDS = 120;
const MAX_TOOL_RESULTS = 120;

function loadAllSessions(): Record<string, AgentSession> {
  try {
    const raw = localStorage.getItem(AGENT_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, AgentSession>;
  } catch {
    return {};
  }
}

function saveAllSessions(sessions: Record<string, AgentSession>): void {
  try {
    localStorage.setItem(AGENT_SESSION_KEY, JSON.stringify(sessions));
  } catch {
    console.warn('[AgentV3] Failed to save sessions to localStorage');
  }
}

export function createAgentSession(brief: ProductBrief): AgentSession {
  const session: AgentSession = {
    id: `sess-${brief.id}`,
    briefId: brief.id,
    title: brief.rawIdea?.slice(0, 60) || brief.ideaInput?.rawIdea?.slice(0, 60) || 'Untitled',
    currentPhase: 'intake',
    runStatus: 'idle',
    decisionStatus: 'need_more_info',
    activeAgent: 'orchestrator',
    messages: [],
    tasks: [],
    findings: [],
    commands: [],
    toolResults: [],
    pendingQuestions: [],
    pendingCommands: [],
    acceptedFindingIds: [],
    rejectedFindingIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: 'agent-v3',
  };

  const sessions = loadAllSessions();
  sessions[brief.id] = session;
  saveAllSessions(sessions);
  return session;
}

export function getAgentSession(briefId: string): AgentSession | null {
  try {
    const sessions = loadAllSessions();
    const session = sessions[briefId];
    if (!session) return null;
    // Sanitize arrays
    return {
      ...session,
      messages: Array.isArray(session.messages) ? session.messages : [],
      tasks: Array.isArray(session.tasks) ? session.tasks : [],
      findings: Array.isArray(session.findings) ? session.findings : [],
      commands: Array.isArray(session.commands) ? session.commands : [],
      toolResults: Array.isArray(session.toolResults) ? session.toolResults : [],
      pendingQuestions: Array.isArray(session.pendingQuestions) ? session.pendingQuestions : [],
      pendingCommands: Array.isArray(session.pendingCommands) ? session.pendingCommands : [],
      acceptedFindingIds: Array.isArray(session.acceptedFindingIds) ? session.acceptedFindingIds : [],
      rejectedFindingIds: Array.isArray(session.rejectedFindingIds) ? session.rejectedFindingIds : [],
    };
  } catch {
    return null;
  }
}

export function saveAgentSession(session: AgentSession): void {
  try {
    const sessions = loadAllSessions();
    sessions[session.briefId] = {
      ...session,
      updatedAt: new Date().toISOString(),
    };
    saveAllSessions(sessions);
  } catch {
    console.warn('[AgentV3] Failed to save session:', session.briefId);
  }
}

export function listAgentSessions(): AgentSession[] {
  try {
    const sessions = loadAllSessions();
    return Object.values(sessions)
      .filter((s) => s && s.briefId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
}

export function deleteAgentSession(briefId: string): void {
  try {
    const sessions = loadAllSessions();
    delete sessions[briefId];
    saveAllSessions(sessions);
  } catch {
    console.warn('[AgentV3] Failed to delete session:', briefId);
  }
}

export function appendMessage(briefId: string, message: AgentMessage): AgentSession {
  const sessions = loadAllSessions();
  const session = sessions[briefId];
  if (!session) return {} as AgentSession;

  session.messages = [...session.messages, message].slice(-MAX_MESSAGES);
  session.updatedAt = new Date().toISOString();
  sessions[briefId] = session;
  saveAllSessions(sessions);
  return session;
}

export function appendCommand(briefId: string, command: AgentCommand): AgentSession {
  const sessions = loadAllSessions();
  const session = sessions[briefId];
  if (!session) return {} as AgentSession;

  session.commands = [...session.commands, command].slice(-MAX_COMMANDS);
  session.updatedAt = new Date().toISOString();
  sessions[briefId] = session;
  saveAllSessions(sessions);
  return session;
}

export function appendToolResult(briefId: string, result: AgentToolResult): AgentSession {
  const sessions = loadAllSessions();
  const session = sessions[briefId];
  if (!session) return {} as AgentSession;

  session.toolResults = [...session.toolResults, result].slice(-MAX_TOOL_RESULTS);
  session.updatedAt = new Date().toISOString();
  sessions[briefId] = session;
  saveAllSessions(sessions);
  return session;
}

export function updateSessionState(briefId: string, patch: Partial<AgentSession>): AgentSession {
  const sessions = loadAllSessions();
  let session = sessions[briefId];
  if (!session) return {} as AgentSession;

  session = { ...session, ...patch, updatedAt: new Date().toISOString() };
  sessions[briefId] = session;
  saveAllSessions(sessions);
  return session;
}

export function getAgentSessionSummary(briefId: string): {
  exists: boolean;
  currentPhase?: AgentPhase;
  runStatus?: AgentRunStatus;
  decisionStatus?: DecisionStatus;
  activeAgent?: AgentRole;
  messageCount: number;
  taskCount: number;
  findingCount: number;
  updatedAt?: string;
} {
  const session = getAgentSession(briefId);
  if (!session) return { exists: false, messageCount: 0, taskCount: 0, findingCount: 0 };
  return {
    exists: true,
    currentPhase: session.currentPhase,
    runStatus: session.runStatus,
    decisionStatus: session.decisionStatus,
    activeAgent: session.activeAgent,
    messageCount: session.messages.filter((m) => m.role !== 'system').length,
    taskCount: session.tasks.length,
    findingCount: session.findings.length,
    updatedAt: session.updatedAt,
  };
}
