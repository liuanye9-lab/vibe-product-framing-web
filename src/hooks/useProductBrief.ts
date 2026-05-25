import { useState, useEffect, useCallback } from 'react';
import type {
  AiSuggestion,
  BusinessFramingState,
  BusinessRoi,
  CopilotMode,
  CopilotStages,
  DemandDiscoveryState,
  FinalHandoff,
  FramingStage,
  IdeaInputState,
  MvpScopeState,
  ProductBrief,
  ProductFramingState,
  StepData,
  SuggestionKey,
  TechnicalPlanningState,
  BlindSpotReviewState,
} from '../types';
import { STEP_KEYS } from '../data/steps';
import { toDisplayList, toDisplayText } from '../lib/utils';

const STORAGE_KEY = 'vibepilot_briefs';
const CURRENT_KEY = 'vibepilot_current_id';

function createEmptyStep(): StepData {
  return {
    userAnswer: '',
    aiEvaluation: '',
    aiQuality: 'vague',
    aiFollowUp: '',
    isCompleted: false,
  };
}

function createLegacySteps(): Record<string, StepData> {
  const steps: Record<string, StepData> = {};
  STEP_KEYS.forEach((k) => {
    steps[k] = createEmptyStep();
  });
  return steps;
}

function createEmptyStages(): CopilotStages {
  return {
    discovery: {},
    product: {},
    business: {},
    technical: {},
    mvp: {},
    blindSpot: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeSource(value: unknown): AiSuggestion['source'] {
  return value === 'ai' || value === 'mock' || value === 'local-rule' ? value : 'local-rule';
}

function normalizeSuggestion(raw: unknown): AiSuggestion | undefined {
  if (!isRecord(raw)) return undefined;
  const rawValue = 'value' in raw ? raw.value : '';
  const value = Array.isArray(rawValue)
    ? toDisplayList(rawValue)
    : typeof rawValue === 'number' || typeof rawValue === 'boolean'
      ? rawValue
      : toDisplayText(rawValue);

  return {
    value,
    reason: toDisplayText(raw.reason),
    risks: toDisplayList(raw.risks),
    alternatives: toDisplayList(raw.alternatives),
    accepted: Boolean(raw.accepted),
    editedByUser: Boolean(raw.editedByUser),
    source: normalizeSource(raw.source),
  };
}

function normalizeSuggestionRecord<T extends object>(raw: unknown): T {
  if (!isRecord(raw)) return {} as T;
  const output: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const normalized = normalizeSuggestion(value);
    if (normalized) output[key] = normalized;
  });
  return output as T;
}

function normalizeTranslations(raw: unknown): TechnicalPlanningState['translations'] {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter(isRecord)
    .map((row) => ({
      userNeed: toDisplayText(row.userNeed),
      requiredCapability: toDisplayText(row.requiredCapability),
      v1Implementation: toDisplayText(row.v1Implementation),
      whyThisIsEnough: toDisplayText(row.whyThisIsEnough),
      upgradeCondition: toDisplayText(row.upgradeCondition),
      risks: toDisplayList(row.risks),
    }));
}

function normalizeTechnicalStage(raw: unknown): TechnicalPlanningState {
  const stage = normalizeSuggestionRecord<TechnicalPlanningState>(raw);
  if (isRecord(raw)) {
    const translations = normalizeTranslations(raw.translations);
    if (translations) stage.translations = translations;
  }
  return stage;
}

function normalizeBusinessStage(raw: unknown): BusinessFramingState {
  const stage = normalizeSuggestionRecord<BusinessFramingState>(raw);
  if (isRecord(raw) && isRecord(raw.roi)) {
    stage.roi = normalizeSuggestionRecord<BusinessRoi>(raw.roi);
  }
  return stage;
}

function normalizeFinalHandoff(raw: unknown): FinalHandoff | undefined {
  if (!isRecord(raw)) return undefined;
  return {
    productBrief: toDisplayText(raw.productBrief),
    mvpScope: toDisplayText(raw.mvpScope),
    technicalArchitecture: toDisplayText(raw.technicalArchitecture),
    dataStructure: toDisplayText(raw.dataStructure),
    acceptanceCriteria: toDisplayText(raw.acceptanceCriteria),
    developmentPrompt: toDisplayText(raw.developmentPrompt),
    source: normalizeSource(raw.source),
  };
}

