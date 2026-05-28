/**
 * Memory Tools — create memory entries and skills.
 */

import type { AgentMemoryItem, MemoryType } from '../memory/memoryTypes';
import { addMemoryItem } from '../memory/episodicMemory';
import { addSkill } from '../memory/skillLibrary';
import { makeToolResult, type AgentToolResult } from './toolTypes';

export function createMemoryTool(input: {
  brief: import('../../types').ProductBrief;
  state: import('../types').AgentGraphState;
  payload: Record<string, unknown>;
}): { success: boolean; message: string; memory: AgentMemoryItem } {
  const p = input.payload;
  const memoryType: MemoryType =
    p.type === 'episodic' || p.type === 'reflection' ? p.type : 'reflection';

  const item = addMemoryItem({
    type: memoryType,
    title: String(p.title || ''),
    content: String(p.content || ''),
    tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
    source: (['agent', 'evaluation', 'reflection'].includes(String(p.source))
      ? String(p.source)
      : 'agent') as AgentMemoryItem['source'],
    relatedBriefId: input.brief.id,
    relatedSessionId: input.state.sessionId,
  });

  return { success: true, message: `Memory created: ${item.title}`, memory: item };
}

export function createSkillTool(input: {
  brief: import('../../types').ProductBrief;
  state: import('../types').AgentGraphState;
  payload: Record<string, unknown>;
}): { success: boolean; message: string; skill: Record<string, unknown> } {
  const p = input.payload;
  const skill = addSkill({
    title: String(p.title || ''),
    triggerTags: Array.isArray(p.triggerTags) ? p.triggerTags.map(String) : [],
    applicableWhen: String(p.applicableWhen || ''),
    recommendedSteps: Array.isArray(p.recommendedSteps)
      ? p.recommendedSteps.map(String)
      : [],
  });

  return { success: true, message: `Skill created: ${skill.title}`, skill: skill as unknown as Record<string, unknown> };
}

// Export a no-op tool result helper for tool registry compatibility
export function makeMemoryToolResult(
  success: boolean,
  message: string,
  memory?: AgentMemoryItem,
): AgentToolResult {
  return makeToolResult(success, message, { data: memory });
}
