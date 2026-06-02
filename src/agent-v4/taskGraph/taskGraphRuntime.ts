/**
 * V5.2 TaskGraph Runtime — Real Agent Workflow Engine
 *
 * Main entry: runAgentTaskGraphTurn()
 *
 * Flow:
 * 1. assertApiReady()
 * 2. Get or create TaskGraph
 * 3. If tasks empty → buildInitialDecisionTasks()
 * 4. Find current task
 * 5. Call LLM Planner with context
 * 6. Execute tool calls from planner
 * 7. Generate Observations
 * 8. Handle approvals
 * 9. Update graph state
 * 10. Return result
 */

import type { ProductBrief } from '../../types';
import type { AgentGraphState } from '../types';
import { assertApiReady } from '../../api/apiHealth';
import { callCopilotJson } from '../../api/evaluate';
import { getTimeoutProfile } from '../../api/timeoutProfile';

import type {
  AgentTaskGraph,
  AgentTask,
  AgentObservation,
  HumanApproval,
  AgentToolCallRecord,
  TaskGraphTurnResult,
  TaskGraphProgressEvent,
  TaskGraphPlannerOutput,
} from './taskGraphTypes';
import { generateTaskGraphId } from './taskGraphTypes';

import { createTaskGraph, getTaskGraph, saveTaskGraph, appendObservation, appendToolCall, appendApproval } from './taskGraphStore';
import { buildInitialDecisionTasks, buildTaskEdges } from './taskPlanner';
import { buildTaskGraphPlannerPrompt } from './taskGraphPromptBuilder';
import { findRelevantSkills } from './skillLibrary';
import { findRelevantMemories, addMemory } from './memoryRuntime';
import {
  getTaskGraphTool,
  listTaskGraphToolNames,
  type TaskGraphToolResult,
} from './tools/taskGraphTools';

const MAX_TOOL_CALLS_PER_TURN = 4;

// ─── Helper: Extract brief context ──────────────────────────────────────────

function extractBriefContext(brief: ProductBrief): {
  rawIdea: string;
  knownFields: string[];
  missingFields: string[];
  summary: string;
} {
  const knownFields: string[] = [];
  const missingFields: string[] = [];

  if (brief.rawIdea) knownFields.push('rawIdea');
  else missingFields.push('rawIdea');
  if (brief.ideaInput?.targetUser) knownFields.push('targetUser');
  else missingFields.push('targetUser');
  if (brief.ideaInput?.scenario) knownFields.push('scenario');
  else missingFields.push('scenario');
  if (brief.ideaInput?.problem) knownFields.push('problem');
  else missingFields.push('problem');
  if (brief.stages?.discovery) knownFields.push('discovery');
  else missingFields.push('discovery');
  if (brief.stages?.product) knownFields.push('product');
  else missingFields.push('product');
  if (brief.stages?.mvp) knownFields.push('mvp');
  else missingFields.push('mvp');
  if (brief.stages?.technical) knownFields.push('technical');
  else missingFields.push('technical');

  const summary = `已知 ${knownFields.length} 项，缺失 ${missingFields.length} 项`;
  return { rawIdea: brief.rawIdea || '', knownFields, missingFields, summary };
}

// ─── Helper: Find next todo task ────────────────────────────────────────────

function findCurrentTask(graph: AgentTaskGraph): AgentTask | null {
  // If currentTaskId is set and task exists, use it
  if (graph.currentTaskId) {
    const task = graph.tasks.find(t => t.id === graph.currentTaskId);
    if (task && task.status !== 'done' && task.status !== 'skipped') {
      return task;
    }
  }

  // Otherwise, find the first non-done task
  return graph.tasks.find(t =>
    t.status === 'todo' || t.status === 'planning' || t.status === 'running' || t.status === 'waiting_approval' || t.status === 'blocked',
  ) ?? null;
}

// ─── Helper: Execute a single tool call ─────────────────────────────────────

async function executeToolCall(input: {
  toolName: string;
  payload: Record<string, unknown>;
  brief: ProductBrief;
  state: AgentGraphState;
  taskId: string;
}): Promise<TaskGraphToolResult> {
  const tool = getTaskGraphTool(input.toolName);
  if (!tool) {
    return {
      success: false,
      message: `工具不存在: ${input.toolName}`,
    };
  }

  // Permission check
  if (tool.permissionLevel === 'dangerous') {
    return {
      success: false,
      message: `工具 ${input.toolName} 需要未来 sandbox 支持，当前版本不执行`,
    };
  }

  // Execute
  return tool.execute({
    brief: input.brief,
    state: input.state,
    payload: input.payload,
    taskId: input.taskId,
  });
}

// ─── Helper: Create a dummy state for tool execution ────────────────────────

function createDummyState(): AgentGraphState {
  const now = new Date().toISOString();
  return {
    sessionId: 'taskgraph-runtime',
    briefId: '',
    status: 'running',
    currentNodeId: 'orchestrator',
    activeAgentName: 'orchestrator',
    userGoal: '',
    tasks: [],
    findings: [],
    pendingQuestions: [],
    pendingCommands: [],
    workingMemory: {},
    createdAt: now,
    updatedAt: now,
    schemaVersion: 'agent-graph-v4',
  };
}

