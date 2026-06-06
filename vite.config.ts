import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { IncomingMessage, ServerResponse } from 'http'
import { normalizeOpenAICompatibleEndpoint, runEndpointNormalizerSelfTest } from './shared/endpointNormalizer'

function normalizeTimeoutMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 90000
  return Math.min(Math.max(n, 10000), 240000)
}

function getAbortSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let rawBody = ''
    req.on('data', (chunk) => {
      rawBody += chunk
    })
    req.on('end', () => resolve(rawBody))
    req.on('error', reject)
  })
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
  return fetch(url, { ...options, signal: getAbortSignal(timeoutMs) })
}

function getUpstreamErrorMessage(error: unknown, endpoint: string, timeoutMs: number): string {
  if (error instanceof Error) {
    return `代理无法连接到上游 API：${error.message}。已尝试请求：${endpoint}。timeoutMs: ${timeoutMs}`
  }

  return `代理无法连接到上游 API。已尝试请求：${endpoint}。timeoutMs: ${timeoutMs}`
}

function classifyUpstreamHttpStatus(
  status: number,
  parsedError: unknown,
  bodyPreview: string,
): string {
  if (status === 401) return 'auth_error'
  if (status === 403) return 'permission_error'
  if (status === 400) return 'bad_request'
  if (status === 429) return 'quota_or_rate_limit'
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable'

  const errorStr = parsedError ? JSON.stringify(parsedError).toLowerCase() : bodyPreview.toLowerCase()

  if (status === 404) return 'model_not_found'

  if (status === 500) {
    if (
      errorStr.includes('model') &&
      (
        errorStr.includes('not found') ||
        errorStr.includes('not exist') ||
        errorStr.includes('does not exist') ||
        errorStr.includes('invalid') ||
        errorStr.includes('not support') ||
        errorStr.includes('unsupported') ||
        errorStr.includes('模型不存在') ||
        errorStr.includes('模型名')
      )
    ) return 'model_not_found'
    if (errorStr.includes('insufficient') || errorStr.includes('quota') || errorStr.includes('balance')) return 'quota_or_rate_limit'
    if (
      errorStr.includes('permission') ||
      errorStr.includes('forbidden') ||
      errorStr.includes('not allowed') ||
      errorStr.includes('access denied') ||
      errorStr.includes('无权限') ||
      errorStr.includes('未开通')
    ) return 'permission_error'
    if (errorStr.includes('key') || errorStr.includes('token') || errorStr.includes('unauthorized')) return 'auth_error'
    return 'provider_internal_error'
  }

  return 'unknown_upstream_error'
}

