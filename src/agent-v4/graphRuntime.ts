/**
 * Agent Graph Runtime V4 — the core execution engine.
 *
 * Inspired by LangGraph: stateful graph, checkpoints, human-in-the-loop,
 * event-driven execution.
 *
 * Flow:
 * 1. Get or create AgentGraphSession
 * 2. Append user_message event
 * 3. Create checkpoint before processing
 * 4. Run orchestrator to determine routing
 * 5. Run the target business node
 * 6. Execute commands (tools, state patches, brief patches)
 * 7. Save session
 * 8. Return result
 *
 * Max 2 nodes per turn (orchestrator + 1 business node).
 * Max 5 commands per turn.
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
import { canTransition } from './graph';
import { executeToolCall } from './tools/toolRegistry';

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

/**
 * Main entry: run a single agent graph turn.
 */
export async function runAgentGraphTurn(input: {
  brief: ProductBrief;
  userMessage: string;
}): Promise<AgentGraphRunResult> {
  const { brief, userMessage } = input;
  const briefId = brief.id;
  const events: AgentGraphEvent[] = [];

  // 1. Get or create session
  let session = getGraphSession(briefId);
  if (!session) {
    session = createGraphSession(brief);
  }

  // Update title if empty
  if (!session.title || session.title === 'Untitled') {
    session = {
      ...session,
      title: (brief.rawIdea || brief.ideaInput?.rawIdea || '').slice(0, 60) || 'Untitled',
    };
  }

  // 2. Append user message event
  const userEvent = createGraphEvent({
    sessionId: session.id,
    briefId: session.briefId,
    type: 'user_message',
    message: userMessage.slice(0, 200),
    payload: { userMessage },
  });
  session = appendGraphEvent(session, userEvent);
  events.push(userEvent);

  // 3. Create checkpoint before processing
  const ckptResult = createCheckpoint({
    session,
    reason: `用户输入处理前 (${session.state.currentNodeId})`,
  });
  session = ckptResult.session;
  events.push(
    session.events[session.events.length - 1],
  );

  // Update state to running
  session = {
    ...session,
    state: { ...session.state, status: 'running', updatedAt: new Date().toISOString() },
  };

  // 4. Run orchestrator
  const orchEventStart = createGraphEvent({
    sessionId: session.id,
    briefId: session.briefId,
    type: 'node_started',
    nodeId: 'orchestrator',
    message: 'Orchestrator 开始路由判断',
  });
  session = appendGraphEvent(session, orchEventStart);
  events.push(orchEventStart);

  let orchResult;
  try {
    orchResult = await runOrchestratorNode({
      brief,
      session,
      userMessage,
    });
  } catch (e) {
    const errEvent = createGraphEvent({
      sessionId: session.id,
      briefId: session.briefId,
      type: 'error',
      nodeId: 'orchestrator',
      message: `Orchestrator 执行失败: ${String(e)}`,
    });
    session = appendGraphEvent(session, errEvent);
    events.push(errEvent);

    return {
      session: { ...session, state: { ...session.state, status: 'failed' } },
      events,
      userVisibleReply: '系统处理出错，请重试。',
      interrupted: true,
    };
  }

  const orchEventDone = createGraphEvent({
    sessionId: session.id,
    briefId: session.briefId,
    type: 'node_completed',
    nodeId: 'orchestrator',
    message: orchResult.reply.slice(0, 200),
    payload: {
      nextNodeId: orchResult.nextNodeId,
      shouldInterrupt: orchResult.shouldInterrupt,
    },
  });
  session = appendGraphEvent(session, orchEventDone);
  events.push(orchEventDone);

  // Execute orchestrator commands
  const orchExecResult = await executeCommands({
    session,
    brief,
    commands: orchResult.commands,
    nodeId: 'orchestrator',
  });
  session = orchExecResult.session;
  events.push(...orchExecResult.events);

  let briefPatch: Partial<ProductBrief> | undefined = orchExecResult.briefPatch;

  // 5. Determine next node
  const targetNodeId = orchResult.nextNodeId || session.state.currentNodeId;

  // 6. Run business node (if not orchestrator and not human_interrupt)
  if (
    targetNodeId !== 'orchestrator' &&
    targetNodeId !== 'human_interrupt' &&
    targetNodeId !== 'end' &&
    NODE_RUNNERS[targetNodeId]
  ) {
    const runner = NODE_RUNNERS[targetNodeId];

    const nodeStartEvent = createGraphEvent({
      sessionId: session.id,
      briefId: session.briefId,
      type: 'node_started',
      nodeId: targetNodeId,
      message: `进入 ${targetNodeId} 节点`,
    });
    session = appendGraphEvent(session, nodeStartEvent);
    events.push(nodeStartEvent);

    let nodeResult;
    try {
      nodeResult = await runner({
        brief: { ...brief, ...briefPatch },
        session,
        userMessage,
      });
    } catch (e) {
      const errEvent = createGraphEvent({
        sessionId: session.id,
        briefId: session.briefId,
        type: 'error',
        nodeId: targetNodeId,
        message: `${targetNodeId} 节点执行失败: ${String(e)}`,
      });
      session = appendGraphEvent(session, errEvent);
      events.push(errEvent);

      return {
        session: { ...session, state: { ...session.state, status: 'waiting_user' } },
        briefPatch,
        events,
        userVisibleReply: '处理出错，请重试或说「继续下一步」跳过当前节点。',
        interrupted: true,
      };
    }

    const nodeDoneEvent = createGraphEvent({
      sessionId: session.id,
      briefId: session.briefId,
      type: 'node_completed',
      nodeId: targetNodeId,
      message: nodeResult.reply.slice(0, 200),
      payload: {
        nextNodeId: nodeResult.nextNodeId,
        confidence: nodeResult.confidence,
      },
    });
    session = appendGraphEvent(session, nodeDoneEvent);
    events.push(nodeDoneEvent);

    // Execute node commands
    const nodeExecResult = await executeCommands({
      session,
      brief: { ...brief, ...briefPatch },
      commands: nodeResult.commands,
      nodeId: targetNodeId,
    });
    session = nodeExecResult.session;
    events.push(...nodeExecResult.events);

    if (nodeExecResult.briefPatch) {
      briefPatch = { ...briefPatch, ...nodeExecResult.briefPatch };
    }

    // Update state
    const newStatus = nodeResult.shouldInterrupt
      ? 'waiting_user'
      : (nodeResult.nextNodeId === 'end' ? 'completed' : 'idle');

    session = {
      ...session,
      state: {
        ...session.state,
        previousNodeId: session.state.currentNodeId,
        currentNodeId: (nodeResult.nextNodeId || session.state.currentNodeId) as AgentNodeId,
        status: newStatus,
        activeAgentName: targetNodeId,
        updatedAt: new Date().toISOString(),
      },
    };

    const interrupted = nodeResult.shouldInterrupt;

    // Add agent message event
    const agentEvent = createGraphEvent({
      sessionId: session.id,
      briefId: session.briefId,
      type: 'agent_message',
      nodeId: targetNodeId,
      message: nodeResult.reply.slice(0, 300),
    });
    session = appendGraphEvent(session, agentEvent);
    events.push(agentEvent);

    // Update user goal if needed
    if (!session.state.userGoal && brief.rawIdea) {
      session = {
        ...session,
        state: { ...session.state, userGoal: brief.rawIdea },
      };
    }

    // 7. Save session
    saveGraphSession(session);

    return {
      session,
      briefPatch,
      events,
      userVisibleReply: nodeResult.reply,
      interrupted,
    };
  }

  // If target is human_interrupt or end — apply state update
  if (targetNodeId === 'human_interrupt') {
    session = {
      ...session,
      state: {
        ...session.state,
        status: 'waiting_user',
        currentNodeId: 'human_interrupt',
        previousNodeId: session.state.currentNodeId,
        updatedAt: new Date().toISOString(),
      },
    };
    const interruptEvent = createGraphEvent({
      sessionId: session.id,
      briefId: session.briefId,
      type: 'human_interrupt',
      message: orchResult.reply.slice(0, 200),
    });
    session = appendGraphEvent(session, interruptEvent);
    events.push(interruptEvent);
    saveGraphSession(session);

    return {
      session,
      briefPatch,
      events,
      userVisibleReply: orchResult.reply,
      interrupted: true,
    };
  }

  if (targetNodeId === 'end') {
    session = {
      ...session,
      state: {
        ...session.state,
        status: 'completed',
        currentNodeId: 'end',
        previousNodeId: session.state.currentNodeId,
        updatedAt: new Date().toISOString(),
      },
    };
    saveGraphSession(session);

    return {
      session,
      briefPatch,
      events,
      userVisibleReply: orchResult.reply || '工作流已完成。',
      interrupted: false,
    };
  }

  // Fallback
  saveGraphSession(session);
  return {
    session,
    briefPatch,
    events,
    userVisibleReply: orchResult.reply,
    interrupted: false,
  };
}

