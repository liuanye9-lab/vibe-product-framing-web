/**
 * Handoff Tools — generate, optimize, evaluate, and fix Developer Handoff.
 */

import type { ProductBrief, FinalHandoff, OutputSource } from '../../types';
import type { AgentGraphState } from '../types';
import { makeToolResult, type AgentToolResult } from './toolTypes';
import { buildLocalHandoff } from '../../api/evaluate';

/** Generate local handoff from ProductBrief. */
export function generateLocalHandoff(input: {
  brief: ProductBrief;
  state: AgentGraphState;
  payload: Record<string, unknown>;
}): AgentToolResult {
  try {
    const handoff = buildLocalHandoff(input.brief);
    if (!handoff) {
      return makeToolResult(false, '生成 Handoff 失败：无法构建本地交付文档');
    }

    return makeToolResult(true, '本地 Handoff 已生成', {
      briefPatch: { finalHandoff: handoff } as Partial<ProductBrief>,
      data: { handoff },
    });
  } catch (e) {
    return makeToolResult(false, `生成 Handoff 失败: ${String(e)}`);
  }
}

/** Optimize handoff using AI. V4.4: No local fallback on failure. */
export async function optimizeHandoffWithAI(input: {
  brief: ProductBrief;
  state: AgentGraphState;
  payload: Record<string, unknown>;
}): Promise<AgentToolResult> {
  const { optimizeHandoff } = await import('../../api/evaluate');
  const handoff = await optimizeHandoff(input.brief);
  if (handoff) {
    return makeToolResult(true, 'AI 优化 Handoff 完成', {
      briefPatch: { finalHandoff: handoff } as Partial<ProductBrief>,
      data: { handoff, source: 'ai' as OutputSource },
    });
  }
  return makeToolResult(false, 'AI 生成 Handoff 失败，请检查 API 配置后重试。');
}

/** Evaluate the quality of the final handoff. */
export function evaluateHandoffQuality(input: {
  brief: ProductBrief;
  state: AgentGraphState;
  payload: Record<string, unknown>;
}): AgentToolResult {
  const handoff = input.brief.finalHandoff;
  if (!handoff) {
    return makeToolResult(false, 'No handoff to evaluate');
  }

  let evaluation = handoff.evaluation;
  if (!evaluation) {
    // Build a simple local evaluation
    const score = calculateLocalScore(handoff);
    evaluation = {
      totalScore: score,
      maxScore: 25,
      readiness: score >= 18 ? 'ready' : score >= 12 ? 'needs-review' : 'not-ready',
      dimensionScores: {
        userScenarioClarity: handoff.productBrief.length > 50 ? 4 : 2,
        mvpFocus: handoff.mvpScope.length > 50 ? 4 : 2,
        technicalExecutability: handoff.technicalArchitecture.length > 30 ? 3 : 2,
        acceptanceCriteriaCompleteness: handoff.acceptanceCriteria.length > 50 ? 4 : 2,
        promptExecutability: handoff.developmentPrompt.length > 100 ? 4 : 2,
      },
      strengths: handoff.productBrief.length > 30 ? ['Product Brief 内容充实'] : [],
      issues: handoff.acceptanceCriteria.length < 50 ? ['验收标准可能不够具体'] : [],
      suggestions: ['建议补充具体的测试步骤'],
    };
  }

  const statePatch: Partial<AgentGraphState> = {
    lastEvaluation: {
      score: evaluation.totalScore,
      readiness: evaluation.readiness,
      issues: evaluation.issues || [],
      suggestions: evaluation.suggestions || [],
    },
  };

  return makeToolResult(
    true,
    `Handoff 评估完成: ${evaluation.readiness} (${evaluation.totalScore}/${evaluation.maxScore})`,
    {
      briefPatch: {
        finalHandoff: { ...handoff, evaluation },
      } as Partial<ProductBrief>,
      statePatch,
    },
  );
}

function calculateLocalScore(handoff: FinalHandoff): number {
  let score = 0;
  if (handoff.productBrief.length > 100) score += 5;
  else if (handoff.productBrief.length > 30) score += 3;
  if (handoff.mvpScope.length > 100) score += 5;
  else if (handoff.mvpScope.length > 30) score += 3;
  if (handoff.technicalArchitecture.length > 50) score += 3;
  if (handoff.dataStructure.length > 30) score += 3;
  if (handoff.acceptanceCriteria.length > 100) score += 4;
  else if (handoff.acceptanceCriteria.length > 30) score += 2;
  if (handoff.developmentPrompt.length > 200) score += 5;
  else if (handoff.developmentPrompt.length > 50) score += 3;
  return score;
}

/** Apply local fix suggestions to the handoff. */
export async function applyLocalHandoffFixes(input: {
  brief: ProductBrief;
  state: AgentGraphState;
  payload: Record<string, unknown>;
}): Promise<AgentToolResult> {
  const handoff = input.brief.finalHandoff;
  if (!handoff) {
    return makeToolResult(false, 'No handoff to fix');
  }

  try {
    const { applyHandoffFixes } = await import('../../evaluation/applyHandoffFixes');
    const result = applyHandoffFixes(handoff);
    if (!result.changed) {
      return makeToolResult(true, '没有新的本地修复需要应用');
    }
    return makeToolResult(true, '本地修复已应用', {
      briefPatch: { finalHandoff: result.handoff } as Partial<ProductBrief>,
    });
  } catch {
    return makeToolResult(false, '应用修复失败');
  }
}
