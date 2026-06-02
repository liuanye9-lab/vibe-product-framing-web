/**
 * Agent V4 Tool Registry
 *
 * Registers all tools available to Agent nodes. Each tool has a clear
 * input schema and returns structured results. Tools cannot navigate
 * or write to localStorage directly — results are collected by runtime.
 */

import type { AgentTool, AgentToolResult } from './toolTypes';
import { makeToolResult } from './toolTypes';
import { updateBriefStage } from './briefTools';
import { generateLocalHandoff, optimizeHandoffWithAI, evaluateHandoffQuality, applyLocalHandoffFixes } from './handoffTools';
import { createMemoryTool, createSkillTool } from './memoryTools';

const registry = new Map<string, AgentTool>();

function register(tool: AgentTool): void {
  registry.set(tool.name, tool);
}

// Register all tools
register({
  name: 'updateBriefStage',
  description: 'Update a stage of the ProductBrief with AI suggestions.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      targetStage: {
        type: 'string',
        enum: ['discovery', 'product', 'mvp', 'technical', 'blindSpot', 'finalHandoff'],
      },
      patch: { type: 'object' },
      source: { type: 'string', enum: ['ai', 'local-rule'] },
    },
    required: ['targetStage', 'patch'],
  },
  execute: async (input) => {
    try {
      const result = updateBriefStage(input);
      return makeToolResult(true, `已更新 ${input.payload.targetStage}`, {
        briefPatch: result.briefPatch,
      });
    } catch (e) {
      return makeToolResult(false, `更新阶段失败: ${String(e)}`);
    }
  },
});

