/**
 * Agent Graph Runtime V4.1 — Anti-Loop & Slot-Aware Execution Engine.
 *
 * Key improvements over V4.0:
 * 1. Intent parsed BEFORE calling nodes → continue/skip/assume bypass slot checks.
 * 2. SlotFillingState tracks what's been asked/assumed/skipped.
 * 3. QuestionLedger prevents repeating the same question.
 * 4. AskedCount >= 2 → auto-assume instead of asking again.
 * 5. Max 2 nodes per turn, max 5 commands per turn.
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

const NODE_RUNNERS: Record<string, typeof runOrchestratorNode> = {
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
}): Promise<AgentGraphRunResult> {
  const { brief, userMessage } = input;
  const briefId = brief.id;
  const events: AgentGraphEvent[] = [];

  // 1. Get or create session, init slot filling
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

  // Normal path: run orchestrator then business node
  session = { ...session, state: { ...session.state, status: 'running', updatedAt: new Date().toISOString() } };

  // 4. Run orchestrator
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

  // 5. Run business node
  const targetNodeId = orchResult.nextNodeId || session.state.currentNodeId;
  if (targetNodeId !== 'orchestrator' && targetNodeId !== 'human_interrupt' && targetNodeId !== 'end' && NODE_RUNNERS[targetNodeId]) {
    const runner = NODE_RUNNERS[targetNodeId];

    events.push(createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'node_started',
      nodeId: targetNodeId, message: `进入 ${targetNodeId} 节点`,
    }));
    session = appendGraphEvent(session, events[events.length - 1]);

    let nodeResult;
    try {
      nodeResult = await runner({ brief: { ...brief, ...briefPatch }, session, userMessage });
    } catch (e) {
      events.push(createGraphEvent({
        sessionId: session.id, briefId: session.briefId, type: 'error',
        nodeId: targetNodeId, message: `${targetNodeId} 执行失败: ${String(e)}`,
      }));
      return { session: { ...session, state: { ...session.state, status: 'waiting_user' } }, briefPatch, events, userVisibleReply: '处理出错，请重试或说「继续下一步」跳过当前节点。', interrupted: true };
    }

    events.push(createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'node_completed',
      nodeId: targetNodeId, message: nodeResult.reply.slice(0, 200),
    }));

    const nodeExecResult = await executeCommands({ session, brief: { ...brief, ...briefPatch }, commands: nodeResult.commands, nodeId: targetNodeId });
    session = nodeExecResult.session;
    events.push(...nodeExecResult.events);
    if (nodeExecResult.briefPatch) briefPatch = { ...briefPatch, ...nodeExecResult.briefPatch };

    // V4.1: If nodeResult.shouldInterrupt, check if slots have been asked too many times
    if (nodeResult.shouldInterrupt) {
      const slotState = session.state.slotFilling!;
      const missing = getMissingRequiredSlots({ slotState, phase: targetNodeId });
      const unaskables = missing.filter((s) => s.askedCount >= 2);

      if (unaskables.length > 0) {
        // Auto-assume slots that have been asked too many times
        events.push(createGraphEvent({
          sessionId: session.id, briefId: session.briefId, type: 'repeated_question_prevented',
          nodeId: targetNodeId,
          message: `防止重复追问: ${unaskables.map((s) => s.label).join(', ')}`,
        }));
        let newSlotState = slotState;
        const assumptions = generateDefaultAssumptions({ brief, phase: targetNodeId, missingSlots: unaskables });
        for (const a of assumptions) {
          newSlotState = markSlotAssumed({ slotState: newSlotState, key: a.slotKey, value: a.value });
        }
        for (const ms of unaskables) {
          if (!assumptions.find((a) => a.slotKey === ms.key)) {
            newSlotState = markSlotSkipped({ slotState: newSlotState, key: ms.key });
          }
        }
        session = { ...session, state: { ...session.state, slotFilling: newSlotState } };

        // Force advance
        const nextId = getDefaultNextNode(targetNodeId);
        if (nextId !== targetNodeId) {
          session = {
            ...session,
            state: { ...session.state, previousNodeId: targetNodeId, currentNodeId: nextId as AgentNodeId, status: 'idle' },
          };
          events.push(createGraphEvent({
            sessionId: session.id, briefId: session.briefId, type: 'phase_advanced',
            nodeId: targetNodeId, message: `自动推进: ${targetNodeId} → ${nextId}`,
          }));
        }
        saveGraphSession(session);
        return { session, briefPatch, events, userVisibleReply: '为了不阻塞流程，已自动使用默认假设并进入下一阶段。', interrupted: false };
      }
    }

    const newStatus = nodeResult.shouldInterrupt ? 'waiting_user' : (nodeResult.nextNodeId === 'end' ? 'completed' : 'idle');
    session = {
      ...session,
      state: {
        ...session.state,
        previousNodeId: session.state.currentNodeId,
        currentNodeId: (nodeResult.nextNodeId || session.state.currentNodeId) as AgentNodeId,
        status: newStatus, activeAgentName: targetNodeId,
        updatedAt: new Date().toISOString(),
      },
    };

    const agentEvent = createGraphEvent({
      sessionId: session.id, briefId: session.briefId, type: 'agent_message',
      nodeId: targetNodeId, message: nodeResult.reply.slice(0, 300),
    });
    session = appendGraphEvent(session, agentEvent);
    events.push(agentEvent);

    if (!session.state.userGoal && brief.rawIdea) {
      session = { ...session, state: { ...session.state, userGoal: brief.rawIdea } };
    }

    saveGraphSession(session);
    return { session, briefPatch, events, userVisibleReply: nodeResult.reply, interrupted: nodeResult.shouldInterrupt };
  }

  // Handle human_interrupt / end
  if (targetNodeId === 'human_interrupt') {
    session = {
      ...session,
      state: { ...session.state, status: 'waiting_user', currentNodeId: 'human_interrupt', previousNodeId: session.state.currentNodeId, updatedAt: new Date().toISOString() },
    };
    saveGraphSession(session);
    return { session, briefPatch, events, userVisibleReply: orchResult.reply, interrupted: true };
  }
  if (targetNodeId === 'end') {
    session = {
      ...session,
      state: { ...session.state, status: 'completed', currentNodeId: 'end', previousNodeId: session.state.currentNodeId, updatedAt: new Date().toISOString() },
    };
    saveGraphSession(session);
    return { session, briefPatch, events, userVisibleReply: orchResult.reply || '工作流已完成。', interrupted: false };
  }

  saveGraphSession(session);
  return { session, briefPatch, events, userVisibleReply: orchResult.reply, interrupted: false };
}

// ---- Command Executor (unchanged from V4.0, keeps all tool mappings) ----

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
