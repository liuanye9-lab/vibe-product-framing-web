export interface HandoffTrace {
  id: string;
  briefId: string;
  createdAt: string;
  mode: 'local' | 'ai';
  rawIdea: string;
  retrievedDocIds: string[];
  retrievalExplanation: string;
  evaluationScore: number;
  readiness: 'ready' | 'needs-review' | 'not-ready';
  issueCount: number;
  previousScore?: number;
  scoreDelta?: number;
  previousReadiness?: 'ready' | 'needs-review' | 'not-ready';
  fixedIssueCount?: number;
  appliedFixIds?: string[];
  remainingIssues?: string[];
  summary?: string;
}
