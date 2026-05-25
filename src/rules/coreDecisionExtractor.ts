import type { CoreDecision, DecisionStage, ProductBrief, SuggestionValue } from '../types';

function suggestionText(value: { value?: SuggestionValue; reason?: string; risks?: string[]; alternatives?: string[] } | undefined): string {
  if (!value) return '';
  if (Array.isArray(value.value)) return value.value.join('；');
  if (value.value && typeof value.value === 'object' && 'value' in value.value) {
    const nested = value.value as { value?: SuggestionValue };
    if (Array.isArray(nested.value)) return nested.value.join('；');
    return String(nested.value || '');
  }
  return String(value.value || '');
}

function firstRisk(...risks: Array<string[] | undefined>): string {
  return risks.flat().find(Boolean) || '最大风险是用户看到的信息仍然太多，导致没有做出明确选择。';
}

function compact(items: Array<string | undefined | false>): string[] {
  return items.filter((item): item is string => Boolean(item));
}

export function extractCoreDecision(brief: ProductBrief, stage: DecisionStage): CoreDecision {
  const { discovery, product, business, technical, mvp, blindSpot } = brief.stages;

  if (stage === 'idea') {
    const targetUser = suggestionText(product.targetUser) || brief.ideaInput.targetUser || '准备使用 AI 编程工具做第一个产品的新手';
    const demand = suggestionText(discovery.targetUserEvidence) || '先假设需求存在，但需要用最小验证动作确认。';
    const roi = business.roi?.roiJudgement?.value || 'uncertain';
    return {
      stage,
      mainDecision: '这个想法是否值得进入 MVP 收敛？',
      recommendedChoice: roi === 'negative' ? '先不要开工，先验证目标用户和痛点。' : `继续推进，但把第一版聚焦在 ${targetUser} 的一个真实场景。`,
      why: demand,
      keyRisk: firstRisk(discovery.falsificationEvidence?.value, business.risksAndBlindSpots?.value),
      alternatives: compact([
        '先访谈 5 个目标用户再设计产品',
        '先做一页 Demo 验证用户是否愿意使用',
        '直接进入 MVP 收敛，但保持范围极小',
      ]),
      details: compact([
        `产品定义：${suggestionText(product.productOneLiner) || brief.ideaInput.rawIdea}`,
        `目标用户：${targetUser}`,
        `当前替代方案：${suggestionText(discovery.currentAlternative) || suggestionText(product.alternatives)}`,
        `最小验证动作：${suggestionText(discovery.smallestValidationAction)}`,
        `ROI 判断：${roi}`,
      ]),
    };
  }

  if (stage === 'mvp') {
    return {
      stage,
      mainDecision: '第一版只验证哪个最小闭环？',
      recommendedChoice: suggestionText(mvp.minimumLoop) || '用户输入一个模糊想法，AI 给出关键决策建议，用户确认后生成 Development Prompt。',
      why: mvp.mustHave?.reason || 'MVP 只保留能完成“从想法到开发交付”的闭环。',
      keyRisk: firstRisk(mvp.scopeRisks?.value, mvp.outOfScope?.value),
      alternatives: compact(mvp.v2Later?.value || ['先只做想法诊断', '先只做 Prompt 生成器', '先做纯 mock 演示']),
      details: compact([
        `Must Have：${suggestionText(mvp.mustHave)}`,
        `Should Have：${suggestionText(mvp.shouldHave)}`,
        `Out of Scope：${suggestionText(mvp.outOfScope)}`,
        `范围提醒：${mvp.scopeCreepWarning || suggestionText(mvp.scopeRisks)}`,
      ]),
    };
  }

  if (stage === 'tech') {
    const translation = technical.translations?.[0];
    return {
      stage,
      mainDecision: 'V1 最低成本技术方案是什么？',
      recommendedChoice: compact([
        suggestionText(technical.frontend),
        suggestionText(technical.database),
        suggestionText(technical.aiApi),
      ]).join('\n') || '使用 React + Vite + TypeScript，localStorage 保存数据，通过 /api/ai-proxy 调用用户自定义 AI API。',
      why: translation?.whyThisIsEnough || technical.frontend?.reason || 'V1 目标是验证核心闭环，不需要先做复杂后端、数据库或账号系统。',
      keyRisk: firstRisk(technical.frontend?.risks, technical.database?.risks, technical.aiApi?.risks),
      alternatives: compact([
        ...(technical.database?.alternatives || []),
        ...(technical.aiApi?.alternatives || []),
        '完全 mock，不接真实 AI API',
      ]),
      details: compact([
        `后端：${suggestionText(technical.backend)}`,
        `认证：${suggestionText(technical.auth)}`,
        `Mock 策略：${suggestionText(technical.mockStrategy)}`,
        `升级条件：${suggestionText(technical.architectureUpgrade)}`,
      ]),
    };
  }

  return {
    stage: 'handoff',
    mainDecision: '这份方案是否已经可以交给 Codex / Claude Code / Cursor 开发？',
    recommendedChoice: brief.finalHandoff?.developmentPrompt ? '可以交付：已生成结构化 Development Prompt。' : '先生成最终交付文档，再交给 AI 编程工具。',
    why: 'Handoff 需要把需求洞察、MVP、技术方案、风险和验收标准整合成可执行说明。',
    keyRisk: firstRisk(blindSpot.demandRisk?.value, blindSpot.businessRisk?.value, blindSpot.technicalRisk?.value, blindSpot.scopeRisk?.value),
    alternatives: compact(['重新优化交付内容', '先回到 MVP 再压缩范围', '先回到技术决策降低工程复杂度']),
    details: compact([
      `需求风险：${suggestionText(blindSpot.demandRisk)}`,
      `业务风险：${suggestionText(blindSpot.businessRisk)}`,
      `技术风险：${suggestionText(blindSpot.technicalRisk)}`,
      `范围风险：${suggestionText(blindSpot.scopeRisk)}`,
      `推荐调整：${suggestionText(blindSpot.recommendedAdjustment)}`,
    ]),
  };
}
