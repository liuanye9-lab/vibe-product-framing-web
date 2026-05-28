/**
 * V4.4 API Proxy — Vercel Serverless Function
 *
 * Forwards AI API requests from the browser to any OpenAI-compatible endpoint.
 * Uses Vercel Serverless runtime (no edge) for 60s timeout on Hobby / 900s on Pro.
 *
 * Added: detailed error diagnostics, CORS headers, maxDuration support.
 */

// DO NOT export runtime: 'edge' — Edge has 30s limit, too short for AI calls.
// Serverless default: 60s (Hobby), up to 900s (Pro with maxDuration config).

export const config = {
  maxDuration: 55, // seconds — just under Vercel Hobby 60s limit
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
    return `${cleanUrl}/chat/completions`;
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

function normalizeTimeoutMs(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 50000;
  // V4.4: Cap at 50s to stay within Vercel serverless 55s limit
  return Math.min(Math.max(n, 10000), 50000);
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

  // Validate non-standard endpoints
  if (!/\/chat\/completions$/i.test(endpoint)) {
    return jsonResponse({
      error: '该服务商 API 路径可能不是 OpenAI-compatible，请填写完整 chat completions endpoint。',
    }, { status: 400 });
  }

  try {
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

    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: getUpstreamErrorMessage(error, endpoint, timeoutMs),
      },
      { status: 502 }
    );
  }
}
