/**
 * Agent V3 Context Builder
 *
 * Builds compressed context for AI calls. Limits each field
 * to prevent timeout and JSON parsing issues.
 */

import type { ProductBrief, AiSuggestion } from '../types';
import type { AgentSession, AgentFinding, AgentTask, AgentMessage } from './types';
import { getAgentPhaseLabel } from './phaseMachine';
import type { UserIntent } from './intentParser';

function truncate(s: string | undefined | null, maxLen = 240): string {
  if (!s) return '';
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

function hasSuggestionValue(s: AiSuggestion | undefined): boolean {
  if (!s) return false;
  const v = s.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function summarizeBrief(brief: ProductBrief): Record<string, unknown> {
  const stages = brief.stages;
  return {
    rawIdea: truncate(brief.rawIdea || brief.ideaInput.rawIdea),
    ideaInput: {
      targetUser: brief.ideaInput.targetUser || '',
      scenario: brief.ideaInput.scenario || '',
      problem: brief.ideaInput.problem || '',
      projectType: brief.ideaInput.projectType || '',
    },
    discovery: {
      targetUser: truncate(hasSuggestionValue(stages.discovery?.targetUserEvidence) ? String(stages.discovery?.targetUserEvidence?.value) : ''),
      painFrequency: truncate(hasSuggestionValue(stages.discovery?.painFrequency) ? String(stages.discovery?.painFrequency?.value) : ''),
      currentAlternative: truncate(hasSuggestionValue(stages.discovery?.currentAlternative) ? String(stages.discovery?.currentAlternative?.value) : ''),
    },
    product: {
      oneLiner: truncate(hasSuggestionValue(stages.product?.productOneLiner) ? String(stages.product?.productOneLiner?.value) : ''),
      targetUser: truncate(hasSuggestionValue(stages.product?.targetUser) ? String(stages.product?.targetUser?.value) : ''),
      aiValue: truncate(hasSuggestionValue(stages.product?.aiValue) ? String(stages.product?.aiValue?.value) : ''),
    },
    mvp: {
      mustHave: hasSuggestionValue(stages.mvp?.mustHave) ? stages.mvp?.mustHave?.value : undefined,
      outOfScope: hasSuggestionValue(stages.mvp?.outOfScope) ? stages.mvp?.outOfScope?.value : undefined,
      minimumLoop: truncate(hasSuggestionValue(stages.mvp?.minimumLoop) ? String(stages.mvp?.minimumLoop?.value) : ''),
    },
    technical: {
      frontend: truncate(hasSuggestionValue(stages.technical?.frontend) ? String(stages.technical?.frontend?.value) : ''),
      backend: truncate(hasSuggestionValue(stages.technical?.backend) ? String(stages.technical?.backend?.value) : ''),
      database: truncate(hasSuggestionValue(stages.technical?.database) ? String(stages.technical?.database?.value) : ''),
      mockStrategy: truncate(hasSuggestionValue(stages.technical?.mockStrategy) ? String(stages.technical?.mockStrategy?.value) : ''),
    },
    risk: {
      demandRisk: hasSuggestionValue(stages.blindSpot?.demandRisk) ? stages.blindSpot?.demandRisk?.value : undefined,
      technicalRisk: hasSuggestionValue(stages.blindSpot?.technicalRisk) ? stages.blindSpot?.technicalRisk?.value : undefined,
    },
    hasHandoff: Boolean(brief.finalHandoff?.developmentPrompt),
  };
}

function summarizeFindings(findings: AgentFinding[], maxCount = 5): Record<string, unknown>[] {
  return findings.slice(-maxCount).map((f) => ({
    title: truncate(f.title, 120),
    summary: truncate(f.summary, 160),
    decisionStatus: f.decisionStatus,
    phase: f.phase,
  }));
}

function summarizeTasks(tasks: AgentTask[], maxCount = 5): Record<string, unknown>[] {
  return tasks.filter((t) => t.status !== 'done').slice(0, maxCount).map((t) => ({
    title: truncate(t.title, 120),
    status: t.status,
    required: t.required,
  }));
}

function summarizeMessages(messages: AgentMessage[], maxCount = 6): Record<string, unknown>[] {
  const nonTool = messages.filter((m) => m.role !== 'tool');
  return nonTool.slice(-maxCount).map((m) => ({
    role: m.role,
    agentRole: m.agentRole,
    content: truncate(String(m.content), 200),
    phase: m.phase,
  }));
}

export function buildAgentRuntimeContext(input: {
  brief: ProductBrief;
  session: AgentSession;
  userMessage: string;
  intent: UserIntent;
}): string {
  const { brief, session, userMessage, intent } = input;

  const context = {
    brief: summarizeBrief(brief),
    session: {
      currentPhase: session.currentPhase,
      phaseLabel: getAgentPhaseLabel(session.currentPhase),
      runStatus: session.runStatus,
      decisionStatus: session.decisionStatus,
      activeAgent: session.activeAgent,
    },
    recentMessages: summarizeMessages(session.messages),
    currentTasks: summarizeTasks(session.tasks),
    recentFindings: summarizeFindings(session.findings),
    pendingQuestions: session.pendingQuestions.slice(0, 3),
    userMessage: truncate(userMessage, 300),
    intent,
  };

  return JSON.stringify(context);
}
