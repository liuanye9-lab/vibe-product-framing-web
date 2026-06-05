/**
 * Model List Probe — V5.5
 *
 * Probes the provider's /v1/models endpoint to check model availability.
 * Goes through /api/models-proxy to avoid exposing API keys.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelListProbeResult {
  ok: boolean;
  httpStatus?: number;
  endpoint?: string;
  models: string[];
  rawPreview?: string;
  errorCategory?: string;
  errorMessage?: string;
  durationMs: number;
}

// ─── Probe ────────────────────────────────────────────────────────────────────

export async function probeProviderModels(input: {
  apiUrl: string;
  apiKey: string;
  timeoutMs?: number;
}): Promise<ModelListProbeResult> {
  const { apiUrl, apiKey, timeoutMs = 15000 } = input;
  const start = Date.now();

  try {
    const res = await fetch('/api/models-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl,
        apiKey,
        timeoutMs,
      }),
      signal: AbortSignal.timeout(timeoutMs + 5000), // Extra buffer for proxy
    });

    const durationMs = Date.now() - start;

    if (!res.ok) {
      let errorBody: { errorCategory?: string; error?: string; endpoint?: string } = {};
      try {
        errorBody = await res.json();
      } catch {
        // ignore
      }

      return {
        ok: false,
        httpStatus: res.status,
        endpoint: errorBody.endpoint,
        models: [],
        errorCategory: errorBody.errorCategory ?? 'unknown',
        errorMessage: errorBody.error ?? `HTTP ${res.status}`,
        durationMs,
      };
    }

    const data = await res.json();

    return {
      ok: data.ok ?? false,
      httpStatus: data.httpStatus ?? res.status,
      endpoint: data.endpoint,
      models: data.models ?? [],
      rawPreview: data.rawPreview,
      errorCategory: data.errorCategory,
      errorMessage: data.errorMessage,
      durationMs,
    };
  } catch (err) {
    return {
      ok: false,
      models: [],
      errorCategory: 'connection',
      errorMessage: err instanceof Error ? err.message : 'Unknown error',
      durationMs: Date.now() - start,
    };
  }
}

// ─── Model Matching ───────────────────────────────────────────────────────────

export function findSimilarModels(
  target: string,
  available: string[],
): string[] {
  const targetLower = target.toLowerCase();
  const similar: string[] = [];

  for (const model of available) {
    const modelLower = model.toLowerCase();
    // Exact match
    if (modelLower === targetLower) return []; // No suggestions needed
    // Partial match
    if (modelLower.includes(targetLower) || targetLower.includes(modelLower)) {
      similar.push(model);
    }
    // Shared prefix (at least 4 chars)
    const prefixLen = Math.min(4, targetLower.length, modelLower.length);
    if (prefixLen >= 4 && modelLower.slice(0, prefixLen) === targetLower.slice(0, prefixLen)) {
      if (!similar.includes(model)) similar.push(model);
    }
  }

  return similar.slice(0, 5); // Max 5 suggestions
}
