/**
 * V5.2 API Proxy — Vercel Serverless Function
 *
 * Forwards AI API requests from the browser to any OpenAI-compatible endpoint.
 * Uses Vercel Serverless runtime (not edge) for longer timeout support.
 *
 * V5.2 changes:
 * - GET health check with endpoint normalizer self-test
 * - Structured upstream error response with body preview
 * - Proxy internal error JSON wrapper (no more raw 500 HTML)
 * - Error category classification (auth, model, quota, etc.)
 */

// DO NOT export runtime: 'edge' — Edge has 30s limit, too short for AI calls.
// Serverless default: 60s (Hobby), up to 900s (Pro with maxDuration config).

import { normalizeOpenAICompatibleEndpoint, runEndpointNormalizerSelfTest } from '../shared/endpointNormalizer';

export const config = {
  maxDuration: 120, // seconds — actual ceiling depends on Vercel plan
};

const MAX_CONCURRENT_UPSTREAM_REQUESTS = 3;
let activeUpstreamRequests = 0;
const upstreamQueue: Array<() => void> = [];

async function acquireUpstreamSlot(): Promise<() => void> {
  if (activeUpstreamRequests >= MAX_CONCURRENT_UPSTREAM_REQUESTS) {
    await new Promise<void>((resolve) => upstreamQueue.push(resolve));
  }

  activeUpstreamRequests += 1;
  return () => {
    activeUpstreamRequests = Math.max(0, activeUpstreamRequests - 1);
    const next = upstreamQueue.shift();
    if (next) next();
  };
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...(init?.headers || {}),
    },
  });
}

/**
 * Normalize the timeout value sent from the client.
 */
function normalizeTimeoutMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  const env = typeof process !== 'undefined' ? process.env : {} as Record<string, string | undefined>;
  const envMaxRaw = env.AI_PROXY_MAX_TIMEOUT_MS || env.VITE_AI_PROXY_MAX_TIMEOUT_MS || '120000';
  const envMax = Number(envMaxRaw);
  const max = Number.isFinite(envMax) ? Math.min(Math.max(envMax, 10000), 300000) : 120000;
  if (!Number.isFinite(n)) return Math.min(90000, max);
  return Math.min(Math.max(n, 10000), max);
}

function getAbortSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

/**
 * V5.2: Extract model name from request body.
 */
function extractModelFromPayload(body: unknown): string {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    if (typeof b.model === 'string') return b.model;
  }
  return 'unknown';
}

/**
 * V5.5: Extract request body shape diagnostics for debugging.
 * Never returns user content — only structural info.
 */
function extractRequestBodyShape(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return { valid: false };
  }
  const b = body as Record<string, unknown>;
  const messages = Array.isArray(b.messages) ? b.messages : [];
  return {
    model: typeof b.model === 'string' ? b.model : 'unknown',
    messageCount: messages.length,
    roles: messages.map((m: { role?: string }) => m?.role).filter(Boolean),
    hasSystemRole: messages.some((m: { role?: string }) => m?.role === 'system'),
    hasTemperature: 'temperature' in b,
    hasMaxTokens: 'max_tokens' in b,
    hasMaxCompletionTokens: 'max_completion_tokens' in b,
    hasStreamField: 'stream' in b,
    topLevelKeys: Object.keys(b),
  };
}

function validateChatPayload(body: unknown): string[] {
  const errors: string[] = [];
  if (!body || typeof body !== 'object') {
    return ['body 必须是对象。'];
  }

  const b = body as Record<string, unknown>;
  if (typeof b.model !== 'string' || b.model.trim().length === 0) {
    errors.push('body.model 必须是非空字符串。');
  }
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    errors.push('body.messages 必须是非空数组。');
  } else {
    b.messages.forEach((message, index) => {
      if (!message || typeof message !== 'object') {
        errors.push(`body.messages[${index}] 必须是对象。`);
        return;
      }
      const m = message as Record<string, unknown>;
      if (typeof m.role !== 'string') {
        errors.push(`body.messages[${index}].role 必须是字符串。`);
      }
      const content = m.content;
      const validContent = typeof content === 'string' || Array.isArray(content);
      if (!validContent) {
        errors.push(`body.messages[${index}].content 必须是字符串或 content parts 数组。`);
      }
    });
  }

  return errors;
}

