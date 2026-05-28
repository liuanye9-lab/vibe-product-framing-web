/**
 * Memory Types V4 — Agent Graph Memory System
 *
 * Memory layers:
 * - Working: transient session-scoped variables
 * - Episodic: key events during a session (what user changed, what was rejected)
 * - Semantic: references from knowledge docs
 * - Reflection: failure analysis and lessons learned
 * - Skill: reusable process templates
 */

export type MemoryType = 'working' | 'episodic' | 'semantic' | 'reflection' | 'skill';

export interface AgentMemoryItem {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  source: 'user' | 'agent' | 'tool' | 'evaluation' | 'reflection';
  relatedBriefId?: string;
  relatedSessionId?: string;
  createdAt: string;
}

export interface AgentSkill {
  id: string;
  title: string;
  triggerTags: string[];
  applicableWhen: string;
  recommendedSteps: string[];
  outputTemplates?: string[];
  createdAt: string;
}
