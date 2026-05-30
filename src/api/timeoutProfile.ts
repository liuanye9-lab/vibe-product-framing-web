/**
 * V4.9 — Unified AI Timeout Profile System
 *
 * Replaces hard-coded 40s/50s timeouts with task-appropriate profiles.
 * Each profile specifies:
 * - timeoutMs: suggested server-side wait time
 * - clientExtraMs: additional client-side buffer
 * - maxTokens: max output tokens for this task
 *
 * The proxy layer reads AI_PROXY_MAX_TIMEOUT_MS from env to set its upper cap.
 */

export type AITaskKind =
  | 'quick_ping'
  | 'json_test'
  | 'long_json_test'
  | 'agent_turn'
  | 'stage_suggestion'
  | 'handoff'
  | 'explain';

export interface TimeoutProfile {
  task: AITaskKind;
  timeoutMs: number;
  clientExtraMs: number;
  maxTokens: number;
  description: string;
}

/**
 * Task-specific timeout profiles.
 *
 * The total client-side timeout = timeoutMs + clientExtraMs.
 * The proxy's internal abort = normalized(timeoutMs) (capped by env proxy max).
 */

export const AI_TIMEOUT_PROFILES: Record<AITaskKind, TimeoutProfile> = {
  quick_ping: {
    task: 'quick_ping',
    timeoutMs: 12000,
    clientExtraMs: 5000,
    maxTokens: 40,
    description: '极轻量 ping，只验证 API 是否基本可达',
  },
  json_test: {
    task: 'json_test',
    timeoutMs: 30000,
    clientExtraMs: 8000,
    maxTokens: 160,
    description: '验证模型能否返回小 JSON',
  },
  long_json_test: {
    task: 'long_json_test',
    timeoutMs: 90000,
    clientExtraMs: 15000,
    maxTokens: 700,
    description: '验证模型能否返回复杂结构化 JSON',
  },
  agent_turn: {
    task: 'agent_turn',
    timeoutMs: 90000,
    clientExtraMs: 15000,
    maxTokens: 900,
    description: 'Agent 单轮推理决策',
  },
  stage_suggestion: {
    task: 'stage_suggestion',
    timeoutMs: 90000,
    clientExtraMs: 15000,
    maxTokens: 900,
    description: '阶段建议生成（产品/业务/技术/MVP 等）',
  },
  handoff: {
    task: 'handoff',
    timeoutMs: 120000,
    clientExtraMs: 20000,
    maxTokens: 1400,
    description: '开发交付文档完整生成',
  },
  explain: {
    task: 'explain',
    timeoutMs: 30000,
    clientExtraMs: 8000,
    maxTokens: 300,
    description: '简短解释/答疑',
  },
};

/**
 * Get a timeout profile by task kind.
 * Returns a copy to prevent mutation.
 */
export function getTimeoutProfile(task: AITaskKind): TimeoutProfile {
  return { ...AI_TIMEOUT_PROFILES[task] };
}

/**
 * Get the proxy-level maximum timeout (ms).
 *
 * Priority:
 * 1. import.meta.env.VITE_AI_PROXY_MAX_TIMEOUT_MS
 * 2. Default: 120000 (2 min)
 *
 * Clamped to [10_000, 300_000].
 * If no env var is set, returns the default.
 */
export function getProxyMaxTimeoutMs(): number {
  const envVal = typeof import.meta !== 'undefined'
    && import.meta.env
    && import.meta.env.VITE_AI_PROXY_MAX_TIMEOUT_MS
    ? import.meta.env.VITE_AI_PROXY_MAX_TIMEOUT_MS
    : undefined;

  const parsed = envVal ? Number(envVal) : NaN;
  const base = Number.isFinite(parsed) ? parsed : 120000;
  // Clamp: 10s min, 300s max
  return Math.min(Math.max(base, 10000), 300000);
}

/**
 * Quick ping constants shared between SettingsPage and apiHealth.
 */
export const QUICK_PING_PROFILE = AI_TIMEOUT_PROFILES.quick_ping;
export const JSON_TEST_PROFILE = AI_TIMEOUT_PROFILES.json_test;
export const LONG_JSON_TEST_PROFILE = AI_TIMEOUT_PROFILES.long_json_test;
