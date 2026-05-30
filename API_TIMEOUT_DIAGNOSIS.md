# API Timeout Diagnosis — Vibe Decision Copilot V4.9

## 为什么官方 API 也会超时？

V4.8 及更早版本中，即使使用 OpenAI/DeepSeek 官方 API，也可能被本项目主动中断：

| # | 阻塞点 | 旧值 | 影响 |
|---|--------|------|------|
| 1 | Settings 前端 `AbortSignal.timeout(40000)` | **40s** | 任何 Settings 测试超过 40 秒被浏览器中断 |
| 2 | Settings `timeoutMs: 40000` 传给代理 | **40s** | 代理层也在 40s 时 abort 上游 |
| 3 | `api/ai-proxy.ts` `normalizeTimeoutMs` 强制压到 | **50s** | 即使前端传 60s/90s，代理也压到 50s |
| 4 | `config.maxDuration` + `vercel.json` `maxDuration` | **55s** | Vercel serverless 在 55s 时直接 kill 函数 |
| 5 | `evaluate.ts` `DEFAULT_AI_TIMEOUT_MS` | **50s** | 所有普通 AI 调用默认 50s |
| 6 | `callAIProxy` 每请求前 `checkProxyReachable()` | **+5s** | 每次 AI 调用多等一个 5s OPTIONS 检查 |
| 7 | `callCopilotJson` Agent 传入 | **60s** | 被代理压成 50s |

**结论**：项目自己的 timeout 策略（40s/50s/55s）主动中断了官方 API，与 API 本身是否可用无关。

## V4.9 修复

### 新的 Timeout Profiles

| Task | TimeoutMs | ClientExtraMs | MaxTokens | 用途 |
|------|-----------|---------------|-----------|------|
| `quick_ping` | 12,000 | 5,000 | 40 | 验证 API 基本可达 |
| `json_test` | 30,000 | 8,000 | 160 | 验证模型返回小 JSON |
| `long_json_test` | 90,000 | 15,000 | 700 | 验证复杂结构化输出 |
| `agent_turn` | 90,000 | 15,000 | 900 | Agent 单轮推理 |
| `stage_suggestion` | 90,000 | 15,000 | 900 | 阶段建议生成 |
| `handoff` | 120,000 | 20,000 | 1,400 | 开发交付文档 |
| `explain` | 30,000 | 8,000 | 300 | 简短解释 |

### 代理层 `normalizeTimeoutMs`

```
旧: Math.min(Math.max(n, 10000), 50000) → 硬限制 50s
新: Math.min(Math.max(n, 10000), env(AI_PROXY_MAX_TIMEOUT_MS || 120000)) → 可配置
```

### API 测试分层

| 层级 | 测试 | 通过标准 | 解锁 |
|------|------|---------|------|
| 1 | Quick Ping (12s) | HTTP 200 + 响应可达 | — |
| 2 | JSON Test (30s) | 返回有效小 JSON + ok=true | **Agent 可运行** (basic_ready) |
| 3 | Long JSON (90s) | 返回结构化长 JSON + 字段完整 | — |
| 4 | Reference Validation | 输出与输入相关性通过 | **Handoff 可运行** (ready) |

### 代理 preflight 移除

`callAIProxy()` 不再在执行 AI 请求前做 OPTIONS preflight 检查。preflight 仅保留为独立函数 `checkAIProxyReachable()`，供 Settings 诊断使用。

### AI 耗时诊断

每次 AI 调用自动记录：
- `durationMs`：客户端总耗时
- `proxyDurationMs`：代理内部耗时（来自 `X-Vibe-Proxy-Duration-Ms` header）
- `upstreamDurationMs`：上游 API 耗时（来自 `X-Vibe-Upstream-Duration-Ms` header）
- `timeoutMs`：使用的超时值
- `model` / `endpoint` / `status` / `responseChars`

存储到 `localStorage: vibepilot_last_ai_timing`，Settings 页和 Agent Debug 面板可见。

## 如何选择模型

- **快速模型**（如 DeepSeek-Chat, GPT-4o-mini）：Quick Ping + JSON Test 通常 < 10s。
- **中速模型**（如 GPT-4o）：JSON Test 15-30s，Long JSON 30-60s。
- **慢速模型**（如 Claude Opus, 某些开源模型）：Quick Ping 可能通过，但 Long JSON 可能超时。UI 会明确告知"基础 API 可用，但长 JSON 慢"而不是"API 地址无效"。

## 下一步 Streaming 计划

当前 AI Proxy 是同步 `await upstream.text()` 模式，用户必须等完整响应。V5.0 计划：
1. 新增 `api/ai-stream.ts`，支持 `stream: true`（SSE）
2. Agent normal turn 先显示 partial reply
3. 最终仍解析完整 JSON
4. 减少"黑屏等待"体验

## 部署注意事项

- Vercel Hobby：maxDuration=60s，即使代码设 120s，实际仍受 60s 限制。建议设置 `AI_PROXY_MAX_TIMEOUT_MS=50000`。
- Vercel Pro：maxDuration 可到 300s，120s 配置正常工作。
- 自托管：无 maxDuration 限制，可设置 `AI_PROXY_MAX_TIMEOUT_MS=180000`。