function suggestion<T>(value: T, reason = '由已有输入推断生成，可继续编辑。'): AiSuggestion<T> {
  return {
    value,
    reason,
    risks: [],
    alternatives: [],
    accepted: false,
    editedByUser: false,
    source: 'local-rule',
  };
}

function createEmptyBrief(id: string, ideaInput: IdeaInputState | string, mode: CopilotMode = 'beginner'): ProductBrief {
  const input: IdeaInputState = typeof ideaInput === 'string' ? { rawIdea: ideaInput } : ideaInput;
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    rawIdea: input.rawIdea,
    ideaInput: input,
    mode,
    stages: createEmptyStages(),
    developmentPrompt: '',
    steps: createLegacySteps(),
  };
}

function migrateLegacySteps(brief: Partial<ProductBrief>): CopilotStages {
  const stages = createEmptyStages();
  const steps = brief.steps || {};

  const getAnswer = (key: string) => steps[key]?.userAnswer || '';
  const getReason = (key: string) => steps[key]?.aiEvaluation || '从旧版问卷答案迁移。';

  const targetUser = getAnswer('targetUser');
  if (targetUser) stages.product.targetUser = suggestion(targetUser, getReason('targetUser'));
  const scenario = getAnswer('scenario');
  if (scenario) stages.product.scenario = suggestion(scenario, getReason('scenario'));
  const painPoint = getAnswer('painPoint');
  if (painPoint) stages.product.corePainPoint = suggestion(painPoint, getReason('painPoint'));
  const alternatives = getAnswer('alternatives');
  if (alternatives) stages.product.alternatives = suggestion([alternatives], getReason('alternatives'));
  const aiValue = getAnswer('aiValue');
  if (aiValue) stages.product.aiValue = suggestion(aiValue, getReason('aiValue'));

  const techStack = getAnswer('techStack');
  if (techStack) stages.technical.frontend = suggestion(techStack, getReason('techStack'));
  const dataStructure = getAnswer('dataStructure');
  if (dataStructure) stages.technical.dataFlow = suggestion(dataStructure, getReason('dataStructure'));

  const mvpScope = getAnswer('mvpScope');
  if (mvpScope) stages.mvp.mustHave = suggestion([mvpScope], getReason('mvpScope'));
  const outOfScope = getAnswer('outOfScope');
  if (outOfScope) stages.mvp.outOfScope = suggestion([outOfScope], getReason('outOfScope'));

  return stages;
}

export function normalizeBrief(brief: Partial<ProductBrief> & { id?: string; rawIdea?: string }): ProductBrief {
  const ideaInput: IdeaInputState = {
    rawIdea: brief.ideaInput?.rawIdea || brief.rawIdea || '',
    targetUser: brief.ideaInput?.targetUser,
    scenario: brief.ideaInput?.scenario,
    problem: brief.ideaInput?.problem,
    projectType: brief.ideaInput?.projectType,
  };
  const normalized = createEmptyBrief(brief.id || `pb-${Date.now()}`, ideaInput, brief.mode || 'beginner');
  normalized.createdAt = brief.createdAt || normalized.createdAt;
  normalized.updatedAt = brief.updatedAt || normalized.createdAt;
  const normalizedHandoff = normalizeFinalHandoff(brief.finalHandoff);
  normalized.developmentPrompt = toDisplayText(brief.developmentPrompt || normalizedHandoff?.developmentPrompt || '');
  normalized.finalHandoff = normalizedHandoff;

  const sourceSteps = brief.steps || {};
  STEP_KEYS.forEach((key) => {
    normalized.steps![key] = {
      ...createEmptyStep(),
      ...(sourceSteps as Record<string, Partial<StepData> | undefined>)[key],
    };
  });

  const migratedStages = migrateLegacySteps(brief);
  normalized.stages = {
    discovery: normalizeSuggestionRecord<DemandDiscoveryState>(brief.stages?.discovery),
    product: {
      ...migratedStages.product,
      ...normalizeSuggestionRecord<ProductFramingState>(brief.stages?.product),
    },
    business: {
      ...migratedStages.business,
      ...normalizeBusinessStage(brief.stages?.business),
    },
    technical: {
      ...migratedStages.technical,
      ...normalizeTechnicalStage(brief.stages?.technical),
    },
    mvp: {
      ...migratedStages.mvp,
      ...normalizeSuggestionRecord<MvpScopeState>(brief.stages?.mvp),
    },
    blindSpot: normalizeSuggestionRecord<BlindSpotReviewState>(brief.stages?.blindSpot),
  };

  return normalized;
}

