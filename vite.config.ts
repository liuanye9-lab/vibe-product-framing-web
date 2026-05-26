import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function normalizeChatCompletionsEndpoint(rawApiUrl: string): string {
  const cleanUrl = rawApiUrl.trim().replace(/\/+$/, '')

  if (/\/chat\/completions$/i.test(cleanUrl)) {
    return cleanUrl
  }

  if (/\/v1$/i.test(cleanUrl)) {
    return `${cleanUrl}/chat/completions`
  }

  if (/\/v1\/chat$/i.test(cleanUrl)) {
    return `${cleanUrl}/completions`
  }

  // Non-standard paths: if it contains /api/paas but no /chat/completions, don't guess
  if (/\/api\/paas/i.test(cleanUrl) && !/\/chat\/completions$/i.test(cleanUrl)) {
    return rawApiUrl
  }

  return `${cleanUrl}/v1/chat/completions`
}

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

            const apiUrl = payload.apiUrl?.trim().replace(/\/+$/, '')
            const apiKey = payload.apiKey?.trim()

            if (!apiUrl || !apiKey || !payload.body) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Missing apiUrl, apiKey, or body' }))
              return
            }

            if (!/^https?:\/\//i.test(apiUrl)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'apiUrl must start with http:// or https://' }))
              return
            }

            endpoint = normalizeChatCompletionsEndpoint(apiUrl)
            timeoutMs = normalizeTimeoutMs(payload.timeoutMs)

            // Validate non-standard endpoints
            if (!/\/chat\/completions$/i.test(endpoint)) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({
                error: '该服务商 API 路径可能不是 OpenAI-compatible，请填写完整 chat completions endpoint。',
              }))
              return
            }

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
