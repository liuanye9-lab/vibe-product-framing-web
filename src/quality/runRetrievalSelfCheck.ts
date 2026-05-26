import { retrieveKnowledge } from '../knowledge/retrieveKnowledge';
import { SAMPLE_IDEAS } from './sampleIdeas';

export interface RetrievalSelfCheckResult {
  input: string;
  passed: boolean;
  retrievedDocIds: string[];
  expectedDocs: string[];
  shouldNotPrefer?: string[];
  issues: string[];
}

export function runRetrievalSelfCheck(): RetrievalSelfCheckResult[] {
  return SAMPLE_IDEAS.map((sample) => {
    const result = retrieveKnowledge({ rawIdea: sample.input, maxDocs: 4 });
    const retrievedDocIds = result.items.map((item) => item.doc.id);
    const issues: string[] = [];
    const expectedInTopTwo = sample.expectedDocs.some((docId) => retrievedDocIds.slice(0, 2).includes(docId));
    if (!expectedInTopTwo) {
      issues.push(`Expected one of ${sample.expectedDocs.join(', ')} in top 2.`);
    }
    const first = retrievedDocIds[0];
    if (sample.shouldNotPrefer?.includes(first)) {
      issues.push(`Should not prefer ${first} as the top result.`);
    }
    return {
      input: sample.input,
      passed: issues.length === 0,
      retrievedDocIds,
      expectedDocs: sample.expectedDocs,
      shouldNotPrefer: sample.shouldNotPrefer,
      issues,
    };
  });
}
