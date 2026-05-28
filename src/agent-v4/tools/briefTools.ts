/**
 * Brief Tools — tools that modify ProductBrief stages.
 */

import type { ProductBrief, AiSuggestion, FramingStage, OutputSource, SuggestionValue, FinalHandoff } from '../../types';
import type { AgentGraphState } from '../types';
import { makeToolResult, type AgentToolResult } from './toolTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeString(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((v) => normalizeString(v)).filter(Boolean).join('；');
  try { return JSON.stringify(value); } catch { return String(value); }
}

function normalizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => normalizeString(v)).filter(Boolean).slice(0, 10);
}

function normalizeSource(value: unknown): OutputSource {
  return value === 'ai' || value === 'local-rule' ? value : 'local-rule';
}

/** Convert a raw value to an AiSuggestion. */
function toAiSuggestion(raw: unknown, key: string): AiSuggestion {
  if (isRecord(raw)) {
    const existing = raw as unknown as AiSuggestion;
    if (existing.editedByUser) return existing;
    return {
      value: (Array.isArray(existing.value) ? existing.value : normalizeString(existing.value)) as SuggestionValue,
      reason: normalizeString(existing.reason) || `Agent 对 ${key} 的判断`,
      risks: normalizeList(existing.risks),
      alternatives: normalizeList(existing.alternatives),
      accepted: Boolean(existing.accepted),
      editedByUser: Boolean(existing.editedByUser),
      source: normalizeSource(existing.source),
    };
  }

  if (Array.isArray(raw)) {
    return {
      value: normalizeList(raw),
      reason: `Agent 对 ${key} 的判断`,
      risks: [],
      alternatives: [],
      accepted: false,
      editedByUser: false,
      source: 'local-rule',
    };
  }

  return {
    value: normalizeString(raw),
    reason: `Agent 对 ${key} 的判断`,
    risks: [],
    alternatives: [],
    accepted: false,
    editedByUser: false,
    source: 'local-rule',
  };
}

/** Patch a stage record, only updating fields that are not edited by user. */
function patchStage(
  existing: Record<string, AiSuggestion | undefined>,
  patch: Record<string, unknown>,
  source: OutputSource,
): Record<string, AiSuggestion | undefined> {
  const result = { ...existing };
  for (const [key, rawValue] of Object.entries(patch)) {
    if (rawValue === undefined || rawValue === null) continue;
    const existingField = result[key];
    if (existingField?.editedByUser) continue;
    const suggestion = toAiSuggestion(rawValue, key);
    suggestion.source = source;
    result[key] = suggestion;
  }
  return result;
}

export function updateBriefStage(input: {
  brief: ProductBrief;
  state: AgentGraphState;
  payload: Record<string, unknown>;
}): AgentToolResult {
  const p = input.payload;
  const targetStage = String(p.targetStage || '');
  const patch = isRecord(p.patch) ? p.patch : {};
  const source = normalizeSource(p.source || 'local-rule');

  const validStages: FramingStage[] = ['discovery', 'product', 'business', 'technical', 'mvp', 'blindSpot'];
  if (!validStages.includes(targetStage as FramingStage) && targetStage !== 'finalHandoff') {
    return makeToolResult(false, `Invalid stage: ${targetStage}`);
  }

  // Handle finalHandoff separately
  if (targetStage === 'finalHandoff') {
    const handoffPatch = patch as Partial<FinalHandoff>;
    const existing = input.brief.finalHandoff || {
      schemaVersion: 'v1.4',
      productBrief: '',
      mvpScope: '',
      devSpec: '',
      technicalArchitecture: '',
      dataStructure: '',
      acceptanceCriteria: '',
      developmentPrompt: '',
      source: 'local-rule' as OutputSource,
    };
    const updated: FinalHandoff = {
      ...existing,
      productBrief: handoffPatch.productBrief || existing.productBrief,
      mvpScope: handoffPatch.mvpScope || existing.mvpScope,
      devSpec: handoffPatch.devSpec || existing.devSpec,
      technicalArchitecture: handoffPatch.technicalArchitecture || existing.technicalArchitecture,
      dataStructure: handoffPatch.dataStructure || existing.dataStructure,
      acceptanceCriteria: handoffPatch.acceptanceCriteria || existing.acceptanceCriteria,
      developmentPrompt: handoffPatch.developmentPrompt || existing.developmentPrompt,
      source: handoffPatch.source || source,
    };

    return makeToolResult(true, `Updated finalHandoff`, {
      briefPatch: { finalHandoff: updated } as Partial<ProductBrief>,
    });
  }

  // Patch stage
  const stage = targetStage as FramingStage;
  const existingStage = input.brief.stages[stage] as Record<string, AiSuggestion | undefined>;
  const patched = patchStage(existingStage || {}, patch, source);

  const stagesPatch: Partial<ProductBrief['stages']> = {};
  (stagesPatch as Record<string, unknown>)[stage] = patched;

  return makeToolResult(true, `Updated stage: ${targetStage}`, {
    briefPatch: { stages: { ...input.brief.stages, ...stagesPatch } },
  });
}
