/**
 * Idea Validation Runtime — V6.0
 *
 * Agent workflow runtime for the Idea Validation flow.
 * Manages node state transitions, research calls, and LLM interactions.
 *
 * Flow:
 * idea_intake → clarification → query_planning → github_research →
 * paper_research → competitor_research → opportunity_evaluation →
 * decision → handoff
 */

import type {
  IdeaValidationTask,
  IdeaValidationNodeKey,
  ValidationNodeStatus,
  ResearchQueryPlan,
  OpportunityEvaluation,
  FinalValidationDecision,
  IdeaValidationError,
} from '../types/ideaValidation';
import {
  getIdeaValidationTask,
  saveIdeaValidationTask,
  createIdeaValidationTask,
} from '../storage/ideaValidationStorage';
import { searchGitHubReferences } from '../research/githubResearch';
import { searchPaperReferences } from '../research/paperResearch';
import { searchCompetitorReferences } from '../research/competitorResearch';
import { evaluateOpportunity } from '../evaluators/opportunityEvaluator';
import {
  buildClarificationPrompt,
  buildResearchQueryPlanPrompt,
  buildOpportunityEvaluationPrompt,
  buildDecisionPrompt,
} from '../prompts/ideaValidationPrompts';
import { callCopilotJson } from '../api/evaluate';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IdeaValidationTurnInput {
  taskId: string;
  userMessage?: string;
  action?:
    | 'start'
    | 'answer_clarification'
    | 'run_research'
    | 'evaluate'
    | 'make_decision'
    | 'generate_handoff';
  onProgress?: (event: {
    percent: number;
    phase: string;
    message: string;
  }) => void;
}

export interface IdeaValidationTurnOutput {
  task: IdeaValidationTask;
  reply: string;
  requiresUserInput: boolean;
}

// ─── Node Helpers ─────────────────────────────────────────────────────────────

function updateNodeStatus(
  task: IdeaValidationTask,
  nodeKey: IdeaValidationNodeKey,
  status: ValidationNodeStatus,
  progress: number,
  output?: Record<string, unknown>,
  error?: IdeaValidationError,
): void {
  const node = task.nodes.find((n) => n.key === nodeKey);
  if (!node) return;

  node.status = status;
  node.progressPercent = progress;
  if (output) node.output = output;
  if (error) node.error = error;
  if (status === 'running') node.startedAt = new Date().toISOString();
  if (status === 'completed' || status === 'failed') {
    node.completedAt = new Date().toISOString();
  }

  // Update task-level progress
  const totalNodes = task.nodes.length;
  const completedNodes = task.nodes.filter(
    (n) => n.status === 'completed' || n.status === 'skipped',
  ).length;
  task.progressPercent = Math.round((completedNodes / totalNodes) * 100);
  task.currentNodeId = nodeKey;
}

// ─── Main Runtime ─────────────────────────────────────────────────────────────