/**
 * V5.2: Extract a human-readable error message from upstream response.
 */
function extractUpstreamErrorMessage(
  parsedError: unknown,
  bodyPreview: string,
  status: number,
): string {
  if (parsedError && typeof parsedError === 'object') {
    const err = parsedError as Record<string, unknown>;
    // OpenAI-style: { error: { message: "...", type: "..." } }
    if (err.error && typeof err.error === 'object') {
      const inner = err.error as Record<string, unknown>;
      if (typeof inner.message === 'string') return inner.message;
      if (typeof inner.type === 'string') return `type: ${inner.type}`;
      if (typeof inner.code === 'string') return `code: ${inner.code}`;
    }
    // Simple: { error: "..." }
    if (typeof err.error === 'string') return err.error;
    // Generic: { message: "..." }
    if (typeof err.message === 'string') return err.message;
    if (typeof err.code === 'string') return `code: ${err.code}`;
  }

  // Body preview for non-JSON
  if (bodyPreview.length > 0) {
    return `HTTP ${status}: ${bodyPreview.slice(0, 200)}`;
  }

  return `HTTP ${status}`;
}

/**
 * V5.2: Classify upstream HTTP status + body into an error category.
 */
function classifyUpstreamHttpStatus(
  status: number,
  parsedError: unknown,
  bodyPreview: string,
):
  | 'auth_error'
  | 'permission_error'
  | 'model_not_found'
  | 'quota_or_rate_limit'
  | 'provider_internal_error'
  | 'bad_request'
  | 'upstream_unavailable'
  | 'unknown_upstream_error'
{
  // Status-based classification
  if (status === 401) return 'auth_error';
  if (status === 403) return 'permission_error';
  if (status === 400) return 'bad_request';
  if (status === 429) return 'quota_or_rate_limit';
  if (status === 502 || status === 503 || status === 504) return 'upstream_unavailable';

  // Body-based refinement for 404 and 500
  const bodyLower = bodyPreview.toLowerCase();
  const errorStr = parsedError ? JSON.stringify(parsedError).toLowerCase() : bodyLower;

  if (status === 404) {
    if (bodyLower.includes('model') || bodyLower.includes('模型') || bodyLower.includes('not found')) {
      return 'model_not_found';
    }
    return 'model_not_found';
  }

  if (status === 500) {
    // Check body for specific error patterns
    if (
      errorStr.includes('model') &&
      (
        errorStr.includes('not found') ||
        errorStr.includes('not exist') ||
        errorStr.includes('does not exist') ||
        errorStr.includes('invalid') ||
        errorStr.includes('not support') ||
        errorStr.includes('unsupported') ||
        errorStr.includes('模型不存在') ||
        errorStr.includes('模型名')
      )
    ) {
      return 'model_not_found';
    }
    if (errorStr.includes('insufficient') || errorStr.includes('quota') || errorStr.includes('balance') || errorStr.includes('余额')) {
      return 'quota_or_rate_limit';
    }
    if (
      errorStr.includes('permission') ||
      errorStr.includes('forbidden') ||
      errorStr.includes('not allowed') ||
      errorStr.includes('access denied') ||
      errorStr.includes('无权限') ||
      errorStr.includes('未开通')
    ) {
      return 'permission_error';
    }
    if (errorStr.includes('key') || errorStr.includes('token') || errorStr.includes('unauthorized') || errorStr.includes('auth')) {
      return 'auth_error';
    }
    return 'provider_internal_error';
  }

  return 'unknown_upstream_error';
}

/**
 * V5.2: Handle GET request — health check + normalizer self-test.
 */
