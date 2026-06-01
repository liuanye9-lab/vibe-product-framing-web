import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { normalizeOpenAICompatibleEndpoint } from './shared/endpointNormalizer'

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

function localAiProxy(): Plugin {
  return {
    name: 'local-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai-proxy', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
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
            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
            // V5.1: Endpoint normalization diagnostics
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
