import type {
  AiSuggestion,
  CopilotStages,
  FinalHandoff,
  ProductBrief,
  StepData,
  StepKey,
} from '../types';
import type { IdeaValidationTask } from '../types/ideaValidation';
import { VALIDATION_DECISION_LABELS } from '../types/ideaValidation';

const BRIEFS_STORAGE_KEY = 'vibepilot_briefs';
const CURRENT_KEY = 'vibepilot_current_id';
const STEP_KEYS: StepKey[] = [
  'targetUser',
  'scenario',
  'painPoint',
  'alternatives',
  'aiValue',
  'mvpScope',
  'outOfScope',
  'techStack',
  'dataStructure',
  'acceptanceCriteria',
];

function suggestion<T>(value: T, reason: string): AiSuggestion<T> {
  return {
    value,
    reason,
    risks: [],
    alternatives: [],
    accepted: true,
    editedByUser: false,
    source: 'ai',
  };
}

function createLegacySteps(task: IdeaValidationTask): Record<string, StepData> {
  const base: Record<string, StepData> = {};
  STEP_KEYS.forEach((key) => {
    base[key] = {
      userAnswer: '',
      aiEvaluation: '由 Idea Validation Agent 验证结果整理。',
      aiQuality: 'ok',
      aiFollowUp: '',
      isCompleted: false,
    };
  });

  base.targetUser.userAnswer = task.targetUser ?? '';
  base.targetUser.isCompleted = Boolean(task.targetUser);
  base.scenario.userAnswer = task.useCase ?? '';
  base.scenario.isCompleted = Boolean(task.useCase);
  base.painPoint.userAnswer = task.successDefinition ?? '';
  base.painPoint.isCompleted = Boolean(task.successDefinition);
  base.alternatives.userAnswer = [
    ...task.research.githubRepos.slice(0, 3).map((repo) => repo.fullName),
    ...task.research.competitors.slice(0, 3).map((comp) => comp.name),
  ].join('；');
  base.alternatives.isCompleted = Boolean(base.alternatives.userAnswer);
  base.aiValue.userAnswer = task.evaluation?.keyReasons.join('；') ?? '';
  base.aiValue.isCompleted = Boolean(base.aiValue.userAnswer);
  base.mvpScope.userAnswer = task.decision?.nextValidationActions.join('；') ?? '';
  base.mvpScope.isCompleted = Boolean(base.mvpScope.userAnswer);
  base.outOfScope.userAnswer = 'V1 不接数据库；不接向量数据库；不实现真实 MCP Server；不伪造 GitHub、论文或公司来源。';
  base.outOfScope.isCompleted = true;
  base.techStack.userAnswer = '沿用当前项目技术栈；先用 localStorage 保存个人验证记录；搜索通过同源 API proxy。';
  base.techStack.isCompleted = true;
  base.dataStructure.userAnswer = 'IdeaValidationTask、ResearchBundle、EvidenceItem、OpportunityEvaluation、FinalValidationDecision。';
  base.dataStructure.isCompleted = true;
  base.acceptanceCriteria.userAnswer = task.decision?.shouldGenerateDevSpec
    ? '用户能查看验证报告；能看到真实引用或明确失败；能基于允许的决策进入 DEV_SPEC。'
    : '先补充缺失证据，再进入开发规格。';
  base.acceptanceCriteria.isCompleted = true;

  return base;
}