function localAiProxy(): Plugin {
  return {
    name: 'local-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-proxy', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            ok: true,
            service: 'vibe-ai-proxy-local',
            method: 'OPTIONS',
            timestamp: new Date().toISOString(),
          }))
          return
        }

        // V5.2: GET health check
        if (req.method === 'GET') {
          const selfTest = runEndpointNormalizerSelfTest()
          const failedCases = selfTest.filter(tc => !tc.passed)
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            ok: failedCases.length === 0,
            service: 'vibe-ai-proxy-local',
            version: 'v5.2',
            runtime: 'vite-dev-server',
            timestamp: new Date().toISOString(),
            normalizerSelfTest: {
              passed: failedCases.length === 0,
              total: selfTest.length,
              failed: failedCases.length,
              failedCases: failedCases.length > 0 ? failedCases : undefined,
            },
          }))
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Method not allowed', errorCategory: 'bad_request' }))
          return
        }

        let rawBody = ''
        req.on('data', (chunk) => {
          rawBody += chunk
        })
        req.on('end', async () => {
          let endpoint = 'unknown-endpoint';
          let timeoutMs = 90000;
          try {
            const payload = JSON.parse(rawBody || '{}') as {
              apiUrl?: string
              apiKey?: string
              body?: unknown
              timeoutMs?: number
            }

            const apiUrl = payload.apiUrl?.trim()
            const apiKey = payload.apiKey?.trim()

            if (!apiUrl || !apiKey || !payload.body) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Missing apiUrl, apiKey, or body', errorCategory: 'bad_request' }))
              return
            }

            // V5.1: Use unified endpoint normalizer (same as api/ai-proxy.ts)
            const normalized = normalizeOpenAICompatibleEndpoint(apiUrl)

            if (normalized.kind === 'invalid' || normalized.errors.length > 0) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({
                error: normalized.errors.join('；') || 'API URL 无效。',
                errorCategory: 'bad_request',
                endpointDiagnostics: normalized,
              }))
              return
            }

            // Safety: /v1/v1 should never reach upstream
            if (/\/v1\/v1(\/|$)/i.test(normalized.endpoint)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({
                error: 'Endpoint normalizer 出错：endpoint 仍包含 /v1/v1。请更新代码或使用 root URL。',
                errorCategory: 'bad_request',
                endpointDiagnostics: normalized,
              }))
              return
            }

            endpoint = normalized.endpoint
            timeoutMs = normalizeTimeoutMs(payload.timeoutMs)

            const upstream = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              signal: getAbortSignal(timeoutMs),
              body: JSON.stringify(payload.body),
            })

            const text = await upstream.text()

            // V5.2: Structured upstream error response
            if (!upstream.ok) {
              const bodyPreview = text.slice(0, 1200)
              let parsedError: unknown = null
              try { parsedError = JSON.parse(text) } catch { /* not JSON */ }

              const errorCategory = classifyUpstreamHttpStatus(upstream.status, parsedError, bodyPreview)
              const maskedEndpoint = endpoint.replace(/\/\/[^@/]+@/, '//***@')

              let errorMessage = `HTTP ${upstream.status}`
              if (parsedError && typeof parsedError === 'object') {
                const err = parsedError as Record<string, unknown>
                if (err.error && typeof err.error === 'object' && typeof (err.error as Record<string, unknown>).message === 'string') {
                  errorMessage = (err.error as Record<string, unknown>).message as string
                } else if (err.error && typeof err.error === 'object' && typeof (err.error as Record<string, unknown>).code === 'string') {
                  errorMessage = `code: ${(err.error as Record<string, unknown>).code as string}`
                } else if (typeof err.error === 'string') {
                  errorMessage = err.error
                } else if (typeof err.message === 'string') {
                  errorMessage = err.message
                } else if (typeof err.code === 'string') {
                  errorMessage = `code: ${err.code}`
                }
              }

              res.statusCode = upstream.status
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('X-Vibe-Normalized-Endpoint', maskedEndpoint)
              res.setHeader('X-Vibe-Endpoint-Kind', normalized.kind)
              res.setHeader('X-Vibe-Endpoint-Warnings', normalized.warnings.join('; '))
              res.end(JSON.stringify({
                error: errorMessage,
                errorCategory,
                upstreamStatus: upstream.status,
                upstreamBodyPreview: bodyPreview,
                endpointDiagnostics: {
                  inputApiUrl: apiUrl,
                  normalizedEndpoint: maskedEndpoint,
                  endpoint: maskedEndpoint,
                  kind: normalized.kind,
                  warnings: normalized.warnings,
                  errors: normalized.errors,
                },
                requestDiagnostics: {
                  model: typeof payload.body === 'object' && payload.body && 'model' in (payload.body as Record<string, unknown>)
                    ? (payload.body as Record<string, unknown>).model
                    : 'unknown',
                  timeoutMs,
                },
              }))
              return
            }

            // Success — return upstream response
            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
            const maskedEndpoint = endpoint.replace(/\/\/[^@/]+@/, '//***@')
            res.setHeader('X-Vibe-Normalized-Endpoint', maskedEndpoint)
            res.setHeader('X-Vibe-Endpoint-Kind', normalized.kind)
            res.setHeader('X-Vibe-Endpoint-Warnings', normalized.warnings.join('; '))
            res.end(text)
          } catch (error) {
            const errorCategory = String(error instanceof Error ? error.name : error).toLowerCase().includes('timeout')
              || String(error instanceof Error ? error.message : error).toLowerCase().includes('abort')
              ? 'timeout'
              : 'upstream_unavailable'
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({
              error: getUpstreamErrorMessage(error, endpoint, timeoutMs),
              errorCategory,
              upstreamBodyPreview: `已尝试请求：${endpoint}。timeoutMs: ${timeoutMs}`,
              endpointDiagnostics: {
                endpoint,
              },
              requestDiagnostics: {
                timeoutMs,
              },
            }))
          }
        })
      })

      server.middlewares.use('/api/models-proxy', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          sendJson(res, 200, { ok: true })
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'Method not allowed' })
          return
        }

        try {
          const payload = JSON.parse(await readRequestBody(req) || '{}') as {
            apiUrl?: string
            apiKey?: string
            timeoutMs?: number
          }
          const apiUrl = payload.apiUrl?.trim()
          const apiKey = payload.apiKey?.trim()

          if (!apiUrl || !apiKey) {
            sendJson(res, 400, { ok: false, error: 'Missing required fields: apiUrl, apiKey' })
            return
          }

          const endpoint = buildModelsEndpoint(apiUrl)
          const timeoutMs = Math.min(Math.max(Number(payload.timeoutMs) || 15000, 5000), 30000)
          const upstreamRes = await fetchWithTimeout(endpoint, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }, timeoutMs)

          const bodyText = await upstreamRes.text()
          const rawPreview = bodyText.slice(0, 2000)

          if (!upstreamRes.ok) {
            const bodyLower = bodyText.toLowerCase()
            let errorCategory = 'provider_internal_error'
            if (upstreamRes.status === 401 || upstreamRes.status === 403) errorCategory = 'auth_error'
            else if (upstreamRes.status === 404) errorCategory = 'not_supported'
            else if (upstreamRes.status === 429) errorCategory = 'rate_limit'
            else if (bodyLower.includes('model') && bodyLower.includes('not found')) errorCategory = 'model_not_found'

            sendJson(res, 200, {
              ok: false,
              httpStatus: upstreamRes.status,
              endpoint,
              models: [],
              rawPreview,
              errorCategory,
              errorMessage: `上游返回 HTTP ${upstreamRes.status}`,
            })
            return
          }

          sendJson(res, 200, {
            ok: true,
            httpStatus: upstreamRes.status,
            endpoint,
            models: parseModelsResponse(bodyText).slice(0, 200),
            rawPreview,
          })
        } catch (err) {
          sendJson(res, 200, {
            ok: false,
            httpStatus: 0,
            models: [],
            errorCategory: 'connection',
            errorMessage: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      })

      server.middlewares.use('/api/research-proxy', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') {
          sendJson(res, 200, { ok: true, items: [], provider: 'none', error: null })
          return
        }

        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, items: [], provider: 'none', error: 'Method not allowed' })
          return
        }

        try {
          const payload = JSON.parse(await readRequestBody(req) || '{}') as {
            type?: 'github' | 'paper' | 'web'
            query?: string
            limit?: number
          }
          const type = payload.type
          const query = payload.query?.trim()
          const limit = Math.min(Math.max(Number(payload.limit) || 5, 1), 10)

          if (!type || !query) {
            sendJson(res, 400, { ok: false, items: [], provider: 'none', error: 'Missing required fields: type, query' })
            return
          }

          const result = type === 'github'
            ? await searchGitHubLocal(query, limit)
            : type === 'paper'
              ? await searchPaperLocal(query, limit)
              : type === 'web'
                ? await searchWebLocal(query, limit)
                : { ok: false, items: [], provider: 'none', error: `Unknown search type: ${type}` }

          sendJson(res, result.ok || result.error === 'search_api_unavailable' ? 200 : 502, result)
        } catch (err) {
          sendJson(res, 500, {
            ok: false,
            items: [],
            provider: 'none',
            error: err instanceof Error ? err.message : 'Internal server error',
          })
        }
      })
    },
  }
}

