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

  return `${cleanUrl}/v1/chat/completions`
}

function getAbortSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

function getUpstreamErrorMessage(error: unknown, endpoint: string): string {
  if (error instanceof Error) {
    return `代理无法连接到上游 API：${error.message}。已尝试请求：${endpoint}`
  }

  return `代理无法连接到上游 API。已尝试请求：${endpoint}`
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
          try {
            const payload = JSON.parse(rawBody || '{}') as {
              apiUrl?: string
              apiKey?: string
              body?: unknown
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

            const endpoint = normalizeChatCompletionsEndpoint(apiUrl)

            const upstream = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              signal: getAbortSignal(90000),
              body: JSON.stringify(payload.body),
            })

            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
            res.end(text)
          } catch (error) {
            const payload = JSON.parse(rawBody || '{}') as { apiUrl?: string }
            const endpoint = payload.apiUrl ? normalizeChatCompletionsEndpoint(payload.apiUrl) : 'unknown endpoint'
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: getUpstreamErrorMessage(error, endpoint) }))
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
