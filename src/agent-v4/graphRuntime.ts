/**
 * Agent Graph Runtime V4.4 — API Required Runtime Lock.
 *
 * V4.4 changes:
 * - assertApiReady() must pass before any AI turn.
 * - No local-rule or mock fallback on AI failure.
 * - AI failure → status='failed', no phase advancement.
 */

import type { ProductBrief } from '../types';
import type {
  AgentGraphSession,
  AgentGraphRunResult,
  AgentGraphEvent,
  AgentGraphCommand,
  AgentNodeId,
} from './types';
import {
  getGraphSession,
  createGraphSession,
  saveGraphSession,
} from './graphStore';
import { createGraphEvent, appendGraphEvent } from './eventLog';
import { createCheckpoint } from './checkpointStore';
import { canTransition, getDefaultNextNode } from './graph';
import { executeToolCall } from './tools/toolRegistry';
import {
  deriveSlotFillingStateFromBrief,
  getMissingRequiredSlots,
  markSlotAssumed,
  markSlotSkipped,
} from './slotFilling';
import {
  markAllQuestionsSkipped,
  markAllQuestionsAssumed,
} from './questionLedger';
import { generateDefaultAssumptions } from './defaultAssumptions';

// AI integration
import { callCopilotJson, getAIConfig, VibeAIError } from '../api/evaluate';
import { assertApiReady } from '../api/apiHealth';
import { getNodeLabel } from './graph';

// Node runners
import { runOrchestratorNode } from './nodes/orchestratorNode';
import { runIntakeNode } from './nodes/intakeNode';
import { runDemandNode } from './nodes/demandNode';
import { runProductNode } from './nodes/productNode';
import { runMvpNode } from './nodes/mvpNode';
import { runTechNode } from './nodes/techNode';
import { runRiskNode } from './nodes/riskNode';
import { runHandoffNode } from './nodes/handoffNode';
import { runReviewerNode } from './nodes/reviewerNode';
import { runReflectionNode } from './nodes/reflectionNode';

// Node runners (kept for reference; V4.4 local fallback removed)
void (function registerNodeRunners() {
  const runners: Record<string, typeof runOrchestratorNode> = {
  orchestrator: runOrchestratorNode,
  intake: runIntakeNode,
  demand: runDemandNode,
  product: runProductNode,
  mvp: runMvpNode,
  tech: runTechNode,
  risk: runRiskNode,
  handoff: runHandoffNode,
  reviewer: runReviewerNode,
  reflection: runReflectionNode,
  };
  void runners;
})();

const MAX_COMMANDS_PER_TURN = 5;

// ---- Intent Parsing (V4.1: action-oriented) ----

type UserIntentV4 =
  | 'continue'
  | 'skip'
  | 'make_assumption'
  | 'generate_handoff'
  | 'ask_why'
  | 'normal';

function parseIntent(message: string): UserIntentV4 {
  const m = message.trim().toLowerCase();
  if (m === '继续下一步' || m === 'continue' || m === '继续') return 'continue';
  if (m === '先跳过' || m === 'skip' || m === '跳过') return 'skip';
  if (m === '帮我做默认假设' || m === 'make_assumption' || m === '默认假设') return 'make_assumption';
  if (m.includes('生成开发文档') || m.includes('生成 handoff') || m.includes('生成交付') || m.includes('生成 codex') || m.includes('开发提示词') || m === '生成交付' || m === '生成交付文档') return 'generate_handoff';
  if (m.includes('为什么') || m.includes('解释')) return 'ask_why';
  return 'normal';
}

// ---- Main Runtime (V4.1) ----

