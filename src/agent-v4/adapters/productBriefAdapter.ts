/**
 * Product Brief Adapter — ensures ProductBrief compatibility with agent-v4.
 *
 * No breaking changes to ProductBrief. Just adds helper functions.
 */

import type { ProductBrief } from '../../types';

/** Get a summary of the brief for agent context. */
export function getBriefSummary(brief: ProductBrief): Record<string, unknown> {
  return {
    id: brief.id,
    rawIdea: brief.rawIdea?.slice(0, 200),
    projectType: brief.ideaInput?.projectType,
    targetUser: brief.ideaInput?.targetUser,
    scenario: brief.ideaInput?.scenario,
    problem: brief.ideaInput?.problem,
    hasDiscovery: Object.keys(brief.stages?.discovery || {}).length > 0,
    hasProduct: Boolean(brief.stages?.product?.productOneLiner?.value),
    hasMvp: Boolean(brief.stages?.mvp?.mustHave?.value),
    hasTech: Boolean(brief.stages?.technical?.frontend?.value),
    hasBlindSpot: Boolean(brief.stages?.blindSpot?.demandRisk?.value),
    hasHandoff: Boolean(brief.finalHandoff),
    handoffScore: brief.finalHandoff?.evaluation?.totalScore,
    handoffReadiness: brief.finalHandoff?.evaluation?.readiness,
  };
}
