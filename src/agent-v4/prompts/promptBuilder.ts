/**
 * Prompt Builder V4 — construct system and user prompts for each Agent.
 *
 * Rules:
 * - No "..." examples — use complete real JSON.
 * - Max 3 commands per agent turn.
 * - If uncertain, ask_user instead of forcing moveNode.
 * - Never change user fields without reason.
 * - Never present suggestions as facts.
 */

import type { AgentNodeId } from '../types';
import type { AgentGraphState, AgentGraphSession } from '../types';
import type { ProductBrief } from '../../types';
import { AGENT_CONTRACTS, type AgentContract } from './promptContracts';
import { getNodeLabel, getNodeDescription } from '../graph';

/** Build system prompt for an agent. */
export function buildAgentSystemPrompt(contract: AgentContract): string {
  const nodeLabel = getNodeLabel(contract.nodeId);
  const nodeDesc = getNodeDescription(contract.nodeId);

  return `你是 Vibe Copilot 的 ${nodeLabel} Agent。
职责：${nodeDesc}

核心使命：${contract.mission}

你可以执行以下命令类型：
${contract.allowedCommands.map((c) => `- ${c}`).join('\n')}

你不能执行以下命令：
${contract.forbiddenCommands.map((c) => `- ${c}`).join('\n') || '（无限制）'}

必要证据（至少满足其中一项）：
${contract.requiredEvidence.map((e) => `- ${e}`).join('\n') || '（无特殊要求）'}

## 关键规则
1. 每次最多返回 2 个 commands。
2. 如果没有把握推进节点，使用 ASK_USER 或返回 shouldInterrupt: true。
3. 不要在没有理由的情况下修改用户已有字段。
4. 不要把建议当成事实来陈述。
5. 如果信息不足，主动追问，不要猜测。
6. 返回严格 JSON 格式，不要 markdown 代码块，不要解释文字。`;
}

/** Build user prompt with compressed context. */
export function buildAgentUserPrompt(input: {
  nodeId: AgentNodeId;
  brief: ProductBrief;
  state: AgentGraphState;
  session: AgentGraphSession;
  userMessage: string;
}): string {
  const contract = AGENT_CONTRACTS[input.nodeId] || AGENT_CONTRACTS.orchestrator;
  const nodeLabel = getNodeLabel(input.nodeId);

  // Compress brief context
  const briefSummary = {
    rawIdea: input.brief.rawIdea || input.brief.ideaInput?.rawIdea || '',
    targetUser: input.brief.ideaInput?.targetUser || '',
    scenario: input.brief.ideaInput?.scenario || '',
    problem: input.brief.ideaInput?.problem || '',
    projectType: input.brief.ideaInput?.projectType || '',
    hasProductOneLiner: Boolean(input.brief.stages?.product?.productOneLiner?.value),
    hasMvpScope: Boolean(input.brief.stages?.mvp?.mustHave?.value),
    hasTechPlan: Boolean(input.brief.stages?.technical?.frontend?.value),
    hasHandoff: Boolean(input.brief.finalHandoff),
  };

  // Current state summary
  const stateSummary = {
    currentNodeId: input.state.currentNodeId,
    previousNodeId: input.state.previousNodeId,
    pendingQuestions: input.state.pendingQuestions.slice(-3),
    taskCount: input.state.tasks.length,
    findingCount: input.state.findings.length,
    lastEvaluation: input.state.lastEvaluation,
  };

  // Working memory
  const wm = input.state.workingMemory || {};

  return `当前 Agent：${nodeLabel}
当前节点：${input.state.currentNodeId}
上一个节点：${input.state.previousNodeId || '无'}
状态：${input.state.status}

## 产品上下文
${JSON.stringify(briefSummary, null, 2)}

## 当前状态
${JSON.stringify(stateSummary, null, 2)}

## 工作记忆
${JSON.stringify(wm, null, 2)}

## 用户消息
${input.userMessage}

## 返回格式（严格 JSON）
${JSON.stringify(contract.outputSchema, null, 2)}

请基于以上信息，严格按照返回格式输出你的分析和命令。`;
}
