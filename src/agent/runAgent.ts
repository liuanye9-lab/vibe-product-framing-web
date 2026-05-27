/**
 * Agent Turn Runner — orchestrates the full Agent workflow cycle.
 *
 * For each user turn:
 * 1. Run local orchestrator to decide next step
 * 2. If AI is needed, call existing AI pipeline
 * 3. Parse Agent JSON response
 * 4. Fallback to local orchestrator on failure
 * 5. Save messages, findings, and brief patches
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

/**
 * Execute a full Agent turn: orchestrator → AI (optionally) → save state.
 */
export async function runAgentTurn(input: {
  brief: ProductBrief;
  userMessage: string;
}): Promise<AgentTurnResult> {
  const { brief, userMessage } = input;

  // Step 1: Ensure workflow exists, then save user message
  const existing = getAgentWorkflow(brief.id);
  if (!existing) createWf(brief.id);

  const userMsg = makeMessage('user', userMessage);
  let workflow = appendAgentMessage(brief.id, userMsg);

  // Step 2: Run local orchestrator
  const orchestrator = runLocalOrchestrator({ brief, workflow, userMessage });

  // Step 3: If no AI call needed, return local reply
  if (!orchestrator.shouldCallAI) {
    const agentMsg = makeMessage('agent', orchestrator.reply, orchestrator.nextAgent, {
      phase: orchestrator.nextPhase,
      decisionStatus: orchestrator.decisionStatus,
    });
    appendAgentMessage(brief.id, agentMsg);
    workflow = updateWorkflowPhase(brief.id, orchestrator.nextPhase);

    return {
      workflow,
      reply: orchestrator.reply,
      orchestrator,
    };
  }

  // Step 4: Try AI call
  const config = getAIConfig();
  if (!config) {
    // No AI configured, use local reply
    const fallbackReply = `${orchestrator.reply}\n\n（AI 未配置，当前使用本地规则判断。如果需要更智能的分析，请先在设置页配置 AI 连接。）`;
    const agentMsg = makeMessage('agent', fallbackReply, orchestrator.nextAgent, {
      phase: orchestrator.nextPhase,
      decisionStatus: orchestrator.decisionStatus,
    });
    appendAgentMessage(brief.id, agentMsg);
    workflow = updateWorkflowPhase(brief.id, orchestrator.nextPhase);

    return {
      workflow,
      reply: fallbackReply,
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

    // Parse agent response
    const reply = aiResponse.reply || orchestrator.reply;
    const questions = aiResponse.questions || orchestrator.questions;

    // Append questions to reply if any
    const fullReply = questions.length > 0
      ? `${reply}\n\n${questions.map((q) => `· ${q}`).join('\n')}`
      : reply;

    // Build finding if present
    let finding: AgentFinding | undefined;
    if (aiResponse.finding) {
      const f = aiResponse.finding;
      finding = makeFinding(
        `find-${Date.now()}`,
        orchestrator.nextAgent,
        orchestrator.nextPhase,
        {
          title: f.title,
          summary: f.summary,
          evidence: f.evidence || [],
          risks: f.risks || [],
          missingInfo: f.missingInfo || [],
          suggestions: f.suggestions || [],
          decisionStatus: f.decisionStatus || orchestrator.decisionStatus,
        },
      );
    }

    // Build brief patch if present
    let briefPatch: Partial<ProductBrief> | undefined;
    if (aiResponse.updates?.patch && aiResponse.updates?.targetStage) {
      briefPatch = applyAgentPatchToBrief({
        brief,
        targetStage: aiResponse.updates.targetStage,
        patch: aiResponse.updates.patch,
      });
    }

    // Save agent message
    const agentMsg = makeMessage('agent', fullReply, orchestrator.nextAgent, {
      phase: orchestrator.nextPhase,
      decisionStatus: orchestrator.decisionStatus,
    });
    workflow = appendAgentMessage(brief.id, agentMsg);

    // Save finding
    if (finding) {
      workflow = addAgentFinding(brief.id, finding);
    }

    // Update phase
    workflow = updateWorkflowPhase(brief.id, orchestrator.nextPhase);

    return {
      workflow,
      briefPatch,
      reply: fullReply,
      finding,
      orchestrator,
    };
  } catch (error) {
    // AI call failed — fallback to local orchestrator reply
    console.warn('[Agent] AI turn failed, using local orchestrator fallback:', error);

    const errorHint = error instanceof VibeAIError
      ? `\n\n（AI 返回不稳定：${error.message.slice(0, 100)}。当前先使用本地规则判断。）`
      : '\n\n（AI 调用失败，当前先使用本地规则判断。可以稍后重试。）';

    const fallbackReply = orchestrator.reply + errorHint;
    const agentMsg = makeMessage('agent', fallbackReply, orchestrator.nextAgent, {
      phase: orchestrator.nextPhase,
      decisionStatus: orchestrator.decisionStatus,
    });
    appendAgentMessage(brief.id, agentMsg);
    workflow = updateWorkflowPhase(brief.id, orchestrator.nextPhase);

    return {
      workflow,
      reply: fallbackReply,
      orchestrator,
    };
  }
}

/**
 * Send a welcome message when entering the Agent workspace.
 */
export function sendWelcomeMessage(brief: ProductBrief): AgentWorkflowState {
  const existing = getAgentWorkflow(brief.id);
  const workflow = existing || createWf(brief.id);

  // Only send welcome if no messages exist
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
