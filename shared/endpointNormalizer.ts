/**
 * V5.1 — Unified OpenAI-Compatible Endpoint Normalizer
 *
 * Pure function module (no window, no document, no localStorage, no import.meta).
 * Can be imported by: frontend (src/), Vercel serverless (api/), Vite config (vite.config.ts).
 *
 * Normalizes various user-provided URL formats into a valid
 * /v1/chat/completions endpoint that OpenAI-compatible APIs expect.
 */

export type EndpointKind =
  | 'root'
  | 'v1_root'
  | 'chat_root'
  | 'chat_completions'
  | 'custom_full_endpoint'
  | 'invalid';

export interface NormalizedEndpointResult {
  input: string;
  normalizedApiUrl: string;
  endpoint: string;
  kind: EndpointKind;
  warnings: string[];
  errors: string[];
}

export interface EndpointSelfTestCase {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  note?: string;
}

/**
 * Normalize any OpenAI-compatible API URL into a /v1/chat/completions endpoint.
 *
 * Supported inputs:
 * - Root URL: https://gpt-agent.cc
 * - /v1 URL: https://gpt-agent.cc/v1
 * - /v1/chat URL: https://gpt-agent.cc/v1/chat
 * - Full endpoint: https://gpt-agent.cc/v1/chat/completions
 * - Broken double /v1: https://api.openai.com/v1/v1/chat/completions (auto-fixed)
 */
export function normalizeOpenAICompatibleEndpoint(rawApiUrl: string): NormalizedEndpointResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Empty check
  if (!rawApiUrl || rawApiUrl.trim().length === 0) {
    return {
      input: rawApiUrl ?? '',
      normalizedApiUrl: '',
      endpoint: '',
      kind: 'invalid',
      warnings,
      errors: ['API URL 不能为空。'],
    };
  }

  // 2. Basic cleanup
  let cleanUrl = rawApiUrl.trim();

  // 3. Protocol check
  if (!/^https?:\/\//i.test(cleanUrl)) {
    return {
      input: rawApiUrl,
      normalizedApiUrl: cleanUrl,
      endpoint: '',
      kind: 'invalid',
      warnings,
      errors: ['API URL 必须以 http:// 或 https:// 开头。'],
    };
  }

  // 4. Remove query string (warn)
  const queryIdx = cleanUrl.indexOf('?');
  if (queryIdx !== -1) {
    warnings.push('API URL 包含 query string，已忽略。请确认不需要 query 参数。');
    cleanUrl = cleanUrl.slice(0, queryIdx);
  }

  // 5. Remove trailing slashes
  cleanUrl = cleanUrl.replace(/\/+$/, '');

  // 6. Remove duplicate slashes (but preserve protocol //)
  //    Match any run of 2+ slashes not immediately after a colon (to keep ://)
  cleanUrl = cleanUrl.replace(/([^:])\/{2,}/g, '$1/');

  // 7. Fix duplicate /v1/v1 patterns
  const hasDuplicateV1 = /\/v1\/v1(\/|$)/i.test(cleanUrl);
  if (hasDuplicateV1) {
    cleanUrl = cleanUrl.replace(/\/v1\/v1(\/|$)/i, '/v1$1');
    warnings.push('检测到重复 /v1，已自动修复。');
  }

  // 8. Determine kind and normalize endpoint
  let normalizedApiUrl: string;
  let endpoint: string;
  let kind: EndpointKind;

  if (/\/v1\/chat\/completions$/i.test(cleanUrl)) {
    // Already a full /v1/chat/completions endpoint
    normalizedApiUrl = cleanUrl.replace(/\/v1\/chat\/completions$/i, '');
    endpoint = cleanUrl;
    kind = 'chat_completions';
  } else if (/\/v1\/chat$/i.test(cleanUrl)) {
    // /v1/chat → append /completions
    normalizedApiUrl = cleanUrl.replace(/\/v1\/chat$/i, '');
    endpoint = `${cleanUrl}/completions`;
    kind = 'chat_root';
  } else if (/\/v1$/i.test(cleanUrl)) {
    // /v1 → append /chat/completions (NOT /v1/chat/completions!)
    normalizedApiUrl = cleanUrl.replace(/\/v1$/i, '');
    endpoint = `${cleanUrl}/chat/completions`;
    kind = 'v1_root';
  } else if (/\/chat\/completions$/i.test(cleanUrl)) {
    // Non-v1 chat/completions (e.g. custom path) — keep as-is
    normalizedApiUrl = cleanUrl.replace(/\/chat\/completions$/i, '');
    endpoint = cleanUrl;
    kind = 'custom_full_endpoint';
  } else {
    // Root URL — append /v1/chat/completions
    normalizedApiUrl = cleanUrl;
    endpoint = `${cleanUrl}/v1/chat/completions`;
    kind = 'root';
  }

  // 9. Final safety check: endpoint must not contain /v1/v1
  if (/\/v1\/v1(\/|$)/i.test(endpoint)) {
    errors.push('Endpoint normalizer 内部错误：endpoint 仍包含 /v1/v1，归一化失败。');
    return {
      input: rawApiUrl,
      normalizedApiUrl,
      endpoint,
      kind: 'invalid',
      warnings,
      errors,
    };
  }

  return {
    input: rawApiUrl,
    normalizedApiUrl,
    endpoint,
    kind,
    warnings,
    errors,
  };
}

