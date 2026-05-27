/**
 * Local Orchestrator — rule-based decision engine for the Agent workflow.
 *
 * Determines the next Agent and phase based on the current ProductBrief state
 * and the user's latest message. This runs before (or instead of) calling the AI.
 */

import type { ProductBrief } from '../types';
import type {
  AgentRole,
  AgentDecisionStatus,
  AgentWorkflowState,
  WorkflowPhase,
} from './types';

export interface OrchestratorResult {
  nextAgent: AgentRole;
  nextPhase: WorkflowPhase;
  decisionStatus: AgentDecisionStatus;
  reply: string;
  questions: string[];
  shouldCallAI: boolean;
  shouldMoveNext: boolean;
}

/**
 * Check whether a string is non-empty and not just whitespace.
 */
function hasValue(s: string | undefined | null): boolean {
  return Boolean(s && s.trim().length > 0);
}

/**
 * Check whether an AiSuggestion has a meaningful value.
 */
function hasSuggestionValue(s: { value?: unknown; accepted?: boolean } | undefined): boolean {
  if (!s) return false;
  const v = s.value;
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'number' || typeof v === 'boolean') return true;
  return false;
}

/**
 * Simple intent detection from user message.
 */
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
 * Determine the next Agent and phase based on the current brief + workflow state.
 */
