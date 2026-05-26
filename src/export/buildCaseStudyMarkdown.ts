import type { FinalHandoff, ProductBrief } from '../types';
import type { HandoffSnapshot } from '../snapshot/types';
import type { HandoffTrace } from '../trace/types';
import { compareLatestSnapshots } from '../snapshot/compareSnapshots';

function list(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- 暂无';
}

export function buildCaseStudyMarkdown(input: {
  brief: ProductBrief;
  handoff: FinalHandoff;
  snapshots: HandoffSnapshot[];
  traces: HandoffTrace[];
}): string {
  const { brief, handoff, snapshots, traces } = input;
  const compare = compareLatestSnapshots(snapshots);
  const appliedFixIds = Array.from(new Set([
    ...snapshots.flatMap((snapshot) => snapshot.appliedFixIds || []),
    ...traces.flatMap((trace) => trace.appliedFixIds || []),
  ]));
  const references = handoff.knowledgeReferences || [];
  return [
    '# Vibe Copilot Case Study',
    '',
    '## 1. Input Idea',
    `- rawIdea: ${brief.ideaInput.rawIdea || brief.rawIdea}`,
    `- targetUser: ${brief.ideaInput.targetUser || '待补充'}`,
    `- scenario: ${brief.ideaInput.scenario || '待补充'}`,
    `- problem: ${brief.ideaInput.problem || '待补充'}`,
    `- projectType: ${brief.ideaInput.projectType || '待补充'}`,
    '',
    '## 2. Retrieved Knowledge',
    references.length ? references.map((ref) => [
      `- ${ref.title}`,
      `  - type: ${ref.type}`,
      `  - score: ${ref.score ?? 0}`,
      `  - matchedAliases: ${ref.matchedAliases?.join('、') || '暂无'}`,
      `  - appliedTo: ${ref.appliedTo?.join('、') || '暂无'}`,
      `  - influence: ${ref.influence || '暂无'}`,
      `  - reason: ${ref.reason}`,
    ].join('\n')).join('\n') : '暂无',
    '',
    '## 3. Generated DEV_SPEC',
    handoff.devSpec || '暂无',
    '',
    '## 4. Evaluation Summary',
    `- Score: ${handoff.evaluation?.totalScore ?? 0} / ${handoff.evaluation?.maxScore ?? 25}`,
    `- Weighted Score: ${handoff.evaluation?.weightedScore ?? 0} / ${handoff.evaluation?.weightedMaxScore ?? 0}`,
    `- Readiness: ${handoff.evaluation?.readiness || 'needs-review'}`,
    '',
    '### Dimension Scores',
    handoff.evaluation ? list(Object.entries(handoff.evaluation.dimensionScores).map(([key, value]) => `${key}: ${value}/5`)) : '- 暂无',
    '',
    '### Issues',
    list(handoff.evaluation?.issues || []),
    '',
    '### Suggestions',
    list(handoff.evaluation?.suggestions || []),
    '',
    '## 5. Applied Fixes',
    list(appliedFixIds),
    '',
    '## 6. Quality Change',
    compare.from && compare.to
      ? [`- Score: ${compare.from.score} -> ${compare.to.score}`, `- Readiness: ${compare.from.readiness} -> ${compare.to.readiness}`, '### Changed Sections', list(compare.changedSections)].join('\n')
      : '至少需要两个 snapshot 才能比较质量变化。',
    '',
    '## 7. Final Codex Development Prompt',
    handoff.developmentPrompt || '暂无',
    '',
    '## 8. Product Value Summary',
    '该案例展示了系统如何把模糊产品想法转化为可开发规格，并通过 Evaluation 和 Local Fixes 形成质量闭环。',
  ].join('\n\n');
}