function handleHealthCheck(): Response {
  const selfTest = runEndpointNormalizerSelfTest();
  const failedCases = selfTest.filter(tc => !tc.passed);

  return jsonResponse({
    ok: failedCases.length === 0,
    service: 'vibe-ai-proxy',
    version: 'v5.2',
    runtime: 'vercel-serverless',
    timestamp: new Date().toISOString(),
    normalizerSelfTest: {
      passed: failedCases.length === 0,
      total: selfTest.length,
      failed: failedCases.length,
      failedCases: failedCases.length > 0 ? failedCases.map(tc => ({
        input: tc.input,
        expected: tc.expected,
        actual: tc.actual,
        note: tc.note,
      })) : undefined,
    },
  });
}

/**
 * V5.2: Main proxy request handler (POST).
 */
async function handleProxyRequest(request: Request): Promise<Response> {
  const proxyStartedAt = performance.now();

  let payload: {
    apiUrl?: string;
    apiKey?: string;
    body?: unknown;
    timeoutMs?: number;
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body', errorCategory: 'bad_request' }, { status: 400 });
  }

  const apiUrl = payload.apiUrl?.trim();
  const apiKey = payload.apiKey?.trim();

  if (!apiUrl || !apiKey || !payload.body) {
    return jsonResponse({ error: 'Missing apiUrl, apiKey, or body', errorCategory: 'bad_request' }, { status: 400 });
  }

  // V5.1: Use unified endpoint normalizer
  const normalized = normalizeOpenAICompatibleEndpoint(apiUrl);

  if (normalized.kind === 'invalid' || normalized.errors.length > 0) {
    return jsonResponse({
      error: normalized.errors.join('；') || 'API URL 无效。',
      errorCategory: 'bad_request',
      endpointDiagnostics: normalized,
    }, { status: 400 });
  }

  // Safety: /v1/v1 should never reach upstream
  if (/\/v1\/v1(\/|$)/i.test(normalized.endpoint)) {
    return jsonResponse({
      error: 'Endpoint normalizer 出错：endpoint 仍包含 /v1/v1。请更新代码或使用 root URL。',
      errorCategory: 'bad_request',
      endpointDiagnostics: normalized,
    }, { status: 400 });
  }

  const endpoint = normalized.endpoint;
  const timeoutMs = normalizeTimeoutMs(payload.timeoutMs);
  const maskedEndpoint = endpoint.replace(/\/\/[^@/]+@/, '//***@');
  const payloadErrors = validateChatPayload(payload.body);
  if (payloadErrors.length > 0) {
    return jsonResponse({
      error: payloadErrors.join('；'),
      errorCategory: 'bad_request',
      requestDiagnostics: {
        model: extractModelFromPayload(payload.body),
        timeoutMs,
        requestBodyShape: extractRequestBodyShape(payload.body),
      },
    }, { status: 400 });
  }

  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await acquireUpstreamSlot();
    const upstreamStartedAt = performance.now();
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: getAbortSignal(timeoutMs),
      body: JSON.stringify(payload.body),
    });

    const text = await upstream.text();
    const upstreamCompletedAt = performance.now();
    const proxyDurationMs = Math.round(performance.now() - proxyStartedAt);
    const upstreamDurationMs = Math.round(upstreamCompletedAt - upstreamStartedAt);

    const responseHeaders: Record<string, string> = {
      'X-Vibe-Proxy-Duration-Ms': String(proxyDurationMs),
      'X-Vibe-Upstream-Endpoint': maskedEndpoint,
      'X-Vibe-Upstream-Duration-Ms': String(upstreamDurationMs),
      'X-Vibe-Timeout-Ms': String(timeoutMs),
      'X-Vibe-Normalized-Endpoint': maskedEndpoint,
      'X-Vibe-Endpoint-Kind': normalized.kind,
      'X-Vibe-Endpoint-Warnings': normalized.warnings.join('; '),
    };

    // V5.2: Structured upstream error response
    if (!upstream.ok) {
      const upstreamContentType = upstream.headers.get('content-type') || '';
      const bodyPreview = text.slice(0, 1200);

      let parsedError: unknown = null;
      try { parsedError = JSON.parse(text); } catch { /* not JSON */ }

      const errorCategory = classifyUpstreamHttpStatus(upstream.status, parsedError, bodyPreview);
      const errorMessage = extractUpstreamErrorMessage(parsedError, bodyPreview, upstream.status);

      return jsonResponse({
        error: errorMessage,
        errorCategory,
        upstreamStatus: upstream.status,
        upstreamContentType,
        upstreamBodyPreview: bodyPreview,
        endpointDiagnostics: {
          inputApiUrl: apiUrl,
          normalizedEndpoint: maskedEndpoint,
          endpoint: maskedEndpoint,
          kind: normalized.kind,
          warnings: normalized.warnings,
          errors: normalized.errors,
        },
        requestDiagnostics: {
          model: extractModelFromPayload(payload.body),
          timeoutMs,
          proxyDurationMs,
          upstreamDurationMs,
          requestBodyShape: extractRequestBodyShape(payload.body),
        },
      }, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // V5.2: Success — return upstream response as-is
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...responseHeaders,
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const proxyDurationMs = Math.round(performance.now() - proxyStartedAt);

    // Classify the error
    let errorMessage: string;
    let errorCategory: string;

    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        errorMessage = `上游 API 请求超时 (${timeoutMs}ms)。`;
        errorCategory = 'timeout';
      } else {
        errorMessage = `代理无法连接到上游 API：${error.message}`;
        errorCategory = 'upstream_unavailable';
      }
    } else {
      errorMessage = '代理无法连接到上游 API。';
      errorCategory = 'upstream_unavailable';
    }

    return jsonResponse(
      {
        error: errorMessage,
        errorCategory,
        upstreamBodyPreview: `已尝试请求：${maskedEndpoint}。timeoutMs: ${timeoutMs}`,
        endpointDiagnostics: {
          inputApiUrl: apiUrl,
          normalizedEndpoint: maskedEndpoint,
          endpoint: maskedEndpoint,
          kind: normalized.kind,
          warnings: normalized.warnings,
        },
        requestDiagnostics: {
          model: extractModelFromPayload(payload.body),
          timeoutMs,
          proxyDurationMs,
          requestBodyShape: extractRequestBodyShape(payload.body),
        },
      },
      {
        status: 502,
        headers: {
          'X-Vibe-Proxy-Duration-Ms': String(proxyDurationMs),
          'X-Vibe-Upstream-Endpoint': maskedEndpoint,
          'X-Vibe-Timeout-Ms': String(timeoutMs),
          'X-Vibe-Normalized-Endpoint': maskedEndpoint,
          'X-Vibe-Endpoint-Kind': normalized.kind,
          'X-Vibe-Endpoint-Warnings': normalized.warnings.join('; '),
        },
      }
    );
  } finally {
    releaseSlot?.();
  }
}

/**
 * V5.2: Main handler — dispatches GET (health) and POST (proxy).
 * Wrapped in try-catch to prevent Vercel 500 HTML.
 */
export default async function handler(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') {
      return jsonResponse({
        ok: true,
        service: 'vibe-ai-proxy',
        method: 'OPTIONS',
        timestamp: new Date().toISOString(),
      });
    }

    // V5.2: GET health check
    if (request.method === 'GET') {
      return handleHealthCheck();
    }

    // POST — proxy request
    if (request.method === 'POST') {
      return await handleProxyRequest(request);
    }

    // Other methods — 405
    return jsonResponse({ error: 'Method not allowed', errorCategory: 'bad_request' }, { status: 405 });
  } catch (error) {
    // V5.2: Catch any internal errors and return JSON instead of Vercel HTML
    const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';
    return jsonResponse({
      error: 'AI Proxy 内部错误',
      errorCategory: 'proxy_internal_error',
      message: error instanceof Error ? error.message : String(error),
      stackPreview: isDev
        ? error instanceof Error ? error.stack?.slice(0, 1200) : undefined
        : undefined,
    }, { status: 500 });
  }
}