/**
 * Run self-test with all required test cases.
 * Returns array of test results; all should pass.
 */
export function runEndpointNormalizerSelfTest(): EndpointSelfTestCase[] {
  const cases: Array<{ input: string; expected: string; note?: string }> = [
    // Root URLs
    { input: 'https://gpt-agent.cc', expected: 'https://gpt-agent.cc/v1/chat/completions' },
    { input: 'https://api.llm-token.cn', expected: 'https://api.llm-token.cn/v1/chat/completions' },
    { input: 'https://api.openai.com', expected: 'https://api.openai.com/v1/chat/completions' },
    { input: 'https://api.deepseek.com', expected: 'https://api.deepseek.com/v1/chat/completions' },

    // /v1 URLs
    { input: 'https://gpt-agent.cc/v1', expected: 'https://gpt-agent.cc/v1/chat/completions' },
    { input: 'https://gpt-agent.cc/v1/', expected: 'https://gpt-agent.cc/v1/chat/completions' },
    { input: 'https://api.openai.com/v1', expected: 'https://api.openai.com/v1/chat/completions' },
    { input: 'https://api.llm-token.cn/v1', expected: 'https://api.llm-token.cn/v1/chat/completions' },
    { input: 'https://api.deepseek.com/v1', expected: 'https://api.deepseek.com/v1/chat/completions' },

    // /v1/chat URLs
    { input: 'https://gpt-agent.cc/v1/chat', expected: 'https://gpt-agent.cc/v1/chat/completions' },
    { input: 'https://api.openai.com/v1/chat', expected: 'https://api.openai.com/v1/chat/completions' },

    // Full endpoint
    { input: 'https://gpt-agent.cc/v1/chat/completions', expected: 'https://gpt-agent.cc/v1/chat/completions' },
    { input: 'https://api.openai.com/v1/chat/completions', expected: 'https://api.openai.com/v1/chat/completions' },

    // Broken double /v1 (auto-fix)
    { input: 'https://api.openai.com/v1/v1/chat/completions', expected: 'https://api.openai.com/v1/chat/completions', note: '修复 /v1/v1 重复' },
    { input: 'https://gpt-agent.cc/v1/v1/chat/completions', expected: 'https://gpt-agent.cc/v1/chat/completions', note: '修复 /v1/v1 重复' },

    // Trailing slashes
    { input: 'https://gpt-agent.cc/', expected: 'https://gpt-agent.cc/v1/chat/completions' },
    { input: 'https://api.openai.com/v1/', expected: 'https://api.openai.com/v1/chat/completions' },

    // Edge: whitespace
    { input: '  https://gpt-agent.cc  ', expected: 'https://gpt-agent.cc/v1/chat/completions', note: 'trim whitespace' },
  ];

  return cases.map(({ input, expected, note }) => {
    const result = normalizeOpenAICompatibleEndpoint(input);
    return {
      input,
      expected,
      actual: result.endpoint,
      passed: result.endpoint === expected && result.kind !== 'invalid',
      note,
    };
  });
}
