/**
 * V5.2 — AI Timing Diagnostics
 *
 * Captures per-request timing data and persists the last result to localStorage.
 * Used by SettingsPage and Agent Debug panels to show API performance.
 *
 * V5.2 changes:
 * - Added errorCategory, errorMessage, upstreamBodyPreview, rawResponsePreview fields
 */

export interface AITimingDiagnostic {
  /** Client-side total duration (ms) */
  durationMs: number;
  /** Proxy internal duration (ms) from X-Vibe-Proxy-Duration-Ms */
  proxyDurationMs: number;
  /** Upstream API duration (ms) from X-Vibe-Upstream-Duration-Ms */
  upstreamDurationMs: number;
  /** Server-side timeout used (ms) */
  timeoutMs: number;
  /** Model name used */
  model: string;
  /** Masked endpoint (no apiKey) */
  endpoint: string;
  /** V5.1: Normalized endpoint from proxy */
  normalizedEndpoint?: string;
  /** V5.1: Endpoint kind (root, v1_root, chat_completions, etc.) */
  endpointKind?: string;
  /** V5.1: Endpoint normalization warnings */
  endpointWarnings?: string[];
  /** V5.1: User-input API URL */
  apiUrlInput?: string;
  /** HTTP status of the proxy response */
  status: number;
  /** Request succeeded (status 2xx and valid response) */
  ok: boolean;
  /** ISO timestamp */
  timestamp: string;
  /** Task kind for this request */
  task?: string;
  /** Response character count */
  responseChars: number;
  /** V5.2: Error category from proxy */
  errorCategory?: string;
  /** V5.2: Error message from proxy */
  errorMessage?: string;
  /** V5.2: Upstream response body preview */
  upstreamBodyPreview?: string;
  /** V5.2: Raw response preview (for non-JSON) */
  rawResponsePreview?: string;
  /** V7: Masked request debug snapshot. Never stores raw API keys. */
  requestDebug?: {
    url: string;
    method: string;
    headers: Record<string, string>;
    payload: Record<string, unknown>;
    attempt?: number;
  };
}

const LAST_AI_TIMING_KEY = 'vibepilot_last_ai_timing';

export function saveLastAITiming(diag: AITimingDiagnostic): void {
  try {
    localStorage.setItem(LAST_AI_TIMING_KEY, JSON.stringify({
      ...diag,
      timestamp: diag.timestamp || new Date().toISOString(),
    }));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function getLastAITiming(): AITimingDiagnostic | null {
  try {
    const raw = localStorage.getItem(LAST_AI_TIMING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AITimingDiagnostic;
  } catch {
    return null;
  }
}

export function clearLastAITiming(): void {
  localStorage.removeItem(LAST_AI_TIMING_KEY);
}

/**
 * Extract timing headers from a fetch Response.
 * Returns null if headers are missing (non-proxy response).
 */
export function extractProxyTimingHeaders(response: Response): {
  proxyDurationMs: number;
  upstreamDurationMs: number;
  endpoint: string;
  timeoutMs: number;
} | null {
  const proxyDurationMs = Number(response.headers.get('X-Vibe-Proxy-Duration-Ms'));
  if (!Number.isFinite(proxyDurationMs)) return null;
  return {
    proxyDurationMs,
    upstreamDurationMs: Number(response.headers.get('X-Vibe-Upstream-Duration-Ms')) || 0,
    endpoint: response.headers.get('X-Vibe-Upstream-Endpoint') || 'unknown',
    timeoutMs: Number(response.headers.get('X-Vibe-Timeout-Ms')) || 0,
  };
}
