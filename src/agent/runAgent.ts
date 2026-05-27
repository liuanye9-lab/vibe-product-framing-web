/**
 * Agent Turn Runner — orchestrates the full Agent workflow cycle (V2.1).
 *
 * Changes from V2.0:
 * - Structured questions in AgentTurnResult (no more text parsing)
 * - phaseAfterTurn drives workflow.currentPhase persistence
 * - AgentMessage.content is reply-only (questions in metadata)
 */

import type { ProductBrief } from '../types';
import type {
  AgentRole,
  AgentDecisionStatus,
  AgentFinding,
  AgentWorkflowState,
  AgentMessage,
  WorkflowPhase,
} from './types';
import { runLocalOrchestrator, type OrchestratorResult } from './orchestrator';
import { buildAgentSystemPrompt, buildAgentUserContext } from './agentPrompts';
import {
  getAgentWorkflow,
  createAgentWorkflow as createWf,
  appendAgentMessage,
  addAgentFinding,
  updateWorkflowPhase,
  generateId,
} from './workflowStore';
import { callCopilotJson, VibeAIError, getAIConfig } from '../api/evaluate';
import { applyAgentPatchToBrief } from './applyAgentPatch';

function makeMessage(
  role: 'user' | 'agent' | 'system',
  content: string,
  agentRole?: AgentRole,
  metadata?: AgentMessage['metadata'],
): AgentMessage {
  return {
    id: generateId(),
    role,
    agentRole,
    content,
    createdAt: new Date().toISOString(),
    metadata,
  };
}

function makeFinding(
  id: string,
  agentRole: AgentRole,
  phase: WorkflowPhase,
  data: {
    title: string;
    summary: string;
    evidence: string[];
    risks: string[];
    missingInfo: string[];
    suggestions: string[];
    decisionStatus: string;
  },
): AgentFinding {
  return {
    id,
    agentRole,
    phase,
    title: data.title,
    summary: data.summary,
    evidence: data.evidence || [],
    risks: data.risks || [],
    missingInfo: data.missingInfo || [],
    suggestions: data.suggestions || [],
    decisionStatus: (data.decisionStatus as AgentDecisionStatus) || 'need_more_info',
  };
}

export interface AgentTurnResult {
  workflow: AgentWorkflowState;
  briefPatch?: Partial<ProductBrief>;
  reply: string;
  questions: string[];
  finding?: AgentFinding;
  orchestrator: OrchestratorResult;
}

interface AgentJsonResponse {
  reply: string;
  finding?: {
    title: string;
    summary: string;
    evidence?: string[];
    risks?: string[];
    missingInfo?: string[];
    suggestions?: string[];
    decisionStatus?: string;
  };
  questions?: string[];
  updates?: {
    targetStage?: string;
    patch?: Record<string, unknown>;
  };
}

function finalPhase(orchestrator: OrchestratorResult): WorkflowPhase {
  return orchestrator.phaseAfterTurn || orchestrator.nextPhase;
}

/**
 * Execute a full Agent turn.
 */
