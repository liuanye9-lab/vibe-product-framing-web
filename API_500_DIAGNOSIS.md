# API 500 Deep Diagnosis Guide

> V5.2 — Vibe Decision Copilot

## 问题特征

当 Settings 页面测试 API 时出现：
- Quick Ping (12s): HTTP 500，约 500-600ms
- JSON Test (30s): HTTP 500，约 500-600ms
- Long JSON (90s): HTTP 500，约 500-600ms

**这不是超时问题**。三个请求都在 500-600ms 内返回错误，说明请求链路已经快速返回错误。

## 诊断流程

### Step 1: Proxy Health

点击 **Proxy Health** 按钮，验证 `/api/ai-proxy` 函数是否正常启动。

- **通过**: 函数正常，问题在上游 API
- **失败**: 函数本身有问题，检查 Vercel 部署

### Step 2: Raw Chat Test

发送最基础的 `Say OK` 请求，不要求 JSON 格式。

- **通过**: endpoint/key/model 基础连通
- **失败**: endpoint/key/model/网关本身有问题

### Step 3: Quick Ping / JSON Test

如果 Raw Chat 通过但 Quick Ping 失败：
- 可能是 JSON 格式问题
- 可能是 system message 不支持
- 尝试开启 "Disable system message" 兼容选项

## Error Category 解读

| Category | 含义 | 常见原因 |
|----------|------|----------|
| `proxy_internal_error` | 代理函数内部崩溃 | 代码 bug、导入路径错误 |
| `auth_error` | API key 无效 | key 过期、权限不足 |
| `permission_error` | 无权限访问 | key 无权访问该模型 |
| `model_not_found` | 模型不存在 | 模型名拼写错误、模型下线 |
| `quota_or_rate_limit` | 额度不足或限流 | 余额为零、请求太频繁 |
| `bad_request` | 请求格式错误 | 参数不支持、格式不对 |
| `provider_internal_error` | 上游服务商内部错误 | 服务商故障、模型报错 |
| `upstream_unavailable` | 上游不可用 | 502/503/504，网络问题 |
| `timeout` | 请求超时 | 模型响应太慢 |

## Upstream Body Preview

V5.2 会在错误响应中包含 `upstreamBodyPreview`（最多 1200 字符），显示上游 API 返回的真实错误内容。

**关键**: 不要只看 HTTP status，要看 body preview，里面通常有具体错误原因。

## 第三方网关常见 500 原因

1. **模型名不对**: 不同网关的模型名可能不同
2. **Endpoint 路径不对**: 有些网关不需要 `/v1` 前缀
3. **Key 权限不对**: key 可能只对部分模型有权限
4. **不支持 system role**: 部分网关对 system message 处理有问题
5. **不支持某些 OpenAI 参数**: 如 `response_format`
6. **服务商内部错误**: 网关本身故障

## 兼容性选项

Settings 页面的 Advanced Options 提供：

- **Disable system message**: 部分第三方网关不支持 system role，开启后只发 user message

## 技术细节

### 代理 vs 上游

- `proxy_internal_error`: 代理函数（`/api/ai-proxy`）自身崩溃
- `provider_internal_error`: 上游 API 返回 500

### 如何区分

查看 API Debug Panel：
- `errorCategory` 字段
- `upstreamBodyPreview` 字段
- `upstreamStatus` 字段

如果 `upstreamStatus` 是 500 且 `errorCategory` 是 `provider_internal_error`，说明上游返回了 500。
如果 `errorCategory` 是 `proxy_internal_error`，说明代理函数自身出错。
