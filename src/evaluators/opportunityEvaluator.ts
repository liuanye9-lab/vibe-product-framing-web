/**
 * Opportunity Evaluator — V6.0
 *
 * Local rule-based evaluation as a fallback/complement to LLM evaluation.
 * Produces an OpportunityEvaluation based on task data and research results.
 */

import type {
  IdeaValidationTask,
  OpportunityEvaluation,
} from '../types/ideaValidation';

// ─── Weights ──────────────────────────────────────────────────────────────────

const WEIGHTS = {
  demandStrength: 0.2,
  userClarity: 0.15,
  competitorMaturity: 0.1,
  differentiationSpace: 0.15,
  technicalFeasibility: 0.1,
  commercializationPotential: 0.1,
  portfolioValue: 0.1,
  agentWorkflowValue: 0.1,
};

// ─── Main Evaluator ──────────────────────────────────────────────────────────

export function evaluateOpportunity(input: {
  task: IdeaValidationTask;
}): OpportunityEvaluation {
  const { task } = input;
  const { research } = task;

  // 1. Demand Strength
  const demandStrength = scoreDemandStrength(task);

  // 2. User Clarity
  const userClarity = scoreUserClarity(task);

  // 3. Competitor Maturity
  const competitorMaturity = scoreCompetitorMaturity(research.competitors.length);

  // 4. Differentiation Space
  const differentiationSpace = scoreDifferentiationSpace(
    research.competitors.length,
    research.githubRepos.length,
  );

  // 5. Technical Feasibility
  const technicalFeasibility = scoreTechnicalFeasibility(research.githubRepos.length);

  // 6. Commercialization Potential
  const commercializationPotential = scoreCommercializationPotential(task);

  // 7. Portfolio Value
  const portfolioValue = scorePortfolioValue(task);

  // 8. Agent Workflow Value
  const agentWorkflowValue = scoreAgentWorkflowValue(task);

  // Overall Score (weighted average)
  const overallScore = Math.round(
    demandStrength * WEIGHTS.demandStrength +
      userClarity * WEIGHTS.userClarity +
      (100 - competitorMaturity) * WEIGHTS.competitorMaturity + // Lower maturity = higher opportunity
      differentiationSpace * WEIGHTS.differentiationSpace +
      technicalFeasibility * WEIGHTS.technicalFeasibility +
      commercializationPotential * WEIGHTS.commercializationPotential +
      portfolioValue * WEIGHTS.portfolioValue +
      agentWorkflowValue * WEIGHTS.agentWorkflowValue,
  );

  // Key Reasons
  const keyReasons: string[] = [];
  if (demandStrength >= 60) keyReasons.push('需求痛点明确');
  if (userClarity >= 60) keyReasons.push('目标用户清晰');
  if (differentiationSpace >= 60) keyReasons.push('存在差异化空间');
  if (technicalFeasibility >= 60) keyReasons.push('技术可行性高');
  if (research.githubRepos.length > 0) keyReasons.push('有开源项目可借鉴');

  // Key Risks
  const keyRisks: string[] = [];
  if (competitorMaturity >= 70) keyRisks.push('竞品市场已较成熟');
  if (userClarity < 40) keyRisks.push('目标用户不够清晰');
  if (demandStrength < 40) keyRisks.push('需求痛点不明确');
  if (research.githubRepos.length === 0 && research.papers.length === 0) {
    keyRisks.push('缺乏技术参考');
  }

  // Missing Evidence
  const missingEvidence: string[] = [];
  if (research.githubRepos.length === 0) missingEvidence.push('未找到相关开源项目');
  if (research.papers.length === 0) missingEvidence.push('未找到相关学术论文');
  if (research.competitors.length === 0) missingEvidence.push('未找到竞品信息');
  if (!task.targetUser) missingEvidence.push('目标用户未明确');
  if (!task.useCase) missingEvidence.push('使用场景未明确');
  if (!task.successDefinition) missingEvidence.push('成功标准未定义');

  return {
    demandStrength,
    userClarity,
    competitorMaturity,
    differentiationSpace,
    technicalFeasibility,
    commercializationPotential,
    portfolioValue,
    agentWorkflowValue,
    overallScore,
    keyReasons,
    keyRisks,
    missingEvidence,
  };
}

