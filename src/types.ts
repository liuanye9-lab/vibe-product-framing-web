export interface StepData {
  userAnswer: string;
  aiEvaluation: string;
  aiQuality: 'specific' | 'ok' | 'vague';
  aiFollowUp: string;
  isCompleted: boolean;
}

export interface ProductBrief {
  id: string;
  createdAt: string;
  rawIdea: string;
  steps: Record<string, StepData>;
  developmentPrompt: string;
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