export async function runAgentGraphTurn(input: {
  brief: ProductBrief;
  userMessage: string;
  onProgress?: (event: {
    phase: string;
    message: string;
  }) => void;
}): Promise<AgentGraphRunResult> {
  const { brief, userMessage } = input;
  const onProgress = input.onProgress ?? (() => {});
  const briefId = brief.id;
  const events: AgentGraphEvent[] = [];

  // 1. Assert API ready (V4.4: no local-rule fallback)
  assertApiReady();

  // 2. Get or create session, init slot filling
  let session = getGraphSession(briefId);
  if (!session) session = createGraphSession(brief);

  // Init slotFilling if missing
  if (!session.state.slotFilling) {
    session = {
      ...session,
      state: {
        ...session.state,
        slotFilling: deriveSlotFillingStateFromBrief({ brief }),
        questionLedger: session.state.questionLedger ?? [],
        advancementCount: session.state.advancementCount ?? 0,
      },
    };
  }

  // Re-derive slots from brief each turn (picks up user edits in legacy steps)
  session = {
    ...session,
    state: {
      ...session.state,
      slotFilling: deriveSlotFillingStateFromBrief({
        brief,
        previous: session.state.slotFilling,
      }),
    },
  };

  // Update title if empty
  if (!session.title || session.title === 'Untitled') {
    session = { ...session, title: (brief.rawIdea || brief.ideaInput?.rawIdea || '').slice(0, 60) || 'Untitled' };
  }

  // 2. Append user message event
  const userEvent = createGraphEvent({
    sessionId: session.id, briefId: session.briefId, type: 'user_message',
    message: userMessage.slice(0, 200), payload: { userMessage },
  });
  session = appendGraphEvent(session, userEvent);
  events.push(userEvent);

  // 3. Parse intent
  const intent = parseIntent(userMessage);
  onProgress({ phase: 'understanding', message: `意图: ${intent}` });

  // 4. Checkpoint
  const ckptResult = createCheckpoint({ session, reason: `用户消息处理前 (${intent})` });
  session = ckptResult.session;
  events.push(session.events[session.events.length - 1]);

  // ---- V4.1: Pre-handle action intents BEFORE orchestrator ----
  let briefPatch: Partial<ProductBrief> | undefined;

  if (intent === 'continue' || intent === 'skip' || intent === 'make_assumption') {
    // Record user action
    const actionEvent = createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'user_action_clicked',
      message: `用户操作: ${intent}`,
    });
    session = appendGraphEvent(session, actionEvent);
    events.push(actionEvent);

    // Resolve slots based on intent
    const slotState = session.state.slotFilling!;
    const currentNodeId = session.state.currentNodeId;
    let userReply: string;
    onProgress({ phase: 'checking_context', message: `节点: ${currentNodeId}` });

    if (intent === 'skip') {
      // Mark all missing required slots as skipped
      const missing = getMissingRequiredSlots({ slotState, phase: currentNodeId });
      let newSlotState = slotState;
      for (const ms of missing) {
        newSlotState = markSlotSkipped({ slotState: newSlotState, key: ms.key });
        events.push(createGraphEvent({
          sessionId: session.id, briefId: session.briefId, type: 'slot_skipped',
          nodeId: currentNodeId, message: `跳过: ${ms.label}`,
        }));
      }
      // Clear pending questions
      const skippedState = markAllQuestionsSkipped({ ...session.state, slotFilling: newSlotState });
      session = { ...session, state: { ...skippedState, slotFilling: newSlotState, pendingQuestions: [] } };
      userReply = '已跳过当前阶段。缺失信息已标记为跳过，后续交付文档会标注。进入下一阶段。';
    } else if (intent === 'make_assumption') {
      // Generate assumptions for missing slots
      const missing = getMissingRequiredSlots({ slotState, phase: currentNodeId });
      let newSlotState = slotState;
      if (missing.length > 0) {
        const assumptions = generateDefaultAssumptions({ brief, phase: currentNodeId, missingSlots: missing });
        for (const a of assumptions) {
          newSlotState = markSlotAssumed({ slotState: newSlotState, key: a.slotKey, value: a.value, confidence: a.confidence });
          events.push(createGraphEvent({
            sessionId: session.id, briefId: session.briefId, type: 'slot_assumed',
            nodeId: currentNodeId, message: `默认假设: ${a.slotKey}=${a.value.slice(0, 50)}`,
            payload: { slotKey: a.slotKey, value: a.value, confidence: a.confidence },
          }));
        }
        // Also mark remaining as assumed
        for (const ms of missing) {
          if (!assumptions.find((a) => a.slotKey === ms.key)) {
            newSlotState = markSlotSkipped({ slotState: newSlotState, key: ms.key });
          }
        }
      }
      const assumedState = markAllQuestionsAssumed({ ...session.state, slotFilling: newSlotState }, '用户选择默认假设');
      session = { ...session, state: { ...assumedState, slotFilling: newSlotState, pendingQuestions: [] } };
      userReply = '我先做了低置信度假设，并进入下一步。下面是我假设的内容，你可以随时修改。';
    } else {
      // continue: auto-resolve missing slots, force advance
      const missing = getMissingRequiredSlots({ slotState, phase: currentNodeId });
      let newSlotState = slotState;
      if (missing.length > 0) {
        const assumptions = generateDefaultAssumptions({ brief, phase: currentNodeId, missingSlots: missing });
        for (const a of assumptions) {
          newSlotState = markSlotAssumed({ slotState: newSlotState, key: a.slotKey, value: a.value, confidence: a.confidence });
          events.push(createGraphEvent({
            sessionId: session.id, briefId: session.briefId, type: 'slot_assumed',
            nodeId: currentNodeId, message: `自动假设: ${a.slotKey}=${a.value.slice(0, 50)}`,
            payload: { slotKey: a.slotKey, confidence: a.confidence, reason: '用户点击继续，自动假设缺失信息' },
          }));
        }
        for (const ms of missing) {
          if (!assumptions.find((a) => a.slotKey === ms.key)) {
            newSlotState = markSlotSkipped({ slotState: newSlotState, key: ms.key });
          }
        }
      }
      const continueState = markAllQuestionsAssumed({ ...session.state, slotFilling: newSlotState }, '用户选择继续');
      session = { ...session, state: { ...continueState, slotFilling: newSlotState, pendingQuestions: [], advancementCount: (session.state.advancementCount ?? 0) + 1 } };
      userReply = '已进入下一阶段。我会把缺失信息标记为默认假设，后续你可以随时修改。';
    }

    // Force advance to next node
    const nextId = getDefaultNextNode(currentNodeId);
    if (canTransition(currentNodeId, nextId)) {
      // Create phase_advanced event
      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'phase_advanced',
        nodeId: currentNodeId, message: `阶段推进: ${currentNodeId} → ${nextId}`,
      }));

      session = {
        ...session,
        state: {
          ...session.state,
          previousNodeId: currentNodeId,
          currentNodeId: nextId as AgentNodeId,
          status: 'idle',
          activeAgentName: nextId,
          updatedAt: new Date().toISOString(),
        },
      };

      saveGraphSession(session);

      return {
        session, briefPatch, events, userVisibleReply: userReply, interrupted: false,
      };
    }

    session = { ...session, state: { ...session.state, status: 'idle' } };
    saveGraphSession(session);
    return { session, briefPatch, events, userVisibleReply: userReply, interrupted: false };
  }

  // ---- Normal / handoff / ask_why paths ----

  // For generate_handoff, route directly
  if (intent === 'generate_handoff') {
    const he = createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'user_action_clicked',
      message: '用户请求生成 Handoff', nodeId: session.state.currentNodeId,
    });
    session = appendGraphEvent(session, he);
    events.push(he);

    // Pre-fill missing slots with assumptions before generating
    const slotState = session.state.slotFilling!;
    const missing = getMissingRequiredSlots({ slotState, phase: 'handoff' });
    if (missing.length > 0) {
      let newSlotState = slotState;
      const assumptions = generateDefaultAssumptions({ brief, phase: 'handoff', missingSlots: missing });
      for (const a of assumptions) {
        newSlotState = markSlotAssumed({ slotState: newSlotState, key: a.slotKey, value: a.value, confidence: a.confidence });
      }
      session = { ...session, state: { ...session.state, slotFilling: newSlotState, pendingQuestions: [] } };
    }

    // Route to handoff node
    if (canTransition(session.state.currentNodeId, 'handoff')) {
      session = {
        ...session,
        state: { ...session.state, previousNodeId: session.state.currentNodeId, currentNodeId: 'handoff', status: 'running' },
      };
    }

    // Execute handoff node
    const nodeStartEvent = createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'node_started',
      nodeId: 'handoff', message: '进入 handoff 节点',
    });
    session = appendGraphEvent(session, nodeStartEvent);
    events.push(nodeStartEvent);

    try {
      const nodeResult = await runHandoffNode({ brief: { ...brief, ...briefPatch }, session, userMessage });
      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'node_completed',
        nodeId: 'handoff', message: nodeResult.reply.slice(0, 200),
      }));

      const nodeExecResult = await executeCommands({
        session, brief: { ...brief, ...briefPatch }, commands: nodeResult.commands, nodeId: 'handoff',
      });
      session = nodeExecResult.session;
      if (nodeExecResult.briefPatch) briefPatch = { ...briefPatch, ...nodeExecResult.briefPatch };

      session = {
        ...session,
        state: {
          ...session.state,
          previousNodeId: 'handoff', currentNodeId: 'reviewer',
          status: nodeResult.shouldInterrupt ? 'waiting_user' : 'idle',
          updatedAt: new Date().toISOString(),
        },
      };

      saveGraphSession(session);
      return { session, briefPatch, events, userVisibleReply: nodeResult.reply, interrupted: false };
    } catch (e) {
      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'error',
        nodeId: 'handoff', message: `Handoff 生成失败: ${String(e)}`,
      }));
      saveGraphSession(session);
      return { session, briefPatch, events, userVisibleReply: '生成失败，请重试。', interrupted: true };
    }
  }

  // ---- AI Agent Call (V4.3: actually calls the LLM) ----

  async function attemptAIAgentCall(params: {
    session: AgentGraphSession;
    brief: ProductBrief;
    userMessage: string;
    intent: string;
    events: AgentGraphEvent[];
  }): Promise<{
    reply: string;
    commands: Array<{ type: string; reason: string; payload: Record<string, unknown> }>;
    questions: string[];
    actionCards: Array<{ type: string; title: string; description: string; actions: Array<{ id: string; label: string; intent: string }> }>;
    usedAI: boolean;
  } | null> {
    const config = getAIConfig();
    if (!config) return null;

    const { session, brief, userMessage, intent, events } = params;
    const currentNodeId = session.state.currentNodeId;
    const nodeLabel = getNodeLabel(currentNodeId);

    // Build compact context
    const context = JSON.stringify({
      rawIdea: (brief.rawIdea || brief.ideaInput?.rawIdea || '').slice(0, 240),
      targetUser: brief.ideaInput?.targetUser || '',
      scenario: brief.ideaInput?.scenario || '',
      problem: brief.ideaInput?.problem || '',
      projectType: brief.ideaInput?.projectType || '',
      currentNodeId,
      currentNodeLabel: nodeLabel,
      status: session.state.status,
      pendingQuestions: session.state.pendingQuestions.slice(0, 3),
      advancementCount: session.state.advancementCount ?? 0,
      knownFacts: session.state.slotFilling
        ? Object.entries(session.state.slotFilling.slots)
            .filter(([, s]) => s.status === 'answered' && s.value)
            .map(([k, s]) => ({ key: k, value: (s.value || '').slice(0, 100) }))
            .slice(0, 6)
        : [],
      assumptions: session.state.slotFilling
        ? Object.entries(session.state.slotFilling.slots)
            .filter(([, s]) => s.status === 'assumed' && s.value)
            .map(([k, s]) => ({ key: k, value: (s.value || '').slice(0, 100), confidence: s.confidence }))
            .slice(0, 6)
        : [],
      userMessage: userMessage.slice(0, 300),
      intent,
    });

    const systemPrompt = `你是 Vibe Copilot 的 ${nodeLabel} Agent，一个 AI 产品经理。
你的任务：根据产品上下文和用户输入，输出结构化 JSON，帮助推进产品决策流程。

## 可用命令
- ASK_USER：追问用户缺失信息，payload: { questions: string[] }
- UPDATE_BRIEF：更新产品文档某阶段，payload: { targetStage, patch }
- MOVE_NODE：推进到下一节点，payload: { targetNodeId }
- CREATE_FINDING：记录分析判断，payload: { title, summary }
- GENERATE_HANDOFF：生成开发交付文档，payload: {}
- EVALUATE_HANDOFF：评估交付质量，payload: {}

## 规则
1. 只返回 JSON，不要 markdown，不要解释文字。
2. 每轮最多 2 个 commands。
3. 如果信息不足需要追问，用 ASK_USER + questions。
4. 如果信息足够推进，用 MOVE_NODE。
5. reply 要像产品经理协作，简洁有行动感，不超过 3 句话。
6. 如果用户输入是普通描述（不是继续/跳过等），先 UPDATE_BRIEF 保存关键信息。
7. 不要返回空 commands。`;

    const userPrompt = `## 当前产品上下文
${context}

## 用户最新输入
${userMessage}

请返回 JSON（只有这个对象，无其他内容）：
{
  "reply": "给用户的回复",
  "commands": [{"type": "ASK_USER|UPDATE_BRIEF|MOVE_NODE|CREATE_FINDING", "reason": "...", "payload": {}}],
  "questions": ["追问1"],
  "actionCards": [{"type": "question|decision|next_step", "title": "...", "description": "...", "actions": [{"id": "1", "label": "继续", "intent": "continue"}]}]
}`;

    events.push(createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'ai_call_started',
      nodeId: currentNodeId, message: `AI Agent 调用: ${nodeLabel}`,
      payload: { userMessage: userMessage.slice(0, 100) },
    }));

    try {
      const aiResponse = await callCopilotJson<{
        reply?: string;
        commands?: Array<{ type?: string; reason?: string; payload?: Record<string, unknown> }>;
        questions?: string[];
        actionCards?: Array<{ type?: string; title?: string; description?: string; actions?: Array<{ id?: string; label?: string; intent?: string }> }>;
      }>(systemPrompt, userPrompt, 1500, 60000);

      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'ai_call_completed',
        nodeId: currentNodeId, message: `AI Agent 响应成功`,
        payload: { hasCommands: Boolean(aiResponse.commands?.length), hasReply: Boolean(aiResponse.reply) },
      }));

      return {
        reply: aiResponse.reply || '我分析了当前情况，请查看我的判断。',
        commands: (aiResponse.commands || []).slice(0, 3).map((c) => ({
          type: String(c.type || 'ASK_USER'),
          reason: String(c.reason || 'Agent 判断'),
          payload: c.payload || {},
        })),
        questions: (aiResponse.questions || []).slice(0, 2),
        actionCards: (aiResponse.actionCards || []).slice(0, 2).map((c) => ({
          type: String(c.type || 'question'),
          title: String(c.title || ''),
          description: String(c.description || ''),
          actions: (c.actions || []).map((a) => ({
            id: String(a.id || `ac-${Date.now()}`),
            label: String(a.label || ''),
            intent: String(a.intent || 'continue'),
          })),
        })),
        usedAI: true,
      };
    } catch (e) {
      const errorMsg = e instanceof VibeAIError
        ? `${e.type}: ${e.message.slice(0, 100)}`
        : String(e).slice(0, 100);

      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'ai_call_failed',
        nodeId: currentNodeId, message: `AI 调用失败: ${errorMsg}`,
        payload: { errorType: e instanceof VibeAIError ? e.type : 'unknown', error: errorMsg },
      }));

      return null; // trigger local fallback
    }
  }

  // Normal path: run orchestrator, try AI — on failure → status='failed'
  session = { ...session, state: { ...session.state, status: 'running', updatedAt: new Date().toISOString() } };

  // 4. Run orchestrator (local, always fast)
  onProgress({ phase: 'planning', message: '运行 orchestrator' });
  const orchEventStart = createGraphEvent({
    sessionId: session.id, briefId: session.briefId, type: 'node_started',
    nodeId: 'orchestrator', message: 'Orchestrator 开始路由判断',
  });
  session = appendGraphEvent(session, orchEventStart);
  events.push(orchEventStart);

  let orchResult;
  try {
    orchResult = await runOrchestratorNode({ brief, session, userMessage });
  } catch (e) {
    events.push(createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'error',
      nodeId: 'orchestrator', message: `Orchestrator 执行失败: ${String(e)}`,
    }));
    return { session: { ...session, state: { ...session.state, status: 'failed' } }, events, userVisibleReply: '系统处理出错，请重试。', interrupted: true };
  }

  events.push(createGraphEvent({
    sessionId: session.id, briefId: session.briefId, type: 'node_completed',
    nodeId: 'orchestrator', message: orchResult.reply.slice(0, 200),
    payload: { nextNodeId: orchResult.nextNodeId, shouldInterrupt: orchResult.shouldInterrupt },
  }));

  // Execute orchestrator commands
  const orchExecResult = await executeCommands({ session, brief, commands: orchResult.commands, nodeId: 'orchestrator' });
  session = orchExecResult.session;
  events.push(...orchExecResult.events);
  if (orchExecResult.briefPatch) briefPatch = { ...briefPatch, ...orchExecResult.briefPatch };

  // V4.3: Try AI agent call for normal intents
  onProgress({ phase: 'running_node', message: '尝试 AI Agent 调用' });
  const aiResult = await attemptAIAgentCall({
    session, brief: { ...brief, ...briefPatch }, userMessage, intent, events,
  });

  if (aiResult && aiResult.usedAI) {
    // AI succeeded — use AI commands and reply
    onProgress({ phase: 'running_tools', message: '执行 AI Agent 命令' });

    // Convert AI command types to AgentGraphCommand
    const aiCommands: AgentGraphCommand[] = aiResult.commands.map((c) => ({
      id: `ai-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: (c.type === 'ASK_USER' || c.type === 'UPDATE_BRIEF' || c.type === 'MOVE_NODE' ||
             c.type === 'CREATE_FINDING' || c.type === 'GENERATE_HANDOFF' ||
             c.type === 'EVALUATE_HANDOFF')
        ? c.type as AgentGraphCommand['type']
        : 'ASK_USER' as AgentGraphCommand['type'],
      reason: c.reason,
      payload: c.payload,
    }));

    const aiExecResult = await executeCommands({
      session, brief: { ...brief, ...briefPatch }, commands: aiCommands.slice(0, 3), nodeId: session.state.currentNodeId,
    });
    session = aiExecResult.session;
    events.push(...aiExecResult.events);
    if (aiExecResult.briefPatch) briefPatch = { ...briefPatch, ...aiExecResult.briefPatch };

    // Update pending questions from AI
    if (aiResult.questions.length > 0) {
      session = { ...session, state: { ...session.state, pendingQuestions: aiResult.questions } };
    }

    // Add agent message event
    events.push(createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'agent_message',
      nodeId: session.state.currentNodeId,
      message: aiResult.reply.slice(0, 300),
    }));

    const interrupted = aiResult.questions.length > 0;
    const newStatus = interrupted ? 'waiting_user' : (session.state.currentNodeId === 'end' ? 'completed' : 'idle');

    session = {
      ...session,
      state: { ...session.state, status: newStatus, updatedAt: new Date().toISOString() },
    };

    onProgress({ phase: 'updating_state', message: '保存状态' });
    saveGraphSession(session);
    onProgress({ phase: 'completed', message: '完成' });

    return { session, briefPatch, events, userVisibleReply: aiResult.reply, interrupted };
  }

  // V4.4: AI unavailable or failed — no local-rule fallback. Mark session as failed.
  onProgress({ phase: 'failed', message: 'AI 调用失败，本轮未生成结果。' });

  session = {
    ...session,
    state: { ...session.state, status: 'failed', updatedAt: new Date().toISOString() },
  };

  events.push(createGraphEvent({
    sessionId: session.id, briefId: session.briefId, type: 'error',
    message: 'API 调用失败，本轮 Agent 未执行。请检查 API 配置后重试。',
  }));

  saveGraphSession(session);
  return {
    session, briefPatch, events,
    userVisibleReply: 'API 调用失败，本轮 Agent 未执行。请检查 API 配置后重试。',
    interrupted: false,
  };
}

// ---- Command Executor ----

async function executeCommands(input: {
  session: AgentGraphSession; brief: ProductBrief; commands: AgentGraphCommand[]; nodeId: AgentNodeId;
}): Promise<{ session: AgentGraphSession; briefPatch?: Partial<ProductBrief>; events: AgentGraphEvent[] }> {
  let session = input.session;
  let briefPatch: Partial<ProductBrief> | undefined;
  const events: AgentGraphEvent[] = [];

  for (const cmd of input.commands.slice(0, MAX_COMMANDS_PER_TURN)) {
    events.push(createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'tool_called',
      nodeId: input.nodeId, message: `命令: ${cmd.type}`, payload: { commandType: cmd.type, reason: cmd.reason },
    }));

    try {
      switch (cmd.type) {
        case 'UPDATE_BRIEF': {
          const r = await executeToolCall({ toolName: 'updateBriefStage', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.briefPatch) briefPatch = { ...briefPatch, ...r.briefPatch };
          if (r.statePatch) session = { ...session, state: { ...session.state, ...r.statePatch } };
          break;
        }
        case 'CREATE_FINDING': {
          const r = await executeToolCall({ toolName: 'createFinding', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.statePatch) session = { ...session, state: { ...session.state, ...r.statePatch } };
          break;
        }
        case 'CREATE_TASK': {
          const r = await executeToolCall({ toolName: 'createTask', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.statePatch) session = { ...session, state: { ...session.state, ...r.statePatch } };
          break;
        }
        case 'COMPLETE_TASK': {
          const r = await executeToolCall({ toolName: 'completeTask', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.statePatch) session = { ...session, state: { ...session.state, ...r.statePatch } };
          break;
        }
        case 'MOVE_NODE': {
          const r = await executeToolCall({ toolName: 'moveNode', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.statePatch) {
            const tid = String(cmd.payload.targetNodeId || '');
            if (canTransition(session.state.currentNodeId, tid as AgentNodeId)) {
              session = { ...session, state: { ...session.state, ...r.statePatch } };
            }
          }
          break;
        }
        case 'GENERATE_HANDOFF': {
          const r = await executeToolCall({ toolName: 'generateLocalHandoff', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.briefPatch) briefPatch = { ...briefPatch, ...r.briefPatch };
          break;
        }
        case 'EVALUATE_HANDOFF': {
          const r = await executeToolCall({ toolName: 'evaluateHandoffQuality', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          if (r.briefPatch) briefPatch = { ...briefPatch, ...r.briefPatch };
          if (r.statePatch) session = { ...session, state: { ...session.state, ...r.statePatch } };
          break;
        }
        case 'CREATE_MEMORY': {
          await executeToolCall({ toolName: 'createMemory', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          break;
        }
        case 'CREATE_SKILL': {
          await executeToolCall({ toolName: 'createSkill', brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
          break;
        }
        case 'INTERRUPT_FOR_USER':
        case 'ASK_USER': {
          session = {
            ...session,
            state: { ...session.state, status: 'waiting_user' as const, pendingQuestions: [...session.state.pendingQuestions, String(cmd.payload.question || cmd.reason || '等待用户输入')] },
          };
          events.push(createGraphEvent({
            sessionId: session.id, briefId: session.briefId, type: 'human_interrupt',
            nodeId: input.nodeId, message: cmd.reason || '需要用户确认', payload: cmd.payload,
          }));
          break;
        }
        case 'CALL_TOOL': {
          const tn = String(cmd.payload.toolName || '');
          if (tn) {
            const r = await executeToolCall({ toolName: tn, brief: { ...input.brief, ...briefPatch }, state: session.state, payload: cmd.payload });
            if (r.briefPatch) briefPatch = { ...briefPatch, ...r.briefPatch };
            if (r.statePatch) session = { ...session, state: { ...session.state, ...r.statePatch } };
          }
          break;
        }
        case 'FINISH': {
          session = { ...session, state: { ...session.state, status: 'completed', currentNodeId: 'end' } };
          break;
        }
        case 'CREATE_CHECKPOINT': {
          session = createCheckpoint({ session, reason: cmd.reason || '命令触发 checkpoint' }).session;
          break;
        }
      }
    } catch (e) {
      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'error',
        nodeId: input.nodeId, message: `命令 ${cmd.type} 失败: ${String(e)}`,
      }));
    }
  }
  return { session, briefPatch, events };
}

// ---- Welcome ----

export function sendV4WelcomeMessage(brief: ProductBrief): AgentGraphSession {
  let session = getGraphSession(brief.id);
  if (!session) session = createGraphSession(brief);
  if (session.events.length > 0) return session;

  const slotFilling = deriveSlotFillingStateFromBrief({ brief });

  session = appendGraphEvent(session, createGraphEvent({
    sessionId: session.id, briefId: session.briefId, type: 'agent_message',
    nodeId: 'orchestrator', message: 'Agent Graph Runtime V4.1 已初始化',
    payload: { version: '4.1' },
  }));

  const hasTargetUser = Boolean(brief.ideaInput?.targetUser);
  const hasScenario = Boolean(brief.ideaInput?.scenario);
  const hasProblem = Boolean(brief.ideaInput?.problem);

  session = {
    ...session,
    state: {
      ...session.state,
      status: hasTargetUser && hasScenario ? 'idle' : 'waiting_user',
      currentNodeId: 'intake', activeAgentName: 'orchestrator',
      slotFilling,
      questionLedger: [],
      advancementCount: 0,
      pendingQuestions: (!hasTargetUser || !hasScenario || !hasProblem)
        ? [
          !hasTargetUser ? '谁会使用这个产品？' : '',
          !hasScenario ? '在什么场景下使用？' : '',
          !hasProblem ? '想解决什么核心问题？' : '',
        ].filter(Boolean).slice(0, 2)
        : [],
    },
  };

  saveGraphSession(session);
  return session;
}
