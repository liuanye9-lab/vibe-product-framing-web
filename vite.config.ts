import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
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
    if (errorStr.includes('model') && (errorStr.includes('not found') || errorStr.includes('not exist'))) return 'model_not_found'
    if (errorStr.includes('insufficient') || errorStr.includes('quota') || errorStr.includes('balance')) return 'quota_or_rate_limit'
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
              res.end(JSON.stringify({ error: 'Missing apiUrl, apiKey, or body' }))
              return
            }

            // V5.1: Use unified endpoint normalizer (same as api/ai-proxy.ts)
            const normalized = normalizeOpenAICompatibleEndpoint(apiUrl)

            if (normalized.kind === 'invalid' || normalized.errors.length > 0) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({
                error: normalized.errors.join('；') || 'API URL 无效。',
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
                } else if (typeof err.error === 'string') {
                  errorMessage = err.error
                } else if (typeof err.message === 'string') {
                  errorMessage = err.message
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
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: getUpstreamErrorMessage(error, endpoint, timeoutMs) }))
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [localAiProxy(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
