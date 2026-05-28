import type { ProductBrief, CopilotPhase, DecisionStageProgress } from '../types';
import { PHASE_LABELS } from '../types';

const PHASE_ORDER: CopilotPhase[] = [
  'rawIdea', 'problemFraming', 'userScenario', 'demandEvidence',
  'mvpScope', 'riskCounterargument', 'techConstraints',
  'acceptanceCriteria', 'devSpec', 'codexTaskPack',
];

const PHASE_PERCENTAGES: Record<CopilotPhase, number> = {
  rawIdea: 10, problemFraming: 25, userScenario: 35,
  demandEvidence: 45, mvpScope: 55, riskCounterargument: 65,
  techConstraints: 75, acceptanceCriteria: 85, devSpec: 92, codexTaskPack: 100,
};

export function calculatePhaseProgress(brief: ProductBrief): DecisionStageProgress[] {
  return PHASE_ORDER.map((key) => {
    const status = derivePhaseStatus(key, brief);
    const { score, missing } = scorePhase(key, brief);
    return {
      key,
      label: PHASE_LABELS[key],
      progressPercent: PHASE_PERCENTAGES[key],
      status,
      qualityScore: score,
      missingInfo: missing,
      questions: generatePhaseQuestions(key),
      acceptanceChecks: generatePhaseChecks(key),
      confirmedByUser: status === 'confirmed',
    };
  });
}

function derivePhaseStatus(key: CopilotPhase, brief: ProductBrief): DecisionStageProgress['status'] {
  const stages = brief.stages;
  const handoff = brief.finalHandoff;
  switch (key) {
    case 'rawIdea':
      return brief.rawIdea && brief.rawIdea.length > 10 ? 'draft' : 'empty';
    case 'problemFraming':
      return stages.product?.corePainPoint?.value ? 'draft' : 'empty';
    case 'userScenario':
      return stages.product?.scenario?.value && stages.product?.targetUser?.value ? 'draft' : 'empty';
    case 'demandEvidence':
      return stages.discovery?.demandEvidence?.value ? 'draft' : 'empty';
    case 'mvpScope':
      return stages.mvp?.mustHave?.value && (stages.mvp.mustHave.value as string[]).length ? 'draft' : 'empty';
    case 'riskCounterargument':
      return stages.blindSpot?.whatWouldProveWrong?.value && (stages.blindSpot.whatWouldProveWrong.value as string[]).length ? 'draft' : 'empty';
    case 'techConstraints':
      return stages.technical?.frontend?.value ? 'draft' : 'empty';
    case 'acceptanceCriteria':
      return handoff?.acceptanceCriteria && handoff.acceptanceCriteria.length > 10 ? 'draft' : 'empty';
    case 'devSpec':
      return handoff?.devSpec && handoff.devSpec.length > 10 ? 'draft' : 'empty';
    case 'codexTaskPack':
      return 'empty';
    default:
      return 'empty';
  }
}