function buildStages(task: IdeaValidationTask): CopilotStages {
  const evidenceRefs = [
    ...task.research.githubRepos.slice(0, 5).map((repo) => repo.fullName),
    ...task.research.papers.slice(0, 5).map((paper) => paper.title),
    ...task.research.competitors.slice(0, 5).map((comp) => comp.name),
  ];
  const risks = task.evaluation?.keyRisks ?? [];
  const reasons = task.evaluation?.keyReasons ?? [];

  return {
    discovery: {
      targetUserEvidence: suggestion(task.targetUser ?? '未指定', '来自 Idea Validation 澄清阶段。'),
      demandEvidence: suggestion(evidenceRefs, '来自真实 GitHub、论文或竞品搜索结果；无结果时保持为空。'),
      falsificationEvidence: suggestion(task.evaluation?.missingEvidence ?? [], '来自机会评估中的缺失证据。'),
      smallestValidationAction: suggestion(
        task.decision?.nextValidationActions[0] ?? '先补充用户访谈和真实使用场景证据。',
        '来自最终验证决策。',
      ),
    },
    product: {
      productOneLiner: suggestion(task.clarifiedIdea ?? task.rawIdea, '来自验证后的想法摘要。'),
      targetUser: suggestion(task.targetUser ?? '未指定', '来自澄清阶段。'),
      scenario: suggestion(task.useCase ?? '未指定', '来自澄清阶段。'),
      corePainPoint: suggestion(task.successDefinition ?? '未指定', '来自成功标准和验证目标。'),
      alternatives: suggestion(evidenceRefs, '来自研究结果，不包含编造来源。'),
      aiValue: suggestion(reasons.join('；') || '等待补充证据后确认 AI 价值。', '来自机会评估关键理由。'),
    },
    business: {
      valueHypothesis: suggestion(task.decision?.bestPositioning || task.rawIdea, '来自最终决策定位。'),
      risksAndBlindSpots: suggestion(risks, '来自机会评估风险。'),
      roi: task.evaluation
        ? {
          userBenefitScore: suggestion(task.evaluation.demandStrength, '映射自 demandStrength。'),
          ownerBenefitScore: suggestion(task.evaluation.portfolioValue, '映射自 portfolioValue。'),
          developmentCostScore: suggestion(100 - task.evaluation.technicalFeasibility, '由 technicalFeasibility 反向估算。'),
          maintenanceCostScore: suggestion(50, '缺少运行数据，保守标记为中等。'),
          roiJudgement: suggestion(
            task.evaluation.overallScore >= 70 ? 'positive' : task.evaluation.overallScore >= 45 ? 'uncertain' : 'negative',
            '由 OpportunityEvaluation overallScore 映射。',
          ),
          reason: suggestion(task.decision?.recommendation ?? '', '来自最终决策建议。'),
        }
        : undefined,
    },
    technical: {
      frontend: suggestion('沿用当前前端应用模式。', '验证结果只负责机会判断，不强行引入新技术栈。'),
      backend: suggestion('保持同源 API proxy；不新增业务后端。', '符合本轮限制：不接数据库、不实现真实 MCP Server。'),
      database: suggestion('不接数据库，继续使用 localStorage。', '符合本轮限制。'),
      aiApi: suggestion('沿用 Settings API 配置和 API Proxy。', '避免在前端暴露私钥。'),
      dataFlow: suggestion('IdeaValidationTask -> ResearchBundle -> OpportunityEvaluation -> FinalValidationDecision -> DEV_SPEC。', '来自 V6 工作流。'),
      mockStrategy: suggestion('不使用 mock 伪造研究来源；搜索失败时展示结构化失败或 skipped。', '符合不编造来源要求。'),
    },
    mvp: {
      mustHave: suggestion(task.decision?.nextValidationActions.slice(0, 3) ?? [], '来自最终决策的下一步行动。'),
      shouldHave: suggestion(task.evaluation?.keyReasons.slice(0, 3) ?? [], '来自机会评估理由。'),
      outOfScope: suggestion(
        ['数据库', '向量数据库', '真实 MCP Server', '伪造 GitHub/论文/公司来源'],
        '来自本轮明确限制。',
      ),
      minimumLoop: suggestion('输入想法 -> 澄清 -> 研究 -> 机会评分 -> 决策 -> 开发交接。', '来自 Idea Validation Agent 工作流。'),
      scopeRisks: suggestion(risks, '来自机会评估风险。'),
    },
    blindSpot: {
      demandRisk: suggestion(task.evaluation?.missingEvidence ?? [], '来自缺失证据。'),
      businessRisk: suggestion(risks, '来自机会评估风险。'),
      technicalRisk: suggestion(['外部搜索 API 可能限流或不可用；模型输出必须通过结构化解析。'], '来自实现约束。'),
      scopeRisk: suggestion(['过早进入开发可能忽略缺失证据。'], '来自 validate_first 决策原则。'),
      whatWouldProveWrong: suggestion(task.evaluation?.missingEvidence ?? [], '来自缺失证据。'),
      recommendedAdjustment: suggestion(task.decision?.nextValidationActions ?? [], '来自最终决策。'),
    },
  };
}

