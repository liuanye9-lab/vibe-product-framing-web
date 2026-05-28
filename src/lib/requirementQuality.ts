import type { ProductBrief, RequirementQualityScore } from '../types';

export function evaluateRequirementQuality(brief: ProductBrief): RequirementQualityScore {
  const rawIdea = brief.rawIdea || '';
  const ideaInput = brief.ideaInput;
  const stages = brief.stages;
  const handoff = brief.finalHandoff;

  const clarity = scoreClarity(rawIdea, ideaInput);
  const specificity = scoreSpecificity(rawIdea, ideaInput, stages);
  const userEvidence = scoreUserEvidence(ideaInput, stages);
  const scopeControl = scoreScopeControl(stages, handoff);
  const testability = scoreTestability(handoff);
  const technicalFeasibility = scoreTechnicalFeasibility(stages);
  const riskAwareness = scoreRiskAwareness(stages);
  const codexExecutability = scoreCodexExecutability(handoff);

  const total = clarity + specificity + userEvidence + scopeControl + testability + technicalFeasibility + riskAwareness + codexExecutability;
  const issues: string[] = [];
  const improvementSuggestions: string[] = [];

  if (clarity < 3) { issues.push('想法表述不够清晰'); improvementSuggestions.push('用一句话说清楚：谁、在什么场景下、遇到什么问题'); }
  if (specificity < 3) { issues.push('需求不够具体'); improvementSuggestions.push('增加具体数字、场景描述、用户画像'); }
  if (userEvidence < 2) { issues.push('缺少用户需求证据'); improvementSuggestions.push('提供用户调研、竞品分析或反证数据'); }
  if (scopeControl < 3) { issues.push('MVP 范围控制不足'); improvementSuggestions.push('明确 P0/P1/P2 和 Out of Scope'); }
  if (testability < 2) { issues.push('验收标准不可测试'); improvementSuggestions.push('使用 EARS 格式编写验收标准'); }
  if (technicalFeasibility < 2) { issues.push('技术方案不明确'); improvementSuggestions.push('确定前端框架、数据存储方案'); }
  if (riskAwareness < 2) { issues.push('风险意识不足'); improvementSuggestions.push('明确反证场景：什么情况下会失败？'); }
  if (codexExecutability < 2) { issues.push('不可交付给 Codex 执行'); improvementSuggestions.push('生成 DEV_SPEC 和 CODEX_TASK_PACK'); }

  return { clarity, specificity, userEvidence, scopeControl, testability, technicalFeasibility, riskAwareness, codexExecutability, total, issues, improvementSuggestions };
}

function scoreClarity(rawIdea: string, ideaInput: ProductBrief['ideaInput']): number {
  let score = 0;
  if (rawIdea.length >= 10) score++;
  if (rawIdea.length >= 30) score++;
  if (ideaInput?.targetUser) score++;
  if (ideaInput?.scenario) score++;
  if (ideaInput?.problem) score++;
  return Math.min(score, 5);
}

function scoreSpecificity(rawIdea: string, ideaInput: ProductBrief['ideaInput'], stages: ProductBrief['stages']): number {
  let score = 0;
  const text = [rawIdea, ideaInput?.targetUser, ideaInput?.scenario, stages?.product?.corePainPoint?.value].filter(Boolean).join(' ');
  if (/\d+/.test(text)) score++;
  if (text.length > 50) score++;
  if (stages?.product?.scenario?.value && (stages.product.scenario.value as string).length > 10) score++;
  if (stages?.product?.targetUser?.value && (stages.product.targetUser.value as string).length > 2) score++;
  if (stages?.product?.corePainPoint?.value && (stages.product.corePainPoint.value as string).length > 5) score++;
  return Math.min(score, 5);
}

function scoreUserEvidence(ideaInput: ProductBrief['ideaInput'], stages: ProductBrief['stages']): number {
  let score = 1;
  if (ideaInput?.targetUser) score++;
  if (ideaInput?.scenario) score++;
  if (stages?.discovery?.demandEvidence?.value && (stages.discovery.demandEvidence.value as string[]).length) score += 2;
  if (stages?.discovery?.falsificationEvidence?.value && (stages.discovery.falsificationEvidence.value as string[]).length) score++;
  return Math.min(score, 5);
}

function scoreScopeControl(stages: ProductBrief['stages'], handoff: ProductBrief['finalHandoff']): number {
  let score = 1;
  if (stages?.mvp?.mustHave?.value && (stages.mvp.mustHave.value as string[]).length) score++;
  if (stages?.mvp?.mustHave?.value && (stages.mvp.mustHave.value as string[]).length <= 5) score++;
  if (stages?.mvp?.outOfScope?.value && (stages.mvp.outOfScope.value as string[]).length) score += 2;
  if (handoff?.devSpec && handoff.devSpec.length) score++;
  return Math.min(score, 5);
}

function scoreTestability(handoff: ProductBrief['finalHandoff']): number {
  let score = 0;
  if (handoff?.acceptanceCriteria && handoff.acceptanceCriteria.length > 10) score += 2;
  if (handoff?.acceptanceCriteria && (handoff.acceptanceCriteria.includes('shall') || handoff.acceptanceCriteria.includes('应当') || handoff.acceptanceCriteria.includes('必须'))) score++;
  if (handoff?.evaluation?.totalScore) { score += Math.min(2, Math.floor(handoff.evaluation.totalScore / 10)); }
  return Math.min(score, 5);
}

function scoreTechnicalFeasibility(stages: ProductBrief['stages']): number {
  let score = 0;
  if (stages?.technical?.frontend?.value) score += 2;
  if (stages?.technical?.backend?.value || stages?.technical?.dataFlow?.value) score++;
  if (stages?.technical?.mockStrategy?.value) score++;
  if (stages?.technical?.architectureUpgrade?.value) score++;
  return Math.min(score, 5);
}

function scoreRiskAwareness(stages: ProductBrief['stages']): number {
  let score = 0;
  if (stages?.blindSpot?.demandRisk?.value && (stages.blindSpot.demandRisk.value as string[]).length) score++;
  if (stages?.blindSpot?.businessRisk?.value && (stages.blindSpot.businessRisk.value as string[]).length) score++;
  if (stages?.blindSpot?.technicalRisk?.value && (stages.blindSpot.technicalRisk.value as string[]).length) score++;
  if (stages?.blindSpot?.whatWouldProveWrong?.value && (stages.blindSpot.whatWouldProveWrong.value as string[]).length) score++;
  if (stages?.blindSpot?.recommendedAdjustment?.value && (stages.blindSpot.recommendedAdjustment.value as string[]).length) score++;
  return Math.min(score, 5);
}

function scoreCodexExecutability(handoff: ProductBrief['finalHandoff']): number {
  let score = 0;
  if (handoff?.developmentPrompt && handoff.developmentPrompt.length > 50) score += 2;
  if (handoff?.devSpec && handoff.devSpec.length > 20) score++;
  if (handoff?.technicalArchitecture && handoff.technicalArchitecture.length > 20) score++;
  if (handoff?.dataStructure && handoff.dataStructure.length > 20) score++;
  return Math.min(score, 5);
}
