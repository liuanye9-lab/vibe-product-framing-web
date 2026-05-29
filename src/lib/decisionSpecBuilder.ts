import type { ProductBrief, DecisionStageProgress, RequirementQualityScore, AmbiguityIssue, ScopeControlResult, EarsRequirement, DevSpec, CodexTaskPack } from '../types';
import { calculatePhaseProgress } from './progressCalculator';
import { evaluateRequirementQuality } from './requirementQuality';
import { detectRequirementAmbiguity } from './ambiguityDetector';
import { deriveScopeControl } from './scopeControl';
import { generateEarsAcceptanceCriteria } from './ears';
import { buildDevSpec } from './devSpecBuilder';
import { buildCodexTaskPack } from './codexTaskPackBuilder';

export interface DecisionSpecBundle {
  generatedAt: string;
  phases: DecisionStageProgress[];
  quality: RequirementQualityScore;
  ambiguityIssues: AmbiguityIssue[];
  scope: ScopeControlResult;
  ears: EarsRequirement[];
  devSpec: DevSpec;
  codexTaskPack: CodexTaskPack;
}

export function buildDecisionSpecBundle(brief: ProductBrief): DecisionSpecBundle {
  const phases = calculatePhaseProgress(brief);
  const quality = evaluateRequirementQuality(brief);
  const ambiguity = detectRequirementAmbiguity({
    rawIdea: brief.rawIdea,
    problemFraming: brief.stages.product?.corePainPoint?.value as string,
    userScenario: brief.stages.product?.scenario?.value as string,
    mvpScope: brief.stages.mvp?.mustHave?.value ? (brief.stages.mvp.mustHave.value as string[]).join(', ') : undefined,
    acceptanceCriteria: brief.finalHandoff?.acceptanceCriteria,
  });
  const scope = deriveScopeControl({ rawIdea: brief.rawIdea });
  const ears = generateEarsAcceptanceCriteria({
    p0Features: scope.p0.length ? scope.p0 : (brief.stages.mvp?.mustHave?.value as string[] || []),
    userScenarios: [brief.stages.product?.scenario?.value as string].filter(Boolean),
    outOfScope: scope.outOfScope,
  });
  const devSpec = buildDevSpec(brief);
  const codexTaskPack = buildCodexTaskPack({ devSpec });

  return {
    generatedAt: new Date().toISOString(),
    phases,
    quality,
    ambiguityIssues: ambiguity,
    scope,
    ears,
    devSpec,
    codexTaskPack,
  };
}