function scorePhase(key: CopilotPhase, brief: ProductBrief): { score: number; missing: string[] } {
  const missing: string[] = [];
  let score = 0;
  switch (key) {
    case 'rawIdea':
      if (!brief.rawIdea || brief.rawIdea.length < 10) { missing.push('原始想法过于简短'); score = 1; }
      else if (brief.rawIdea.length < 30) { score = 3; }
      else score = 5;
      break;
    case 'problemFraming':
      if (brief.stages.product?.corePainPoint?.value) score = 4;
      else { missing.push('未定义核心痛点'); score = 1; }
      break;
    case 'userScenario':
      if (brief.stages.product?.scenario?.value && brief.stages.product?.targetUser?.value) score = 5;
      else if (brief.stages.product?.scenario?.value || brief.stages.product?.targetUser?.value) { score = 3; missing.push('目标用户或场景不完整'); }
      else { missing.push('目标用户和场景均未定义'); score = 0; }
      break;
    case 'demandEvidence':
      if (brief.stages.discovery?.demandEvidence?.value && (brief.stages.discovery.demandEvidence.value as string[]).length) score = 4;
      else { missing.push('未提供需求证据'); score = 1; }
      break;
    case 'mvpScope':
      if (brief.stages.mvp?.mustHave?.value && (brief.stages.mvp.mustHave.value as string[]).length && brief.stages.mvp?.outOfScope?.value && (brief.stages.mvp.outOfScope.value as string[]).length) score = 5;
      else if (brief.stages.mvp?.mustHave?.value && (brief.stages.mvp.mustHave.value as string[]).length) { score = 3; missing.push('未定义 Out of Scope'); }
      else { missing.push('MVP 范围未定义'); score = 0; }
      break;
    case 'riskCounterargument':
      if (brief.stages.blindSpot?.whatWouldProveWrong?.value && (brief.stages.blindSpot.whatWouldProveWrong.value as string[]).length) score = 4;
      else { missing.push('未定义反证风险'); score = 1; }
      break;
    case 'techConstraints':
      if (brief.stages.technical?.frontend?.value) score = 4;
      else { missing.push('技术方案未定义'); score = 1; }
      break;
    case 'acceptanceCriteria':
      if (brief.finalHandoff?.acceptanceCriteria && brief.finalHandoff.acceptanceCriteria.length > 20) score = 4;
      else { missing.push('验收标准不完整'); score = 2; }
      break;
    case 'devSpec':
      if (brief.finalHandoff?.devSpec && brief.finalHandoff.devSpec.length > 20) score = 4;
      else { missing.push('DEV_SPEC 未生成'); score = 1; }
      break;
    case 'codexTaskPack':
      missing.push('CODEX_TASK_PACK 需在输出页面手动生成');
      score = 0;
      break;
  }
  return { score, missing };
}

function generatePhaseQuestions(key: CopilotPhase): string[] {
  const questions: Record<CopilotPhase, string[]> = {
    rawIdea: ['你想解决什么问题？', '这个问题值得用软件解决吗？'],
    problemFraming: ['目标用户的核心痛点是什么？', '为什么现有方案不够好？'],
    userScenario: ['用户在什么场景下使用？', '使用频率如何？'],
    demandEvidence: ['有什么证据表明这个需求真实存在？', '有没有反证表明需求不够强？'],
    mvpScope: ['V1 最小闭环是什么？', 'V1 明确不做什么？'],
    riskCounterargument: ['什么情况下这个想法会失败？', '最大的假设是什么？'],
    techConstraints: ['前端用什么技术栈？', '数据存储方案是什么？'],
    acceptanceCriteria: ['用户成功完成一次使用的标准是什么？', '开发完成的定义是什么？'],
    devSpec: [],
    codexTaskPack: [],
  };
  return questions[key] || [];
}

function generatePhaseChecks(key: CopilotPhase): string[] {
  const checks: Record<CopilotPhase, string[]> = {
    rawIdea: ['想法描述 ≥ 10 字'],
    problemFraming: ['核心痛点已明确', '问题可被验证'],
    userScenario: ['目标用户已定义', '使用场景已定义'],
    demandEvidence: ['有需求证据或反证'],
    mvpScope: ['P0 功能 ≤ 5 个', 'Out of Scope 已定义'],
    riskCounterargument: ['至少一个反证场景'],
    techConstraints: ['前端方案已确定', '数据方案已确定'],
    acceptanceCriteria: ['验收标准可测试', '符合 EARS 格式'],
    devSpec: ['productGoal 已定义', 'p0Features 已列出'],
    codexTaskPack: ['任务列表完整', 'implementationSteps 有序'],
  };
  return checks[key] || [];
}

export function getOverallProgress(phases: DecisionStageProgress[]): { completed: number; total: number; percentage: number } {
  const total = phases.length;
  const completed = phases.filter((p) => p.status === 'confirmed' || p.status === 'draft').length;
  return { completed, total, percentage: Math.round((completed / total) * 100) };
}
