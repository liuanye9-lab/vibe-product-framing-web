import type {
  IdeaValidationTask,
  ValidationDecision,
  ValidationEvaluatorReport,
} from '../types/ideaValidation';

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueStrings(items: Array<string | undefined>): string[] {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))),
  );
}

function decideWorthDoing(input: {
  score: number;
  feasibilityScore: number;
  missingCount: number;
  highRiskCount: number;
}): ValidationDecision {
  const { score, feasibilityScore, missingCount, highRiskCount } = input;

  if (score >= 72 && feasibilityScore >= 60 && missingCount <= 2) return 'do';
  if (score >= 50 && missingCount <= 5) return 'validate_first';
  if (score >= 42 && highRiskCount <= 2) return 'pivot';
  return 'do_not_do';
}

export function buildValidationEvaluatorReport(task: IdeaValidationTask): ValidationEvaluatorReport {
  const evaluation = task.evaluation;
  const githubRepos = task.research.githubRepos.slice(0, 8);
  const papers = task.research.papers.slice(0, 8);
  const competitors = task.research.competitors.slice(0, 8);

  const hasClarifiedIdea = Boolean(task.clarifiedIdea || task.rawIdea);
  const requiredInputs = [
    task.targetUser ? undefined : '目标用户',
    task.useCase ? undefined : '核心使用场景',
    task.successDefinition ? undefined : '成功标准',
    githubRepos.length > 0 ? undefined : 'GitHub 开源参考',
    papers.length > 0 ? undefined : '论文或技术文献',
    competitors.length > 0 ? undefined : '竞品或成熟项目证据',
  ].filter((item): item is string => Boolean(item));

  const completenessScore = clampScore(
    (hasClarifiedIdea ? 18 : 0) +
      (task.targetUser ? 18 : 0) +
      (task.useCase ? 18 : 0) +
      (task.successDefinition ? 14 : 0) +
      Math.min(16, githubRepos.length * 4) +
      Math.min(8, papers.length * 2) +
      Math.min(8, competitors.length * 2),
  );

  const feasibilityScore = clampScore(
    evaluation
      ? Math.round((evaluation.technicalFeasibility * 0.55) + (evaluation.agentWorkflowValue * 0.25) + (evaluation.portfolioValue * 0.2))
      : 45 + Math.min(30, githubRepos.length * 6),
  );

  const evidenceScore = clampScore(
    Math.min(40, githubRepos.length * 8) +
      Math.min(25, papers.length * 5) +
      Math.min(25, competitors.length * 5) +
      Math.min(10, task.research.evidenceItems.length),
  );

  const decisionReadinessScore = clampScore(
    Math.round((completenessScore * 0.35) + (feasibilityScore * 0.3) + (evidenceScore * 0.25) + ((evaluation?.overallScore ?? 50) * 0.1)),
  );

  const overallScore = clampScore(
    Math.round((decisionReadinessScore * 0.4) + ((evaluation?.overallScore ?? 50) * 0.35) + (evidenceScore * 0.25)),
  );

  const highRiskCount = evaluation?.keyRisks.length ?? 0;
  const worthDoingDecision = decideWorthDoing({
    score: overallScore,
    feasibilityScore,
    missingCount: requiredInputs.length,
    highRiskCount,
  });

  const borrowableApproaches = uniqueStrings([
    ...githubRepos.flatMap((repo) => repo.whatToBorrow),
    ...competitors.flatMap((competitor) => competitor.opportunityGap),
    githubRepos.length > 0 ? '复用开源项目的交互模式、数据结构和边界定义' : undefined,
    papers.length > 0 ? '把论文中的方法转成可验证的 MVP 假设' : undefined,
  ]).slice(0, 10);

  const evaluatorWarnings = uniqueStrings([
    ...(evaluation?.missingEvidence ?? []).map((item) => `缺失证据：${item}`),
    requiredInputs.length > 0 ? `仍缺少关键输入：${requiredInputs.join('、')}` : undefined,
    evidenceScore < 40 ? '外部证据不足，不能直接进入重开发' : undefined,
    competitors.length >= 6 ? '竞品较多，需要明确差异化定位' : undefined,
  ]);

  const worthDoingReason = evaluation?.keyReasons[0]
    ?? (worthDoingDecision === 'do'
      ? '证据和可行性已达到 MVP 验证门槛。'
      : '证据仍不足，需要先补齐用户和外部参考。');

  return {
    summary: `Evaluator 已复核 ${githubRepos.length} 个开源项目、${papers.length} 篇论文、${competitors.length} 个竞品，整体准备度 ${overallScore}/100。`,
    completenessScore,
    feasibilityScore,
    evidenceScore,
    decisionReadinessScore,
    overallScore,
    relatedOpenSourceProjects: githubRepos.map((repo) => ({
      name: repo.fullName,
      url: repo.url,
      stars: repo.stars,
      whatToBorrow: repo.whatToBorrow.length > 0
        ? repo.whatToBorrow
        : [repo.whatItDoes || repo.description || '参考其产品结构与实现边界'],
      relevanceScore: repo.relevanceScore,
    })),
    borrowableApproaches,
    paperReferences: papers.map((paper) => ({
      title: paper.title,
      url: paper.url,
      year: paper.year,
      usefulConcepts: paper.usefulConcepts.length > 0
        ? paper.usefulConcepts
        : [paper.summary || '参考论文的任务定义和评估方法'],
      howToUseInProject: paper.howToUseInProject || '将论文方法转为 MVP 中可验证的功能假设。',
      relevanceScore: paper.relevanceScore,
    })),
    matureProjectAnalysis: competitors.map((competitor) => ({
      name: competitor.name,
      url: competitor.url,
      positioning: competitor.positioning,
      strengths: competitor.strengths,
      weaknesses: competitor.weaknesses,
      opportunityGap: competitor.opportunityGap,
      relevanceScore: competitor.relevanceScore,
    })),
    worthDoingDecision,
    worthDoingReason,
    missingInputs: requiredInputs,
    evaluatorWarnings,
  };
}
