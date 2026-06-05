/**
 * Idea Validation Prompts — V6.0
 *
 * Prompt builders for the Idea Validation Agent Workflow.
 * All prompts request JSON output.
 * Explicitly instructs models not to fabricate sources.
 */

import type {
  IdeaValidationTask,
  ResearchBundle,
  OpportunityEvaluation,
} from '../types/ideaValidation';

// ─── 1. Clarification Prompt ──────────────────────────────────────────────────

export function buildClarificationPrompt(input: {
  rawIdea: string;
  goalType: string;
}): string {
  return `你是一个产品想法验证助手。用户有一个模糊的产品想法，需要你帮助澄清。

用户的想法：
"${input.rawIdea}"

用户的目标类型：${input.goalType}

请分析这个想法，并判断是否需要更多信息。如果需要，请提出 1-3 个关键问题。

输出格式（严格 JSON）：
{
  "needsClarification": true/false,
  "clarifiedIdea": "如果足够清晰，给出一句话总结",
  "targetUser": "目标用户是谁",
  "useCase": "核心使用场景",
  "successDefinition": "用户如何定义成功",
  "questions": ["问题1", "问题2", "问题3"]
}

规则：
- 如果想法已经足够清晰，needsClarification 设为 false
- 不要编造用户没有说的信息
- 问题要具体，不要问太宽泛的问题
- 最多 3 个问题`;
}

// ─── 2. Research Query Plan Prompt ────────────────────────────────────────────

export function buildResearchQueryPlanPrompt(task: IdeaValidationTask): string {
  return `你是一个研究查询规划助手。根据用户的产品想法，生成搜索查询。

产品想法：${task.clarifiedIdea ?? task.rawIdea}
目标用户：${task.targetUser ?? '未指定'}
使用场景：${task.useCase ?? '未指定'}
目标类型：${task.goalType}

请生成以下搜索查询：
1. GitHub 查询（3-5 个）：用于搜索相关开源项目
2. 论文查询（3-5 个）：用于搜索相关学术论文
3. 公司/竞品查询（3-5 个）：用于搜索相关公司或竞品
4. 关键词（5-10 个）：用于评估结果相关性
5. 否定关键词（3-5 个）：用于排除不相关结果

输出格式（严格 JSON）：
{
  "githubQueries": ["query1", "query2"],
  "paperQueries": ["query1", "query2"],
  "companyQueries": ["query1", "query2"],
  "keywords": ["keyword1", "keyword2"],
  "negativeKeywords": ["keyword1", "keyword2"]
}

规则：
- 查询要具体，不要太宽泛
- 考虑中英文两种语言
- 不要编造不存在的技术或公司`;
}

// ─── 3. GitHub Summary Prompt ─────────────────────────────────────────────────

export function buildGitHubSummaryPrompt(input: {
  task: IdeaValidationTask;
  repo: {
    fullName: string;
    description: string;
    stars?: number;
    language?: string;
  };
}): string {
  return `分析这个 GitHub 项目与用户想法的相关性。

用户想法：${input.task.clarifiedIdea ?? input.task.rawIdea}
目标用户：${input.task.targetUser ?? '未指定'}

项目信息：
- 名称：${input.repo.fullName}
- 描述：${input.repo.description}
- Stars：${input.repo.stars ?? '未知'}
- 语言：${input.repo.language ?? '未知'}

请分析并输出（严格 JSON）：
{
  "whatItDoes": "这个项目做什么（一句话）",
  "whatToBorrow": ["可以借鉴的点1", "可以借鉴的点2"],
  "limitations": ["局限性1", "局限性2"],
  "relevanceScore": 0-100
}

规则：
- 只基于提供的信息分析
- 不要编造项目没有的功能
- relevanceScore 基于与用户想法的相关性`;
}

// ─── 4. Paper Summary Prompt ──────────────────────────────────────────────────

export function buildPaperSummaryPrompt(input: {
  task: IdeaValidationTask;
  paper: {
    title: string;
    abstract?: string;
    year?: number;
    authors?: string[];
  };
}): string {
  return `分析这篇论文与用户想法的相关性。

用户想法：${input.task.clarifiedIdea ?? input.task.rawIdea}

论文信息：
- 标题：${input.paper.title}
- 摘要：${input.paper.abstract ?? '无'}
- 年份：${input.paper.year ?? '未知'}
- 作者：${input.paper.authors?.join(', ') ?? '未知'}

请分析并输出（严格 JSON）：
{
  "summary": "论文核心内容（一句话）",
  "usefulConcepts": ["有用概念1", "有用概念2"],
  "howToUseInProject": "如何应用到用户项目中",
  "relevanceScore": 0-100
}

规则：
- 只基于提供的信息分析
- 不要编造论文没有的内容
- 如果摘要太短无法判断，relevanceScore 设为 30`;
}

// ─── 5. Competitor Summary Prompt ─────────────────────────────────────────────

