import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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

            const upstream = await fetch(`${apiUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload.body),
            })

            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
            res.end(text)
          } catch (error) {
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'AI proxy request failed' }))
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