/** Execute commands from a node result, applying side effects. */
async function executeCommands(input: {
  session: AgentGraphSession;
  brief: ProductBrief;
  commands: AgentGraphCommand[];
  nodeId: AgentNodeId;
}): Promise<{
  session: AgentGraphSession;
  briefPatch?: Partial<ProductBrief>;
  events: AgentGraphEvent[];
}> {
  let session = input.session;
  let briefPatch: Partial<ProductBrief> | undefined;
  const events: AgentGraphEvent[] = [];

  for (const cmd of input.commands.slice(0, MAX_COMMANDS_PER_TURN)) {
    // Log command execution
    const toolEvent = createGraphEvent({
      sessionId: session.id,
      briefId: session.briefId,
      type: 'tool_called',
      nodeId: input.nodeId,
      message: `命令: ${cmd.type}`,
      payload: { commandType: cmd.type, reason: cmd.reason },
    });
    session = appendGraphEvent(session, toolEvent);
    events.push(toolEvent);

    try {
      // Map command type to tool execution
      switch (cmd.type) {
        case 'UPDATE_BRIEF': {
          const result = await executeToolCall({
            toolName: 'updateBriefStage',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.briefPatch) {
            briefPatch = { ...briefPatch, ...result.briefPatch };
          }
          if (result.statePatch) {
            session = {
              ...session,
              state: { ...session.state, ...result.statePatch },
            };
          }
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'tool_completed',
              nodeId: input.nodeId,
              message: result.message,
              payload: { success: result.success },
            }),
          );
          break;
        }

        case 'CREATE_FINDING': {
          const result = await executeToolCall({
            toolName: 'createFinding',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.statePatch) {
            session = {
              ...session,
              state: { ...session.state, ...result.statePatch },
            };
          }
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'tool_completed',
              nodeId: input.nodeId,
              message: result.message,
            }),
          );
          break;
        }

        case 'CREATE_TASK': {
          const result = await executeToolCall({
            toolName: 'createTask',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.statePatch) {
            session = {
              ...session,
              state: { ...session.state, ...result.statePatch },
            };
          }
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'tool_completed',
              nodeId: input.nodeId,
              message: result.message,
            }),
          );
          break;
        }

        case 'COMPLETE_TASK': {
          const result = await executeToolCall({
            toolName: 'completeTask',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.statePatch) {
            session = {
              ...session,
              state: { ...session.state, ...result.statePatch },
            };
          }
          break;
        }

        case 'MOVE_NODE': {
          const result = await executeToolCall({
            toolName: 'moveNode',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.statePatch) {
            const targetNodeId = String(cmd.payload.targetNodeId || '');
            if (canTransition(session.state.currentNodeId, targetNodeId as AgentNodeId)) {
              session = {
                ...session,
                state: { ...session.state, ...result.statePatch },
              };
            }
          }
          break;
        }

        case 'GENERATE_HANDOFF': {
          const result = await executeToolCall({
            toolName: 'generateLocalHandoff',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.briefPatch) {
            briefPatch = { ...briefPatch, ...result.briefPatch };
          }
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'tool_completed',
              nodeId: input.nodeId,
              message: result.message,
            }),
          );
          break;
        }

        case 'EVALUATE_HANDOFF': {
          const result = await executeToolCall({
            toolName: 'evaluateHandoffQuality',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          if (result.briefPatch) {
            briefPatch = { ...briefPatch, ...result.briefPatch };
          }
          if (result.statePatch) {
            session = {
              ...session,
              state: { ...session.state, ...result.statePatch },
            };
          }
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'evaluation_completed',
              nodeId: input.nodeId,
              message: result.message,
              payload: result.statePatch?.lastEvaluation,
            }),
          );
          break;
        }

        case 'CREATE_MEMORY': {
          const result = await executeToolCall({
            toolName: 'createMemory',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'tool_completed',
              nodeId: input.nodeId,
              message: result.message,
            }),
          );
          break;
        }

        case 'CREATE_SKILL': {
          const result = await executeToolCall({
            toolName: 'createSkill',
            brief: { ...input.brief, ...briefPatch },
            state: session.state,
            payload: cmd.payload,
          });
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'reflection_created',
              nodeId: input.nodeId,
              message: result.message,
            }),
          );
          break;
        }

        case 'INTERRUPT_FOR_USER':
        case 'ASK_USER': {
          session = {
            ...session,
            state: {
              ...session.state,
              status: 'waiting_user' as const,
              pendingQuestions: [
                ...session.state.pendingQuestions,
                String(cmd.payload.question || cmd.reason || '等待用户输入'),
              ],
            },
          };
          events.push(
            createGraphEvent({
              sessionId: session.id,
              briefId: session.briefId,
              type: 'human_interrupt',
              nodeId: input.nodeId,
              message: cmd.reason || '需要用户确认',
              payload: cmd.payload,
            }),
          );
          break;
        }

        case 'CALL_TOOL': {
          const toolName = String(cmd.payload.toolName || '');
          if (toolName) {
            const result = await executeToolCall({
              toolName,
              brief: { ...input.brief, ...briefPatch },
              state: session.state,
              payload: cmd.payload,
            });
            if (result.briefPatch) {
              briefPatch = { ...briefPatch, ...result.briefPatch };
            }
            if (result.statePatch) {
              session = {
                ...session,
                state: { ...session.state, ...result.statePatch },
              };
            }
            events.push(
              createGraphEvent({
                sessionId: session.id,
                briefId: session.briefId,
                type: 'tool_completed',
                nodeId: input.nodeId,
                message: result.message,
              }),
            );
          }
          break;
        }

        case 'FINISH': {
          session = {
            ...session,
            state: {
              ...session.state,
              status: 'completed',
              currentNodeId: 'end',
            },
          };
          break;
        }

        case 'CREATE_CHECKPOINT': {
          const ckpt = createCheckpoint({
            session,
            reason: cmd.reason || '命令触发 checkpoint',
          });
          session = ckpt.session;
          break;
        }

        default:
          break;
      }
    } catch (e) {
      events.push(
        createGraphEvent({
          sessionId: session.id,
          briefId: session.briefId,
          type: 'error',
          nodeId: input.nodeId,
          message: `命令 ${cmd.type} 执行失败: ${String(e)}`,
        }),
      );
    }
  }

  return { session, briefPatch, events };
}

