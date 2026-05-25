export type SuggestionValue = string | string[] | number | boolean;

export type OutputSource = 'ai' | 'mock' | 'local-rule';

export type ProjectType = 'Web App' | 'AI Agent' | 'SaaS' | 'Portfolio' | 'Other';

export type CopilotMode = 'beginner' | 'builder' | 'review';

export type FramingStage = 'discovery' | 'product' | 'business' | 'technical' | 'mvp' | 'blindSpot';

export type DecisionStage = 'idea' | 'mvp' | 'tech' | 'handoff';

export interface CoreDecision {
  stage: DecisionStage;
  mainDecision: string;
  recommendedChoice: string;
  why: string;
  keyRisk: string;
  alternatives: string[];
  details?: string[];
}

export type GlossaryKey =
  | 'mvp'
  | 'mockStrategy'
  | 'dataStructure'
  | 'dataFlow'
  | 'backend'
  | 'database'
  | 'auth'
  | 'aiApi'
  | 'acceptanceCriteria'
  | 'valueHypothesis'
  | 'roi'
  | 'outOfScope'
  | 'scopeCreep';

export interface GlossaryItem {
  key: GlossaryKey;
  plainName: string;
  expertName: string;
  simpleExplanation: string;
  whyItMatters: string;
  example: string;
  beginnerAction: string;
}

export type SuggestionKey =
  | 'targetUserEvidence'
  | 'painFrequency'
  | 'currentAlternative'
  | 'consequenceIfUnsolved'
  | 'demandEvidence'
  | 'falsificationEvidence'
  | 'smallestValidationAction'
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
  | 'userBenefitScore'
  | 'ownerBenefitScore'
  | 'developmentCostScore'
  | 'maintenanceCostScore'
  | 'aiCostRisk'
  | 'userSwitchingCost'
  | 'roiJudgement'
  | 'reason'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'aiApi'
  | 'auth'
  | 'fileUpload'
  | 'dataFlow'
  | 'mockStrategy'
  | 'mockableParts'
  | 'mockDataExample'
  | 'realApiTrigger'
  | 'mockFailureFallback'
  | 'architectureUpgrade'
  | 'mustHave'
  | 'shouldHave'
  | 'outOfScope'
  | 'v2Later'
  | 'minimumLoop'
  | 'scopeRisks'
  | 'demandRisk'
  | 'businessRisk'
  | 'technicalRisk'
  | 'scopeRisk'
  | 'whatWouldProveWrong'
  | 'recommendedAdjustment';

export interface AiSuggestion<T = SuggestionValue> {
  value: T;
  reason: string;
  risks?: string[];
  alternatives?: string[];
  accepted: boolean;
  editedByUser: boolean;
  source?: OutputSource;
}

export interface IdeaInputState {
  rawIdea: string;
  targetUser?: string;
  scenario?: string;
  problem?: string;
  projectType?: ProjectType;
}

export interface DemandDiscoveryState {
  targetUserEvidence?: AiSuggestion<string>;
  painFrequency?: AiSuggestion<string>;
  currentAlternative?: AiSuggestion<string>;
  consequenceIfUnsolved?: AiSuggestion<string>;
  demandEvidence?: AiSuggestion<string[]>;
  falsificationEvidence?: AiSuggestion<string[]>;
  smallestValidationAction?: AiSuggestion<string>;
}

export interface ProductFramingState {
  productOneLiner?: AiSuggestion<string>;
  targetUser?: AiSuggestion<string>;
  scenario?: AiSuggestion<string>;
  corePainPoint?: AiSuggestion<string>;
  alternatives?: AiSuggestion<string[]>;
  aiValue?: AiSuggestion<string>;
}

export interface BusinessRoi {
  userBenefitScore?: AiSuggestion<number>;
  ownerBenefitScore?: AiSuggestion<number>;
  developmentCostScore?: AiSuggestion<number>;
  maintenanceCostScore?: AiSuggestion<number>;
  aiCostRisk?: AiSuggestion<string>;
  userSwitchingCost?: AiSuggestion<string>;
  roiJudgement?: AiSuggestion<'positive' | 'uncertain' | 'negative'>;
  reason?: AiSuggestion<string>;
}

export interface BusinessFramingState {
  userValue?: AiSuggestion<string>;
  ownerValue?: AiSuggestion<string>;
  valueHypothesis?: AiSuggestion<string>;
  metrics?: AiSuggestion<string[]>;
  monetization?: AiSuggestion<string>;
  risksAndBlindSpots?: AiSuggestion<string[]>;
  roi?: BusinessRoi;
}

export interface TechnicalTranslation {
  userNeed: string;
  requiredCapability: string;
  v1Implementation: string;
  whyThisIsEnough: string;
  upgradeCondition: string;
  risks?: string[];
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
  mockableParts?: AiSuggestion<string[]>;
  mockDataExample?: AiSuggestion<string>;
  realApiTrigger?: AiSuggestion<string>;
  mockFailureFallback?: AiSuggestion<string>;
  architectureUpgrade?: AiSuggestion<string>;
  translations?: TechnicalTranslation[];
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

export interface BlindSpotReviewState {
  demandRisk?: AiSuggestion<string[]>;
  businessRisk?: AiSuggestion<string[]>;
  technicalRisk?: AiSuggestion<string[]>;
  scopeRisk?: AiSuggestion<string[]>;
  whatWouldProveWrong?: AiSuggestion<string[]>;
  recommendedAdjustment?: AiSuggestion<string[]>;
}

export interface FinalHandoff {
  productBrief: string;
  mvpScope: string;
  technicalArchitecture: string;
  dataStructure: string;
  acceptanceCriteria: string;
  developmentPrompt: string;
  source?: OutputSource;
}

export interface CopilotStages {
  discovery: DemandDiscoveryState;
  product: ProductFramingState;
  business: BusinessFramingState;
  technical: TechnicalPlanningState;
  mvp: MvpScopeState;
  blindSpot: BlindSpotReviewState;
}

export interface ProductBrief {
  id: string;
  createdAt: string;
  updatedAt: string;
  rawIdea: string;
  ideaInput: IdeaInputState;
  mode: CopilotMode;
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
  source?: OutputSource;
}
