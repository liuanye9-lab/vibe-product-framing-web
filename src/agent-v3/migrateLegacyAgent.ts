/**
 * Agent V3 Migration — converts legacy V1/V2 workflows to V3 sessions.
 *
 * Reads old vibepilot_agent_workflows_v1 and migrates to V3 format.
 * Does NOT delete old data.
 */

import type { AgentSession, AgentMessage, AgentFinding, AgentPhase } from './types';
import type { AgentWorkflowState, AgentMessage as V2Message, AgentFinding as V2Finding } from '../agent/types';
import { createAgentSession, saveAgentSession, getAgentSession } from './sessionStore';

const LEGACY_KEY = 'vibepilot_agent_workflows_v1';

function loadLegacyWorkflows(): Record<string, AgentWorkflowState> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, AgentWorkflowState>;
  } catch {
    return {};
  }
}

function migrateV2MessageToV3(msg: V2Message): AgentMessage {
  return {
    id: msg.id,
    role: msg.role,
    agentRole: msg.agentRole,
    phase: msg.metadata?.phase as AgentPhase | undefined,
    content: msg.content,
    createdAt: msg.createdAt,
    questions: msg.metadata?.questions,
    actionCards: [],
  };
}

function migrateV2FindingToV3(f: V2Finding): AgentFinding {
  return {
    id: f.id,
    phase: f.phase as AgentPhase,
    agentRole: f.agentRole,
    title: f.title,
    summary: f.summary,
    evidence: f.evidence || [],
    risks: f.risks || [],
    missingInfo: f.missingInfo || [],
    suggestions: f.suggestions || [],
    decisionStatus: f.decisionStatus === 'ready_to_decide' ? 'ready' :
      f.decisionStatus === 'can_move_next' ? 'can_continue' :
        f.decisionStatus === 'risk_detected' ? 'risk_detected' :
          f.decisionStatus === 'blocked' ? 'blocked' : 'need_more_info',
    confidence: 0.5,
    createdAt: new Date().toISOString(),
  };
}

export function migrateLegacyAgentWorkflowIfNeeded(briefId: string): AgentSession | null {
  // If V3 session already exists, don't migrate
  const existingV3 = getAgentSession(briefId);
  if (existingV3) return existingV3;

  // Check for V1/V2 workflow
  const legacyWorkflows = loadLegacyWorkflows();
  const legacy = legacyWorkflows[briefId];
  if (!legacy) return null;

  try {
    // Create V3 session from legacy data
    const migratedMessages: AgentMessage[] = (legacy.messages || []).map(migrateV2MessageToV3);
    const migratedFindings: AgentFinding[] = (legacy.findings || []).map(migrateV2FindingToV3);

    // We need a brief reference — create minimal session
    // The actual brief will be loaded by the calling page
    const session = createAgentSession({ id: briefId, rawIdea: '', ideaInput: {} } as Parameters<typeof createAgentSession>[0]);
    session.currentPhase = legacy.currentPhase as AgentPhase;
    session.messages = migratedMessages;
    session.findings = migratedFindings;
    session.acceptedFindingIds = legacy.acceptedFindings || [];
    session.rejectedFindingIds = legacy.rejectedFindings || [];
    session.schemaVersion = 'agent-v3';
    session.updatedAt = new Date().toISOString();

    saveAgentSession(session);
    return session;
  } catch {
    console.warn('[AgentV3] Failed to migrate legacy workflow for:', briefId);
    return null;
  }
}