export function useProductBrief(id?: string) {
  const [brief, setBrief] = useState<ProductBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      const all = loadAll();
      const found = all.find((b) => b.id === id);
      if (found) {
        setBrief(normalizeBrief(found));
      } else {
        setBrief(createEmptyBrief(id, { rawIdea: '' }));
      }
    }
    setLoading(false);
  }, [id]);

  const save = useCallback((updated: ProductBrief) => {
    const normalized = normalizeBrief({ ...updated, updatedAt: new Date().toISOString() });
    setBrief(normalized);
    const all = loadAll();
    const idx = all.findIndex((b) => b.id === normalized.id);
    if (idx >= 0) {
      all[idx] = normalized;
    } else {
      all.push(normalized);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }, []);

  const initBrief = useCallback((ideaInput: IdeaInputState | string, mode: CopilotMode = 'beginner'): ProductBrief => {
    const newId = `pb-${Date.now()}`;
    const newBrief = createEmptyBrief(newId, ideaInput, mode);
    save(newBrief);
    localStorage.setItem(CURRENT_KEY, newId);
    return newBrief;
  }, [save]);

  const updateIdeaInput = useCallback((input: Partial<IdeaInputState>) => {
    if (!brief) return;
    const ideaInput = { ...brief.ideaInput, ...input };
    save({ ...brief, rawIdea: ideaInput.rawIdea, ideaInput });
  }, [brief, save]);

  const updateStage = useCallback(<T extends DemandDiscoveryState | ProductFramingState | BusinessFramingState | TechnicalPlanningState | MvpScopeState | BlindSpotReviewState>(
    stage: FramingStage,
    data: Partial<T>
  ) => {
    if (!brief) return;
    save({
      ...brief,
      stages: {
        ...brief.stages,
        [stage]: {
          ...brief.stages[stage],
          ...data,
        },
      },
    });
  }, [brief, save]);

  const updateSuggestion = useCallback((stage: FramingStage, key: SuggestionKey, data: Partial<AiSuggestion>) => {
    if (!brief) return;
    const currentStage = brief.stages[stage] as Record<string, AiSuggestion | undefined>;
    const current = currentStage[key] || suggestion('');
    save({
      ...brief,
      stages: {
        ...brief.stages,
        [stage]: {
          ...currentStage,
          [key]: {
            ...current,
            ...data,
          },
        },
      },
    });
  }, [brief, save]);

  const saveFinalHandoff = useCallback((finalHandoff: FinalHandoff) => {
    if (!brief) return;
    save({
      ...brief,
      finalHandoff,
      developmentPrompt: finalHandoff.developmentPrompt,
    });
  }, [brief, save]);

  const updateStep = useCallback(
    (stepKey: string, data: Partial<StepData>) => {
      if (!brief) return;
      const steps = brief.steps || createLegacySteps();
      const updated = {
        ...brief,
        steps: {
          ...steps,
          [stepKey]: { ...steps[stepKey], ...data },
        },
      };
      save(updated);
    },
    [brief, save]
  );

  return { brief, loading, save, initBrief, updateIdeaInput, updateStage, updateSuggestion, saveFinalHandoff, updateStep };
}

function loadAll(): ProductBrief[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item) => normalizeBrief(item as Partial<ProductBrief>));
  } catch {
    return [];
  }
}

export function getCurrentBriefId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}
