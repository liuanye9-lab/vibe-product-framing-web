/**
 * Research Types — V6.0
 *
 * Internal types for research proxy communication.
 */

export interface ResearchProxyRequest {
  type: 'github' | 'paper' | 'web';
  query: string;
  limit?: number;
}

export interface ResearchProxyResponse {
  ok: boolean;
  items: ResearchProxyItem[];
  provider: string;
  error: string | null;
}

export interface ResearchProxyItem {
  title: string;
  url: string;
  description?: string;
  // GitHub-specific
  stars?: number;
  forks?: number;
  language?: string;
  updatedAt?: string;
  license?: string;
  fullName?: string;
  // Paper-specific
  year?: number;
  authors?: string[];
  abstract?: string;
  // Company/web-specific
  snippet?: string;
}

export interface ResearchError {
  code:
    | 'api_unavailable'
    | 'search_api_unavailable'
    | 'github_rate_limited'
    | 'paper_search_failed'
    | 'competitor_search_failed'
    | 'no_evidence_found'
    | 'unknown';
  message: string;
  recoverable: boolean;
  retryable: boolean;
}
