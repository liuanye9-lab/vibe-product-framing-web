/**
 * Competitor Research Adapter — V6.0
 *
 * Searches for company/competitor references via /api/research-proxy.
 * - Supports Tavily / Brave / SerpAPI / Bing via configurable provider
 * - Never fabricates companies
 * - Returns search_api_unavailable if no SEARCH_API_KEY configured
 */

import type { CompetitorReference, IdeaValidationError } from '../types/ideaValidation';
import type { ResearchProxyResponse } from './researchTypes';
import { scoreCompetitor, sortByRelevance, deduplicateByField } from './researchScoring';

interface CompetitorSearchResult {
  items: CompetitorReference[];
  error?: IdeaValidationError;
}

export async function searchCompetitorReferences(input: {
  queries: string[];
  limitPerQuery?: number;
  keywords?: string[];
}): Promise<CompetitorSearchResult> {
  const { queries, limitPerQuery = 5, keywords = [] } = input;
  const allCompetitors: CompetitorReference[] = [];
  let lastError: IdeaValidationError | undefined;

  for (const query of queries) {
    try {
      const res = await fetch('/api/research-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'web',
          query,
          limit: Math.min(limitPerQuery, 10),
        }),
      });

      if (!res.ok) {
        lastError = {
          code: 'competitor_search_failed',
          message: `Competitor search failed: HTTP ${res.status}`,
          recoverable: true,
          retryable: true,
        };
        continue;
      }

      const data: ResearchProxyResponse = await res.json();

      if (!data.ok || data.error) {
        lastError = {
          code: 'search_api_unavailable',
          message: data.error ?? 'Competitor search returned no results',
          recoverable: true,
          retryable: true,
        };
        continue;
      }

      const competitors: CompetitorReference[] = data.items.map((item) => ({
        id: item.url ?? `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: item.title ?? 'Unknown',
        url: item.url,
        type: classifyCompetitorType(item),
        positioning: item.description ?? item.snippet ?? '',
        targetUser: undefined,
        businessModel: undefined,
        strengths: [],
        weaknesses: [],
        opportunityGap: [],
        relevanceScore: scoreCompetitor(
          {
            description: item.description,
            title: item.title,
            snippet: item.snippet,
          },
          keywords.length > 0 ? keywords : [query],
        ),
      }));

      allCompetitors.push(...competitors);
    } catch (err) {
      lastError = {
        code: 'competitor_search_failed',
        message: err instanceof Error ? err.message : 'Unknown competitor search error',
        recoverable: true,
        retryable: true,
      };
    }
  }

  // Deduplicate and sort
  const deduplicated = deduplicateByField(allCompetitors, 'name');
  const sorted = sortByRelevance(deduplicated);

  return {
    items: sorted,
    error: sorted.length === 0 ? lastError : undefined,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyCompetitorType(item: {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
}): CompetitorReference['type'] {
  const url = (item.url ?? '').toLowerCase();
  const title = (item.title ?? '').toLowerCase();
  const desc = `${item.description ?? ''} ${item.snippet ?? ''}`.toLowerCase();

  if (url.includes('github.com') || desc.includes('open source') || desc.includes('开源')) {
    return 'open_source';
  }
  if (
    url.includes('crunchbase.com') ||
    desc.includes('startup') ||
    desc.includes('funding') ||
    desc.includes('融资')
  ) {
    return 'startup';
  }
  if (
    title.includes('google') ||
    title.includes('microsoft') ||
    title.includes('apple') ||
    title.includes('meta') ||
    title.includes('amazon') ||
    desc.includes('big tech')
  ) {
    return 'big_tech';
  }
  if (desc.includes('saas') || desc.includes('subscription') || desc.includes('订阅')) {
    return 'saas';
  }
  return 'unknown';
}