/**
 * Send welcome message for V4 agent workspace.
 */
export function sendV4WelcomeMessage(brief: ProductBrief): AgentGraphSession {
  let session = getGraphSession(brief.id);
  if (!session) {
    session = createGraphSession(brief);
  }

  if (session.events.length > 0) return session;

  const hasTargetUser = Boolean(brief.ideaInput?.targetUser);
  const hasScenario = Boolean(brief.ideaInput?.scenario);

  const welcomeEvent = createGraphEvent({
    sessionId: session.id,
    briefId: session.briefId,
    type: 'agent_message',
    nodeId: 'orchestrator',
    message: 'Agent Graph Runtime V4 已初始化',
    payload: { version: '4.0', status: 'ready' },
  });
  session = appendGraphEvent(session, welcomeEvent);

  session = {
    ...session,
    state: {
      ...session.state,
      status: hasTargetUser && hasScenario ? 'idle' : 'waiting_user',
      currentNodeId: 'intake',
      activeAgentName: 'orchestrator',
      pendingQuestions: hasTargetUser && hasScenario
        ? []
        : [
          hasTargetUser ? '' : '谁会使用这个产品？',
          hasScenario ? '' : '在什么场景下使用？',
        ].filter(Boolean),
      updatedAt: new Date().toISOString(),
    },
  };

  saveGraphSession(session);
  return session;
}
