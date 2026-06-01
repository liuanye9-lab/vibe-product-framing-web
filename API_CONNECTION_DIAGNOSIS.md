# API Connection Diagnosis Guide

> V5.1 — OpenAI-Compatible URL Normalization Patch

## Supported URL Formats

本项目支持用户输入以下任何一种 URL 格式，系统会自动归一化为 `/v1/chat/completions` endpoint：

| 输入格式 | 示例 | 归一化结果 |
|---|---|---|
| Root URL | `https://gpt-agent.cc` | `https://gpt-agent.cc/v1/chat/completions` |
| /v1 URL | `https://gpt-agent.cc/v1` | `https://gpt-agent.cc/v1/chat/completions` |
| /v1/chat | `https://gpt-agent.cc/v1/chat` | `https://gpt-agent.cc/v1/chat/completions` |
| Full endpoint | `https://gpt-agent.cc/v1/chat/completions` | `https://gpt-agent.cc/v1/chat/completions` |

## 用户示例

### https://gpt-agent.cc
- 类型：root URL
- 归一化：`https://gpt-agent.cc/v1/chat/completions`

### https://gpt-agent.cc/v1
- 类型：v1_root
- 归一化：`https://gpt-agent.cc/v1/chat/completions`
- **注意：** 不会变成 `/v1/v1/chat/completions`

### https://api.llm-token.cn
- 类型：root URL（第三方 OpenAI-compatible 网关）
- 归一化：`https://api.llm-token.cn/v1/chat/completions`

## 为什么不能出现 /v1/v1

旧版本 `api/ai-proxy.ts` 中的 `normalizeChatCompletionsEndpoint` 有 bug：

```javascript
if (/\/v1$/i.test(cleanUrl)) {
  return `${cleanUrl}/v1/chat/completions`;  // BUG: /v1 + /v1/chat/completions = /v1/v1/chat/completions
}
```

如果用户填写 `https://api.openai.com/v1`，会被错误拼成 `https://api.openai.com/v1/v1/chat/completions`。

V5.1 使用统一的 endpoint normalizer 修复了这个问题。

## 为什么本地代理和线上代理必须共用 normalizer

- `vite.config.ts` 里的 `localAiProxy` 处理本地开发请求
- `api/ai-proxy.ts` 处理 Vercel 线上部署请求
- 如果两者使用不同的归一化逻辑，会出现"本地正常、线上失败"的问题
- V5.1 将逻辑统一到 `shared/endpointNormalizer.ts`，三个入口（前端、Vite proxy、Vercel proxy）共用同一套函数

## 如何在 Settings 查看 Endpoint Preview

1. 进入 Settings 页面
2. 在 API 地址输入框输入任意格式的 URL
3. 输入框下方会实时显示：
   - 最终请求地址
   - Endpoint 类型（root / v1_root / chat_completions 等）
   - Warnings（如有）
   - Errors（如有，红色高亮）

## 如何运行 URL 自检

1. 进入 Settings 页面
2. 点击"URL 兼容性自检"按钮
3. 查看表格中每个测试用例的 Input / Expected / Actual / Passed 状态
4. 如果有失败项，说明 endpoint normalizer 需要修复

## 常见 HTTP 错误解释

| HTTP Status | 含义 | 建议 |
|---|---|---|
| 401 | API key 无效或没有权限 | 检查 key 是否正确、是否过期 |
| 403 | API key 无权限访问该模型或服务 | 检查 key 权限和模型白名单 |
| 404 | endpoint 或模型名错误 | 查看 Endpoint Preview 确认最终 URL，检查模型名 |
| 429 | 额度不足或触发限流 | 等待一段时间或充值 |
| 502/503/504 | 代理或上游 API 暂时不可用 | 查看 Last AI Timing 判断是代理问题还是上游问题 |
| Timeout | 请求在 timeout 内未完成 | 检查模型速度、timeout 配置和上游响应时间 |

## 如果 Quick Ping 通过但 Long JSON 失败

说明：
1. API 地址和 Key 基本可用（能收到响应）
2. 模型能返回小 JSON
3. 但模型无法生成结构化长 JSON（可能是模型能力不足、max_tokens 不够、或输出格式不稳定）

建议：
- 换用更强的模型（如 gpt-4o 替代 gpt-4o-mini）
- 检查模型是否支持长输出
- 查看 Last AI Timing 的 responseChars 判断输出长度
