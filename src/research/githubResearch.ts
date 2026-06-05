/**
 * GitHub Research Adapter — V6.0
 *
 * Searches GitHub for open-source references via /api/research-proxy.
 * - Deduplicates by fullName
 * - Scores by stars, recency, keyword relevance
 * - Never fabricates results
 */

import type { GitHubReference, IdeaValidationError } from '../types/ideaValidation';
import type { ResearchProxyResponse } from './researchTypes';
import { scoreGitHubRepo, sortByRelevance, deduplicateByField } from './researchScoring';

interface GitHubSearchResult {
  items: GitHubReference[];
  error?: IdeaValidationError;
}

export async function searchGitHubReferences(input: {
  queries: string[];
  limitPerQuery?: number;
  keywords?: string[];
}): Promise<GitHubSearchResult> {
  const { queries, limitPerQuery = 5, keywords = [] } = input;
  const allRepos: GitHubReference[] = [];
  let lastError: IdeaValidationError | undefined;

  for (const query of queries) {
    try {
      const res = await fetch('/api/research-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'github',
          query,
          limit: Math.min(limitPerQuery, 10),
        }),
      });

      if (!res.ok) {
        lastError = {
          code: 'search_api_unavailable',
          message: `GitHub search failed: HTTP ${res.status}`,
          recoverable: true,
          retryable: true,
        };
        continue;
      }

      const data: ResearchProxyResponse = await res.json();

      if (!data.ok || data.error) {
        if (data.error?.includes('rate limit')) {
          lastError = {
            code: 'github_rate_limited',
            message: 'GitHub API rate limit exceeded. Try again later.',
            recoverable: true,
            retryable: true,
          };
        } else {
          lastError = {
            code: 'search_api_unavailable',
            message: data.error ?? 'GitHub search returned no results',
            recoverable: true,
            retryable: true,
          };
        }
        continue;
      }

      const repos: GitHubReference[] = data.items.map((item) => ({
        id: item.fullName ?? item.url ?? `gh_${Date.now()}`,
        name: item.title ?? item.fullName?.split('/')[1] ?? 'unknown',
        fullName: item.fullName ?? item.title ?? 'unknown/unknown',
        url: item.url,
        description: item.description ?? '',
        stars: item.stars,
        forks: item.forks,
        language: item.language,
        updatedAt: item.updatedAt,
        license: item.license,
        readmeSummary: undefined,
        whatItDoes: item.description ?? '',
        whatToBorrow: [],
        limitations: [],
        relevanceScore: scoreGitHubRepo(
          {
            stars: item.stars,
            updatedAt: item.updatedAt,
            description: item.description,
          },
          keywords.length > 0 ? keywords : [query],
        ),
      }));

      allRepos.push(...repos);
    } catch (err) {
      lastError = {
        code: 'api_unavailable',
        message: err instanceof Error ? err.message : 'Unknown GitHub search error',
        recoverable: true,
        retryable: true,
      };
    }
  }

  // Deduplicate and sort
  const deduplicated = deduplicateByField(allRepos, 'fullName');
  const sorted = sortByRelevance(deduplicated);

  return {
    items: sorted,
    error: sorted.length === 0 ? lastError : undefined,
  };
}
