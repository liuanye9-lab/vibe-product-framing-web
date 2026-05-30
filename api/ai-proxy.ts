/**
 * V4.9 API Proxy — Vercel Serverless Function
 *
 * Forwards AI API requests from the browser to any OpenAI-compatible endpoint.
 * Uses Vercel Serverless runtime (not edge) for longer timeout support.
 *
 * V4.9 changes:
 * - Removed 50s hard timeout cap; now controlled by AI_PROXY_MAX_TIMEOUT_MS env var (default 120s).
 * - Added X-Vibe-* response headers for timing diagnostics.
 * - maxDuration set to 120s. Actual limit still depends on plan: Hobby 60s, Pro 900s.
 *   If deploying to Hobby, set AI_PROXY_MAX_TIMEOUT_MS=50000 to stay within the 60s limit.
 */

// DO NOT export runtime: 'edge' — Edge has 30s limit, too short for AI calls.
// Serverless default: 60s (Hobby), up to 900s (Pro with maxDuration config).

export const config = {
  maxDuration: 120, // seconds — actual ceiling depends on Vercel plan
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  });
}

function normalizeChatCompletionsEndpoint(rawApiUrl: string): string {
  const cleanUrl = rawApiUrl.trim().replace(/\/+$/, '');

  if (/\/chat\/completions$/i.test(cleanUrl)) {
    return cleanUrl;
  }

  if (/\/v1$/i.test(cleanUrl)) {
    return `${cleanUrl}/v1/chat/completions`;
  }

  if (/\/v1\/chat$/i.test(cleanUrl)) {
    return `${cleanUrl}/completions`;
  }

  // Non-standard paths: if it contains /api/paas but no /chat/completions,
  // don't guess — let the caller handle it
  if (/\/api\/paas/i.test(cleanUrl) && !/\/chat\/completions$/i.test(cleanUrl)) {
    return rawApiUrl; // Return as-is, caller should validate
  }

  return `${cleanUrl}/v1/chat/completions`;
}

/**
 * Normalize the timeout value sent from the client.
 *
 * V4.9: Max is controlled by AI_PROXY_MAX_TIMEOUT_MS env var (default 120000).
 * Min is 10000 (10s). Values outside [10s, env_max] are clamped.
 */
function normalizeTimeoutMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  // Read proxy max from Vercel env (process.env on serverless)
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

function getUpstreamErrorMessage(error: unknown, endpoint: string, timeoutMs: number): string {
  if (error instanceof Error) {
    return `代理无法连接到上游 API：${error.message}。已尝试请求：${endpoint}。timeoutMs: ${timeoutMs}`;
  }

  return `代理无法连接到上游 API。已尝试请求：${endpoint}。timeoutMs: ${timeoutMs}`;
}

export default async function handler(request: Request) {
  const proxyStartedAt = performance.now();

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload: {
    apiUrl?: string;
    apiKey?: string;
    body?: unknown;
    timeoutMs?: number;
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const apiUrl = payload.apiUrl?.trim().replace(/\/+$/, '');
  const apiKey = payload.apiKey?.trim();

  if (!apiUrl || !apiKey || !payload.body) {
    return jsonResponse({ error: 'Missing apiUrl, apiKey, or body' }, { status: 400 });
  }

  if (!/^https?:\/\//i.test(apiUrl)) {
    return jsonResponse({ error: 'apiUrl must start with http:// or https://' }, { status: 400 });
  }

  const endpoint = normalizeChatCompletionsEndpoint(apiUrl);
  const timeoutMs = normalizeTimeoutMs(payload.timeoutMs);
  const maskedEndpoint = endpoint.replace(/\/\/[^@/]+@/, '//***@');

  // Validate non-standard endpoints
  if (!/\/chat\/completions$/i.test(endpoint)) {
    return jsonResponse({
      error: '该服务商 API 路径可能不是 OpenAI-compatible，请填写完整 chat completions endpoint。',
    }, { status: 400 });
  }

  try {
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
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      // V4.9: Timing diagnostics headers (safe, no apiKey exposed)
      'X-Vibe-Proxy-Duration-Ms': String(proxyDurationMs),
      'X-Vibe-Upstream-Endpoint': maskedEndpoint,
      'X-Vibe-Upstream-Duration-Ms': String(upstreamDurationMs),
      'X-Vibe-Timeout-Ms': String(timeoutMs),
    };

    return new Response(text, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const proxyDurationMs = Math.round(performance.now() - proxyStartedAt);
    return jsonResponse(
      {
        error: getUpstreamErrorMessage(error, endpoint, timeoutMs),
        proxyDurationMs,
      },
      {
        status: 502,
        headers: {
          'X-Vibe-Proxy-Duration-Ms': String(proxyDurationMs),
          'X-Vibe-Upstream-Endpoint': maskedEndpoint,
          'X-Vibe-Timeout-Ms': String(timeoutMs),
        },
      }
    );
  }
}
