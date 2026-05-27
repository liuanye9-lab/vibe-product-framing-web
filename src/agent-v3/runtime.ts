/**
 * Agent V3 Runtime — the main Agent turn executor.
 *
 * Flow:
 * 1. Get or create AgentSession
 * 2. Append user message
 * 3. Parse intent
 * 4. Local Runtime Decision (handle continue/skip/assumption/generate_handoff)
 * 5. If local rules cover it → execute commands directly
 * 6. Otherwise → call AI Agent → parse commands → execute
 * 7. Return AgentRuntimeResult
 */

import type { ProductBrief } from '../types';
import type {
  AgentSession,
  AgentMessage,
  AgentCommand,
  AgentRuntimeResult,
  AgentActionCard,
  AgentPhase,
} from './types';
import { generateId } from './types';
import {
  getAgentSession,
  createAgentSession,
  appendMessage,
  appendCommand,
  appendToolResult,
  updateSessionState,
} from './sessionStore';
import { parseUserIntent, type UserIntent } from './intentParser';
import { buildAgentRuntimeContext } from './contextBuilder';
import { getAgentPhaseLabel, getNextAgentPhase, getAgentRoleForPhase } from './phaseMachine';
import { AGENT_CONTRACTS } from './agentContracts';
import { buildAgentV3SystemPrompt, buildAgentV3UserPrompt } from './agentPromptBuilder';
import { executeAgentCommand } from './toolRegistry';
import { callCopilotJson, VibeAIError, getAIConfig, buildLocalHandoff } from '../api/evaluate';

function makeMessage(
  role: 'user' | 'agent' | 'system' | 'tool',
  content: string,
  agentRole?: AgentSession['activeAgent'],
  extra?: Partial<AgentMessage>,
): AgentMessage {
  return {
    id: generateId(),
    role,
    agentRole,
    content,
    createdAt: new Date().toISOString(),
    questions: extra?.questions,
    actionCards: extra?.actionCards,
    commandIds: extra?.commandIds,
    toolResultIds: extra?.toolResultIds,
    phase: extra?.phase,
  };
}

interface AgentV3JsonResponse {
  reply: string;
  commands?: Array<{
    type: string;
    reason?: string;
    payload?: Record<string, unknown>;
  }>;
  actionCards?: Array<{
    type: string;
    title: string;
    description: string;
    actions: Array<{
      id: string;
      label: string;
      intent: string;
      value?: string;
    }>;
  }>;
  questions?: string[];
  confidence?: number;
}

// Generate local fallback commands
function handleLocalDecision(
  intent: UserIntent,
  session: AgentSession,
): { commands: AgentCommand[]; reply: string; actionCards: AgentActionCard[]; shouldWait: boolean } {
  const phase = session.currentPhase;
  const next = getNextAgentPhase(phase);
  const phaseLabel = getAgentPhaseLabel(phase);
  const nextLabel = getAgentPhaseLabel(next);

  switch (intent) {
    case 'continue': {
      const cmd: AgentCommand = {
        id: generateId(),
        type: 'move_phase',
        agentRole: session.activeAgent,
        phase,
        reason: '用户选择继续推进',
        payload: { phase: next },
      };
      return {
        commands: [cmd],
        reply: `已进入 **${nextLabel}** 阶段。我会基于已有信息继续，如果缺信息会做合理假设。`,
        actionCards: [
          {
            id: generateId(),
            type: 'next_step',
            title: `进入 ${nextLabel}`,
            description: `当前阶段 ${phaseLabel} 已通过，可以开始 ${nextLabel}。`,
            actions: [
              { id: generateId(), label: '继续', intent: 'continue' },
              { id: generateId(), label: '修改上一阶段', intent: 'edit', value: phase },
            ],
          },
        ],
        shouldWait: false,
      };
    }

    case 'skip': {
      const skipCmd: AgentCommand = {
        id: generateId(),
        type: 'move_phase',
        agentRole: session.activeAgent,
        phase,
        reason: '用户选择跳过当前阶段',
        payload: { phase: next },
      };
      return {
        commands: [skipCmd],
        reply: `跳过 **${phaseLabel}** 阶段，推进到 **${nextLabel}**。后续如需补充，随时可以回头修改。`,
        actionCards: [
          {
            id: generateId(),
            type: 'warning',
            title: `已跳过 ${phaseLabel}`,
            description: `这个阶段的信息可能会影响后续判断。如果需要补充，随时告诉我。`,
            actions: [
              { id: generateId(), label: '继续到下一阶段', intent: 'continue' },
            ],
          },
        ],
        shouldWait: false,
      };
    }

    case 'make_assumption': {
      const assumeCmd: AgentCommand = {
        id: generateId(),
        type: 'set_status',
        agentRole: session.activeAgent,
        phase,
        reason: '用户选择默认假设',
        payload: { decisionStatus: 'can_continue' },
      };
      return {
        commands: [assumeCmd],
        reply: `好的，我会基于已有信息做默认假设来推进 **${phaseLabel}**。如果假设不对，随时告诉我修改。`,
        actionCards: [],
        shouldWait: false,
      };
    }

    case 'generate_handoff': {
      const handoffCmd: AgentCommand = {
        id: generateId(),
        type: 'move_phase',
        agentRole: session.activeAgent,
        phase,
        reason: '用户请求生成 handoff',
        payload: { phase: 'handoff' as AgentPhase },
      };
      return {
        commands: [handoffCmd],
        reply: `好的，我会整合所有阶段的信息，生成 Developer Handoff。`,
        actionCards: [],
        shouldWait: false,
      };
    }

    default:
      return { commands: [], reply: '', actionCards: [], shouldWait: false };
  }
}