register({
  name: 'createFinding',
  description: 'Create a finding in the agent state.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      nodeId: { type: 'string' },
      evidence: { type: 'array', items: { type: 'string' } },
      risks: { type: 'array', items: { type: 'string' } },
      missingInfo: { type: 'array', items: { type: 'string' } },
      suggestions: { type: 'array', items: { type: 'string' } },
      confidence: { type: 'number' },
    },
    required: ['title', 'summary'],
  },
  execute: async (input) => {
    const p = input.payload;
    const finding = {
      id: `find-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(p.title || ''),
      summary: String(p.summary || ''),
      nodeId: (p.nodeId || input.state.currentNodeId) as import('../types').AgentNodeId,
      evidence: Array.isArray(p.evidence) ? p.evidence.map(String) : [],
      risks: Array.isArray(p.risks) ? p.risks.map(String) : [],
      missingInfo: Array.isArray(p.missingInfo) ? p.missingInfo.map(String) : [],
      suggestions: Array.isArray(p.suggestions) ? p.suggestions.map(String) : [],
      confidence: typeof p.confidence === 'number' ? p.confidence : 0.5,
      createdAt: new Date().toISOString(),
    };
    return makeToolResult(true, `Finding created: ${finding.title}`, {
      statePatch: {
        findings: [...input.state.findings, finding],
      } as Partial<import('../types').AgentGraphState>,
    });
  },
});

register({
  name: 'createTask',
  description: 'Create a task in the agent state.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      required: { type: 'boolean' },
    },
    required: ['title'],
  },
  execute: async (input) => {
    const p = input.payload;
    const task = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: String(p.title || ''),
      description: String(p.description || ''),
      ownerNode: input.state.currentNodeId as import('../types').AgentNodeId,
      status: 'todo' as const,
      phase: input.state.currentNodeId as import('../types').AgentNodeId,
      required: Boolean(p.required),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return makeToolResult(true, `Task created: ${task.title}`, {
      statePatch: {
        tasks: [...input.state.tasks, task],
      } as Partial<import('../types').AgentGraphState>,
    });
  },
});

register({
  name: 'completeTask',
  description: 'Mark a task as completed.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: ['done', 'skipped', 'blocked'] },
    },
    required: ['taskId'],
  },
  execute: async (input) => {
    const p = input.payload;
    const taskId = String(p.taskId || '');
    const newStatus = (['done', 'skipped', 'blocked'].includes(String(p.status)) ? String(p.status) : 'done') as 'done' | 'skipped' | 'blocked';
    const updatedTasks = input.state.tasks.map((t) =>
      t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t,
    );
    return makeToolResult(true, `Task ${taskId} → ${newStatus}`, {
      statePatch: {
        tasks: updatedTasks,
      } as Partial<import('../types').AgentGraphState>,
    });
  },
});

register({
  name: 'moveNode',
  description: 'Move to a different graph node.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      targetNodeId: { type: 'string' },
    },
    required: ['targetNodeId'],
  },
  execute: async (input) => {
    const targetNodeId = String(input.payload.targetNodeId || '');
    return makeToolResult(true, `Move to node: ${targetNodeId}`, {
      statePatch: {
        previousNodeId: input.state.currentNodeId,
        currentNodeId: targetNodeId as import('../types').AgentNodeId,
      } as Partial<import('../types').AgentGraphState>,
    });
  },
});

register({
  name: 'legacyGenerateLocalHandoff',
  description: '[Legacy/Debug] Generate handoff locally from ProductBrief without AI. Not used in core agent path.',
  permissionLevel: 'generate_artifact',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: { type: 'object', properties: {} },
  execute: async (input) => {
    try {
      const result = generateLocalHandoff(input);
      return result;
    } catch (e) {
      return makeToolResult(false, `生成 Handoff 失败: ${String(e)}`);
    }
  },
});

register({
  name: 'optimizeHandoffWithAI',
  description: 'Optimize handoff using AI. Requires valid API connection. No local fallback on failure.',
  permissionLevel: 'external_ai',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: { type: 'object', properties: {} },
  execute: async (input) => {
    try {
      const result = await optimizeHandoffWithAI(input);
      return result;
    } catch (e) {
      return makeToolResult(false, `AI 优化 Handoff 失败: ${String(e)}`);
    }
  },
});

register({
  name: 'evaluateHandoffQuality',
  description: 'Evaluate the quality of the final handoff.',
  permissionLevel: 'read',
  sideEffect: 'none',
  requiresApproval: false,
  inputSchema: { type: 'object', properties: {} },
  execute: async (input) => {
    try {
      const result = evaluateHandoffQuality(input);
      return result;
    } catch (e) {
      return makeToolResult(false, `评估 Handoff 失败: ${String(e)}`);
    }
  },
});

register({
  name: 'applyLocalHandoffFixes',
  description: 'Apply local fix suggestions to the handoff.',
  permissionLevel: 'generate_artifact',
  sideEffect: 'artifact_generation',
  requiresApproval: false,
  inputSchema: { type: 'object', properties: {} },
  execute: async (input) => {
    try {
      const result = applyLocalHandoffFixes(input);
      return result;
    } catch (e) {
      return makeToolResult(false, `应用修复失败: ${String(e)}`);
    }
  },
});

register({
  name: 'createMemory',
  description: 'Create a memory entry.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['episodic', 'reflection'] },
      title: { type: 'string' },
      content: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      source: { type: 'string' },
    },
    required: ['title', 'content'],
  },
  execute: async (input) => {
    try {
      const result = createMemoryTool(input);
      return makeToolResult(true, result.message, { data: result.memory });
    } catch (e) {
      return makeToolResult(false, `创建记忆失败: ${String(e)}`);
    }
  },
});

register({
  name: 'createSkill',
  description: 'Create a reusable skill in the skill library.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      triggerTags: { type: 'array', items: { type: 'string' } },
      applicableWhen: { type: 'string' },
      recommendedSteps: { type: 'array', items: { type: 'string' } },
    },
    required: ['title'],
  },
  execute: async (input) => {
    try {
      const result = createSkillTool(input);
      return makeToolResult(true, result.message, { data: result.skill });
    } catch (e) {
      return makeToolResult(false, `创建 Skill 失败: ${String(e)}`);
    }
  },
});

register({
  name: 'askUser',
  description: 'Pause execution and ask the user for input.',
  permissionLevel: 'write_state',
  sideEffect: 'state_update',
  requiresApproval: false,
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string' },
    },
    required: ['question'],
  },
  execute: async (input) => {
    const question = String(input.payload.question || '');
    return makeToolResult(true, `Ask user: ${question}`, {
      statePatch: {
        status: 'waiting_user',
        pendingQuestions: [...input.state.pendingQuestions, question],
      } as Partial<import('../types').AgentGraphState>,
    });
  },
});

export function getTool(name: string): AgentTool | undefined {
  return registry.get(name);
}

export function hasTool(name: string): boolean {
  return registry.has(name);
}

export function listTools(): AgentTool[] {
  return Array.from(registry.values());
}

export async function executeToolCall(input: {
  toolName: string;
  brief: import('../../types').ProductBrief;
  state: import('../types').AgentGraphState;
  payload: Record<string, unknown>;
}): Promise<AgentToolResult> {
  const tool = getTool(input.toolName);
  if (!tool) {
    return makeToolResult(false, `Unknown tool: ${input.toolName}`);
  }
  try {
    return await tool.execute(input);
  } catch (e) {
    return makeToolResult(false, `Tool "${input.toolName}" error: ${String(e)}`);
  }
}