function buildModelsEndpoint(apiUrl: string): string {
  let url = apiUrl.trim()
  if (url.includes('/chat/completions')) {
    url = url.replace('/chat/completions', '/models')
  } else if (url.endsWith('/v1')) {
    url = `${url}/models`
  } else if (url.endsWith('/v1/')) {
    url = `${url}models`
  } else if (!url.endsWith('/models')) {
    const base = url.endsWith('/') ? url.slice(0, -1) : url
    url = `${base}/v1/models`
  }
  return url
}

function parseModelsResponse(bodyText: string): string[] {
  try {
    const data = JSON.parse(bodyText)
    if (Array.isArray(data.data)) {
      return data.data.map((item: { id?: string }) => item.id).filter((id: unknown): id is string => typeof id === 'string')
    }
    if (Array.isArray(data.models)) {
      return data.models
        .map((item: { id?: string; name?: string } | string) => typeof item === 'string' ? item : item.id ?? item.name)
        .filter((id: unknown): id is string => typeof id === 'string')
    }
    if (Array.isArray(data)) {
      return data.filter((item: unknown): item is string => typeof item === 'string')
    }
  } catch {
    return []
  }
  return []
}

interface LocalResearchItem {
  title: string
  url: string
  description?: string
  stars?: number
  forks?: number
  language?: string
  updatedAt?: string
  license?: string
  fullName?: string
  year?: number
  authors?: string[]
  abstract?: string
  snippet?: string
}

interface LocalResearchResponse {
  ok: boolean
  items: LocalResearchItem[]
  provider: string
  error: string | null
}