/**
 * Execute a full Agent Runtime turn.
 */
export async function runAgentRuntimeTurn(input: {
  brief: ProductBrief;
  userMessage: string;
}): Promise<AgentRuntimeResult> {
  const { brief, userMessage } = input;
  const briefId = brief.id;

  // 1. Get or create session
  let session = getAgentSession(briefId);
  if (!session) {
    const { migrateLegacyAgentWorkflowIfNeeded } = await import('./migrateLegacyAgent');
    session = migrateLegacyAgentWorkflowIfNeeded(briefId);
    if (!session) {
      void createAgentSession(brief);
      session = getAgentSession(briefId)!;
    }
  }

  // 2. Append user message
  const userMsg = makeMessage('user', userMessage);
  void appendMessage(briefId, userMsg);

  // 3. Parse intent
  const intent = parseUserIntent(userMessage);

  // Update session title from brief if empty
  if (!session.title || session.title === 'Untitled') {
    session = updateSessionState(briefId, {
      title: (brief.rawIdea || brief.ideaInput?.rawIdea || '').slice(0, 60),
    });
  }

  // 4. Check if local rules can handle this
  if (intent !== 'normal') {
    const localResult = handleLocalDecision(intent, session);
    if (localResult.commands.length > 0) {
      // Execute local commands
      const commandIds: string[] = [];
      const toolResultIds: string[] = [];
      let combinedBriefPatch: Partial<ProductBrief> | undefined;
      let combinedSessionPatch: Partial<AgentSession> = {};

      for (const cmd of localResult.commands) {
        session = appendCommand(briefId, cmd);
        commandIds.push(cmd.id);

        const exec = await executeAgentCommand({
          command: cmd,
          brief: { ...brief, ...combinedBriefPatch },
          session: { ...session, ...combinedSessionPatch },
        });

        session = appendToolResult(briefId, exec.toolResult);
        toolResultIds.push(exec.toolResult.id);

        if (exec.briefPatch) combinedBriefPatch = { ...combinedBriefPatch, ...exec.briefPatch };
        if (exec.sessionPatch) combinedSessionPatch = { ...combinedSessionPatch, ...exec.sessionPatch };
      }

      // Apply session patches
      if (Object.keys(combinedSessionPatch).length > 0) {
        session = updateSessionState(briefId, combinedSessionPatch);
      }

      // Add agent reply message
      const agentMsg = makeMessage('agent', localResult.reply, session.activeAgent, {
        questions: [],
        actionCards: localResult.actionCards,
        commandIds,
        toolResultIds,
        phase: session.currentPhase,
      });
      appendMessage(briefId, agentMsg);

      session = updateSessionState(briefId, {
        runStatus: localResult.shouldWait ? 'waiting_user' : 'idle',
      });

      return {
        session,
        briefPatch: combinedBriefPatch,
        userVisibleReply: localResult.reply,
        actionCards: localResult.actionCards,
        shouldWaitForUser: false,
      };
    }
  }

  // 5. Try AI call for normal intent
  const config = getAIConfig();
  if (!config) {
    // No AI config — use local fallback
    return handleAIFallback(session, brief, intent, briefId, 'AI 未配置，使用本地规则判断。');
  }

  try {
    // Build context
    const context = buildAgentRuntimeContext({ brief, session, userMessage, intent });

    // Select agent for current phase
    const activeRole = getAgentRoleForPhase(session.currentPhase);
    const contract = AGENT_CONTRACTS[activeRole];

    const systemPrompt = buildAgentV3SystemPrompt(activeRole);
    const userPrompt = buildAgentV3UserPrompt({
      role: activeRole,
      context,
      contract,
    });

    const aiResponse = await callCopilotJson<AgentV3JsonResponse>(
      systemPrompt,
      userPrompt,
      1500,
      60000,
    );

    // Parse AI response
    const reply = aiResponse.reply || '我分析了当前情况，请查看我的判断。';
    const commands = (aiResponse.commands || []).slice(0, 3);
    const actionCards = (aiResponse.actionCards || [])
      .map((card) => ({
        id: generateId(),
        type: card.type as AgentActionCard['type'],
        title: card.title,
        description: card.description,
        actions: (card.actions || []).map((a) => ({
          id: a.id || generateId(),
          label: a.label,
          intent: a.intent as AgentActionCard['actions'][0]['intent'],
          value: a.value,
        })),
      }))
      .slice(0, 2);
    const questions = (aiResponse.questions || []).slice(0, 2);

    // 6. Validate commands
    const validCommands: AgentCommand[] = [];
    for (const c of commands) {
      const cmdType = c.type as AgentCommand['type'];
      if (!contract.allowedCommands.includes(cmdType)) {
        console.warn(`[AgentV3] Command "${cmdType}" not allowed for ${activeRole}, skipping`);
        continue;
      }
      validCommands.push({
        id: generateId(),
        type: cmdType,
        agentRole: activeRole,
        phase: session.currentPhase,
        reason: c.reason || 'Agent 判断需要执行此命令',
        payload: c.payload || {},
      });
    }

    // 7. Execute commands
    const commandIds: string[] = [];
    const toolResultIds: string[] = [];
    let combinedBriefPatch: Partial<ProductBrief> | undefined;
    let combinedSessionPatch: Partial<AgentSession> = {};

    // Build handoff and evaluate handler closures
    const buildHandoffFn = async (b: ProductBrief) => {
      try { return await (await import('../api/evaluate')).optimizeHandoff(b); }
      catch { return buildLocalHandoff(b); }
    };
    const evaluateHandoffFn = async (b: ProductBrief) => {
      // evaluateHandoff doesn't exist as standalone; use local handoff + check evaluation field
      return b.finalHandoff || undefined;
    };

    for (const cmd of validCommands.slice(0, 5)) {
      session = appendCommand(briefId, cmd);
      commandIds.push(cmd.id);

      const exec = await executeAgentCommand({
        command: cmd,
        brief: { ...brief, ...combinedBriefPatch },
        session: { ...session, ...combinedSessionPatch },
        buildHandoff: buildHandoffFn,
        evaluateHandoffFn,
      });

      session = appendToolResult(briefId, exec.toolResult);
      toolResultIds.push(exec.toolResult.id);

      if (exec.briefPatch) combinedBriefPatch = { ...combinedBriefPatch, ...exec.briefPatch };
      if (exec.sessionPatch) combinedSessionPatch = { ...combinedSessionPatch, ...exec.sessionPatch };
    }

    // Apply session patches
    if (Object.keys(combinedSessionPatch).length > 0) {
      session = updateSessionState(briefId, combinedSessionPatch);
    }

    // 8. Add agent reply message
    const agentMsg = makeMessage('agent', reply, activeRole, {
      questions: questions.length > 0 ? questions : undefined,
      actionCards: actionCards.length > 0 ? actionCards : undefined,
      commandIds,
      toolResultIds,
      phase: session.currentPhase,
    });
    session = appendMessage(briefId, agentMsg);

    session = updateSessionState(briefId, {
      runStatus: questions.length > 0 || actionCards.some((c) => c.type === 'question')
        ? 'waiting_user' : 'idle',
    });

    return {
      session,
      briefPatch: combinedBriefPatch,
      userVisibleReply: reply,
      actionCards,
      shouldWaitForUser: questions.length > 0,
    };
  } catch (error) {
    console.warn('[AgentV3] AI turn failed:', error);
    const errorMsg = error instanceof VibeAIError
      ? `AI 返回不稳定：${error.message.slice(0, 100)}。当前先用本地规则判断。`
      : 'AI 调用失败，当前先用本地规则判断。';
    return handleAIFallback(session, brief, intent, briefId, errorMsg);
  }
}