// ─── Main Runtime Function ──────────────────────────────────────────────────

export async function runAgentTaskGraphTurn(input: {
  brief: ProductBrief;
  userMessage: string;
  onProgress?: (event: TaskGraphProgressEvent) => void;
}): Promise<TaskGraphTurnResult> {
  const { brief, userMessage, onProgress } = input;
  const now = new Date().toISOString();

  // 1. Assert API ready
  assertApiReady();

  onProgress?.({ percent: 5, phase: 'init', message: '初始化 TaskGraph...' });

  // 2. Get or create TaskGraph
  let graph = getTaskGraph(brief.id);
  if (!graph) {
    graph = createTaskGraph({
      briefId: brief.id,
      goal: brief.rawIdea || '产品决策工作流',
    });
  }

  // 3. If tasks empty, build initial tasks
  if (graph.tasks.length === 0) {
    const tasks = buildInitialDecisionTasks({
      briefId: brief.id,
      rawIdea: brief.rawIdea || '',
    });
    const edges = buildTaskEdges(tasks);
    graph = {
      ...graph,
      tasks,
      edges,
      status: 'running',
      currentTaskId: tasks[0]?.id,
    };
    saveTaskGraph(graph);

    onProgress?.({ percent: 10, phase: 'planning', message: `创建 ${tasks.length} 个决策任务` });
  }

  // 4. Find current task
  const currentTask = findCurrentTask(graph);

  // If no current task, graph is complete
  if (!currentTask) {
    const reply = '所有决策任务已完成！可以查看 Decision Output 获取完整交付物。';
    return {
      graph: { ...graph, status: 'done' },
      observations: [],
      approvals: [],
      reply,
      toolCallCount: 0,
      nextAction: 'completed',
    };
  }

  onProgress?.({ percent: 20, phase: 'context', message: `当前任务: ${currentTask.title}` });

  // 5. Extract brief context
  const briefContext = extractBriefContext(brief);

  // 6. Find relevant skills and memories
  const relevantSkills = findRelevantSkills({
    userMessage,
    currentTaskTitle: currentTask.title,
    tags: [currentTask.ownerAgent],
  });

  const relevantMemories = findRelevantMemories({
    briefId: brief.id,
    userMessage,
    currentTaskTitle: currentTask.title,
  });

  // 7. Build planner prompt
  const { systemPrompt, userPrompt } = buildTaskGraphPlannerPrompt({
    graph,
    currentTask,
    brief,
    briefContext,
    userMessage,
    relevantSkills,
    relevantMemories,
    recentObservations: graph.observations.slice(-10),
    availableToolNames: listTaskGraphToolNames(),
  });

  onProgress?.({ percent: 30, phase: 'planning', message: 'Agent 正在分析和规划...' });

  // 8. Call LLM Planner
  let plannerOutput: TaskGraphPlannerOutput;
  try {
    const timeoutProfile = getTimeoutProfile('agent_turn');
    plannerOutput = await callCopilotJson<TaskGraphPlannerOutput>(
      systemPrompt,
      userPrompt,
      2000,
      timeoutProfile.timeoutMs,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'AI 调用失败';
    return {
      graph: { ...graph, status: 'failed' },
      observations: [],
      approvals: [],
      reply: `Agent 规划失败: ${errorMsg}`,
      toolCallCount: 0,
      nextAction: 'failed',
    };
  }

  // Validate planner output
  if (!plannerOutput || typeof plannerOutput !== 'object') {
    return {
      graph,
      observations: [],
      approvals: [],
      reply: 'Agent 返回了无效的规划结果，请重试。',
      toolCallCount: 0,
      nextAction: 'failed',
    };
  }

  onProgress?.({ percent: 40, phase: 'execution', message: '执行工具调用...' });

  // 9. Execute tool calls
  const observations: AgentObservation[] = [];
  const approvals: HumanApproval[] = [];
  const toolCalls: AgentToolCallRecord[] = [];
  let toolCallCount = 0;
  const toolCallsToExecute = (plannerOutput.nextToolCalls || []).slice(0, MAX_TOOL_CALLS_PER_TURN);

  for (const tc of toolCallsToExecute) {
    const tool = getTaskGraphTool(tc.toolName);
    if (!tool) {
      // Record failed tool call
      const record: AgentToolCallRecord = {
        id: generateTaskGraphId('tcr'),
        taskId: currentTask.id,
        toolName: tc.toolName,
        permissionLevel: 'read',
        input: tc.input || {},
        success: false,
        error: `工具不存在: ${tc.toolName}`,
        startedAt: now,
        completedAt: now,
      };
      toolCalls.push(record);
      graph = appendToolCall(graph, record);
      continue;
    }

    onProgress?.({
      percent: 40 + Math.round((toolCallCount / toolCallsToExecute.length) * 30),
      phase: 'tool',
      message: `执行工具: ${tc.toolName}`,
    });

    const result = await executeToolCall({
      toolName: tc.toolName,
      payload: tc.input || {},
      brief,
      state: createDummyState(),
      taskId: currentTask.id,
    });

    toolCallCount++;

    // Create tool call record
    const record: AgentToolCallRecord = {
      id: generateTaskGraphId('tcr'),
      taskId: currentTask.id,
      toolName: tc.toolName,
      permissionLevel: tool.permissionLevel,
      input: tc.input || {},
      output: result.data ? { summary: result.message } : undefined,
      success: result.success,
      error: result.success ? undefined : result.message,
      observationId: result.observation?.id,
      startedAt: now,
      completedAt: now,
    };
    toolCalls.push(record);
    graph = appendToolCall(graph, record);

    // Process observation
    if (result.observation) {
      observations.push(result.observation);
      graph = appendObservation(graph, result.observation);
    }

    // Process approval
    if (result.approval) {
      approvals.push(result.approval);
      graph = appendApproval(graph, result.approval);
    }

    // Process brief patch
    if (result.briefPatch) {
      // Store in working memory for later application
      graph = {
        ...graph,
        tasks: graph.tasks.map(t =>
          t.id === currentTask.id
            ? { ...t, observations: [...t.observations, result.observation?.id || ''] }
            : t,
        ),
      };
    }
  }

  onProgress?.({ percent: 75, phase: 'update', message: '更新任务状态...' });

  // 10. Update current task status based on planner output
  if (plannerOutput.taskUpdate) {
    const update = plannerOutput.taskUpdate;
    graph = {
      ...graph,
      tasks: graph.tasks.map(t => {
        if (t.id !== currentTask.id) return t;
        return {
          ...t,
          status: update.status || t.status,
          progressPercent: update.progressPercent ?? t.progressPercent,
          updatedAt: now,
        };
      }),
    };
  }

  // 11. Handle approval request from planner
  if (plannerOutput.approvalRequest?.required) {
    const approval: HumanApproval = {
      id: generateTaskGraphId('appr'),
      taskId: currentTask.id,
      title: plannerOutput.approvalRequest.title,
      description: plannerOutput.approvalRequest.description,
      status: 'pending',
      requiredBefore: plannerOutput.approvalRequest.requiredBefore,
      createdAt: now,
    };
    approvals.push(approval);
    graph = appendApproval(graph, approval);

    // Update task to waiting_approval
    graph = {
      ...graph,
      tasks: graph.tasks.map(t =>
        t.id === currentTask.id
          ? { ...t, status: 'waiting_approval', approvalId: approval.id }
          : t,
      ),
    };
  }

  // 12. Handle memory write from planner
  if (plannerOutput.memoryWrite?.shouldWrite) {
    addMemory({
      briefId: brief.id,
      type: 'decision',
      title: plannerOutput.memoryWrite.title,
      content: plannerOutput.memoryWrite.content,
      tags: plannerOutput.memoryWrite.tags || [],
      sourceTaskId: currentTask.id,
    });
  }

  // 13. Determine next action
  let nextAction: TaskGraphTurnResult['nextAction'] = 'continue';
  if (graph.tasks.some(t => t.status === 'waiting_approval')) {
    nextAction = 'waiting_approval';
  }
  if (graph.tasks.every(t => t.status === 'done' || t.status === 'skipped')) {
    nextAction = 'completed';
  }

  // 14. Update graph
  graph = {
    ...graph,
    currentTaskId: currentTask.id,
    updatedAt: now,
  };
  saveTaskGraph(graph);

  onProgress?.({ percent: 100, phase: 'complete', message: '完成' });

  // 15. Build brief patch if any observations contain data
  let briefPatch: Partial<ProductBrief> | undefined;
  for (const tc of toolCallsToExecute) {
    const tool = getTaskGraphTool(tc.toolName);
    if (!tool) continue;
    const result = await executeToolCall({
      toolName: tc.toolName,
      payload: tc.input || {},
      brief,
      state: createDummyState(),
      taskId: currentTask.id,
    });
    if (result.briefPatch) {
      briefPatch = { ...briefPatch, ...result.briefPatch };
    }
  }

  return {
    graph,
    briefPatch,
    observations,
    approvals,
    reply: plannerOutput.reply || 'Agent 已完成本轮分析。',
    toolCallCount,
    nextAction,
  };
}

// ─── Initialize TaskGraph for a brief ───────────────────────────────────────

export function initializeTaskGraph(briefId: string, rawIdea: string): AgentTaskGraph {
  let graph = getTaskGraph(briefId);
  if (graph) return graph;

  graph = createTaskGraph({
    briefId,
    goal: rawIdea || '产品决策工作流',
  });

  const tasks = buildInitialDecisionTasks({ briefId, rawIdea });
  const edges = buildTaskEdges(tasks);
  graph = {
    ...graph,
    tasks,
    edges,
    status: 'running',
    currentTaskId: tasks[0]?.id,
  };
  saveTaskGraph(graph);
  return graph;
}
