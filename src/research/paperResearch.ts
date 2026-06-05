/**
 * Paper Research Adapter — V6.0
 *
 * Searches for academic papers via /api/research-proxy.
 * - Uses Semantic Scholar or arXiv
 * - Never fabricates results
 * - Returns search_api_unavailable if no API key configured
 */

import type { PaperReference, IdeaValidationError } from '../types/ideaValidation';
import type { ResearchProxyResponse } from './researchTypes';
import { scorePaper, sortByRelevance, deduplicateByField } from './researchScoring';

interface PaperSearchResult {
  items: PaperReference[];
  error?: IdeaValidationError;
}

export async function searchPaperReferences(input: {
  queries: string[];
  limitPerQuery?: number;
  keywords?: string[];
}): Promise<PaperSearchResult> {
  const { queries, limitPerQuery = 5, keywords = [] } = input;
  const allPapers: PaperReference[] = [];
  let lastError: IdeaValidationError | undefined;

  for (const query of queries) {
    try {
      const res = await fetch('/api/research-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'paper',
          query,
          limit: Math.min(limitPerQuery, 10),
        }),
      });

      if (!res.ok) {
        lastError = {
          code: 'paper_search_failed',
          message: `Paper search failed: HTTP ${res.status}`,
          recoverable: true,
          retryable: true,
        };
        continue;
      }

      const data: ResearchProxyResponse = await res.json();

      if (!data.ok || data.error) {
        lastError = {
          code: 'search_api_unavailable',
          message: data.error ?? 'Paper search returned no results',
          recoverable: true,
          retryable: true,
        };
        continue;
      }

      const papers: PaperReference[] = data.items.map((item) => ({
        id: item.url ?? `paper_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: item.title,
        url: item.url,
        year: item.year,
        authors: item.authors,
        abstract: item.abstract,
        summary: item.description ?? item.snippet ?? '',
        usefulConcepts: [],
        howToUseInProject: '',
        relevanceScore: scorePaper(
          {
            year: item.year,
            abstract: item.abstract,
            title: item.title,
          },
          keywords.length > 0 ? keywords : [query],
        ),
      }));

      allPapers.push(...papers);
    } catch (err) {
      lastError = {
        code: 'paper_search_failed',
        message: err instanceof Error ? err.message : 'Unknown paper search error',
        recoverable: true,
        retryable: true,
      };
    }
  }

  // Deduplicate and sort
  const deduplicated = deduplicateByField(allPapers, 'title');
  const sorted = sortByRelevance(deduplicated);

  return {
    items: sorted,
    error: sorted.length === 0 ? lastError : undefined,
  };
}