async function handleAIFallback(
  session: AgentSession,
  brief: ProductBrief,
  intent: UserIntent,
  briefId: string,
  errorMsg: string,
): Promise<AgentRuntimeResult> {
  const phase = session.currentPhase;
  const phaseLabel = getAgentPhaseLabel(phase);

  let fallbackReply = `${errorMsg}\n\n当前阶段：**${phaseLabel}**。`;
  let actionCards: AgentActionCard[] = [];

  if (intent === 'normal') {
    // Check if we should ask questions or can move forward
    fallbackReply += '\n\n你可以选择：补充信息、继续下一步、或让我做默认假设。';
    actionCards = [
      {
        id: generateId(),
        type: 'decision',
        title: '当前阶段：' + phaseLabel,
        description: 'AI 暂时不可用，使用本地规则推进。',
        actions: [
          { id: generateId(), label: '继续下一步', intent: 'continue' },
          { id: generateId(), label: '先跳过', intent: 'skip' },
          { id: generateId(), label: '帮我做默认假设', intent: 'make_assumption' },
          { id: generateId(), label: '生成 Handoff', intent: 'generate_handoff' },
        ],
      },
    ];
  } else {
    // For intent-driven fallback, still execute the local decision
    const localResult = handleLocalDecision(intent, session);
    if (localResult.commands.length > 0) {
      for (const cmd of localResult.commands) {
        session = appendCommand(briefId, cmd);
        const exec = await executeAgentCommand({
          command: cmd,
          brief,
          session,
        });
        session = appendToolResult(briefId, exec.toolResult);
        if (exec.sessionPatch) {
          session = updateSessionState(briefId, exec.sessionPatch);
        }
      }
      fallbackReply = localResult.reply + '\n\n（AI 暂时不可用，使用本地规则推进。）';
      actionCards = localResult.actionCards;
    }
  }

  const agentMsg = makeMessage('agent', fallbackReply, session.activeAgent, {
    actionCards: actionCards.length > 0 ? actionCards : undefined,
    phase: session.currentPhase,
  });
  void appendMessage(briefId, agentMsg);

  void updateSessionState(briefId, { runStatus: 'waiting_user' });

  return {
    session,
    userVisibleReply: fallbackReply,
    actionCards,
    shouldWaitForUser: true,
  };
}

