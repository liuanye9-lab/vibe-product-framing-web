/**
 * V5.2 TaskGraph Prompt Builder — Builds LLM prompts for the TaskGraph planner
 *
 * The planner receives:
 * - Current task graph state
 * - Relevant skills
 * - Relevant memories
 * - Brief context
 * - User message
 *
 * And outputs structured JSON: nextToolCalls, taskUpdate, approvalRequest, memoryWrite
 */

import type { AgentTaskGraph, AgentTask, AgentObservation } from './taskGraphTypes';
import type { AgentSkill } from './skillLibrary';
import type { AgentMemoryEntry } from './memoryRuntime';
import type { ProductBrief } from '../../types';

interface PromptInput {
  graph: AgentTaskGraph;
  currentTask: AgentTask | null;
  brief: ProductBrief;
  briefContext: {
    rawIdea: string;
    knownFields: string[];
    missingFields: string[];
    summary: string;
  };
  userMessage: string;
  relevantSkills: AgentSkill[];
  relevantMemories: AgentMemoryEntry[];
  recentObservations: AgentObservation[];
  availableToolNames: string[];
}

// ─── System Prompt ──────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are the Vibe Decision Copilot Agent Planner.

Your role: analyze the current state of a product decision workflow and decide the next actions.

## Output Format

You MUST return a valid JSON object with this exact structure:

{
  "reply": "Natural language reply to the user (Chinese preferred)",
  "reasoningSummary": "Brief reasoning (not hidden chain-of-thought)",
  "nextToolCalls": [
    {
      "toolName": "tool_name",
      "reason": "Why this tool is called",
      "input": { }
    }
  ],
  "taskUpdate": {
    "status": "running|waiting_approval|done|blocked",
    "progressPercent": 0
  },
  "approvalRequest": {
    "required": true,
    "title": "Approval title",
    "description": "What needs approval",
    "requiredBefore": "Task or step name"
  },
  "memoryWrite": {
    "shouldWrite": true,
    "title": "Memory title",
    "content": "What to remember",
    "tags": ["tag1"]
  }
}

## Rules

1. Return ONLY valid JSON. No markdown, no code fences, no commentary.
2. nextToolCalls: maximum 4 per turn. Tool names MUST come from the available tools list.
3. Do NOT fabricate tool results. Tools return Observations.
4. If critical information is missing, prefer requestHumanApproval or askUser rather than generating guesses.
5. If user asks for CODEX_TASK_PACK, verify DEV_SPEC and Acceptance Criteria exist first.
6. If MVP Scope is unconfirmed, generate draft only and mark as unconfirmed.
7. Each turn should advance at most 1 key task.
8. Use Chinese for user-facing reply text.
`;
}

// ─── User Prompt ────────────────────────────────────────────────────────────

function buildUserPrompt(input: PromptInput): string {
  const {
    graph,
    currentTask,
    briefContext,
    userMessage,
    relevantSkills,
    relevantMemories,
    recentObservations,
    availableToolNames,
  } = input;

  const sections: string[] = [];

  // Task Graph Overview
  sections.push(`## Task Graph Overview
Goal: ${graph.goal}
Status: ${graph.status}
Progress: ${graph.progressPercent}%
Total Tasks: ${graph.tasks.length}
Completed: ${graph.tasks.filter(t => t.status === 'done').length}
Current Task: ${currentTask ? `${currentTask.title} (${currentTask.status})` : 'None'}
Pending Approvals: ${graph.approvals.filter(a => a.status === 'pending').length}`);

  // Task List Summary
  const taskSummary = graph.tasks.map(t =>
    `- [${t.status}] ${t.title} (${t.progressPercent}%) - Owner: ${t.ownerAgent}${t.requiresApproval ? ' [需要确认]' : ''}`,
  ).join('\n');
  sections.push(`## Tasks\n${taskSummary}`);

  // Brief Context
  sections.push(`## Brief Context
Raw Idea: ${briefContext.rawIdea}
Known Fields: ${briefContext.knownFields.join(', ')}
Missing Fields: ${briefContext.missingFields.join(', ')}
Summary: ${briefContext.summary}`);

  // Current Task Detail
  if (currentTask) {
    sections.push(`## Current Task Detail
Title: ${currentTask.title}
Description: ${currentTask.description}
Owner: ${currentTask.ownerAgent}
Status: ${currentTask.status}
Expected Output: ${currentTask.expectedOutput}
Acceptance Criteria: ${currentTask.acceptanceCriteria.join('; ')}
Steps: ${currentTask.steps.map(s => `[${s.status}] ${s.title}`).join(', ')}
Tool Calls: ${currentTask.toolCalls.length}
Observations: ${currentTask.observations.length}`);
  }

  // Recent Observations
  if (recentObservations.length > 0) {
    const obsList = recentObservations.slice(-5).map(o =>
      `- [${o.source}] ${o.title}: ${o.content.slice(0, 200)}${o.content.length > 200 ? '...' : ''}`,
    ).join('\n');
    sections.push(`## Recent Observations\n${obsList}`);
  }

  // Relevant Skills
  if (relevantSkills.length > 0) {
    const skillList = relevantSkills.map(s =>
      `- ${s.title}: ${s.applicableWhen} (Steps: ${s.recommendedSteps.length})`,
    ).join('\n');
    sections.push(`## Relevant Skills\n${skillList}`);
  }

  // Relevant Memories
  if (relevantMemories.length > 0) {
    const memList = relevantMemories.slice(-5).map(m =>
      `- [${m.type}] ${m.title}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`,
    ).join('\n');
    sections.push(`## Relevant Memories\n${memList}`);
  }

  // Available Tools
  sections.push(`## Available Tools
${availableToolNames.join(', ')}`);

  // User Message
  sections.push(`## User Message
${userMessage}`);

  // Instructions
  sections.push(`## Instructions
Based on the current state, decide the next actions. Consider:
1. What information is missing?
2. What tools should be called next?
3. Does this step need human approval?
4. What should be remembered?
5. What is the appropriate reply to the user?

Return ONLY the JSON object described in the system prompt.`);

  return sections.join('\n\n');
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function buildTaskGraphPlannerPrompt(input: PromptInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
  };
}
