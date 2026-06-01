/**
 * V5.1 API Proxy — Vercel Serverless Function
 *
 * Forwards AI API requests from the browser to any OpenAI-compatible endpoint.
 * Uses Vercel Serverless runtime (not edge) for longer timeout support.
 *
 * V5.1 changes:
 * - Uses shared endpoint normalizer (same logic as vite.config.ts and frontend)
 * - Added X-Vibe-Normalized-Endpoint, X-Vibe-Endpoint-Kind, X-Vibe-Endpoint-Warnings headers
 * - Improved error messages for URL, key, model, quota, and timeout issues
 */

// DO NOT export runtime: 'edge' — Edge has 30s limit, too short for AI calls.
// Serverless default: 60s (Hobby), up to 900s (Pro with maxDuration config).

import { normalizeOpenAICompatibleEndpoint } from '../shared/endpointNormalizer';

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

  const apiUrl = payload.apiUrl?.trim();
  const apiKey = payload.apiKey?.trim();

  if (!apiUrl || !apiKey || !payload.body) {
    return jsonResponse({ error: 'Missing apiUrl, apiKey, or body' }, { status: 400 });
  }

  // V5.1: Use unified endpoint normalizer
  const normalized = normalizeOpenAICompatibleEndpoint(apiUrl);

  if (normalized.kind === 'invalid' || normalized.errors.length > 0) {
    return jsonResponse({
      error: normalized.errors.join('；') || 'API URL 无效。',
      endpointDiagnostics: normalized,
    }, { status: 400 });
  }

  // Safety: /v1/v1 should never reach upstream
  if (/\/v1\/v1(\/|$)/i.test(normalized.endpoint)) {
    return jsonResponse({
      error: 'Endpoint normalizer 出错：endpoint 仍包含 /v1/v1。请更新代码或使用 root URL。',
      endpointDiagnostics: normalized,
    }, { status: 400 });
  }

  const endpoint = normalized.endpoint;
  const timeoutMs = normalizeTimeoutMs(payload.timeoutMs);
  const maskedEndpoint = endpoint.replace(/\/\/[^@/]+@/, '//***@');

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
      // V5.1: Endpoint normalization diagnostics
      'X-Vibe-Normalized-Endpoint': maskedEndpoint,
      'X-Vibe-Endpoint-Kind': normalized.kind,
      'X-Vibe-Endpoint-Warnings': normalized.warnings.join('; '),
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
          'X-Vibe-Normalized-Endpoint': maskedEndpoint,
          'X-Vibe-Endpoint-Kind': normalized.kind,
          'X-Vibe-Endpoint-Warnings': normalized.warnings.join('; '),
        },
      }
    );
  }
}
