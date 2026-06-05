/**
 * Model List Probe — V5.6
 *
 * Probes the provider's /v1/models endpoint to check model availability.
 * Goes through /api/models-proxy to avoid exposing API keys.
 *
 * V5.6 changes:
 * - Added currentModel parameter to check if model exists in list
 * - Added currentModelFound and similarModels to result
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
  /** V5.6: Whether the current model was found in the list */
  currentModelFound?: boolean;
  /** V5.6: Similar model names to the current model */
  similarModels?: string[];
}

// ─── Probe ────────────────────────────────────────────────────────────────────

export async function probeProviderModels(input: {
  apiUrl: string;
  apiKey: string;
  currentModel?: string;
  timeoutMs?: number;
}): Promise<ModelListProbeResult> {
  const { apiUrl, apiKey, currentModel, timeoutMs = 15000 } = input;
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
    const models: string[] = data.models ?? [];

    // V5.6: Check if current model is in the list
    let currentModelFound: boolean | undefined;
    let similarModels: string[] | undefined;

    if (currentModel && models.length > 0) {
      const currentLower = currentModel.toLowerCase();
      currentModelFound = models.some((m: string) => m.toLowerCase() === currentLower);

      if (!currentModelFound) {
        similarModels = findSimilarModels(currentModel, models);
      }
    }

    return {
      ok: data.ok ?? false,
      httpStatus: data.httpStatus ?? res.status,
      endpoint: data.endpoint,
      models,
      rawPreview: data.rawPreview,
      errorCategory: data.errorCategory,
      errorMessage: data.errorMessage,
      durationMs,
      currentModelFound,
      similarModels,
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

  // Strip separators for fuzzy matching
  const targetStripped = targetLower.replace(/[-_.]/g, '');

  for (const model of available) {
    const modelLower = model.toLowerCase();
    // Exact match
    if (modelLower === targetLower) return []; // No suggestions needed
    // Partial match
    if (modelLower.includes(targetLower) || targetLower.includes(modelLower)) {
      similar.push(model);
      continue;
    }
    // Fuzzy: strip separators and check inclusion
    const modelStripped = modelLower.replace(/[-_.]/g, '');
    if (modelStripped.length >= 4 && targetStripped.length >= 4) {
      if (modelStripped.includes(targetStripped) || targetStripped.includes(modelStripped)) {
        if (!similar.includes(model)) similar.push(model);
        continue;
      }
    }
    // Shared prefix (at least 4 chars)
    const prefixLen = Math.min(4, targetLower.length, modelLower.length);
    if (prefixLen >= 4 && modelLower.slice(0, prefixLen) === targetLower.slice(0, prefixLen)) {
      if (!similar.includes(model)) similar.push(model);
    }
  }

  return similar.slice(0, 5); // Max 5 suggestions
}
