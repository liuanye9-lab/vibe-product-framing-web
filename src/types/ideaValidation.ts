/**
 * Idea Validation Types — V6.0
 *
 * Type definitions for the Idea Validation Agent Workflow.
 * All types must be serializable (no functions in state).
 */

// ─── Enums ────────────────────────────────────────────────────────────────────

export type IdeaGoalType =
  | 'personal_efficiency'
  | 'portfolio'
  | 'job_interview'
  | 'commercialization'
  | 'technical_practice'
  | 'unknown';

export type ValidationDecision =
  | 'do'
  | 'do_not_do'
  | 'validate_first'
  | 'pivot';

export type ResearchSourceType =
  | 'github'
  | 'paper'
  | 'company'
  | 'web'
  | 'user';

export type ValidationNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'waiting_user'
  | 'skipped';

// ─── Core Task ────────────────────────────────────────────────────────────────

export interface IdeaValidationTask {
  id: string;
  schemaVersion?: string;
  version?: number;
  rawIdea: string;
  clarifiedIdea?: string;
  goalType: IdeaGoalType;
  targetUser?: string;
  useCase?: string;
  successDefinition?: string;
  status: ValidationNodeStatus;
  progressPercent: number;
  currentNodeId?: string;
  nodes: IdeaValidationNode[];
  research: ResearchBundle;
  evaluation?: OpportunityEvaluation;
  evaluatorReport?: ValidationEvaluatorReport;
  decision?: FinalValidationDecision;
  history?: IdeaValidationHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// ─── Workflow Nodes ───────────────────────────────────────────────────────────

export type IdeaValidationNodeKey =
  | 'idea_intake'
  | 'clarification'
  | 'query_planning'
  | 'github_research'
  | 'paper_research'
  | 'competitor_research'
  | 'opportunity_evaluation'
  | 'evaluator'
  | 'decision'
  | 'handoff';

export interface IdeaValidationNode {
  id: string;
  key: IdeaValidationNodeKey;
  title: string;
  status: ValidationNodeStatus;
  progressPercent: number;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: IdeaValidationError;
  startedAt?: string;
  completedAt?: string;
}

// ─── Research ─────────────────────────────────────────────────────────────────

export interface ResearchQueryPlan {
  githubQueries: string[];
  paperQueries: string[];
  companyQueries: string[];
  keywords: string[];
  negativeKeywords: string[];
}

export interface ResearchBundle {
  queryPlan?: ResearchQueryPlan;
  githubRepos: GitHubReference[];
  papers: PaperReference[];
  competitors: CompetitorReference[];
  evidenceItems: EvidenceItem[];
}

export interface GitHubReference {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  stars?: number;
  forks?: number;
  language?: string;
  updatedAt?: string;
  license?: string;
  readmeSummary?: string;
  whatItDoes: string;
  whatToBorrow: string[];
  limitations: string[];
  relevanceScore: number;
}

export interface PaperReference {
  id: string;
  title: string;
  url?: string;
  year?: number;
  authors?: string[];
  abstract?: string;
  summary: string;
  usefulConcepts: string[];
  howToUseInProject: string;
  relevanceScore: number;
}

export interface CompetitorReference {
  id: string;
  name: string;
  url?: string;
  type: 'startup' | 'big_tech' | 'open_source' | 'saas' | 'unknown';
  positioning: string;
  targetUser?: string;
  businessModel?: string;
  strengths: string[];
  weaknesses: string[];
  opportunityGap: string[];
  relevanceScore: number;
}

export interface EvidenceItem {
  id: string;
  sourceType: ResearchSourceType;
  title: string;
  url?: string;
  claim: string;
  evidenceText: string;
  confidence: number;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface OpportunityEvaluation {
  demandStrength: number;
  userClarity: number;
  competitorMaturity: number;
  differentiationSpace: number;
  technicalFeasibility: number;
  commercializationPotential: number;
  portfolioValue: number;
  agentWorkflowValue: number;
  overallScore: number;
  keyReasons: string[];
  keyRisks: string[];
  missingEvidence: string[];
}

export interface ValidationEvaluatorReport {
  summary: string;
  completenessScore: number;
  feasibilityScore: number;
  evidenceScore: number;
  decisionReadinessScore: number;
  overallScore: number;
  relatedOpenSourceProjects: Array<{
    name: string;
    url: string;
    stars?: number;
    whatToBorrow: string[];
    relevanceScore: number;
  }>;
  borrowableApproaches: string[];
  paperReferences: Array<{
    title: string;
    url?: string;
    year?: number;
    usefulConcepts: string[];
    howToUseInProject: string;
    relevanceScore: number;
  }>;
  matureProjectAnalysis: Array<{
    name: string;
    url?: string;
    positioning: string;
    strengths: string[];
    weaknesses: string[];
    opportunityGap: string[];
    relevanceScore: number;
  }>;
  worthDoingDecision: ValidationDecision;
  worthDoingReason: string;
  missingInputs: string[];
  evaluatorWarnings: string[];
}

export interface IdeaValidationHistoryEntry {
  id: string;
  version: number;
  event: string;
  nodeKey?: IdeaValidationNodeKey;
  summary: string;
  createdAt: string;
}

// ─── Decision ─────────────────────────────────────────────────────────────────

export interface FinalValidationDecision {
  decision: ValidationDecision;
  recommendation: string;
  bestPositioning: string;
  shouldBuildMVP: boolean;
  shouldGenerateDevSpec: boolean;
  nextValidationActions: string[];
  why: string[];
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface IdeaValidationError {
  code:
    | 'api_unavailable'
    | 'search_api_unavailable'
    | 'github_rate_limited'
    | 'paper_search_failed'
    | 'competitor_search_failed'
    | 'llm_parse_failed'
    | 'no_evidence_found'
    | 'unknown';
  message: string;
  recoverable: boolean;
  retryable: boolean;
  rawPreview?: string;
}

// ─── Goal Labels ──────────────────────────────────────────────────────────────

export const IDEA_GOAL_LABELS: Record<IdeaGoalType, string> = {
  personal_efficiency: '提升个人效率',
  portfolio: '作品集展示',
  job_interview: '求职面试',
  commercialization: '商业化',
  technical_practice: '技术练习',
  unknown: '不确定',
};

export const VALIDATION_DECISION_LABELS: Record<ValidationDecision, string> = {
  do: '建议做',
  do_not_do: '不建议做',
  validate_first: '先验证再决定',
  pivot: '建议转型',
};

export const VALIDATION_NODE_LABELS: Record<IdeaValidationNodeKey, string> = {
  idea_intake: '接收想法',
  clarification: '澄清需求',
  query_planning: '规划搜索',
  github_research: 'GitHub 研究',
  paper_research: '论文研究',
  competitor_research: '竞品研究',
  opportunity_evaluation: '机会评估',
  evaluator: 'Evaluator 复核',
  decision: '决策建议',
  handoff: '开发交接',
};

export const VALIDATION_NODE_ICONS: Record<IdeaValidationNodeKey, string> = {
  idea_intake: '💡',
  clarification: '❓',
  query_planning: '🗺️',
  github_research: '📦',
  paper_research: '📄',
  competitor_research: '🏢',
  opportunity_evaluation: '📊',
  evaluator: '🔎',
  decision: '✅',
  handoff: '🚀',
};
