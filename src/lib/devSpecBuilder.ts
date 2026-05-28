import type { ProductBrief, DevSpec } from '../types';
import { buildStructuredDevSpec } from '../spec/buildStructuredDevSpec';
import { generateEarsAcceptanceCriteria } from './ears';
import { deriveScopeControl } from './scopeControl';

export function buildDevSpec(brief: ProductBrief): DevSpec {
  const handoff = brief.finalHandoff;
  const scope = deriveScopeControl({ rawIdea: brief.rawIdea });
  const userScenarios = [
    brief.stages.product?.scenario?.value as string || '',
    brief.ideaInput?.scenario || '',
  ].filter(Boolean);

  let acceptanceCriteria: string[] = [];
  if (handoff?.acceptanceCriteria) {
    acceptanceCriteria = handoff.acceptanceCriteria
      .split('\n')
      .map((l) => l.replace(/^[-*\d.)）\s]+/, '').trim())
      .filter(Boolean);
  }

  // 尝试使用已有 structured spec
  const structured = buildStructuredDevSpec({
    brief,
    productBrief: handoff?.productBrief || '',
    mvpScope: handoff?.mvpScope || '',
    technicalArchitecture: handoff?.technicalArchitecture || '',
    dataStructure: handoff?.dataStructure || '',
    acceptanceCriteria: handoff?.acceptanceCriteria || '',
    developmentPrompt: handoff?.developmentPrompt || '',
    knowledgeReferences: handoff?.knowledgeReferences,
  });

  const ears = generateEarsAcceptanceCriteria({
    p0Features: scope.p0,
    userScenarios,
    outOfScope: scope.outOfScope,
  });

  return {
    productGoal: structured.projectOverview.productGoal,
    targetUsers: [structured.projectOverview.targetUser].filter(Boolean),
    userScenarios: structured.userFlow || userScenarios,
    p0Features: scope.p0.length ? scope.p0 : structured.mvpScope.mustHave,
    p1Features: structured.mvpScope.shouldHave,
    p2Features: [],
    outOfScope: structured.mvpScope.outOfScope,
    dataEntities: structured.dataModels.map((m) => m.name),
    coreFlows: structured.userFlow,
    acceptanceCriteria: acceptanceCriteria.length
      ? acceptanceCriteria
      : ears.map((e) => e.text),
    nonFunctionalRequirements: structured.aiBehaviorRules,
    risks: structured.risks.map((r) => r.risk),
    generatedAt: new Date().toISOString(),
  };
}

export function formatDevSpecMarkdown(devSpec: DevSpec): string {
  const sections: string[] = [
    '# DEV_SPEC',
    '',
    `> 生成时间: ${devSpec.generatedAt || 'N/A'}`,
    '',
    '## 产品目标',
    devSpec.productGoal || '待补充',
    '',
    '## 目标用户',
    ...devSpec.targetUsers.map((u) => `- ${u}`),
    '',
    '## 用户场景',
    ...devSpec.userScenarios.map((s) => `- ${s}`),
    '',
    '## P0 功能 （V1 必须实现）',
    ...devSpec.p0Features.map((f) => `- ${f}`),
    '',
    '## P1 功能 （V1 建议实现）',
    ...(devSpec.p1Features.length ? devSpec.p1Features.map((f) => `- ${f}`) : ['暂无']),
    '',
    '## P2 功能 （后续版本）',
    ...(devSpec.p2Features.length ? devSpec.p2Features.map((f) => `- ${f}`) : ['暂无']),
    '',
    '## Out of Scope （V1 不做）',
    ...devSpec.outOfScope.map((o) => `- ${o}`),
    '',
    '## 数据实体',
    ...devSpec.dataEntities.map((d) => `- ${d}`),
    '',
    '## 核心流程',
    ...devSpec.coreFlows.map((f, i) => `${i + 1}. ${f}`),
    '',
    '## 验收标准',
    ...devSpec.acceptanceCriteria.map((a) => `- ${a}`),
    '',
    '## 非功能需求',
    ...devSpec.nonFunctionalRequirements.map((n) => `- ${n}`),
    '',
    '## 风险',
    ...devSpec.risks.map((r) => `- ${r}`),
  ];
  return sections.join('\n');
}
