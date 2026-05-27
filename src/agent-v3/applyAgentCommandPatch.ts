/**
 * Agent V3 Command Patch Applier
 *
 * Applies Agent-generated patches to ProductBrief stages via commands.
 * Supports V3 phase → stage mapping and source tracking.
 */

import type { ProductBrief, AiSuggestion, SuggestionValue, FinalHandoff, OutputSource } from '../types';

function toSuggestion(value: unknown, source: OutputSource): AiSuggestion<SuggestionValue> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) {
      return {
        value: (obj.value ?? '') as SuggestionValue,
        reason: typeof obj.reason === 'string' ? obj.reason : 'Agent 工作流生成',
        risks: Array.isArray(obj.risks) ? obj.risks.filter((r): r is string => typeof r === 'string') : [],
        alternatives: Array.isArray(obj.alternatives) ? obj.alternatives.filter((a): a is string => typeof a === 'string') : [],
        accepted: typeof obj.accepted === 'boolean' ? obj.accepted : false,
        editedByUser: false,
        source,
      };
    }
  }

  if (Array.isArray(value)) {
    return {
      value: value.filter((v): v is string => typeof v === 'string'),
      reason: 'Agent 工作流生成',
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source,
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
    source,
  };
}

// V3 phase → brief stage mapping
const PHASE_TO_STAGE: Record<string, string | null> = {
  intake: 'discovery',
  demand: 'discovery',
  product: 'product',
  mvp: 'mvp',
  tech: 'technical',
  risk: 'blindSpot',
  handoff: 'finalHandoff',
  review: null,
  complete: null,
};

export function applyAgentCommandPatchToBrief(input: {
  brief: ProductBrief;
  targetStage: string;
  patch: Record<string, unknown>;
  source: 'ai' | 'local-rule';
}): Partial<ProductBrief> {
  const { brief, targetStage, patch, source } = input;

  if (!targetStage || Object.keys(patch).length === 0) return {};

  // Resolve targetStage via V3 phase mapping
  const stageKey = PHASE_TO_STAGE[targetStage] || targetStage;
  if (!stageKey || stageKey === 'none') return {};

  // Handle finalHandoff separately
  if (stageKey === 'finalHandoff') {
    const handoffPatch = patch as unknown as Partial<FinalHandoff>;
    const existing = brief.finalHandoff || {} as FinalHandoff;
    const merged: FinalHandoff = {
      ...existing,
      productBrief: handoffPatch.productBrief || existing.productBrief || '',
      mvpScope: handoffPatch.mvpScope || existing.mvpScope || '',
      devSpec: handoffPatch.devSpec || existing.devSpec || '',
      technicalArchitecture: handoffPatch.technicalArchitecture || existing.technicalArchitecture || '',
      dataStructure: handoffPatch.dataStructure || existing.dataStructure || '',
      acceptanceCriteria: handoffPatch.acceptanceCriteria || existing.acceptanceCriteria || '',
      developmentPrompt: handoffPatch.developmentPrompt || existing.developmentPrompt || '',
      source: source as OutputSource,
    };
    return { finalHandoff: merged };
  }

  // Handle stage patches
  const currentStage = (brief.stages as unknown as Record<string, Record<string, AiSuggestion | undefined>>)[stageKey];
  if (!currentStage) return {};

  const updatedStage: Record<string, AiSuggestion> = {};

  for (const [key, value] of Object.entries(patch)) {
    const existing = currentStage[key];
    if (existing?.editedByUser) continue;
    updatedStage[key] = toSuggestion(value, source as OutputSource);
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
