import type { FinalHandoff, HandoffEvaluation, HandoffEvaluationDimension, HandoffFixSuggestion } from '../types';

interface DimensionConfig {
  label: string;
  text: string;
  groups: string[][];
  issueWhenMissing: string[];
  suggestions: string[];
  structureChecks?: Array<(text: string) => boolean>;
}

const EVALUATION_WEIGHTS = {
  userScenarioClarity: 1,
  mvpFocus: 1.2,
  technicalExecutability: 1.5,
  acceptanceCriteriaCompleteness: 1.3,
  promptExecutability: 1.5,
};

function scoreByKeywords(text: string, groups: string[][]): number {
  const normalized = text.toLowerCase();
  return groups.reduce((score, group) => score + (group.some((keyword) => normalized.includes(keyword.toLowerCase())) ? 1 : 0), 0);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(5, score));
}

function lines(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

function hasConcreteEvidence(text: string): boolean {
  return text.trim().length > 80 || lines(text).filter((line) => /^[-*]\s+|^\d+[.)]\s+/.test(line)).length >= 2 || /[A-Z][A-Za-z]+Item|[A-Z][A-Za-z]+Record|[A-Z][A-Za-z]+Trace|[A-Z][A-Za-z]+\s*\{/.test(text);
}

function hasListStructure(text: string): boolean {
  return /(^|\n)-\s+|(^|\n)\d+\.|Must Have|\[ \]/i.test(text);
}

function hasDataModelShape(text: string): boolean {
  return /[{}]/.test(text) || /[A-Z][A-Za-z]+\s*\{[^}]+}/.test(text) || lines(text).filter((line) => /:\s*(string|number|boolean|Record|Array|\w+\[\])|-\s+\w+\s*\{/.test(line)).length >= 2;
}

function hasActionResultAcceptance(text: string): boolean {
  return /用户可以|点击|输入|应看到|生成后|失败时/.test(text);
}

function extractEvidence(text: string, groups: string[][]): string[] {
  const sourceLines = lines(text);
  const normalizedText = text.toLowerCase();
  const evidence = groups.flatMap((group) => {
    const keyword = group.find((item) => normalizedText.includes(item.toLowerCase()));
    if (!keyword) return [];
    const foundLine = sourceLines.find((item) => item.toLowerCase().includes(keyword.toLowerCase()));
    return foundLine ? [foundLine.slice(0, 160)] : [];
  });
  return Array.from(new Set(evidence)).slice(0, 4);
}

function missingIssues(score: number, config: DimensionConfig): string[] {
  if (score >= 4) return ['暂无明显问题'];
  return config.issueWhenMissing.slice(0, Math.max(1, 5 - score));
}

function buildDimension(config: DimensionConfig): HandoffEvaluationDimension {
  const keywordScore = scoreByKeywords(config.text, config.groups);
  const structureScore = (config.structureChecks || []).filter((check) => check(config.text)).length;
  let score = clampScore(keywordScore + structureScore);
  const evidence = extractEvidence(config.text, config.groups);

  if (!hasConcreteEvidence(config.text)) score = Math.min(score, 3);
  if (!evidence.length) score = Math.min(score, 3);
  if (config.text.trim().length < 60) score = Math.min(score, 2);

  return {
    score,
    label: config.label,
    evidence,
    issues: missingIssues(score, config),
    suggestions: config.suggestions,
  };
}

function meaningfulIssues(dimension: HandoffEvaluationDimension): string[] {
  return dimension.issues.filter((issue) => issue !== '暂无明显问题');
}

function includesAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function buildFixSuggestions(handoff: FinalHandoff, scores: HandoffEvaluation['dimensionScores']): HandoffFixSuggestion[] {
  const fixes: HandoffFixSuggestion[] = [];

  if (scores.mvpFocus < 4) {
    if (!includesAny(handoff.mvpScope, ['Must Have', 'must-have', '必须', 'P0'])) {
      fixes.push({
        id: 'fix-mvp-must-have',
        targetSection: 'mvpScope',
        issue: 'MVP Scope 缺少 Must Have，开发者不知道第一版必须完成什么。',
        patch: '## Local Fix: 补充 Must Have\n为什么补：明确第一版必须实现的最小闭环，避免开发工具自由发挥。\n补什么：\n- 用户可以输入一个模糊产品想法。\n- 系统可以生成 Knowledge References、DEV_SPEC、Evaluation Report。\n- 用户可以复制或下载 Codex Development Prompt。',
      });
    }
    if (!includesAny(handoff.mvpScope, ['Out of Scope', 'out-of-scope', '不做', '暂不'])) {
      fixes.push({
        id: 'fix-mvp-out-of-scope',
        targetSection: 'mvpScope',
        issue: 'MVP Scope 缺少 Out of Scope，容易把 V1 做成大平台。',
        patch: '## Local Fix: 补充 Out of Scope\n为什么补：明确 V1 不做什么，降低范围膨胀风险。\n补什么：\nV1 不做登录、支付、团队协作、复杂后台、向量数据库、Embedding、Rerank、MCP Server、自动部署流水线。',
      });
    }
  }

  if (scores.technicalExecutability < 4 && !hasDataModelShape(handoff.dataStructure)) {
    fixes.push({
      id: 'fix-data-structure-models',
      targetSection: 'dataStructure',
      issue: 'Data Structure 缺少明确数据模型，开发者难以落地状态和存储。',
      patch: '## Local Fix: 补充数据模型\n为什么补：让开发者明确 V1 需要保存哪些对象和字段。\n补什么：\n- ProjectIdea { id, rawIdea, targetUser, scenario, problem, projectType, createdAt }\n- FinalHandoff { productBrief, mvpScope, devSpec, acceptanceCriteria, developmentPrompt, evaluation }\n- HandoffTrace { id, briefId, createdAt, retrievedDocIds, evaluationScore, readiness }',
    });
  }

  if (scores.promptExecutability < 4) {
    if (!includesAny(handoff.developmentPrompt, ['npm run build', 'npm run lint'])) {
      fixes.push({
        id: 'fix-prompt-verification',
        targetSection: 'developmentPrompt',
        issue: 'Development Prompt 缺少测试命令，无法形成可靠交付闭环。',
        patch: '## Local Fix: 补充执行验证\n为什么补：让 AI 编程工具在完成后自检，避免类型错误或构建失败。\n补什么：\n完成后必须运行：\n- npm run build\n- npm run lint',
      });
    }
    if (!includesAny(handoff.developmentPrompt, ['不要', '禁止', 'Do not', 'constraint'])) {
      fixes.push({
        id: 'fix-prompt-constraints',
        targetSection: 'developmentPrompt',
        issue: 'Development Prompt 缺少实现约束，可能引入数据库、认证或范围外能力。',
        patch: '## Local Fix: 补充实现约束\n为什么补：防止 AI 编程工具做超出 V1 的改造。\n补什么：\n- 保持现有 UI 风格。\n- 不新增数据库、认证、支付、MCP、向量库、Embedding 或 Rerank。\n- 所有复杂对象渲染前必须格式化。',
      });
    }
  }

  if (scores.acceptanceCriteriaCompleteness < 4 && !hasActionResultAcceptance(handoff.acceptanceCriteria)) {
    fixes.push({
      id: 'fix-acceptance-testable',
      targetSection: 'acceptanceCriteria',
      issue: 'Acceptance Criteria 缺少动作和结果，验收判断不够客观。',
      patch: '## Local Fix: 补充可测试验收标准\n为什么补：把主观描述改成可操作、可验证的完成判断。\n补什么：\n- 用户输入产品想法后，应看到 Knowledge References、DEV_SPEC、Evaluation Report。\n- 点击 Apply Local Fixes 后，应看到评分重新计算，并生成新的 Generation Trace。\n- 下载 Markdown 时，应包含 schemaVersion、readiness、score 和 knowledge reference 数量。',
    });
  }

  return fixes;
}

export function evaluateHandoff(handoff: FinalHandoff): HandoffEvaluation {
  const technicalText = `${handoff.technicalArchitecture}\n${handoff.dataStructure}`;
  const dimensions = {
    userScenarioClarity: buildDimension({
      label: 'User Scenario Clarity',
      text: handoff.productBrief,
      groups: [
        ['目标用户', 'target user', '用户'],
        ['使用场景', 'scenario', '场景'],
        ['核心痛点', 'pain', 'problem', '问题'],
        ['替代方案', 'alternative', '需求证据', '需求洞察'],
        ['产品目标', 'product goal', '产品定义'],
      ],
      issueWhenMissing: ['缺少目标用户、使用场景或核心痛点中的关键信息。', '缺少当前替代方案或需求证据，开发者难以理解为什么要做。'],
      suggestions: ['补充用户现在如何解决这个问题，以及为什么现有方式不够好。'],
      structureChecks: [hasListStructure, hasConcreteEvidence],
    }),
    mvpFocus: buildDimension({
      label: 'MVP Focus',
      text: handoff.mvpScope,
      groups: [
        ['must have', 'must-have', '必须', 'p0'],
        ['should have', 'should-have', 'p1'],
        ['out of scope', 'out-of-scope', '不做', '暂不'],
        ['最小闭环', 'minimum loop'],
        ['v1', '第一版', 'mvp'],
      ],
      issueWhenMissing: ['MVP Scope 没有完整区分 Must Have、Should Have 和 Out of Scope。', '缺少最小闭环或 V1 边界，容易引发范围膨胀。'],
      suggestions: ['把第一版压缩成一个用户能完整走通的闭环，并明确列出不做什么。'],
      structureChecks: [hasListStructure, hasConcreteEvidence],
    }),
    technicalExecutability: buildDimension({
      label: 'Technical Executability',
      text: technicalText,
      groups: [
        ['前端', 'frontend', 'react', 'vite'],
        ['数据结构', 'data structure', 'data model', '实体'],
        ['localstorage', '本地存储', 'storage', '存储'],
        ['ai api', 'api', 'proxy', '模型'],
        ['error', '失败', '兜底', 'fallback', '异常'],
      ],
      issueWhenMissing: ['技术方案缺少前端、数据结构、存储方式、AI API 或异常处理中的一项。', '开发者可能不知道数据存在哪里、接口失败时如何处理。'],
      suggestions: ['补充 V1 使用的存储方式、AI API 调用边界，以及失败兜底行为。'],
      structureChecks: [hasDataModelShape, hasListStructure],
    }),
    acceptanceCriteriaCompleteness: buildDimension({
      label: 'Acceptance Criteria Completeness',
      text: handoff.acceptanceCriteria,
      groups: [
        ['可以', '点击', '输入', '生成', '下载', '复制'],
        ['完成', '判断', 'pass', 'fail'],
        ['异常', '失败', '空状态', '错误'],
        ['用户', '流程', '页面'],
        ['测试', 'test', 'checklist', '检查', '验收'],
      ],
      issueWhenMissing: ['验收标准缺少可测试动作、完成判断、异常情况或用户流程。', '部分标准可能仍是主观描述，开发完成后难以判断是否通过。'],
      suggestions: ['把每条验收标准改成“用户执行某动作后，应看到某结果”的形式。'],
      structureChecks: [hasActionResultAcceptance, hasListStructure],
    }),
    promptExecutability: buildDimension({
      label: 'Prompt Executability',
      text: handoff.developmentPrompt,
      groups: [
        ['任务', 'task', '实现', '开发'],
        ['文件', 'file', '页面', '组件'],
        ['约束', 'constraint', '禁止', '不要'],
        ['验收', 'acceptance', 'criteria'],
        ['npm run build', 'npm run lint', '测试', 'test', 'build'],
      ],
      issueWhenMissing: ['开发 Prompt 缺少任务、文件/页面、约束、验收标准或测试命令。', '交给 Codex / Claude Code / Cursor 时可能无法稳定执行。'],
      suggestions: ['在 Development Prompt 末尾明确要求运行 npm run build，并说明不允许新增数据库、登录、支付等范围外能力。'],
      structureChecks: [hasListStructure, hasConcreteEvidence],
    }),
  };

  const dimensionScores = {
    userScenarioClarity: dimensions.userScenarioClarity.score,
    mvpFocus: dimensions.mvpFocus.score,
    technicalExecutability: dimensions.technicalExecutability.score,
    acceptanceCriteriaCompleteness: dimensions.acceptanceCriteriaCompleteness.score,
    promptExecutability: dimensions.promptExecutability.score,
  };
  const totalScore = Object.values(dimensionScores).reduce((sum, score) => sum + score, 0);
  const weightedScore = Number(Object.entries(dimensionScores)
    .reduce((sum, [key, score]) => sum + score * EVALUATION_WEIGHTS[key as keyof typeof EVALUATION_WEIGHTS], 0)
    .toFixed(1));
  const weightedMaxScore = Number((5 * Object.values(EVALUATION_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toFixed(1));
  const readiness = totalScore >= 21 ? 'ready' : totalScore >= 15 ? 'needs-review' : 'not-ready';
  const allDimensions = Object.values(dimensions);
  const issues = allDimensions.flatMap(meaningfulIssues);
  const suggestions = Array.from(new Set(allDimensions.flatMap((dimension) => dimension.suggestions)));
  const strengths = allDimensions
    .filter((dimension) => dimension.score >= 4)
    .map((dimension) => `${dimension.label} 已达到可开发水平。`);

  return {
    totalScore,
    maxScore: 25,
    weightedScore,
    weightedMaxScore,
    readiness,
    dimensionScores,
    dimensions,
    strengths: strengths.length ? strengths.slice(0, 4) : ['已生成完整 handoff 草案，但仍需要补充关键开发证据。'],
    issues: issues.length ? issues.slice(0, 6) : ['暂无明显问题'],
    suggestions: suggestions.length ? suggestions.slice(0, 6) : ['可以交给 Codex / Claude Code / Cursor 开始实现，并按验收标准逐条检查。'],
    fixSuggestions: buildFixSuggestions(handoff, dimensionScores),
  };
}
