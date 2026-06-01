/**
 * V5.2 — Unified API Proxy Error Parser
 *
 * Parses structured error responses from /api/ai-proxy into a normalized format.
 * Used by SettingsPage, evaluate.ts, and any code that calls the proxy.
 */

export interface ParsedApiError {
  httpStatus?: number
  errorCategory: string
  message: string
  upstreamBodyPreview?: string
  normalizedEndpoint?: string
  endpointKind?: string
  endpointWarnings?: string[]
  endpointErrors?: string[]
  rawPreview?: string
  /** V5.2: Model that was used in the request */
  model?: string
  /** V5.2: Proxy duration */
  proxyDurationMs?: number
  /** V5.2: Upstream duration */
  upstreamDurationMs?: number
}

/**
 * Parse a non-ok response from /api/ai-proxy into a structured error.
 * Handles both structured JSON errors and raw HTML/text errors.
 */
export function parseApiProxyError(input: {
  status: number
  rawText: string
  headers?: Headers
}): ParsedApiError {
  const { status, rawText, headers } = input

  // Try to parse as JSON (structured proxy error)
  let parsed: Record<string, unknown> | null = null
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>
  } catch { /* not JSON */ }

  // Extract error message
  let message = `HTTP ${status}`
  if (parsed) {
    const err = parsed.error
    if (typeof err === 'string') {
      message = err
    } else if (err && typeof err === 'object' && typeof (err as Record<string, unknown>).message === 'string') {
      message = (err as Record<string, unknown>).message as string
    } else if (typeof parsed.message === 'string') {
      message = parsed.message
    }
  }

  // Extract error category
  const errorCategory = typeof parsed?.errorCategory === 'string'
    ? parsed.errorCategory
    : classifyHttpStatus(status)

  // Extract upstream body preview
  const upstreamBodyPreview = typeof parsed?.upstreamBodyPreview === 'string'
    ? parsed.upstreamBodyPreview
    : undefined

  // Extract endpoint diagnostics
  const endpointDiag = parsed?.endpointDiagnostics as Record<string, unknown> | undefined
  const normalizedEndpoint = typeof endpointDiag?.normalizedApiUrl === 'string'
    ? endpointDiag.normalizedApiUrl as string
    : typeof endpointDiag?.endpoint === 'string'
      ? endpointDiag.endpoint as string
      : headers?.get('X-Vibe-Normalized-Endpoint') || undefined

  const endpointKind = typeof endpointDiag?.kind === 'string'
    ? endpointDiag.kind as string
    : headers?.get('X-Vibe-Endpoint-Kind') || undefined

  const endpointWarnings = Array.isArray(endpointDiag?.warnings)
    ? endpointDiag.warnings as string[]
    : (headers?.get('X-Vibe-Endpoint-Warnings') || '').split('; ').filter(Boolean)

  const endpointErrors = Array.isArray(endpointDiag?.errors)
    ? endpointDiag.errors as string[]
    : undefined

  // Extract request diagnostics
  const reqDiag = parsed?.requestDiagnostics as Record<string, unknown> | undefined
  const model = typeof reqDiag?.model === 'string' ? reqDiag.model : undefined
  const proxyDurationMs = typeof reqDiag?.proxyDurationMs === 'number' ? reqDiag.proxyDurationMs : undefined
  const upstreamDurationMs = typeof reqDiag?.upstreamDurationMs === 'number' ? reqDiag.upstreamDurationMs : undefined

  // Raw preview for non-JSON responses
  const rawPreview = parsed ? undefined : rawText.slice(0, 1200)

  return {
    httpStatus: status,
    errorCategory,
    message,
    upstreamBodyPreview,
    normalizedEndpoint,
    endpointKind,
    endpointWarnings: endpointWarnings.length > 0 ? endpointWarnings : undefined,
    endpointErrors,
    rawPreview,
    model,
    proxyDurationMs,
    upstreamDurationMs,
  }
}

/**
 * Classify HTTP status into an error category.
 */
export function classifyHttpStatus(status: number): string {
  if (status === 401) return 'auth_error'
  if (status === 403) return 'permission_error'
  if (status === 404) return 'model_not_found'
  if (status === 429) return 'quota_or_rate_limit'
  if (status === 400) return 'bad_request'
  if (status === 500) return 'provider_internal_error'
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable'
  return 'unknown_upstream_error'
}

/**
 * Map parsed API error to VibeAIError type.
 */
export function classifyParsedApiErrorToAIErrorType(parsed: ParsedApiError): 'connection' | 'timeout' | 'http' | 'empty' | 'json_parse' | 'validation' | 'unknown' {
  if (parsed.errorCategory === 'proxy_internal_error') return 'connection'
  if (parsed.errorCategory === 'upstream_unavailable') return 'connection'
  if (parsed.errorCategory === 'auth_error' || parsed.errorCategory === 'permission_error') return 'http'
  if (parsed.errorCategory === 'model_not_found') return 'http'
  if (parsed.errorCategory === 'quota_or_rate_limit') return 'http'
  if (parsed.errorCategory === 'bad_request') return 'http'
  if (parsed.errorCategory === 'provider_internal_error') return 'http'
  if (parsed.httpStatus) return 'http'
  return 'unknown'
}

/**
 * Build a user-facing error message from parsed API error.
 */
export function buildUserFacingApiErrorMessage(parsed: ParsedApiError): string {
  const parts: string[] = []

  // Category-specific prefix
  const categoryMessages: Record<string, string> = {
    auth_error: 'API key 无效或没有权限。',
    permission_error: 'API key 无权限访问该模型或服务。',
    model_not_found: 'endpoint 或模型名错误。',
    quota_or_rate_limit: '额度不足或触发限流。',
    bad_request: '请求格式错误。',
    provider_internal_error: '上游 API 服务内部错误。',
    upstream_unavailable: '上游 API 暂时不可用。',
    proxy_internal_error: 'AI 代理函数内部错误。',
  }

  const prefix = categoryMessages[parsed.errorCategory]
  if (prefix) parts.push(prefix)

  // Add the actual message
  if (parsed.message && parsed.message !== prefix) {
    parts.push(parsed.message)
  }

  // Add HTTP status
  if (parsed.httpStatus) {
    parts.push(`(HTTP ${parsed.httpStatus})`)
  }

  return parts.join(' ') || `API 请求失败 (HTTP ${parsed.httpStatus || 'unknown'})`
}
