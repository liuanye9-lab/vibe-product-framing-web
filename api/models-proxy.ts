/**
 * Models Proxy — V5.5
 *
 * Vercel Serverless function that probes /v1/models endpoints.
 * Never returns API keys to the client.
 * Supports OpenAI-compatible /v1/models.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// ─── Timeout helper ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Build models endpoint ────────────────────────────────────────────────────

function buildModelsEndpoint(apiUrl: string): string {
  let url = apiUrl.trim();

  // If it's a chat/completions endpoint, replace with models
  if (url.includes('/chat/completions')) {
    url = url.replace('/chat/completions', '/models');
  } else if (url.endsWith('/v1')) {
    url = url + '/models';
  } else if (url.endsWith('/v1/')) {
    url = url + 'models';
  } else if (!url.endsWith('/models')) {
    // Root URL — append /v1/models
    const base = url.endsWith('/') ? url.slice(0, -1) : url;
    url = base + '/v1/models';
  }

  return url;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { apiUrl, apiKey, timeoutMs = 15000 } = req.body as {
      apiUrl: string;
      apiKey: string;
      timeoutMs?: number;
    };

    if (!apiUrl || !apiKey) {
      res.status(400).json({
        ok: false,
        error: 'Missing required fields: apiUrl, apiKey',
      });
      return;
    }

    const endpoint = buildModelsEndpoint(apiUrl);
    const effectiveTimeout = Math.min(Math.max(timeoutMs, 5000), 30000);

    const upstreamRes = await fetchWithTimeout(
      endpoint,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
      effectiveTimeout,
    );

    const bodyText = await upstreamRes.text();
    const rawPreview = bodyText.slice(0, 2000);

    if (!upstreamRes.ok) {
      // Classify error
      let errorCategory = 'provider_internal_error';
      const bodyLower = bodyText.toLowerCase();

      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        errorCategory = 'auth_error';
      } else if (upstreamRes.status === 404) {
        errorCategory = 'not_supported';
      } else if (upstreamRes.status === 429) {
        errorCategory = 'rate_limit';
      } else if (bodyLower.includes('model') && bodyLower.includes('not found')) {
        errorCategory = 'model_not_found';
      }

      res.status(200).json({
        ok: false,
        httpStatus: upstreamRes.status,
        endpoint,
        models: [],
        rawPreview,
        errorCategory,
        errorMessage: `上游返回 HTTP ${upstreamRes.status}`,
      });
      return;
    }

    // Parse models list — supports multiple provider response formats
    let models: string[] = [];
    try {
      const data = JSON.parse(bodyText);
      if (Array.isArray(data.data)) {
        // OpenAI standard: { data: [{ id: "model" }] }
        models = data.data
          .map((item: { id?: string }) => item.id)
          .filter((id: string | undefined): id is string => typeof id === 'string');
      } else if (Array.isArray(data.models)) {
        // Some providers: { models: [{ id: "...", name: "..." }] }
        models = data.models
          .map((item: { id?: string; name?: string }) => item.id ?? item.name)
          .filter((id: string | undefined): id is string => typeof id === 'string');
      } else if (Array.isArray(data)) {
        // Some providers: ["model1", "model2"]
        models = data.filter((item: unknown): item is string => typeof item === 'string');
      }
    } catch {
      // Not valid JSON — provider might not support /v1/models properly
    }

    // Limit to 200 models
    if (models.length > 200) {
      models = models.slice(0, 200);
    }

    res.status(200).json({
      ok: true,
      httpStatus: upstreamRes.status,
      endpoint,
      models,
      rawPreview,
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      httpStatus: 0,
      models: [],
      errorCategory: 'connection',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}