/**
 * Send welcome message for V3 agent workspace.
 */
export function sendV3WelcomeMessage(brief: ProductBrief): AgentSession {
  let session = getAgentSession(brief.id);
  if (!session) {
    session = createAgentSession(brief);
  }

  if (session.messages.length > 0) return session;

  const rawIdea = brief.rawIdea || brief.ideaInput?.rawIdea || '';
  const hasTargetUser = Boolean(brief.ideaInput?.targetUser);
  const hasScenario = Boolean(brief.ideaInput?.scenario);

  let welcomeContent = `你好！我是 Vibe Copilot 的 AI 产品经理。\n\n`;

  if (!rawIdea) {
    welcomeContent += `请先描述一下你想做的产品。只需简单说说：`;
  } else if (!hasTargetUser || !hasScenario) {
    welcomeContent += `我看到你的想法了：「${rawIdea.slice(0, 80)}」\n\n在我深入分析之前，想先了解：`;
  } else {
    welcomeContent += `我看到你的想法了：「${rawIdea.slice(0, 80)}」\n\n信息看起来比较清晰，我可以开始帮你做需求诊断。`;
  }

  const questions: string[] = [];
  if (!hasTargetUser) questions.push('谁会使用这个产品？他们当前的痛点是什么？');
  if (!hasScenario) questions.push('用户在什么场景下会打开这个产品？');

  const actionCards: AgentActionCard[] = [
    {
      id: generateId(),
      type: 'question',
      title: '开始你的产品决策之旅',
      description: '我作为 AI 产品经理，会帮你一步步梳理需求、定义产品、收敛 MVP、制定技术方案、审查风险、生成开发文档。',
      actions: [
        { id: generateId(), label: '我来描述想法', intent: 'answer' },
        { id: generateId(), label: '帮我做默认假设', intent: 'make_assumption' },
      ],
    },
  ];

  const agentMsg = makeMessage('agent', welcomeContent, 'orchestrator', {
    questions: questions.length > 0 ? questions : undefined,
    actionCards,
    phase: 'intake',
  });

  void appendMessage(brief.id, agentMsg);
  session = updateSessionState(brief.id, {
    currentPhase: 'intake' as AgentPhase,
    activeAgent: 'orchestrator',
    runStatus: hasTargetUser && hasScenario ? 'idle' : 'waiting_user',
    decisionStatus: hasTargetUser && hasScenario ? 'can_continue' : 'need_more_info',
  });

  return session;
}
