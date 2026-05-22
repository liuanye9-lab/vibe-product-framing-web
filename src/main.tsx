import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = document.getElementById('root')

if (!root) {
  const fallback = document.createElement('div')
  fallback.style.padding = '24px'
  fallback.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  fallback.innerHTML = '<h1>VibePilot 启动失败</h1><p>页面根节点不存在，请刷新页面或检查 index.html。</p>'
  document.body.appendChild(fallback)
} else {
  root.innerHTML = `
    <div class="vp-boot-screen">
      <div class="vp-boot-card">
        <strong>VibePilot 正在加载...</strong>
        <p>如果页面长时间停在这里，请强制刷新或清理浏览器缓存。</p>
      </div>
    </div>
  `

  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