export function runLocalOrchestrator(input: {
  brief: ProductBrief;
  workflow: AgentWorkflowState;
  userMessage: string;
}): OrchestratorResult {
  const { brief, workflow, userMessage } = input;
  const intent = detectUserIntent(userMessage);
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
  const hasFinalHandoff = Boolean(brief.finalHandoff?.developmentPrompt);

  // --- Phase 0: empty idea ---
  if (!hasValue(brief.rawIdea) && !hasValue(brief.ideaInput.rawIdea)) {
    return {
      nextAgent: 'orchestrator',
      nextPhase: 'intake',
      decisionStatus: 'need_more_info',
      reply: '我还没有看到你的产品想法。可以先简单描述一下你想做什么吗？比如「我想做一个帮助 vibe coding 新手快速选择技术栈的工具」。',
      questions: [],
      shouldCallAI: false,
      shouldMoveNext: false,
    };
  }

  // --- Phase 1: intake → demand ---
  if (!hasTargetUser || !hasScenario || !hasProblem) {
    const missing: string[] = [];
    if (!hasTargetUser) missing.push('谁最痛（目标用户）');
    if (!hasScenario) missing.push('在什么场景下使用');
    if (!hasProblem) missing.push('解决什么问题');

    const phase = workflow.currentPhase === 'intake' ? 'intake' : 'demand';

    return {
      nextAgent: 'demand',
      nextPhase: phase as WorkflowPhase,
      decisionStatus: 'need_more_info',
      reply: `我先帮你梳理一下核心信息。目前还缺几项：${missing.join('、')}。\n\n不用一次性全部填完——先告诉我你最确定的那一项就行。`,
      questions: missing.map((m) => (m.includes('用户') ? '谁会使用这个产品？他们当前的痛点是什么？' : m.includes('场景') ? '用户在什么情况下会打开这个产品？' : '用户现在怎么解决这个问题的？')).slice(0, 2),
      shouldCallAI: false,
      shouldMoveNext: false,
    };
  }

  // --- Intent: skip / make_assumption ---
  if (intent === 'skip' || intent === 'make_assumption') {
    return {
      nextAgent: 'demand',
      nextPhase: 'demand',
      decisionStatus: 'ready_to_decide',
      reply: intent === 'make_assumption'
        ? '好的，我会基于你已有的信息做默认假设。如果假设不对，随时告诉我修改。'
        : '没问题，先跳过这个部分。后续如果需要补充，随时可以回头问。',
      questions: [],
      shouldCallAI: true,
      shouldMoveNext: true,
    };
  }

  if (intent === 'go_back') {
    return {
      nextAgent: 'mvp',
      nextPhase: 'mvp',
      decisionStatus: 'need_more_info',
      reply: '好的，我们回到 MVP 范围这一步。你对第一版的功能有什么新的想法吗？',
      questions: [],
      shouldCallAI: false,
      shouldMoveNext: false,
    };
  }

  // --- Phase 2: product framing ---
  if (!hasSuggestionValue(product.productOneLiner) || !hasSuggestionValue(product.aiValue)) {
    return {
      nextAgent: 'product',
      nextPhase: 'product',
      decisionStatus: 'need_more_info',
      reply: '需求信息我大致了解了，接下来帮你整理一下产品定义：用一句话说清楚这个产品是做什么的，以及 AI 在这个产品里起什么作用。',
      questions: ['这个产品一句话怎么说？（谁在什么场景下解决什么问题）', 'AI 在这个产品里是核心功能还是辅助功能？'],
      shouldCallAI: true,
      shouldMoveNext: false,
    };
  }

  // --- Phase 3: MVP scope ---
  if (!hasMustHave) {
    return {
      nextAgent: 'mvp',
      nextPhase: 'mvp',
      decisionStatus: 'need_more_info',
      reply: '产品定义清楚了，接下来收敛一下第一版范围。先明确「必须做」和「不做」的边界，防止做着做着变成大平台。',
      questions: ['第一版最核心的功能是什么？（最少 1 个，最多 3 个）', '第一版明确不做什么？'],
      shouldCallAI: true,
      shouldMoveNext: false,
    };
  }

  if (!hasOutOfScope) {
    return {
      nextAgent: 'mvp',
      nextPhase: 'mvp',
      decisionStatus: 'risk_detected',
      reply: 'MVP 的「必须做」有了，但还没有定义「不做」的范围。没有明确的边界，范围很容易悄悄膨胀。',
      questions: ['第一版明确不做哪些功能？（比如：不做登录、不做支付、不做后台）'],
      shouldCallAI: true,
      shouldMoveNext: false,
    };
  }

  // --- Phase 4: technical ---
  if (!hasTech) {
    return {
      nextAgent: 'tech',
      nextPhase: 'tech',
      decisionStatus: 'need_more_info',
      reply: 'MVP 范围定下来了，接下来确定技术方案。我会基于你的产品类型和需求，推荐最低成本的技术栈。',
      questions: [],
      shouldCallAI: true,
      shouldMoveNext: false,
    };
  }

  // --- Phase 5: risk ---
  const hasBlindSpot = hasSuggestionValue(blindSpot.demandRisk) || hasSuggestionValue(blindSpot.technicalRisk);
  if (!hasBlindSpot) {
    return {
      nextAgent: 'risk',
      nextPhase: 'risk',
      decisionStatus: 'need_more_info',
      reply: '技术和范围都有了，最后检查一下盲点和风险：有没有什么事情如果发生，会让这个产品不成立？',
      questions: [],
      shouldCallAI: true,
      shouldMoveNext: false,
    };
  }

  // --- Phase 6: handoff ---
  if (!hasFinalHandoff) {
    return {
      nextAgent: 'handoff',
      nextPhase: 'handoff',
      decisionStatus: 'can_move_next',
      reply: '所有阶段都通过了。现在可以整合成 Developer Handoff，生成可以直接交给 AI 编程工具的开发提示词。',
      questions: [],
      shouldCallAI: true,
      shouldMoveNext: true,
    };
  }

  // --- Phase 7: complete ---
  return {
    nextAgent: 'orchestrator',
    nextPhase: 'complete',
    decisionStatus: 'can_move_next',
    reply: '所有阶段都完成了！你可以点击"生成 Developer Handoff"查看完整的开发交付文档。如需修改任何部分，直接告诉我。',
    questions: [],
    shouldCallAI: false,
    shouldMoveNext: false,
  };
}
