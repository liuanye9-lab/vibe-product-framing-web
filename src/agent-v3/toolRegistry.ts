/**
 * Agent V3 Tool Registry
 *
 * Executes Agent Commands and produces AgentToolResults + patches.
 * Tools never write to localStorage directly — the Runtime handles persistence.
 */

import type { ProductBrief } from '../types';
import type {
  AgentSession,
  AgentCommand,
  AgentToolResult,
  AgentFinding,
  AgentTask,
  AgentPhase,
  AgentRunStatus,
  DecisionStatus,
} from './types';
import { generateId } from './types';
import { getAgentRoleForPhase, getNextAgentPhase } from './phaseMachine';
import { applyAgentCommandPatchToBrief } from './applyAgentCommandPatch';

function makeToolResult(
  commandId: string,
  success: boolean,
  message: string,
  data?: unknown,
): AgentToolResult {
  return {
    id: `tr-${generateId()}`,
    commandId,
    success,
    message,
    data,
    createdAt: new Date().toISOString(),
  };
}

export async function executeAgentCommand(input: {
  command: AgentCommand;
  brief: ProductBrief;
  session: AgentSession;
  buildHandoff?: (brief: ProductBrief) => Promise<ProductBrief['finalHandoff']>;
  evaluateHandoffFn?: (brief: ProductBrief) => Promise<ProductBrief['finalHandoff']>;
}): Promise<{
  toolResult: AgentToolResult;
  briefPatch?: Partial<ProductBrief>;
  sessionPatch?: Partial<AgentSession>;
}> {
  const { command, brief, session, buildHandoff, evaluateHandoffFn } = input;

  switch (command.type) {
    case 'ask_user': {
      const questions = (Array.isArray(command.payload.questions) ? command.payload.questions : []) as string[];
      const reason = typeof command.payload.reason === 'string' ? command.payload.reason : '需要更多信息';
      return {
        toolResult: makeToolResult(command.id, true, `追问用户：${reason}`),
        sessionPatch: {
          pendingQuestions: questions.slice(0, 3),
          runStatus: 'waiting_user',
          decisionStatus: 'need_more_info',
        },
      };
    }

    case 'update_brief': {
      const targetStage = typeof command.payload.targetStage === 'string' ? command.payload.targetStage : '';
      const patch = (command.payload.patch || {}) as Record<string, unknown>;
      if (!targetStage || Object.keys(patch).length === 0) {
        return {
          toolResult: makeToolResult(command.id, false, 'update_brief: 缺少 targetStage 或 patch'),
        };
      }
      const briefPatch = applyAgentCommandPatchToBrief({
        brief,
        targetStage,
        patch,
        source: 'ai',
      });
      return {
        toolResult: makeToolResult(command.id, true, `更新了 ${targetStage} 阶段`, { targetStage, fields: Object.keys(patch) }),
        briefPatch,
      };
    }

    case 'create_finding': {
      const finding: AgentFinding = {
        id: `find-${generateId()}`,
        phase: command.phase,
        agentRole: command.agentRole,
        title: typeof command.payload.title === 'string' ? command.payload.title : 'Untitled finding',
        summary: typeof command.payload.summary === 'string' ? command.payload.summary : '',
        evidence: Array.isArray(command.payload.evidence) ? command.payload.evidence.filter((e): e is string => typeof e === 'string') : [],
        risks: Array.isArray(command.payload.risks) ? command.payload.risks.filter((r): r is string => typeof r === 'string') : [],
        missingInfo: Array.isArray(command.payload.missingInfo) ? command.payload.missingInfo.filter((m): m is string => typeof m === 'string') : [],
        suggestions: Array.isArray(command.payload.suggestions) ? command.payload.suggestions.filter((s): s is string => typeof s === 'string') : [],
        decisionStatus: (typeof command.payload.decisionStatus === 'string' ? command.payload.decisionStatus : 'need_more_info') as DecisionStatus,
        confidence: typeof command.payload.confidence === 'number' ? command.payload.confidence : 0.5,
        createdAt: new Date().toISOString(),
      };
      return {
        toolResult: makeToolResult(command.id, true, `创建了 finding: ${finding.title}`),
        sessionPatch: {
          findings: [...session.findings, finding],
        },
      };
    }

    case 'create_task': {
      const task: AgentTask = {
        id: `task-${generateId()}`,
        title: typeof command.payload.title === 'string' ? command.payload.title : 'Untitled task',
        description: typeof command.payload.description === 'string' ? command.payload.description : '',
        phase: command.phase,
        ownerAgent: command.agentRole,
        status: 'todo',
        required: Boolean(command.payload.required),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        toolResult: makeToolResult(command.id, true, `创建了任务: ${task.title}`),
        sessionPatch: {
          tasks: [...session.tasks, task],
        },
      };
    }

    case 'complete_task': {
      const taskId = typeof command.payload.taskId === 'string' ? command.payload.taskId : '';
      const updatedTasks = session.tasks.map((t) =>
        t.id === taskId ? { ...t, status: 'done' as const, updatedAt: new Date().toISOString() } : t
      );
      return {
        toolResult: makeToolResult(command.id, true, `完成任务: ${taskId}`),
        sessionPatch: { tasks: updatedTasks },
      };
    }

    case 'move_phase': {
      const targetPhase = (typeof command.payload.phase === 'string' ? command.payload.phase : getNextAgentPhase(session.currentPhase)) as AgentPhase;
      const newAgentRole = getAgentRoleForPhase(targetPhase);
      return {
        toolResult: makeToolResult(command.id, true, `进入阶段: ${targetPhase}`),
        sessionPatch: {
          currentPhase: targetPhase,
          activeAgent: newAgentRole,
          pendingQuestions: [],
        },
      };
    }

    case 'set_status': {
      const patch: Partial<AgentSession> = {};
      if (typeof command.payload.runStatus === 'string') patch.runStatus = command.payload.runStatus as AgentRunStatus;
      if (typeof command.payload.decisionStatus === 'string') patch.decisionStatus = command.payload.decisionStatus as DecisionStatus;
      return {
        toolResult: makeToolResult(command.id, true, '状态已更新'),
        sessionPatch: patch,
      };
    }

    case 'generate_handoff': {
      if (!buildHandoff) {
        return {
          toolResult: makeToolResult(command.id, false, 'generate_handoff: buildHandoff function not provided'),
        };
      }
      try {
        const handoff = await buildHandoff(brief);
        return {
          toolResult: makeToolResult(command.id, true, 'Handoff 已生成'),
          briefPatch: { finalHandoff: handoff ?? undefined },
        };
      } catch (e) {
        return {
          toolResult: makeToolResult(command.id, false, `Handoff 生成失败: ${e instanceof Error ? e.message : 'Unknown error'}`),
        };
      }
    }

    case 'evaluate_handoff': {
      if (!evaluateHandoffFn) {
        return {
          toolResult: makeToolResult(command.id, false, 'evaluate_handoff: evaluateHandoff function not provided'),
        };
      }
      try {
        const evaluated = await evaluateHandoffFn(brief);
        return {
          toolResult: makeToolResult(command.id, true, 'Handoff 已评估'),
          briefPatch: evaluated ? { finalHandoff: evaluated } : undefined,
        };
      } catch (e) {
        return {
          toolResult: makeToolResult(command.id, false, `Handoff 评估失败: ${e instanceof Error ? e.message : 'Unknown error'}`),
        };
      }
    }

    case 'show_warning': {
      const title = typeof command.payload.title === 'string' ? command.payload.title : '警告';
      const message = typeof command.payload.message === 'string' ? command.payload.message : '';
      return {
        toolResult: makeToolResult(command.id, true, `显示警告: ${title}`, { title, message }),
      };
    }

    case 'wait_for_user_confirmation': {
      const msg = typeof command.payload.message === 'string' ? command.payload.message : '请确认是否继续';
      return {
        toolResult: makeToolResult(command.id, true, `等待用户确认: ${msg}`),
        sessionPatch: {
          pendingCommands: [command],
          runStatus: 'waiting_user',
        },
      };
    }

    default:
      return {
        toolResult: makeToolResult(command.id, false, `未知命令类型: ${command.type}`),
      };
  }
}
