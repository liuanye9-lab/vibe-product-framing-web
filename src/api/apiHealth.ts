/**
 * V4.4 API Health Status System
 *
 * Manages API readiness state in localStorage.
 * Core workflows MUST call assertApiReady() before executing.
 * No local-rule or mock fallback is accepted as a substitute.
 */

export type ApiHealthStatus =
  | 'unknown'
  | 'not_configured'
  | 'connection_failed'
  | 'json_failed'
  | 'validation_failed'
  | 'ready';

export interface ApiHealthState {
  status: ApiHealthStatus;
  checkedAt?: string;
  provider?: string;
  model?: string;
  apiUrl?: string;
  message: string;
  details?: string;
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

export function isApiReady(): boolean {
  return getApiHealth().status === 'ready';
}

/**
 * Throw if API is not verified ready.
 * Must be called at the start of every core workflow path.
 */
export function assertApiReady(): void {
  const health = getApiHealth();
  if (health.status === 'ready') return;

  const messages: Record<ApiHealthStatus, string> = {
    unknown: 'API 状态未知。请进入设置页完成 API Connection、JSON Generation 和 Reference Validation 测试。',
    not_configured: 'API 未配置。请先进入设置页填写 API URL、API Key 和模型名，并通过全部三项测试。',
    connection_failed: 'API 连接失败。请检查 endpoint、key、余额、网络和模型名，并在设置页重新测试。',
    json_failed: '模型已响应，但没有返回有效 JSON。请换稳定模型或降低输出长度，并在设置页重新测试。',
    validation_failed: '模型输出没有通过业务校验。请检查模型能力或更换模型，并在设置页重新测试。',
    ready: '', // unreachable
  };

  const msg = messages[health.status] || 'API 未通过验证。系统不会使用本地规则或 mock 结果继续生成。';
  throw new Error(msg);
}

/**
 * Mark API as ready (only call from Settings after all 3 tests pass).
 */
export function markApiReady(details?: Partial<ApiHealthState>): void {
  saveApiHealth({
    status: 'ready',
    message: 'API 已通过全部验证。',
    ...details,
    checkedAt: new Date().toISOString(),
  });
}

/**
 * Mark API as failed with specific status.
 */
export function markApiFailed(status: Exclude<ApiHealthStatus, 'ready' | 'unknown'>, message: string, details?: string): void {
  saveApiHealth({ status, message, details, checkedAt: new Date().toISOString() });
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