export async function runIdeaValidationTurn(
  input: IdeaValidationTurnInput,
): Promise<IdeaValidationTurnOutput> {
  const { taskId, userMessage, action, onProgress } = input;

  const task = getIdeaValidationTask(taskId);
  if (!task) {
    return {
      task: createIdeaValidationTask({ rawIdea: 'Unknown', goalType: 'unknown' }),
      reply: '任务不存在，请重新开始。',
      requiresUserInput: false,
    };
  }

  const progress = (percent: number, phase: string, message: string) => {
    onProgress?.({ percent, phase, message });
  };

  try {
    switch (action ?? detectAction(task)) {
      case 'start':
        return await handleStart(task, progress);
      case 'answer_clarification':
        return await handleClarification(task, userMessage ?? '', progress);
      case 'run_research':
        return await handleResearch(task, progress);
      case 'evaluate':
        return await handleEvaluate(task, progress);
      case 'make_decision':
        return await handleDecision(task, progress);
      case 'generate_handoff':
        return await handleHandoff(task, progress);
      default:
        return {
          task,
          reply: '未知操作，请重试。',
          requiresUserInput: false,
        };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    task.status = 'failed';
    saveIdeaValidationTask(task);
    return {
      task,
      reply: `执行出错：${errorMsg}`,
      requiresUserInput: false,
    };
  }
}

// ─── Action Detection ─────────────────────────────────────────────────────────

function detectAction(task: IdeaValidationTask): string {
  const currentNode = task.nodes.find((n) => n.key === task.currentNodeId);
  if (!currentNode) return 'start';
  if (currentNode.status === 'pending' || currentNode.status === 'running') {
    return mapNodeKeyToAction(currentNode.key);
  }
  // Find next pending node
  const nextNode = task.nodes.find((n) => n.status === 'pending');
  if (nextNode) return mapNodeKeyToAction(nextNode.key);
  return 'start';
}

function mapNodeKeyToAction(key: IdeaValidationNodeKey): string {
  const map: Record<IdeaValidationNodeKey, string> = {
    idea_intake: 'start',
    clarification: 'answer_clarification',
    query_planning: 'run_research',
    github_research: 'run_research',
    paper_research: 'run_research',
    competitor_research: 'run_research',
    opportunity_evaluation: 'evaluate',
    decision: 'make_decision',
    handoff: 'generate_handoff',
  };
  return map[key];
}

// ─── Handler: Start ───────────────────────────────────────────────────────────

async function handleStart(
  task: IdeaValidationTask,
  progress: (p: number, phase: string, msg: string) => void,
): Promise<IdeaValidationTurnOutput> {
  progress(10, 'idea_intake', '分析想法...');

  updateNodeStatus(task, 'idea_intake', 'running', 50);

  // Analyze raw idea
  const rawIdea = task.rawIdea;

  // Check if idea is clear enough
  const hasTargetUser = rawIdea.length > 20 && /用户|帮助|面向|给/.test(rawIdea);
  const hasUseCase = rawIdea.length > 30 && /场景|用来|用于|解决/.test(rawIdea);

  if (hasTargetUser && hasUseCase) {
    // Idea is relatively clear, move to clarification to confirm
    updateNodeStatus(task, 'idea_intake', 'completed', 100, {
      analysis: '想法已包含目标用户和使用场景',
    });
    task.status = 'waiting_user';
    saveIdeaValidationTask(task);

    return {
      task,
      reply: `收到你的想法：「${rawIdea}」

看起来你的想法已经比较清晰。让我确认几个关键点：

1. 目标用户是谁？
2. 核心使用场景是什么？
3. 你如何定义这个项目的成功？

你可以直接回答，或者让我基于现有信息继续分析。`,
      requiresUserInput: true,
    };
  }

  // Idea needs clarification
  updateNodeStatus(task, 'idea_intake', 'completed', 100, {
    analysis: '想法需要进一步澄清',
  });
  updateNodeStatus(task, 'clarification', 'waiting_user', 0);
  task.status = 'waiting_user';
  saveIdeaValidationTask(task);

  return {
    task,
    reply: `收到你的想法：「${rawIdea}」

为了更好地评估这个想法，我需要了解更多信息：

1. 这个工具/产品主要帮助谁？（目标用户）
2. 用户会在什么场景下使用它？（使用场景）
3. 你希望达到什么效果？（成功标准）

请尽量具体地描述，这会帮助我更准确地评估机会。`,
    requiresUserInput: true,
  };
}

// ─── Handler: Clarification ──────────────────────────────────────────────────

async function handleClarification(
  task: IdeaValidationTask,
  userMessage: string,
  progress: (p: number, phase: string, msg: string) => void,
): Promise<IdeaValidationTurnOutput> {
  progress(20, 'clarification', '分析用户回答...');

  updateNodeStatus(task, 'clarification', 'running', 50);

  try {
    // Use LLM to parse user's clarification
    const prompt = buildClarificationPrompt({
      rawIdea: task.rawIdea,
      goalType: task.goalType,
    });

    const result = await callCopilotJson<{
      needsClarification: boolean;
      clarifiedIdea?: string;
      targetUser?: string;
      useCase?: string;
      successDefinition?: string;
      questions?: string[];
    }>(prompt, `用户的回答：${userMessage}`, 1000);

    // Update task with clarified information
    if (result.clarifiedIdea) task.clarifiedIdea = result.clarifiedIdea;
    if (result.targetUser) task.targetUser = result.targetUser;
    if (result.useCase) task.useCase = result.useCase;
    if (result.successDefinition) task.successDefinition = result.successDefinition;

    updateNodeStatus(task, 'clarification', 'completed', 100, {
      clarifiedIdea: task.clarifiedIdea,
      targetUser: task.targetUser,
      useCase: task.useCase,
      successDefinition: task.successDefinition,
    });

    if (result.needsClarification && result.questions && result.questions.length > 0) {
      // Still need more info
      task.status = 'waiting_user';
      saveIdeaValidationTask(task);

      return {
        task,
        reply: `感谢你的回答。我还需要了解：

${result.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

请继续补充信息。`,
        requiresUserInput: true,
      };
    }

    // Enough info, move to query planning
    saveIdeaValidationTask(task);
    return await handleResearch(task, progress);
  } catch {
    // LLM failed, use basic parsing
    task.clarifiedIdea = task.clarifiedIdea ?? task.rawIdea;
    task.targetUser = task.targetUser ?? '未指定';
    task.useCase = task.useCase ?? userMessage;

    updateNodeStatus(task, 'clarification', 'completed', 100, {
      clarifiedIdea: task.clarifiedIdea,
      targetUser: task.targetUser,
      useCase: task.useCase,
    });

    saveIdeaValidationTask(task);
    return await handleResearch(task, progress);
  }
}

// ─── Handler: Research ────────────────────────────────────────────────────────

async function handleResearch(
  task: IdeaValidationTask,
  progress: (p: number, phase: string, msg: string) => void,
): Promise<IdeaValidationTurnOutput> {
  progress(30, 'query_planning', '规划搜索查询...');

  // Step 1: Query Planning
  updateNodeStatus(task, 'query_planning', 'running', 50);

  let queryPlan: ResearchQueryPlan;
  try {
    const prompt = buildResearchQueryPlanPrompt(task);
    queryPlan = await callCopilotJson<ResearchQueryPlan>(prompt, '', 1500);
  } catch {
    // Fallback: generate basic queries from the idea
    const idea = task.clarifiedIdea ?? task.rawIdea;
    queryPlan = {
      githubQueries: [`${idea} tool`, `${idea} open source`],
      paperQueries: [`${idea} research`, `${idea} paper`],
      companyQueries: [`${idea} startup`, `${idea} product`],
      keywords: idea.split(/\s+/).filter((w) => w.length > 1),
      negativeKeywords: [],
    };
  }

  task.research.queryPlan = queryPlan;
  updateNodeStatus(task, 'query_planning', 'completed', 100, {
    queryPlan,
  });

  // Step 2: GitHub Research
  progress(40, 'github_research', '搜索 GitHub 项目...');
  updateNodeStatus(task, 'github_research', 'running', 50);

  const githubResult = await searchGitHubReferences({
    queries: queryPlan.githubQueries,
    limitPerQuery: 5,
    keywords: queryPlan.keywords,
  });

  task.research.githubRepos = githubResult.items;
  updateNodeStatus(
    task,
    'github_research',
    githubResult.error ? 'failed' : 'completed',
    githubResult.error ? 0 : 100,
    { count: githubResult.items.length },
    githubResult.error,
  );

  // Step 3: Paper Research
  progress(60, 'paper_research', '搜索学术论文...');
  updateNodeStatus(task, 'paper_research', 'running', 50);

  const paperResult = await searchPaperReferences({
    queries: queryPlan.paperQueries,
    limitPerQuery: 5,
    keywords: queryPlan.keywords,
  });

  task.research.papers = paperResult.items;
  updateNodeStatus(
    task,
    'paper_research',
    paperResult.error ? 'failed' : 'completed',
    paperResult.error ? 0 : 100,
    { count: paperResult.items.length },
    paperResult.error,
  );

  // Step 4: Competitor Research
  progress(80, 'competitor_research', '搜索竞品信息...');
  updateNodeStatus(task, 'competitor_research', 'running', 50);

  const competitorResult = await searchCompetitorReferences({
    queries: queryPlan.companyQueries,
    limitPerQuery: 5,
    keywords: queryPlan.keywords,
  });

  task.research.competitors = competitorResult.items;
  updateNodeStatus(
    task,
    'competitor_research',
    competitorResult.error ? 'failed' : 'completed',
    competitorResult.error ? 0 : 100,
    { count: competitorResult.items.length },
    competitorResult.error,
  );

  // Build evidence items from research
  task.research.evidenceItems = [
    ...task.research.githubRepos.map((repo) => ({
      id: `ev_gh_${repo.id}`,
      sourceType: 'github' as const,
      title: repo.fullName,
      url: repo.url,
      claim: repo.whatItDoes || repo.description,
      evidenceText: `${repo.stars ?? 0} stars, ${repo.language ?? 'unknown'}`,
      confidence: repo.relevanceScore / 100,
    })),
    ...task.research.papers.map((paper) => ({
      id: `ev_paper_${paper.id}`,
      sourceType: 'paper' as const,
      title: paper.title,
      url: paper.url,
      claim: paper.summary,
      evidenceText: paper.abstract ?? '',
      confidence: paper.relevanceScore / 100,
    })),
    ...task.research.competitors.map((comp) => ({
      id: `ev_comp_${comp.id}`,
      sourceType: 'company' as const,
      title: comp.name,
      url: comp.url,
      claim: comp.positioning,
      evidenceText: comp.strengths.join('; '),
      confidence: comp.relevanceScore / 100,
    })),
  ];

  saveIdeaValidationTask(task);

  // Auto-proceed to evaluation
  return await handleEvaluate(task, progress);
}

// ─── Handler: Evaluate ────────────────────────────────────────────────────────

async function handleEvaluate(
  task: IdeaValidationTask,
  progress: (p: number, phase: string, msg: string) => void,
): Promise<IdeaValidationTurnOutput> {
  progress(85, 'opportunity_evaluation', '评估机会...');

  updateNodeStatus(task, 'opportunity_evaluation', 'running', 50);

  let evaluation: OpportunityEvaluation;

  // Try LLM evaluation first
  try {
    const prompt = buildOpportunityEvaluationPrompt({
      task,
      research: task.research,
    });

    evaluation = await callCopilotJson<OpportunityEvaluation>(prompt, '', 2000);
  } catch {
    // Fallback to local evaluation
    evaluation = evaluateOpportunity({ task });
  }

  task.evaluation = evaluation;
  updateNodeStatus(task, 'opportunity_evaluation', 'completed', 100, {
    overallScore: evaluation.overallScore,
  });

  saveIdeaValidationTask(task);

  // Auto-proceed to decision
  return await handleDecision(task, progress);
}

// ─── Handler: Decision ────────────────────────────────────────────────────────

async function handleDecision(
  task: IdeaValidationTask,
  progress: (p: number, phase: string, msg: string) => void,
): Promise<IdeaValidationTurnOutput> {
  progress(90, 'decision', '生成决策建议...');

  updateNodeStatus(task, 'decision', 'running', 50);

  if (!task.evaluation) {
    task.evaluation = evaluateOpportunity({ task });
  }

  let decision: FinalValidationDecision;

  // Try LLM decision first
  try {
    const prompt = buildDecisionPrompt({
      task,
      evaluation: task.evaluation,
    });

    decision = await callCopilotJson<FinalValidationDecision>(prompt, '', 1500);
  } catch {
    // Fallback to rule-based decision
    decision = generateRuleBasedDecision(task.evaluation);
  }

  task.decision = decision;
  task.status = 'completed';
  updateNodeStatus(task, 'decision', 'completed', 100, {
    decision: decision.decision,
    recommendation: decision.recommendation,
  });

  saveIdeaValidationTask(task);

  progress(100, 'completed', '验证完成');

  // Build response
  const eval_ = task.evaluation;
  const reply = buildDecisionReply(task, decision, eval_);

  return {
    task,
    reply,
    requiresUserInput: false,
  };
}

// ─── Handler: Handoff ─────────────────────────────────────────────────────────

async function handleHandoff(
  task: IdeaValidationTask,
  progress: (p: number, phase: string, msg: string) => void,
): Promise<IdeaValidationTurnOutput> {
  progress(95, 'handoff', '准备开发交接...');

  if (!task.decision) {
    return {
      task,
      reply: '请先完成决策评估。',
      requiresUserInput: false,
    };
  }

  if (task.decision.decision === 'do_not_do') {
    updateNodeStatus(task, 'handoff', 'skipped', 100, {
      reason: '不建议做此项目',
    });
    saveIdeaValidationTask(task);

    return {
      task,
      reply: `根据评估结果，不建议继续做这个项目。

**原因：**
${task.decision.why.map((w) => `- ${w}`).join('\n')}

**建议的下一步：**
${task.decision.nextValidationActions.map((a) => `- ${a}`).join('\n')}

你可以：
1. 调整想法方向（pivot）
2. 先做用户验证再决定
3. 查看完整报告`,
      requiresUserInput: false,
    };
  }

  // Generate DEV_SPEC or CODEX_TASK_PACK
  updateNodeStatus(task, 'handoff', 'completed', 100, {
    shouldGenerateDevSpec: task.decision.shouldGenerateDevSpec,
    shouldBuildMVP: task.decision.shouldBuildMVP,
  });
  saveIdeaValidationTask(task);

  return {
    task,
    reply: `验证完成！建议继续开发。

**最佳定位：** ${task.decision.bestPositioning}

**下一步行动：**
${task.decision.nextValidationActions.map((a) => `- ${a}`).join('\n')}

你可以：
1. 生成 DEV_SPEC（开发规格文档）
2. 生成 Codex Task Pack（任务包）
3. 查看完整验证报告
4. 返回首页`,
    requiresUserInput: false,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateRuleBasedDecision(
  evaluation: OpportunityEvaluation,
): FinalValidationDecision {
  const score = evaluation.overallScore;
  const missingCount = evaluation.missingEvidence.length;

  if (score >= 70 && missingCount <= 2) {
    return {
      decision: 'do',
      recommendation: '这个想法有较好的机会，建议开始 MVP 开发。',
      bestPositioning: evaluation.keyReasons[0] ?? '待确定',
      shouldBuildMVP: true,
      shouldGenerateDevSpec: true,
      nextValidationActions: [
        '确定 MVP 核心功能',
        '生成 DEV_SPEC',
        '开始原型开发',
      ],
      why: evaluation.keyReasons,
    };
  }

  if (score >= 50) {
    return {
      decision: 'validate_first',
      recommendation: '想法有潜力，但需要先验证关键假设。',
      bestPositioning: evaluation.keyReasons[0] ?? '待确定',
      shouldBuildMVP: false,
      shouldGenerateDevSpec: false,
      nextValidationActions: [
        ...evaluation.missingEvidence.map((e) => `补充：${e}`),
        '做用户访谈验证需求',
        '再重新评估',
      ],
      why: [...evaluation.keyReasons, ...evaluation.keyRisks],
    };
  }

  if (score >= 30 && evaluation.differentiationSpace >= 50) {
    return {
      decision: 'pivot',
      recommendation: '当前方向竞争激烈，建议调整定位。',
      bestPositioning: '寻找差异化切入点',
      shouldBuildMVP: false,
      shouldGenerateDevSpec: false,
      nextValidationActions: [
        '分析竞品的弱点',
        '寻找未被满足的细分需求',
        '重新定义目标用户',
      ],
      why: evaluation.keyRisks,
    };
  }

  return {
    decision: 'do_not_do',
    recommendation: '当前评估不支持继续做这个项目。',
    bestPositioning: '',
    shouldBuildMVP: false,
    shouldGenerateDevSpec: false,
    nextValidationActions: [
      '重新审视想法的核心价值',
      '寻找新的方向',
      '或者先做更深入的用户调研',
    ],
    why: evaluation.keyRisks,
  };
}

function buildDecisionReply(
  task: IdeaValidationTask,
  decision: FinalValidationDecision,
  evaluation: OpportunityEvaluation,
): string {
  const decisionEmoji: Record<string, string> = {
    do: '✅',
    do_not_do: '❌',
    validate_first: '⚠️',
    pivot: '🔄',
  };

  const decisionLabel: Record<string, string> = {
    do: '建议做',
    do_not_do: '不建议做',
    validate_first: '先验证再决定',
    pivot: '建议转型',
  };

  return `## 验证结果

### 决策：${decisionEmoji[decision.decision] ?? '📊'} ${decisionLabel[decision.decision] ?? decision.decision}

**建议：** ${decision.recommendation}

### 评估分数
- 总分：**${evaluation.overallScore}/100**
- 需求强度：${evaluation.demandStrength}/100
- 用户清晰度：${evaluation.userClarity}/100
- 竞品成熟度：${evaluation.competitorMaturity}/100
- 差异化空间：${evaluation.differentiationSpace}/100
- 技术可行性：${evaluation.technicalFeasibility}/100

### 研究发现
- GitHub 项目：${task.research.githubRepos.length} 个
- 学术论文：${task.research.papers.length} 篇
- 竞品/公司：${task.research.competitors.length} 个

${evaluation.keyReasons.length > 0 ? `### 关键理由\n${evaluation.keyReasons.map((r) => `- ${r}`).join('\n')}` : ''}

${evaluation.keyRisks.length > 0 ? `### 关键风险\n${evaluation.keyRisks.map((r) => `- ${r}`).join('\n')}` : ''}

${evaluation.missingEvidence.length > 0 ? `### 缺失证据\n${evaluation.missingEvidence.map((e) => `- ${e}`).join('\n')}` : ''}

### 下一步
${decision.nextValidationActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

---
你可以：
1. 查看完整验证报告
2. ${decision.shouldGenerateDevSpec ? '生成 DEV_SPEC' : '先验证后再生成 DEV_SPEC'}
3. 返回首页`;
}
