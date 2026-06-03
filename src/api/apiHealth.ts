/**
 * V4.9 API Health Status System
 *
 * Manages API readiness state in localStorage.
 * Core workflows MUST call assertApiReady() before executing.
 * No local-rule or mock fallback is accepted as a substitute.
 *
 * V4.9 changes:
 * - Added basic_ready state (Quick Ping + JSON Test pass)
 * - Split failure states: proxy_failed, quick_ping_failed, json_failed, long_json_failed
 * - Agent can run with basic_ready; Handoff requires ready.
 *
 * V5.3 changes:
 * - Added smokeTest field to tests
 * - API Ready based on single smoke test (non-empty model response)
 * - Long JSON / Reference Validation no longer block API Ready
 */

export type ApiHealthStatus =
  | 'unknown'
  | 'not_configured'
  | 'proxy_failed'
  | 'quick_ping_failed'
  | 'json_failed'
  | 'long_json_failed'
  | 'validation_failed'
  | 'basic_ready'
  | 'ready';

export interface ApiHealthState {
  status: ApiHealthStatus;
  checkedAt?: string;
  provider?: string;
  model?: string;
  apiUrl?: string;
  message: string;
  details?: string;
  /** V4.9: per-test results */
  tests?: {
    smokeTest?: { status: 'pass' | 'fail' | 'pending'; durationMs?: number; error?: string; checkedAt?: string; variantId?: string };
    quickPing?: { status: 'pass' | 'fail' | 'pending'; durationMs?: number; error?: string };
    jsonTest?: { status: 'pass' | 'fail' | 'pending'; durationMs?: number; error?: string };
    longJson?: { status: 'pass' | 'fail' | 'pending'; durationMs?: number; error?: string };
    refValidation?: { status: 'pass' | 'fail' | 'pending'; reason?: string };
  };
}

const API_HEALTH_KEY = 'vibepilot_api_health_v4';

function emptyHealth(): ApiHealthState {
  return { status: 'not_configured', message: 'API 未配置。' };
}

export function getApiHealth(): ApiHealthState {
  try {
    const raw = localStorage.getItem(API_HEALTH_KEY);
    if (!raw) return emptyHealth();
    const parsed = JSON.parse(raw) as Partial<ApiHealthState>;
    if (!parsed.status) return emptyHealth();
    return {
      status: parsed.status,
      checkedAt: parsed.checkedAt,
      provider: parsed.provider,
      model: parsed.model,
      apiUrl: parsed.apiUrl,
      message: parsed.message || '',
      details: parsed.details,
      tests: parsed.tests,
    };
  } catch {
    return emptyHealth();
  }
}

export function saveApiHealth(state: ApiHealthState): void {
  localStorage.setItem(API_HEALTH_KEY, JSON.stringify({
    ...state,
    checkedAt: state.checkedAt || new Date().toISOString(),
  }));
}

export function clearApiHealth(): void {
  localStorage.removeItem(API_HEALTH_KEY);
}

/** V4.9: Agent can run with basic_ready or ready. */
export function isApiReady(): boolean {
  const status = getApiHealth().status;
  return status === 'ready' || status === 'basic_ready';
}

/** V4.9: Handoff requires full ready (all 4 tests pass). */
export function isApiFullyReady(): boolean {
  return getApiHealth().status === 'ready';
}

/**
 * Throw if API is not at least basic_ready.
 * Must be called at the start of every core workflow path.
 * V5.3: basic_ready is sufficient for all tasks (smoke test passed).
 */
export function assertApiReady(): void {
  const health = getApiHealth();
  if (health.status === 'ready' || health.status === 'basic_ready') return;

  const messages: Record<ApiHealthStatus, string> = {
    unknown: 'API 状态未知。请进入设置页点击「测试并保存 API」完成 Smoke Test。',
    not_configured: 'API 未配置。请先进入设置页填写 API URL、API Key 和模型名。',
    proxy_failed: 'API 代理不可达。请检查部署环境是否正常。',
    quick_ping_failed: 'API Smoke Test 失败。请在设置页重新测试。',
    json_failed: 'API Smoke Test 失败（模型返回为空）。请检查模型名或服务商状态。',
    long_json_failed: '复杂测试失败，但 API 基础可用性未受影响。请在设置页重新测试。',
    validation_failed: '输出校验失败，但 API 基础可用性未受影响。请在设置页重新测试。',
    basic_ready: '', // unreachable
    ready: '', // unreachable
  };

  const msg = messages[health.status] || 'API 未通过验证。系统不会使用本地规则或 mock 结果继续生成。';
  throw new Error(msg);
}

/**
 * V5.3: assertApiFullyReady now same as assertApiReady (smoke test is sufficient).
 */
export function assertApiFullyReady(): void {
  assertApiReady();
}

/**
 * Mark API as fully ready (smoke test passed — non-empty model response).
 */
export function markApiReady(details?: Partial<ApiHealthState>): void {
  saveApiHealth({
    status: 'ready',
    message: 'API 已通过 Smoke Test（模型返回非空内容）。',
    ...details,
    checkedAt: new Date().toISOString(),
  });
}

/**
 * Mark API as basic ready (Quick Ping + JSON Test pass).
 */
export function markApiBasicReady(details?: Partial<ApiHealthState>): void {
  saveApiHealth({
    status: 'basic_ready',
    message: 'API 基础可用（Quick Ping + JSON 通过）。Agent 可运行，Handoff 需要完整验证。',
    ...details,
    checkedAt: new Date().toISOString(),
  });
}

/**
 * Mark API as failed with specific status.
 */
export function markApiFailed(status: Exclude<ApiHealthStatus, 'ready' | 'basic_ready' | 'unknown'>, message: string, details?: string): void {
  saveApiHealth({ status, message, details, checkedAt: new Date().toISOString() });
}

/**
 * Update per-test results without changing overall status.
 */
export function updateApiHealthTests(tests: ApiHealthState['tests']): void {
  const current = getApiHealth();
  saveApiHealth({
    ...current,
    tests: { ...current.tests, ...tests },
  });
}

/**
 * Generate user-facing error message for any API error.
 */
export function getApiRequiredErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('not_configured') || lower.includes('未配置')) {
    return 'API 未配置。请先进入设置页填写 API URL、API Key 和模型名。';
  }
  if (lower.includes('connection') || lower.includes('fetch') || lower.includes('network') || lower.includes('econnrefused') || lower.includes('enotfound')) {
    return 'API 连接失败。请检查 endpoint、key、余额、网络和模型名。';
  }
  if (lower.includes('json') || lower.includes('parse') || lower.includes('syntax')) {
    return '模型已响应，但没有返回有效 JSON。请换稳定模型或降低输出长度。';
  }
  if (lower.includes('validation') || lower.includes('校验') || lower.includes('reference')) {
    return '模型输出没有通过业务校验。请检查模型能力或更换模型。';
  }
  return `API 调用失败，本轮未生成结果。请前往设置页修复 API 后重试。\n\n错误详情：${msg.slice(0, 200)}`;
}
