/**
 * Local Orchestrator — rule-based decision engine for the Agent workflow (V2.1).
 *
 * Key design changes from V2.0:
 * 1. Intent detection runs FIRST. continue/skip/make_assumption override missing-field checks.
 * 2. workflow.currentPhase is the primary state machine, not brief field scanning.
 * 3. phaseAfterTurn keeps track of where the state machine should land after processing.
 */

import type { ProductBrief } from '../types';
import type {
  AgentRole,
  AgentDecisionStatus,
  AgentWorkflowState,
  WorkflowPhase,
} from './types';
import { getNextPhase, getPreviousPhase } from './phaseUtils';

export interface OrchestratorResult {
  nextAgent: AgentRole;
  nextPhase: WorkflowPhase;
  phaseAfterTurn: WorkflowPhase;
  decisionStatus: AgentDecisionStatus;
  reply: string;
  questions: string[];
  shouldCallAI: boolean;
  shouldMoveNext: boolean;
}

function hasValue(s: string | undefined | null): boolean {
  return Boolean(s && s.trim().length > 0);
}

function hasSuggestionValue(s: { value?: unknown } | undefined): boolean {
  if (!s) return false;
  const v = s.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  return false;
}

function detectUserIntent(
  message: string,
): 'skip' | 'unsure' | 'make_assumption' | 'go_back' | 'continue' | 'normal' {
  const m = message.toLowerCase().trim();
  if (m === '跳过' || m === '先跳过' || m === 'skip' || m === '先不回答') return 'skip';
  if (m === '我不确定' || m === '不确定' || m === 'unsure' || m === '不知道') return 'unsure';
  if (m.includes('假设') || m === '帮我做默认假设' || m === 'make_assumption') return 'make_assumption';
  if (m === '回到 mvp' || m === '回退' || m === 'go_back' || m.includes('回去')) return 'go_back';
  if (m === '继续' || m === '下一步' || m === 'continue' || m.includes('继续')) return 'continue';
  return 'normal';
}

/**
 * Phase-based state machine. The phase determines what to check, not the other way around.
 */
