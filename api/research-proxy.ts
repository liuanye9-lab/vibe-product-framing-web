/**
 * Research Proxy — V6.0
 *
 * Vercel Serverless function that proxies research requests to:
 * - GitHub Search API (optional GITHUB_TOKEN)
 * - Semantic Scholar / arXiv (no key required)
 * - Tavily / Brave / SerpAPI / Bing (optional SEARCH_API_KEY)
 *
 * Never returns API keys to the client.
 * Returns structured JSON errors on failure.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProxyRequest {
  type: 'github' | 'paper' | 'web';
  query: string;
  limit?: number;
}

interface ProxyItem {
  title: string;
  url: string;
  description?: string;
  stars?: number;
  forks?: number;
  language?: string;
  updatedAt?: string;
  license?: string;
  fullName?: string;
  year?: number;
  authors?: string[];
  abstract?: string;
  snippet?: string;
}

interface ProxyResponse {
  ok: boolean;
  items: ProxyItem[];
  provider: string;
  error: string | null;
}

// ─── Timeout helper ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

async function searchGitHub(query: string, limit: number): Promise<ProxyResponse> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VibePilot-Research/1.0',
  };
  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${Math.min(limit, 10)}`;
    const res = await fetchWithTimeout(url, { headers });

    if (res.status === 403) {
      return {
        ok: false,
        items: [],
        provider: 'github',
        error: 'GitHub API rate limit exceeded. Configure GITHUB_TOKEN for higher limits.',
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        provider: 'github',
        error: `GitHub API returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const items: ProxyItem[] = (data.items ?? []).map(
      (repo: Record<string, unknown>) => ({
        title: (repo.name as string) ?? '',
        url: (repo.html_url as string) ?? '',
        description: (repo.description as string) ?? '',
        stars: repo.stargazers_count as number,
        forks: repo.forks_count as number,
        language: repo.language as string,
        updatedAt: repo.updated_at as string,
        license: (repo.license as Record<string, string> | null)?.name,
        fullName: repo.full_name as string,
      }),
    );

    return { ok: true, items, provider: 'github', error: null };
  } catch (err) {
    return {
      ok: false,
      items: [],
      provider: 'github',
      error: err instanceof Error ? err.message : 'Unknown GitHub error',
    };
  }
}

// ─── Semantic Scholar ─────────────────────────────────────────────────────────

async function searchSemanticScholar(query: string, limit: number): Promise<ProxyResponse> {
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${Math.min(limit, 10)}&fields=title,url,year,authors,abstract`;
    const res = await fetchWithTimeout(url, {});

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        provider: 'semantic_scholar',
        error: `Semantic Scholar API returned HTTP ${res.status}`,
      };
    }

    const data = await res.json();
    const items: ProxyItem[] = (data.data ?? []).map(
      (paper: Record<string, unknown>) => ({
        title: (paper.title as string) ?? '',
        url: (paper.url as string) ?? '',
        year: paper.year as number,
        authors: ((paper.authors as Array<{ name: string }>) ?? []).map((a) => a.name),
        abstract: (paper.abstract as string) ?? '',
      }),
    );

    return { ok: true, items, provider: 'semantic_scholar', error: null };
  } catch (err) {
    return {
      ok: false,
      items: [],
      provider: 'semantic_scholar',
      error: err instanceof Error ? err.message : 'Unknown Semantic Scholar error',
    };
  }
}

// ─── arXiv (fallback) ────────────────────────────────────────────────────────

async function searchArxiv(query: string, limit: number): Promise<ProxyResponse> {
  try {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${Math.min(limit, 10)}`;
    const res = await fetchWithTimeout(url, {});

    if (!res.ok) {
      return {
        ok: false,
        items: [],
        provider: 'arxiv',
        error: `arXiv API returned HTTP ${res.status}`,
      };
    }

    const xml = await res.text();
    const items: ProxyItem[] = [];

    // Simple XML parsing for arXiv results
    const entries = xml.split('<entry>').slice(1);
    for (const entry of entries) {
      const title = extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim() ?? '';
      const summary = extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim() ?? '';
      const link = extractXmlAttribute(entry, 'id') ?? '';
      const published = extractXmlTag(entry, 'published') ?? '';
      const year = published ? parseInt(published.substring(0, 4), 10) : undefined;

      const authorNames: string[] = [];
      const authorMatches = entry.match(/<author>[\s\S]*?<\/author>/g) ?? [];
      for (const am of authorMatches) {
        const name = extractXmlTag(am, 'name');
        if (name) authorNames.push(name);
      }

      if (title) {
        items.push({
          title,
          url: link,
          abstract: summary,
          year,
          authors: authorNames,
        });
      }
    }

    return { ok: true, items, provider: 'arxiv', error: null };
  } catch (err) {
    return {
      ok: false,
      items: [],
      provider: 'arxiv',
      error: err instanceof Error ? err.message : 'Unknown arXiv error',
    };
  }
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1] ?? null;
}

function extractXmlAttribute(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`));
  return match?.[1] ?? null;
}

// ─── Web Search (Tavily / Brave / generic) ───────────────────────────────────

async function searchWeb(query: string, limit: number): Promise<ProxyResponse> {
  const apiKey = process.env.SEARCH_API_KEY;
  const provider = process.env.SEARCH_PROVIDER ?? 'tavily';

  if (!apiKey) {
    return {
      ok: false,
      items: [],
      provider: 'none',
      error: 'SEARCH_API_KEY not configured. Web search unavailable.',
    };
  }

  try {
    if (provider === 'tavily') {
      return await searchTavily(query, limit, apiKey);
    }
    if (provider === 'brave') {
      return await searchBrave(query, limit, apiKey);
    }
    return {
      ok: false,
      items: [],
      provider,
      error: `Unsupported search provider: ${provider}`,
    };
  } catch (err) {
    return {
      ok: false,
      items: [],
      provider,
      error: err instanceof Error ? err.message : 'Unknown web search error',
    };
  }
}

async function searchTavily(
  query: string,
  limit: number,
  apiKey: string,
): Promise<ProxyResponse> {
  const res = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(limit, 10),
    }),
  });

  if (!res.ok) {
    return {
      ok: false,
      items: [],
      provider: 'tavily',
      error: `Tavily API returned HTTP ${res.status}`,
    };
  }

  const data = await res.json();
  const items: ProxyItem[] = (data.results ?? []).map(
    (r: Record<string, unknown>) => ({
      title: (r.title as string) ?? '',
      url: (r.url as string) ?? '',
      snippet: (r.content as string) ?? '',
      description: (r.content as string) ?? '',
    }),
  );

  return { ok: true, items, provider: 'tavily', error: null };
}

async function searchBrave(
  query: string,
  limit: number,
  apiKey: string,
): Promise<ProxyResponse> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(limit, 10)}`;
  const res = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) {
    return {
      ok: false,
      items: [],
      provider: 'brave',
      error: `Brave API returned HTTP ${res.status}`,
    };
  }

  const data = await res.json();
  const items: ProxyItem[] = (data.web?.results ?? []).map(
    (r: Record<string, unknown>) => ({
      title: (r.title as string) ?? '',
      url: (r.url as string) ?? '',
      snippet: (r.description as string) ?? '',
      description: (r.description as string) ?? '',
    }),
  );

  return { ok: true, items, provider: 'brave', error: null };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, items: [], provider: 'none', error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body as ProxyRequest;
    const { type, query, limit: rawLimit } = body;
    const limit = Math.min(rawLimit ?? 5, 10);

    if (!type || !query) {
      res.status(400).json({
        ok: false,
        items: [],
        provider: 'none',
        error: 'Missing required fields: type, query',
      });
      return;
    }

    let result: ProxyResponse;

    switch (type) {
      case 'github':
        result = await searchGitHub(query, limit);
        break;
      case 'paper':
        // Try Semantic Scholar first, fall back to arXiv
        result = await searchSemanticScholar(query, limit);
        if (!result.ok || result.items.length === 0) {
          const arxivResult = await searchArxiv(query, limit);
          if (arxivResult.ok && arxivResult.items.length > 0) {
            result = arxivResult;
          }
        }
        break;
      case 'web':
        result = await searchWeb(query, limit);
        break;
      default:
        result = {
          ok: false,
          items: [],
          provider: 'none',
          error: `Unknown search type: ${type}`,
        };
    }

    res.status(result.ok ? 200 : 502).json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      items: [],
      provider: 'none',
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