// ─── Scoring Functions ────────────────────────────────────────────────────────

function scoreDemandStrength(task: IdeaValidationTask): number {
  let score = 30; // Base score

  if (task.targetUser) score += 20;
  if (task.useCase) score += 20;
  if (task.successDefinition) score += 15;
  if (task.clarifiedIdea && task.clarifiedIdea.length > 20) score += 15;

  return Math.min(100, score);
}

function scoreUserClarity(task: IdeaValidationTask): number {
  let score = 20; // Base score

  if (task.targetUser) {
    // More specific user = higher score
    const user = task.targetUser.toLowerCase();
    if (user.length > 20) score += 30;
    else if (user.length > 10) score += 20;
    else score += 10;
  }

  if (task.useCase) {
    if (task.useCase.length > 30) score += 30;
    else if (task.useCase.length > 10) score += 20;
    else score += 10;
  }

  if (task.successDefinition) score += 20;

  return Math.min(100, score);
}

function scoreCompetitorMaturity(competitorCount: number): number {
  // More competitors = more mature market
  if (competitorCount >= 5) return 80;
  if (competitorCount >= 3) return 60;
  if (competitorCount >= 1) return 40;
  return 20;
}

function scoreDifferentiationSpace(
  competitorCount: number,
  githubCount: number,
): number {
  let score = 50; // Base

  // Some competition validates the market
  if (competitorCount >= 1) score += 10;
  if (competitorCount >= 3) score += 10;

  // But too much competition reduces space
  if (competitorCount >= 10) score -= 20;

  // Open-source projects show technical direction but also competition
  if (githubCount >= 1) score += 10;
  if (githubCount >= 5) score -= 10;

  // Having no competition could mean no market OR untapped opportunity
  if (competitorCount === 0 && githubCount === 0) {
    score = 40; // Uncertain
  }

  return Math.max(10, Math.min(100, score));
}

function scoreTechnicalFeasibility(githubCount: number): number {
  let score = 50; // Base

  // Open-source references increase feasibility
  if (githubCount >= 3) score += 30;
  else if (githubCount >= 1) score += 20;

  return Math.min(100, score);
}

function scoreCommercializationPotential(task: IdeaValidationTask): number {
  let score = 30; // Base

  const goal = task.goalType;
  if (goal === 'commercialization') score += 30;
  else if (goal === 'portfolio') score += 15;
  else if (goal === 'job_interview') score += 10;

  if (task.useCase) score += 15;
  if (task.targetUser) score += 15;

  return Math.min(100, score);
}

function scorePortfolioValue(task: IdeaValidationTask): number {
  let score = 40; // Base

  const goal = task.goalType;
  if (goal === 'portfolio') score += 30;
  else if (goal === 'job_interview') score += 25;
  else if (goal === 'technical_practice') score += 20;

  // AI-related projects have higher portfolio value
  const idea = (task.clarifiedIdea ?? task.rawIdea).toLowerCase();
  if (idea.includes('ai') || idea.includes('agent') || idea.includes('llm')) {
    score += 20;
  }

  return Math.min(100, score);
}

function scoreAgentWorkflowValue(task: IdeaValidationTask): number {
  let score = 30; // Base

  const idea = (task.clarifiedIdea ?? task.rawIdea).toLowerCase();
  if (idea.includes('agent') || idea.includes('工作流') || idea.includes('workflow')) {
    score += 30;
  }
  if (idea.includes('ai') || idea.includes('llm') || idea.includes('大模型')) {
    score += 20;
  }

  const goal = task.goalType;
  if (goal === 'portfolio') score += 10;
  if (goal === 'commercialization') score += 10;

  return Math.min(100, score);
}
