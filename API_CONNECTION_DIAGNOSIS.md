# API Connection Diagnosis Guide

> V5.6 — Deep API Provider Diagnosis Patch

## V5.6：Provider / Model Mismatch 诊断

### 核心问题

很多第三方 API 网关（如小米 MiMo、LLM Token、GPT Agent）代理多家模型。用户可能：
1. 填了 MiMo 的 URL，但模型名填了 `kimi-k2.6`
2. 从网页复制模型名时带入隐藏字符
3. 不确定服务商支持哪些模型

V5.6 的解决方案：
- **Provider 推断**：从 URL 推断服务商（MiMo/Kimi/DeepSeek/OpenAI/GLM/Custom）
- **Mismatch 诊断**：检查 model 是否属于推断出的服务商
- **Model 清洗**：移除零宽字符、特殊横线、前后空格
- **模型列表探测**：通过 /v1/models 查看服务商支持的模型
- **动态错误文案**：优先展示 provider mismatch > 模型未找到 > auth 错误 > HTTP 500

### 必须知道的规则

1. **API URL 和模型名必须属于同一服务商或同一聚合网关。**
2. `xiaomimo` URL 不应随意填写 `kimi-*` 模型名，除非该网关后台明确支持。
3. HTTP 500 不一定是服务器挂了，很多 provider 会把 model_not_found / permission / bad_request 包装成 500。
4. 从网页复制模型名时可能带入零宽字符，系统会自动清洗并提示。
5. 如果截图里露出 API Key，应立即重新生成。

### 如何使用 /v1/models 探测

1. 运行「测试并保存 API」
2. 如果测试失败，系统会自动尝试 /v1/models 探测
3. 展开 Debug 面板查看「模型列表探测」区块
4. 如果探测成功，会显示模型数量和当前模型是否在列表中
5. 如果当前模型不在列表中，会显示相似模型名

### 如何检查隐藏字符和特殊横线

1. 在模型名输入框输入模型名
2. 如果检测到隐藏字符或特殊横线，页面上方会出现警告
3. Debug 面板中「模型名诊断」区块显示：
   - Original：原始输入
   - Normalized：清洗后的模型名
   - Changed：是否有变化
   - Warnings：检测到的问题

### 如何查看 Debug Panel

1. 运行「测试并保存 API」
2. 展开「API Debug — Smoke Test」折叠面板
3. 查看：
   - **Provider 诊断**：推断的服务商、置信度、errors/warnings/suggestions
   - **模型名诊断**：Original/Normalized/Changed/Warnings
   - **模型列表探测**：探测结果、模型数量、当前模型是否在列表中
   - **上游原始响应**：服务商返回的原始 body
   - **Attempts 表格**：每种 variant 的状态/HTTP/Error Category/Duration/Preview

---

## V5.5：Provider Model Compatibility Diagnosis

V5.5 新增了 Provider 推断和 Model 清洗功能，解决了 MiMo URL + Kimi model 的 mismatch 问题。

### Provider 推断

系统根据 URL 推断服务商：

| URL 模式 | 推断服务商 |
|----------|-----------|
| `xiaomimo` / `mimo` | Xiaomi MiMo |
| `moonshot` / `kimi` | Moonshot / Kimi |
| `deepseek` | DeepSeek |
| `api.openai.com` | OpenAI |
| `bigmodel` / `zhipu` | GLM / 智谱 |
| 其他 | 自定义网关 |

### Mismatch 诊断示例

**场景：MiMo URL + Kimi 模型**

```
API URL: https://token-plan-cn.xiaomimo.com
Model: kimi-k2.6
```

系统推断 Provider 为 Xiaomi MiMo，但模型名包含 `kimi`，属于 Moonshot / Kimi。

**错误提示：**
> 当前 API URL 看起来属于 Xiaomi MiMo，但模型名 "kimi-k2.6" 像 Kimi / Moonshot 模型。请确认 endpoint 和 model 是否属于同一服务商。

**建议：**
- 如果使用小米 MiMo，请从服务商后台复制精确 model id
- 如果使用 Kimi，请切换到对应的官方 API 地址

### Model 清洗

| 问题 | 处理方式 |
|------|----------|
| 前后空格 | trim |
| 零宽字符（\u200B \u200C \u200D \uFEFF） | 移除 |
| 特殊横线（– — − －） | 替换为普通连字符 `-` |
| 多余空格 | 合并 |

---

## V5.4：为什么需要多 Variant Smoke Test

V5.3 使用单一 payload 进行 Smoke Test，但不同 AI 服务商对 OpenAI API 的兼容程度不同。有些服务商不支持 `max_tokens`、`temperature`、`system role` 等参数，导致单一 payload 可能失败。

**V5.6 方案：** 系统内部自动尝试 9 种不同 payload variant，从最简化到最复杂，直到找到一个能工作的。UI 上仍然只有一个「测试并保存 API」按钮。

### 9 种 Payload Variants (V5.6)