export function buildCompetitorSummaryPrompt(input: {
  task: IdeaValidationTask;
  competitor: {
    title: string;
    url?: string;
    snippet?: string;
  };
}): string {
  return `分析这个竞品/公司与用户想法的关系。

用户想法：${input.task.clarifiedIdea ?? input.task.rawIdea}
目标用户：${input.task.targetUser ?? '未指定'}

竞品信息：
- 名称：${input.competitor.title}
- 链接：${input.competitor.url ?? '无'}
- 描述：${input.competitor.snippet ?? '无'}

请分析并输出（严格 JSON）：
{
  "positioning": "这个竞品的定位",
  "targetUser": "它的目标用户",
  "businessModel": "商业模式（如果能判断）",
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["劣势1", "劣势2"],
  "opportunityGap": ["差异化机会1", "差异化机会2"],
  "relevanceScore": 0-100
}

规则：
- 只基于提供的信息分析
- 不要编造公司没有的业务
- 如果信息太少，relevanceScore 设为 20`;
}

// ─── 6. Opportunity Evaluation Prompt ─────────────────────────────────────────

export function buildOpportunityEvaluationPrompt(input: {
  task: IdeaValidationTask;
  research: ResearchBundle;
}): string {
  const { task, research } = input;

  const githubSummary = research.githubRepos
    .slice(0, 5)
    .map(
      (r) =>
        `- ${r.fullName} (${r.stars ?? 0} stars): ${r.whatItDoes || r.description}`,
    )
    .join('\n');

  const paperSummary = research.papers
    .slice(0, 5)
    .map((p) => `- ${p.title} (${p.year ?? '?'}): ${p.summary}`)
    .join('\n');

  const competitorSummary = research.competitors
    .slice(0, 5)
    .map((c) => `- ${c.name}: ${c.positioning}`)
    .join('\n');

  return `基于以下研究结果，评估这个产品想法的机会。

产品想法：${task.clarifiedIdea ?? task.rawIdea}
目标用户：${task.targetUser ?? '未指定'}
使用场景：${task.useCase ?? '未指定'}
目标类型：${task.goalType}

GitHub 开源项目（${research.githubRepos.length} 个）：
${githubSummary || '无结果'}

学术论文（${research.papers.length} 篇）：
${paperSummary || '无结果'}

竞品/公司（${research.competitors.length} 个）：
${competitorSummary || '无结果'}

请评估以下维度（每项 0-100 分）：
1. 需求强度：用户痛点是否明确、强烈
2. 用户清晰度：目标用户是否具体
3. 竞品成熟度：竞品是否已经很成熟（成熟可能降低机会）
4. 差异化空间：是否有明确的差异化机会
5. 技术可行性：第一版是否可做
6. 商业化潜力：是否有付费场景
7. 作品集价值：是否能展示 AI 产品能力
8. Agent 工作流价值：是否适合展示 Agent 能力

输出格式（严格 JSON）：
{
  "demandStrength": 0-100,
  "userClarity": 0-100,
  "competitorMaturity": 0-100,
  "differentiationSpace": 0-100,
  "technicalFeasibility": 0-100,
  "commercializationPotential": 0-100,
  "portfolioValue": 0-100,
  "agentWorkflowValue": 0-100,
  "overallScore": 0-100,
  "keyReasons": ["理由1", "理由2"],
  "keyRisks": ["风险1", "风险2"],
  "missingEvidence": ["缺失证据1", "缺失证据2"]
}

规则：
- overallScore 是加权平均
- 如果没有搜索结果，missingEvidence 必须写清楚
- 不要编造不存在的证据
- 如果信息不足，分数应该偏低`;
}

// ─── 7. Decision Prompt ──────────────────────────────────────────────────────

export function buildDecisionPrompt(input: {
  task: IdeaValidationTask;
  evaluation: OpportunityEvaluation;
}): string {
  const { task, evaluation } = input;

  return `基于以下评估结果，给出最终决策建议。

产品想法：${task.clarifiedIdea ?? task.rawIdea}
目标用户：${task.targetUser ?? '未指定'}
目标类型：${task.goalType}

评估结果：
- 需求强度：${evaluation.demandStrength}/100
- 用户清晰度：${evaluation.userClarity}/100
- 竞品成熟度：${evaluation.competitorMaturity}/100
- 差异化空间：${evaluation.differentiationSpace}/100
- 技术可行性：${evaluation.technicalFeasibility}/100
- 商业化潜力：${evaluation.commercializationPotential}/100
- 作品集价值：${evaluation.portfolioValue}/100
- Agent 工作流价值：${evaluation.agentWorkflowValue}/100
- 总分：${evaluation.overallScore}/100

关键理由：${evaluation.keyReasons.join('；')}
关键风险：${evaluation.keyRisks.join('；')}
缺失证据：${evaluation.missingEvidence.join('；')}

请给出决策建议。

输出格式（严格 JSON）：
{
  "decision": "do" | "do_not_do" | "validate_first" | "pivot",
  "recommendation": "一句话建议",
  "bestPositioning": "最佳定位",
  "shouldBuildMVP": true/false,
  "shouldGenerateDevSpec": true/false,
  "nextValidationActions": ["下一步1", "下一步2"],
  "why": ["理由1", "理由2"]
}

决策规则：
- overallScore >= 70 且缺失证据少 → do
- overallScore >= 50 但缺失证据多 → validate_first
- overallScore < 40 或关键风险大 → do_not_do
- 竞品成熟但有差异化空间 → pivot
- 不要无依据地鼓励做项目`;
}