function buildFinalHandoff(task: IdeaValidationTask): FinalHandoff {
  const refs = [
    ...task.research.githubRepos.map((repo) => `- GitHub: ${repo.fullName} ${repo.url}`),
    ...task.research.papers.map((paper) => `- Paper: ${paper.title}${paper.url ? ` ${paper.url}` : ''}`),
    ...task.research.competitors.map((comp) => `- Company/Web: ${comp.name}${comp.url ? ` ${comp.url}` : ''}`),
  ];
  const decisionLabel = task.decision ? VALIDATION_DECISION_LABELS[task.decision.decision] : '未完成';
  const missingEvidence = task.evaluatorReport?.missingInputs ?? task.evaluation?.missingEvidence ?? [];

  return {
    schemaVersion: 'idea-validation-v1',
    source: 'ai',
    productBrief: [
      `想法：${task.clarifiedIdea ?? task.rawIdea}`,
      `目标用户：${task.targetUser ?? '未指定'}`,
      `使用场景：${task.useCase ?? '未指定'}`,
      `最终决策：${decisionLabel}`,
      `建议：${task.decision?.recommendation ?? '未完成决策'}`,
    ].join('\n'),
    mvpScope: [
      'P0:',
      ...(task.decision?.nextValidationActions.slice(0, 3).map((item) => `- ${item}`) ?? ['- 先完成机会验证']),
      '',
      'Out of Scope:',
      '- 不接数据库',
      '- 不接向量数据库',
      '- 不实现真实 MCP Server',
      '- 不伪造研究来源',
    ].join('\n'),
    devSpec: [
      '# DEV_SPEC Seed',
      '',
      `目标：${task.decision?.bestPositioning || task.clarifiedIdea || task.rawIdea}`,
      '',
      '研究引用：',
      ...(refs.length ? refs : ['- 暂无可用研究引用，需先补充证据。']),
      '',
      'Evaluator 复核：',
      task.evaluatorReport
        ? `- 准备度：${task.evaluatorReport.overallScore}/100\n- 是否值得做：${task.evaluatorReport.worthDoingDecision}\n- 理由：${task.evaluatorReport.worthDoingReason}`
        : '- 暂无 evaluator 报告。',
      '',
      '缺失证据：',
      ...(missingEvidence.length ? missingEvidence.map((item) => `- ${item}`) : ['- 暂无']),
    ].join('\n'),
    technicalArchitecture: [
      '- 前端：沿用当前 React/Vite 应用。',
      '- 存储：localStorage。',
      '- API：同源 API proxy 调用 AI / research proxy。',
      '- 不新增数据库、向量数据库或真实 MCP Server。',
    ].join('\n'),
    dataStructure: [
      'IdeaValidationTask { id, schemaVersion, version, rawIdea, goalType, progressPercent, nodes, research, evaluation, evaluatorReport, decision, history }',
      'ResearchBundle { queryPlan, githubRepos, papers, competitors, evidenceItems }',
      'ValidationEvaluatorReport { relatedOpenSourceProjects, borrowableApproaches, paperReferences, matureProjectAnalysis, worthDoingDecision }',
      'FinalValidationDecision { decision, recommendation, bestPositioning, nextValidationActions }',
    ].join('\n'),
    acceptanceCriteria: [
      '- 用户可以查看 Idea Validation 报告。',
      '- GitHub / Paper / Company 结果必须来自真实搜索返回或明确失败。',
      '- 无 SEARCH_API_KEY 时竞品搜索显示 skipped，不编造公司。',
      '- 最终决策必须是 do / do_not_do / validate_first / pivot。',
      '- 只有允许继续时才进入 DEV_SPEC / Codex Task Pack。',
    ].join('\n'),
    developmentPrompt: [
      '# Codex Development Prompt',
      '',
      `基于 Idea Validation 结果继续实现：${task.clarifiedIdea ?? task.rawIdea}`,
      '',
      '必须保留：旧四步流程、ProductBrief 数据结构、localStorage 历史数据、API Proxy、Settings API 诊断。',
      '禁止：接数据库、接向量数据库、实现真实 MCP Server、伪造 GitHub/论文/公司来源、在前端暴露私钥。',
    ].join('\n'),
    validationWarnings: missingEvidence,
  };
}

function loadBriefs(): ProductBrief[] {
  try {
    const raw = localStorage.getItem(BRIEFS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ensureProductBriefFromIdeaValidationTask(task: IdeaValidationTask): string {
  const now = new Date().toISOString();
  const brief: ProductBrief = {
    id: task.id,
    createdAt: task.createdAt,
    updatedAt: now,
    rawIdea: task.clarifiedIdea ?? task.rawIdea,
    ideaInput: {
      rawIdea: task.clarifiedIdea ?? task.rawIdea,
      targetUser: task.targetUser,
      scenario: task.useCase,
      problem: task.successDefinition,
      projectType: 'AI Agent',
    },
    mode: 'builder',
    stages: buildStages(task),
    finalHandoff: buildFinalHandoff(task),
    developmentPrompt: buildFinalHandoff(task).developmentPrompt,
    steps: createLegacySteps(task),
  };

  const briefs = loadBriefs();
  const idx = briefs.findIndex((item) => item.id === brief.id);
  if (idx >= 0) {
    briefs[idx] = {
      ...briefs[idx],
      ...brief,
      createdAt: briefs[idx].createdAt || brief.createdAt,
      updatedAt: now,
    };
  } else {
    briefs.unshift(brief);
  }

  try {
    localStorage.setItem(BRIEFS_STORAGE_KEY, JSON.stringify(briefs.slice(0, 50)));
    localStorage.setItem(CURRENT_KEY, brief.id);
  } catch {
    // If localStorage is unavailable, the caller can still stay on the report page.
  }

  return brief.id;
}