export async function runAgentTurn(input: {
  brief: ProductBrief;
  userMessage: string;
}): Promise<AgentTurnResult> {
  const { brief, userMessage } = input;

  const existing = getAgentWorkflow(brief.id);
  if (!existing) createWf(brief.id);

  const userMsg = makeMessage('user', userMessage);
  let workflow = appendAgentMessage(brief.id, userMsg);

  const orchestrator = runLocalOrchestrator({ brief, workflow, userMessage });

  // --- No AI needed — return local reply directly ---
  if (!orchestrator.shouldCallAI) {
    const agentMsg = makeMessage('agent', orchestrator.reply, orchestrator.nextAgent, {
      phase: finalPhase(orchestrator),
      decisionStatus: orchestrator.decisionStatus,
      questions: orchestrator.questions.length > 0 ? orchestrator.questions : undefined,
    });
    appendAgentMessage(brief.id, agentMsg);
    workflow = updateWorkflowPhase(brief.id, finalPhase(orchestrator));

    return {
      workflow,
      reply: orchestrator.reply,
      questions: orchestrator.questions,
      orchestrator,
    };
  }

  // --- AI call ---
  const config = getAIConfig();
  if (!config) {
    const fallbackReply = `${orchestrator.reply}\n\n（AI 未配置，当前使用本地规则判断。请在设置页配置 AI 连接以获取更智能的分析。）`;
    const agentMsg = makeMessage('agent', fallbackReply, orchestrator.nextAgent, {
      phase: finalPhase(orchestrator),
      decisionStatus: orchestrator.decisionStatus,
      questions: orchestrator.questions.length > 0 ? orchestrator.questions : undefined,
    });
    appendAgentMessage(brief.id, agentMsg);
    workflow = updateWorkflowPhase(brief.id, finalPhase(orchestrator));

    return {
      workflow,
      reply: fallbackReply,
      questions: orchestrator.questions,
      orchestrator,
    };
  }

  try {
    const systemPrompt = buildAgentSystemPrompt(orchestrator.nextAgent);
    const userContext = buildAgentUserContext({
      brief,
      workflow,
      userMessage,
      orchestratorResult: orchestrator,
    });

    const aiResponse = await callCopilotJson<AgentJsonResponse>(
      systemPrompt,
      userContext,
      1200,
      60000,
    );

    const reply = aiResponse.reply || orchestrator.reply;
    const questions = aiResponse.questions && aiResponse.questions.length > 0
      ? aiResponse.questions
      : orchestrator.questions;

    let finding: AgentFinding | undefined;
    if (aiResponse.finding) {
      finding = makeFinding(
        `find-${Date.now()}`,
        orchestrator.nextAgent,
        orchestrator.nextPhase,
        {
          title: aiResponse.finding.title,
          summary: aiResponse.finding.summary,
          evidence: aiResponse.finding.evidence || [],
          risks: aiResponse.finding.risks || [],
          missingInfo: aiResponse.finding.missingInfo || [],
          suggestions: aiResponse.finding.suggestions || [],
          decisionStatus: aiResponse.finding.decisionStatus || orchestrator.decisionStatus,
        },
      );
    }

    let briefPatch: Partial<ProductBrief> | undefined;
    if (aiResponse.updates?.patch && aiResponse.updates?.targetStage) {
      briefPatch = applyAgentPatchToBrief({
        brief,
        targetStage: aiResponse.updates.targetStage,
        patch: aiResponse.updates.patch,
      });
    }

    const agentMsg = makeMessage('agent', reply, orchestrator.nextAgent, {
      phase: finalPhase(orchestrator),
      decisionStatus: orchestrator.decisionStatus,
      questions: questions.length > 0 ? questions : undefined,
    });
    workflow = appendAgentMessage(brief.id, agentMsg);

    if (finding) {
      workflow = addAgentFinding(brief.id, finding);
    }

    workflow = updateWorkflowPhase(brief.id, finalPhase(orchestrator));

    return {
      workflow,
      briefPatch,
      reply,
      questions,
      finding,
      orchestrator,
    };
  } catch (error) {
    console.warn('[Agent] AI turn failed, using local orchestrator fallback:', error);

    const errorHint = error instanceof VibeAIError
      ? `\n\n（AI 返回不稳定：${error.message.slice(0, 100)}。当前先使用本地规则判断。）`
      : '\n\n（AI 调用失败，当前先使用本地规则判断。可以稍后重试。）';

    const fallbackReply = orchestrator.reply + errorHint;
    const agentMsg = makeMessage('agent', fallbackReply, orchestrator.nextAgent, {
      phase: finalPhase(orchestrator),
      decisionStatus: orchestrator.decisionStatus,
      questions: orchestrator.questions.length > 0 ? orchestrator.questions : undefined,
    });
    appendAgentMessage(brief.id, agentMsg);
    workflow = updateWorkflowPhase(brief.id, finalPhase(orchestrator));

    return {
      workflow,
      reply: fallbackReply,
      questions: orchestrator.questions,
      orchestrator,
    };
  }
}

/**
 * Send a welcome message when entering the Agent workspace.
 * Only sends if no messages exist — prevents duplicate welcomes on history resume.
 */
export function sendWelcomeMessage(brief: ProductBrief): AgentWorkflowState {
  const existing = getAgentWorkflow(brief.id);
  const workflow = existing || createWf(brief.id);

  if (workflow.messages.length > 0) return workflow;

  const orchestrator = runLocalOrchestrator({
    brief,
    workflow,
    userMessage: '',
  });

  const welcomeMsg = makeMessage('agent', orchestrator.reply, 'orchestrator', {
    phase: 'intake',
    decisionStatus: 'need_more_info',
  });
  appendAgentMessage(brief.id, welcomeMsg);
  return updateWorkflowPhase(brief.id, 'intake');
}