async function searchGitHubLocal(query: string, limit: number): Promise<LocalResearchResponse> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VibePilot-Research/1.0',
  }
  if (token) headers.Authorization = `token ${token}`

  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${limit}`
  const response = await fetchWithTimeout(url, { headers }, 15000)
  if (response.status === 403) {
    return { ok: false, items: [], provider: 'github', error: 'GitHub API rate limit exceeded. Configure GITHUB_TOKEN for higher limits.' }
  }
  if (!response.ok) {
    return { ok: false, items: [], provider: 'github', error: `GitHub API returned HTTP ${response.status}` }
  }

  const data = await response.json() as { items?: Array<Record<string, unknown>> }
  const items = ((data.items ?? []) as Array<Record<string, unknown>>).map((repo) => ({
    title: (repo.name as string) ?? '',
    url: (repo.html_url as string) ?? '',
    description: (repo.description as string) ?? '',
    stars: repo.stargazers_count as number,
    forks: repo.forks_count as number,
    language: repo.language as string,
    updatedAt: repo.updated_at as string,
    license: (repo.license as Record<string, string> | null)?.name,
    fullName: repo.full_name as string,
  }))
  return { ok: true, items, provider: 'github', error: null }
}

async function searchPaperLocal(query: string, limit: number): Promise<LocalResearchResponse> {
  const semantic = await searchSemanticScholarLocal(query, limit)
  if (semantic.ok && semantic.items.length > 0) return semantic
  const arxiv = await searchArxivLocal(query, limit)
  if (arxiv.ok && arxiv.items.length > 0) return arxiv
  return semantic.ok ? semantic : arxiv
}

async function searchSemanticScholarLocal(query: string, limit: number): Promise<LocalResearchResponse> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,url,year,authors,abstract`
  const response = await fetchWithTimeout(url, {}, 15000)
  if (!response.ok) {
    return { ok: false, items: [], provider: 'semantic_scholar', error: `Semantic Scholar API returned HTTP ${response.status}` }
  }

  const data = await response.json() as { data?: Array<Record<string, unknown>> }
  const items = ((data.data ?? []) as Array<Record<string, unknown>>).map((paper) => ({
    title: (paper.title as string) ?? '',
    url: (paper.url as string) ?? '',
    year: paper.year as number,
    authors: ((paper.authors as Array<{ name: string }>) ?? []).map((author) => author.name),
    abstract: (paper.abstract as string) ?? '',
  }))
  return { ok: true, items, provider: 'semantic_scholar', error: null }
}

async function searchArxivLocal(query: string, limit: number): Promise<LocalResearchResponse> {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`
  const response = await fetchWithTimeout(url, {}, 15000)
  if (!response.ok) {
    return { ok: false, items: [], provider: 'arxiv', error: `arXiv API returned HTTP ${response.status}` }
  }

  const xml = await response.text()
  const entries = xml.split('<entry>').slice(1)
  const items = entries.map((entry) => {
    const published = extractXmlTag(entry, 'published') ?? ''
    const authorNames = (entry.match(/<author>[\s\S]*?<\/author>/g) ?? [])
      .map((author) => extractXmlTag(author, 'name'))
      .filter((name): name is string => Boolean(name))
    return {
      title: extractXmlTag(entry, 'title')?.replace(/\s+/g, ' ').trim() ?? '',
      url: extractXmlTag(entry, 'id') ?? '',
      abstract: extractXmlTag(entry, 'summary')?.replace(/\s+/g, ' ').trim() ?? '',
      year: published ? parseInt(published.substring(0, 4), 10) : undefined,
      authors: authorNames,
    }
  }).filter((item) => item.title)
  return { ok: true, items, provider: 'arxiv', error: null }
}

function extractXmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
  return match?.[1] ?? null
}

async function searchWebLocal(query: string, limit: number): Promise<LocalResearchResponse> {
  const apiKey = process.env.SEARCH_API_KEY
  const provider = process.env.SEARCH_PROVIDER ?? 'tavily'
  if (!apiKey) {
    return { ok: false, items: [], provider: 'none', error: 'search_api_unavailable' }
  }
  if (provider === 'brave') return searchBraveLocal(query, limit, apiKey)
  return searchTavilyLocal(query, limit, apiKey)
}

async function searchTavilyLocal(query: string, limit: number, apiKey: string): Promise<LocalResearchResponse> {
  const response = await fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: limit }),
  }, 15000)
  if (!response.ok) {
    return { ok: false, items: [], provider: 'tavily', error: `Tavily API returned HTTP ${response.status}` }
  }
  const data = await response.json() as { results?: Array<Record<string, unknown>> }
  const items = ((data.results ?? []) as Array<Record<string, unknown>>).map((item) => ({
    title: (item.title as string) ?? '',
    url: (item.url as string) ?? '',
    snippet: (item.content as string) ?? '',
    description: (item.content as string) ?? '',
  }))
  return { ok: true, items, provider: 'tavily', error: null }
}

async function searchBraveLocal(query: string, limit: number, apiKey: string): Promise<LocalResearchResponse> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  }, 15000)
  if (!response.ok) {
    return { ok: false, items: [], provider: 'brave', error: `Brave API returned HTTP ${response.status}` }
  }
  const data = await response.json() as { web?: { results?: Array<Record<string, unknown>> } }
  const items = ((data.web?.results ?? []) as Array<Record<string, unknown>>).map((item) => ({
    title: (item.title as string) ?? '',
    url: (item.url as string) ?? '',
    snippet: (item.description as string) ?? '',
    description: (item.description as string) ?? '',
  }))
  return { ok: true, items, provider: 'brave', error: null }
}

export default defineConfig({
  plugins: [localAiProxy(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
