export type SuggestionValue = string | string[];

export type ProjectType = 'Web App' | 'AI Agent' | 'SaaS' | 'Portfolio' | 'Other';

export type FramingStage = 'product' | 'business' | 'technical' | 'mvp';

export type SuggestionKey =
  | 'productOneLiner'
  | 'targetUser'
  | 'scenario'
  | 'corePainPoint'
  | 'alternatives'
  | 'aiValue'
  | 'userValue'
  | 'ownerValue'
  | 'valueHypothesis'
  | 'metrics'
  | 'monetization'
  | 'risksAndBlindSpots'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'aiApi'
  | 'auth'
  | 'fileUpload'
  | 'dataFlow'
  | 'mockStrategy'
  | 'architectureUpgrade'
  | 'mustHave'
  | 'shouldHave'
  | 'outOfScope'
  | 'v2Later'
  | 'minimumLoop'
  | 'scopeRisks';

export interface AiSuggestion<T = SuggestionValue> {
  value: T;
  reason: string;
  risks?: string[];
  alternatives?: string[];
  accepted: boolean;
  editedByUser: boolean;
}

export interface IdeaInputState {
  rawIdea: string;
  targetUser?: string;
  scenario?: string;
  problem?: string;
  projectType?: ProjectType;
}

export interface ProductFramingState {
  productOneLiner?: AiSuggestion<string>;
  targetUser?: AiSuggestion<string>;
  scenario?: AiSuggestion<string>;
  corePainPoint?: AiSuggestion<string>;
  alternatives?: AiSuggestion<string[]>;
  aiValue?: AiSuggestion<string>;
}

export interface BusinessFramingState {
  userValue?: AiSuggestion<string>;
  ownerValue?: AiSuggestion<string>;
  valueHypothesis?: AiSuggestion<string>;
  metrics?: AiSuggestion<string[]>;
  monetization?: AiSuggestion<string>;
  risksAndBlindSpots?: AiSuggestion<string[]>;
}

export interface TechnicalPlanningState {
  frontend?: AiSuggestion<string>;
  backend?: AiSuggestion<string>;
  database?: AiSuggestion<string>;
  aiApi?: AiSuggestion<string>;
  auth?: AiSuggestion<string>;
  fileUpload?: AiSuggestion<string>;
  dataFlow?: AiSuggestion<string>;
  mockStrategy?: AiSuggestion<string>;
  architectureUpgrade?: AiSuggestion<string>;
}

export interface MvpScopeState {
  mustHave?: AiSuggestion<string[]>;
  shouldHave?: AiSuggestion<string[]>;
  outOfScope?: AiSuggestion<string[]>;
  v2Later?: AiSuggestion<string[]>;
  minimumLoop?: AiSuggestion<string>;
  scopeRisks?: AiSuggestion<string[]>;
  scopeCreepWarning?: string;
}

export interface FinalHandoff {
  productBrief: string;
  mvpScope: string;
  technicalArchitecture: string;
  dataStructure: string;
  acceptanceCriteria: string;
  developmentPrompt: string;
}

export interface CopilotStages {
  product: ProductFramingState;
  business: BusinessFramingState;
  technical: TechnicalPlanningState;
  mvp: MvpScopeState;
}

export interface ProductBrief {
  id: string;
  createdAt: string;
  updatedAt: string;
  rawIdea: string;
  ideaInput: IdeaInputState;
  stages: CopilotStages;
  finalHandoff?: FinalHandoff;
  developmentPrompt: string;
  steps: Record<string, StepData>;
}

// Legacy compatibility types. Old pages/history may still read these while localStorage is migrated.
export interface StepData {
  userAnswer: string;
  aiEvaluation: string;
  aiQuality: 'specific' | 'ok' | 'vague';
  aiFollowUp: string;
  isCompleted: boolean;
}

export type StepKey =
  | 'targetUser'
  | 'scenario'
  | 'painPoint'
  | 'alternatives'
  | 'aiValue'
  | 'mvpScope'
  | 'outOfScope'
  | 'techStack'
  | 'dataStructure'
  | 'acceptanceCriteria';

export interface EvaluateIdeaResult {
  score: number;
  mainIssue: string;
  missingFields: string[];
  riskFlags: string[];
}
