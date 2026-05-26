import type { FramingStage, ProductBrief } from '../types';

function toShortText(value: unknown, maxLen = 180): string {
  if (value === undefined || value === null) return '';
  const s = typeof value === 'string' ? value : String(value);
  return s.length <= maxLen ? s : `${s.slice(0, maxLen)}...`;
}

function extractValue(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
    return (raw as { value?: unknown }).value;
  }
  return raw;
}

function toShortList(value: unknown, maxItems = 3): string[] {
  if (!Array.isArray(value)) {
    const v = extractValue(value);
    if (Array.isArray(v)) return v.slice(0, maxItems).map((item) => toShortText(item));
    const t = toShortText(v);
    return t ? [t] : [];
  }
  return value.slice(0, maxItems).map((item) => toShortText(extractValue(item) ?? item));
}

/**
 * Build a compact, stage-specific context to reduce token usage.
 * For `mvp`: only includes fields relevant to MVP scope decisions.
 * Other stages still use buildBriefContext().
 */
export function buildCompactStageContext(stage: FramingStage, brief: ProductBrief): string {
  if (stage !== 'mvp') {
    // Fallback for non-mvp stages (not expected, but safe)
    return JSON.stringify({ mode: brief.mode, ideaInput: brief.ideaInput });
  }

  const product = brief.stages.product;
  const discovery = brief.stages.discovery;
  const business = brief.stages.business;

  return JSON.stringify({
    mode: brief.mode,
    stage: 'mvp',
    ideaInput: {
      rawIdea: toShortText(brief.ideaInput.rawIdea),
      targetUser: toShortText(brief.ideaInput.targetUser),
      scenario: toShortText(brief.ideaInput.scenario),
      problem: toShortText(brief.ideaInput.problem),
      projectType: toShortText(brief.ideaInput.projectType),
    },
    productSummary: {
      productOneLiner: toShortText(extractValue(product.productOneLiner)),
      targetUser: toShortText(extractValue(product.targetUser)),
      scenario: toShortText(extractValue(product.scenario)),
      corePainPoint: toShortText(extractValue(product.corePainPoint)),
      aiValue: toShortText(extractValue(product.aiValue)),
    },
    demandSummary: {
      targetUserEvidence: toShortText(extractValue(discovery.targetUserEvidence)),
      currentAlternative: toShortText(extractValue(discovery.currentAlternative)),
      smallestValidationAction: toShortText(extractValue(discovery.smallestValidationAction)),
    },
    businessSummary: {
      valueHypothesis: toShortText(extractValue(business.valueHypothesis)),
      risksAndBlindSpots: toShortList(extractValue(business.risksAndBlindSpots)),
    },
    productType: toShortText(brief.ideaInput.projectType),
  }, null, 2);
}