export function runLocalOrchestrator(input: {
  brief: ProductBrief;
  workflow: AgentWorkflowState;
  userMessage: string;
}): OrchestratorResult {
  const { brief, workflow, userMessage } = input;
  const intent = detectUserIntent(userMessage);
  const phase = workflow.currentPhase;

  const product = brief.stages.product;
  const mvp = brief.stages.mvp;
  const technical = brief.stages.technical;
  const blindSpot = brief.stages.blindSpot;

  const hasTargetUser = hasValue(brief.ideaInput.targetUser) || hasSuggestionValue(product.targetUser);
  const hasScenario = hasValue(brief.ideaInput.scenario) || hasSuggestionValue(product.scenario);
  const hasProblem = hasValue(brief.ideaInput.problem) || hasSuggestionValue(product.corePainPoint);
  const hasMustHave = hasSuggestionValue(mvp.mustHave);
  const hasOutOfScope = hasSuggestionValue(mvp.outOfScope);
  const hasTech = hasSuggestionValue(technical.frontend);
  const hasBlindSpot = hasSuggestionValue(blindSpot.demandRisk) || hasSuggestionValue(blindSpot.technicalRisk);
  const hasFinalHandoff = Boolean(brief.finalHandoff?.developmentPrompt);

  // --- empty idea: always block ---
  if (!hasValue(brief.rawIdea) && !hasValue(brief.ideaInput.rawIdea)) {
    return {
      nextAgent: 'orchestrator',
      nextPhase: 'intake',
      phaseAfterTurn: 'intake',
      decisionStatus: 'need_more_info',
      reply: '我还没有看到你的产品想法。可以先简单描述一下你想做什么吗？',
      questions: [],
      shouldCallAI: false,
      shouldMoveNext: false,
    };
  }

  // --- intent handlers (highest priority after empty check) ---

  if (intent === 'go_back') {
    const prev = getPreviousPhase(phase);
    return {
      nextAgent: prev === 'mvp' ? 'mvp' : prev === 'tech' ? 'tech' : prev === 'risk' ? 'risk' : 'demand',
      nextPhase: prev,
      phaseAfterTurn: prev,
      decisionStatus: 'can_move_next',
      reply: `好的，我们回到上一步。你想修改什么？`,
      questions: [],
      shouldCallAI: false,
      shouldMoveNext: false,
    };
  }

  if (intent === 'continue') {
    // Don't get blocked by missing fields — move forward
    const next = getNextPhase(phase);

    const phaseChecks: Record<WorkflowPhase, { agent: AgentRole; needsAI: boolean; needsFields: boolean; reply: string }> = {
      intake: { agent: 'demand', needsAI: false, needsFields: false, reply: '好的，接下来帮你梳理需求。' },
      demand: { agent: 'demand', needsAI: false, needsFields: false, reply: '好的，进入产品定义阶段。' },
      product: { agent: 'product', needsAI: true, needsFields: true, reply: '好的，帮你整理产品一句话定义。' },
      mvp: { agent: 'mvp', needsAI: true, needsFields: true, reply: '好的，帮你收敛 MVP 范围，明确第一版的边界。' },
      tech: { agent: 'tech', needsAI: true, needsFields: true, reply: '好的，帮你确定最低成本的技术方案。' },
      risk: { agent: 'risk', needsAI: true, needsFields: true, reply: '好的，帮你检查盲点和风险。' },
      handoff: { agent: 'handoff', needsAI: true, needsFields: false, reply: '所有阶段已通过，可以生成 Developer Handoff。' },
      complete: { agent: 'orchestrator', needsAI: false, needsFields: false, reply: '所有阶段都已完成。' },
    };

    const check = phaseChecks[phase] || { agent: 'orchestrator' as AgentRole, needsAI: false, needsFields: false, reply: '继续推进中...' };

    if (phase === 'complete') {
      return {
        nextAgent: 'orchestrator',
        nextPhase: 'complete',
        phaseAfterTurn: 'complete',
        decisionStatus: 'can_move_next',
        reply: check.reply,
        questions: [],
        shouldCallAI: false,
        shouldMoveNext: false,
      };
    }

    return {
      nextAgent: check.agent,
      nextPhase: next,
      phaseAfterTurn: next,
      decisionStatus: 'can_move_next',
      reply: check.reply,
      questions: [],
      shouldCallAI: check.needsAI,
      shouldMoveNext: true,
    };
  }

  if (intent === 'skip') {
    const next = getNextPhase(phase);
    return {
      nextAgent: next === 'demand' ? 'demand' : next === 'product' ? 'product' : 'mvp',
      nextPhase: next,
      phaseAfterTurn: next,
      decisionStatus: 'can_move_next',
      reply: `跳过当前阶段。后续如果需要补充，随时可以回头修改。`,
      questions: [],
      shouldCallAI: false,
      shouldMoveNext: true,
    };
  }

  if (intent === 'make_assumption') {
    // Allow AI to fill in defaults for current phase
    return {
      nextAgent: phase === 'intake' ? 'demand' : phase === 'demand' ? 'demand' :
        phase === 'product' ? 'product' : phase === 'mvp' ? 'mvp' :
          phase === 'tech' ? 'tech' : phase === 'risk' ? 'risk' : 'handoff',
      nextPhase: phase,
      phaseAfterTurn: phase,
      decisionStatus: 'ready_to_decide',
      reply: '好的，我会基于你已有的信息做默认假设。如果假设不对，随时告诉我修改。',
      questions: [],
      shouldCallAI: true,
      shouldMoveNext: false,
    };
  }

  // ===== Phase-based state machine (only for 'normal' intent) =====

  switch (phase) {
    case 'intake': {
      // If idea exists but demand info missing
      if (!hasTargetUser || !hasScenario || !hasProblem) {
        const missing: string[] = [];
        if (!hasTargetUser) missing.push('谁最痛（目标用户）');
        if (!hasScenario) missing.push('在什么场景下使用');
        if (!hasProblem) missing.push('解决什么问题');

        return {
          nextAgent: 'demand',
          nextPhase: 'intake',
          phaseAfterTurn: 'intake',
          decisionStatus: 'need_more_info',
          reply: `我先帮你梳理一下核心信息。目前还缺：${missing.join('、')}。不用一次性全部填完。`,
          questions: [
            hasTargetUser ? '' : '谁会使用这个产品？他们当前的痛点是什么？',
            hasScenario ? '' : '用户在什么情况下会打开这个产品？',
          ].filter(Boolean).slice(0, 2),
          shouldCallAI: false,
          shouldMoveNext: false,
        };
      }
      // Demand info sufficient → advance
      return {
        nextAgent: 'demand',
        nextPhase: 'demand',
        phaseAfterTurn: 'demand',
        decisionStatus: 'can_move_next',
        reply: '需求信息看起来很清楚了，接下来帮你进入需求诊断阶段。',
        questions: [],
        shouldCallAI: true,
        shouldMoveNext: false,
      };
    }

    case 'demand': {
      // Check if demand info is filled
      if (!hasTargetUser || !hasScenario || !hasProblem) {
        const missing: string[] = [];
        if (!hasTargetUser) missing.push('目标用户');
        if (!hasScenario) missing.push('使用场景');
        if (!hasProblem) missing.push('核心问题');

        return {
          nextAgent: 'demand',
          nextPhase: 'demand',
          phaseAfterTurn: 'demand',
          decisionStatus: 'need_more_info',
          reply: `需求诊断还需要以下信息：${missing.join('、')}。你可以选择补充，或点击"继续下一步"跳过。`,
          questions: missing.slice(0, 2).map((m) => `请描述一下${m}`),
          shouldCallAI: false,
          shouldMoveNext: false,
        };
      }
      // Product framing missing → move to product
      if (!hasSuggestionValue(product.productOneLiner) || !hasSuggestionValue(product.aiValue)) {
        return {
          nextAgent: 'product',
          nextPhase: 'product',
          phaseAfterTurn: 'product',
          decisionStatus: 'can_move_next',
          reply: '需求诊断完成。接下来帮你整理产品一句话定义和 AI 介入价值。',
          questions: [],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      return {
        nextAgent: 'product',
        nextPhase: 'product',
        phaseAfterTurn: 'product',
        decisionStatus: 'can_move_next',
        reply: '需求诊断完成，进入产品定义阶段。',
        questions: [],
        shouldCallAI: true,
        shouldMoveNext: false,
      };
    }

    case 'product': {
      if (!hasMustHave || !hasOutOfScope) {
        return {
          nextAgent: 'mvp',
          nextPhase: 'mvp',
          phaseAfterTurn: 'mvp',
          decisionStatus: 'can_move_next',
          reply: '产品定义完成。接下来收敛 MVP 范围，明确第一版必须做和不做什么。',
          questions: [],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      return {
        nextAgent: 'mvp',
        nextPhase: 'mvp',
        phaseAfterTurn: 'mvp',
        decisionStatus: 'can_move_next',
        reply: '产品定义已完成，进入 MVP 范围阶段。',
        questions: [],
        shouldCallAI: true,
        shouldMoveNext: false,
      };
    }

    case 'mvp': {
      if (!hasMustHave) {
        return {
          nextAgent: 'mvp',
          nextPhase: 'mvp',
          phaseAfterTurn: 'mvp',
          decisionStatus: 'need_more_info',
          reply: '第一版最核心的功能是什么？明确 Must Have，避免做着做着变成大平台。',
          questions: ['第一版最核心的功能是什么？（最少 1 个，最多 3 个）', '第一版明确不做什么？'],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      if (!hasOutOfScope) {
        return {
          nextAgent: 'mvp',
          nextPhase: 'mvp',
          phaseAfterTurn: 'mvp',
          decisionStatus: 'risk_detected',
          reply: 'MVP 的「必须做」有了，但没有定义「不做」的范围。没有边界，范围容易膨胀。',
          questions: ['第一版明确不做哪些功能？'],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      if (!hasTech) {
        return {
          nextAgent: 'tech',
          nextPhase: 'tech',
          phaseAfterTurn: 'tech',
          decisionStatus: 'can_move_next',
          reply: 'MVP 范围确定。接下来帮你确定最低成本的技术方案。',
          questions: [],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      return {
        nextAgent: 'tech',
        nextPhase: 'tech',
        phaseAfterTurn: 'tech',
        decisionStatus: 'can_move_next',
        reply: 'MVP 范围完成，进入技术方案阶段。',
        questions: [],
        shouldCallAI: true,
        shouldMoveNext: false,
      };
    }

    case 'tech': {
      if (!hasTech) {
        return {
          nextAgent: 'tech',
          nextPhase: 'tech',
          phaseAfterTurn: 'tech',
          decisionStatus: 'need_more_info',
          reply: '我来帮你分析最低成本的技术方案：推荐前端框架、是否需要后端/数据库/AI API、Mock 策略和升级条件。',
          questions: [],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      if (!hasBlindSpot) {
        return {
          nextAgent: 'risk',
          nextPhase: 'risk',
          phaseAfterTurn: 'risk',
          decisionStatus: 'can_move_next',
          reply: '技术方案确定。最后检查一下盲点和风险。',
          questions: [],
          shouldCallAI: true,
          shouldMoveNext: false,
        };
      }
      return {
        nextAgent: 'risk',
        nextPhase: 'risk',
        phaseAfterTurn: 'risk',
        decisionStatus: 'can_move_next',
        reply: '技术方案完成，进入风险审查阶段。',
        questions: [],
        shouldCallAI: true,
        shouldMoveNext: false,
      };
    }

    case 'risk': {
      if (!hasFinalHandoff) {
        return {
          nextAgent: 'handoff',
          nextPhase: 'handoff',
          phaseAfterTurn: 'handoff',
          decisionStatus: 'can_move_next',
          reply: '风险审查完成。现在可以整合所有阶段，生成 Developer Handoff。',
          questions: [],
          shouldCallAI: true,
          shouldMoveNext: true,
        };
      }
      return {
        nextAgent: 'orchestrator',
        nextPhase: 'complete',
        phaseAfterTurn: 'complete',
        decisionStatus: 'can_move_next',
        reply: '所有阶段完成。点击"生成 Developer Handoff"查看完整交付文档。',
        questions: [],
        shouldCallAI: false,
        shouldMoveNext: false,
      };
    }

    case 'handoff': {
      return {
        nextAgent: 'handoff',
        nextPhase: 'handoff',
        phaseAfterTurn: 'handoff',
        decisionStatus: 'can_move_next',
        reply: '所有阶段通过。你可以点击右侧"生成 Developer Handoff"生成开发交付文档。',
        questions: [],
        shouldCallAI: false,
        shouldMoveNext: false,
      };
    }

    case 'complete': {
      return {
        nextAgent: 'orchestrator',
        nextPhase: 'complete',
        phaseAfterTurn: 'complete',
        decisionStatus: 'can_move_next',
        reply: '所有阶段都完成了！如需修改任何部分，直接告诉我。',
        questions: [],
        shouldCallAI: false,
        shouldMoveNext: false,
      };
    }

    default:
      return {
        nextAgent: 'orchestrator',
        nextPhase: 'intake',
        phaseAfterTurn: 'intake',
        decisionStatus: 'need_more_info',
        reply: '请描述你的产品想法。',
        questions: [],
        shouldCallAI: false,
        shouldMoveNext: false,
      };
  }
}