| # | Variant | 说明 | 额外参数 |
|---|---------|------|----------|
| 1 | `messages_plain_no_extra_params` | 仅 model + messages | 无 |
| 2 | `user_plain_no_extra_params` | 显式指令，无额外参数 | 无 |
| 3 | `user_plain_with_max_tokens` | 纯文本 + max_tokens | max_tokens |
| 4 | `user_json_no_extra_params` | JSON 请求 + max_tokens | max_tokens |
| 5 | `user_json_with_max_tokens` | JSON + max_tokens + stream:false | max_tokens, stream |
| 6 | `user_json_max_completion_tokens` | 使用 max_completion_tokens | max_completion_tokens, stream |
| 7 | `user_json_with_temperature` | 标准 + temperature | max_tokens, temperature, stream |
| 8 | `system_user_no_extra` | System + User 消息 | 无 |
| 9 | `content_array_format` | Content 数组格式 | max_tokens |

### 排序原则

1. 最小请求优先
2. 不要第一步加 temperature
3. 不要第一步加 stream=false
4. 不要第一步要求 JSON
5. 不要第一步用 system role

### 为什么 endpoint 正确但仍可能失败

即使 endpoint preview 显示正确的 URL（如 `https://token-plan-cn.xiaomimo.com/v1/chat/completions`），请求仍可能失败，因为：

1. **模型名不匹配**：服务商要求精确的模型名（大小写、版本号、横线格式）
2. **模型未开通**：Key 有权限但模型未在后台开通
3. **参数不兼容**：服务商不支持 `max_tokens`、`temperature` 等参数
4. **服务商内部错误**：服务商把模型不存在、权限错误等包装成 HTTP 500
5. **Provider 不匹配**：URL 和模型名属于不同服务商

### HTTP 500 的真正含义

HTTP 500 表示**请求已到达上游服务商**，但服务商内部处理失败。这不是 URL 拼接错误或网络问题。

**V5.6 改进：** 当所有 variant 都返回 HTTP 500 时，系统会：
1. 检查 provider/model mismatch
2. 自动探测 /v1/models 查看模型列表
3. 给出组合诊断，而不是只说"上游返回 500"

## 常见 HTTP 错误解释

| HTTP Status | 含义 | 建议 |
|---|---|---|
| 401 | API key 无效或没有权限 | 检查 key 是否正确、是否过期 |
| 403 | API key 无权限访问该模型或服务 | 检查 key 权限和模型白名单 |
| 404 | endpoint 或模型名错误 | 查看 Endpoint Preview 确认最终 URL，检查模型名 |
| 429 | 额度不足或触发限流 | 等待一段时间或充值 |
| 500 | 服务商内部错误 | 检查模型名、服务商后台状态，查看 Debug 面板中的 Provider 诊断 |
| Timeout | 请求在 timeout 内未完成 | 检查模型速度、timeout 配置和上游响应时间 |

## 错误分类与建议

| Error Category | 含义 | 建议 |
|---|---|---|
| `auth_error` | API Key 无效或没有权限 | 检查 Key 是否正确 |
| `permission_error` | API Key 无权限访问该模型 | 在服务商后台确认权限 |
| `model_not_found` | Endpoint 或模型名错误 | 检查模型名称 |
| `quota_or_rate_limit` | 额度不足或触发限流 | 检查账户余额或稍后重试 |
| `provider_internal_error` | 上游服务商内部错误 | 检查模型名、服务商状态 |
| `upstream_unavailable` | 上游服务商不可用 | 稍后重试 |
| `bad_request` | 请求格式错误 | 检查 URL 格式 |

## URL 归一化

本项目支持用户输入以下任何一种 URL 格式，系统会自动归一化为 `/v1/chat/completions` endpoint：

| 输入格式 | 示例 | 归一化结果 |
|---|---|---|
| Root URL | `https://gpt-agent.cc` | `https://gpt-agent.cc/v1/chat/completions` |
| /v1 URL | `https://gpt-agent.cc/v1` | `https://gpt-agent.cc/v1/chat/completions` |
| /v1/chat | `https://gpt-agent.cc/v1/chat` | `https://gpt-agent.cc/v1/chat/completions` |
| Full endpoint | `https://gpt-agent.cc/v1/chat/completions` | `https://gpt-agent.cc/v1/chat/completions` |

## 为什么不能出现 /v1/v1

旧版本 `api/ai-proxy.ts` 中的 `normalizeChatCompletionsEndpoint` 有 bug：

```javascript
if (/\/v1$/i.test(cleanUrl)) {
  return `${cleanUrl}/v1/chat/completions`;  // BUG: /v1 + /v1/chat/completions = /v1/v1/chat/completions
}
```

V5.1 使用统一的 endpoint normalizer 修复了这个问题。

## 为什么本地代理和线上代理必须共用 normalizer

- `vite.config.ts` 里的 `localAiProxy` 处理本地开发请求
- `api/ai-proxy.ts` 处理 Vercel 线上部署请求
- 如果两者使用不同的归一化逻辑，会出现"本地正常、线上失败"的问题
- V5.1 将逻辑统一到 `shared/endpointNormalizer.ts`，三个入口共用同一套函数
