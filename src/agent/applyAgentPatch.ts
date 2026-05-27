/**
 * Agent Patch Applier — applies Agent-generated updates to ProductBrief stages.
 *
 * Rules:
 * 1. targetStage maps to the corresponding brief.stages field.
 * 2. String values in patch are converted to AiSuggestion.
 * 3. Already-AiSuggestion shapes are normalized.
 * 4. Fields with editedByUser=true are NOT overwritten (unless explicitly requested).
 */

import type { ProductBrief, AiSuggestion, SuggestionValue } from '../types';

function toSuggestion(value: unknown): AiSuggestion<SuggestionValue> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    // Already looks like an AiSuggestion
    if ('value' in obj) {
      return {
        value: (obj.value ?? '') as SuggestionValue,
        reason: typeof obj.reason === 'string' ? obj.reason : 'Agent 工作流生成',
        risks: Array.isArray(obj.risks) ? obj.risks.filter((r): r is string => typeof r === 'string') : [],
        alternatives: Array.isArray(obj.alternatives) ? obj.alternatives.filter((a): a is string => typeof a === 'string') : [],
        accepted: typeof obj.accepted === 'boolean' ? obj.accepted : false,
        editedByUser: false,
        source: 'ai',
      };
    }
  }

  // Plain value — wrap in AiSuggestion
  if (Array.isArray(value)) {
    return {
      value: value.filter((v): v is string => typeof v === 'string'),
      reason: 'Agent 工作流生成',
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source: 'ai',
    };
  }

  const strValue = typeof value === 'string' ? value : String(value ?? '');
  return {
    value: strValue,
    reason: 'Agent 工作流生成',
    risks: [],
    alternatives: [],
    accepted: false,
    editedByUser: false,
    source: 'ai',
  };
}

/**
 * Apply an Agent-generated patch to the brief's stages.
 * Does NOT overwrite fields that were edited by the user.
 */
export function applyAgentPatchToBrief(input: {
  brief: ProductBrief;
  targetStage: string;
  patch: Record<string, unknown>;
}): Partial<ProductBrief> {
  const { brief, targetStage, patch } = input;

  // Map targetStage to the actual stage key
  const stageKeyMap: Record<string, string> = {
    discovery: 'discovery',
    product: 'product',
    mvp: 'mvp',
    technical: 'technical',
    blindSpot: 'blindSpot',
    finalHandoff: 'finalHandoff',
    none: 'none',
  };

  const stageKey = stageKeyMap[targetStage];
  if (!stageKey || stageKey === 'none') return {};

  // For finalHandoff, we return a separate type
  if (stageKey === 'finalHandoff') {
    return {};
  }

  const currentStage = (brief.stages as unknown as Record<string, Record<string, AiSuggestion | undefined>>)[stageKey];
  if (!currentStage) return {};

  const updatedStage: Record<string, AiSuggestion> = {};

  for (const [key, value] of Object.entries(patch)) {
    // Skip if field was edited by user
    const existing = currentStage[key];
    if (existing?.editedByUser) {
      continue;
    }

    const suggestion = toSuggestion(value);
    updatedStage[key] = suggestion;
  }

  if (Object.keys(updatedStage).length === 0) return {};

  return {
    stages: {
      ...brief.stages,
      [stageKey]: {
        ...currentStage,
        ...updatedStage,
      },
    },
  } as Partial<ProductBrief>;
}
