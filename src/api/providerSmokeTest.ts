/**
 * V5.5: Provider-Compatible Smoke Test
 *
 * Attempts multiple payload variants to find one that works with the target provider.
 * Stops early on success or on fatal errors (401/403/429).
 * Continues on 500/404/timeout to try simpler variants.
 *
 * V5.5 additions:
 * - Model name normalization (hidden chars, special dashes)
 * - Provider/model mismatch diagnosis
 * - /v1/models model list probe (on failure only)
 * - Request body shape diagnostics
 */

import { normalizeOpenAICompatibleEndpoint } from './endpointNormalizer';
import { normalizeApiUrl, extractAIContent } from './evaluate';
import { parseApiProxyError } from './apiErrorParser';
import { buildSmokeTestPayloadVariants, type SmokeTestVariantId } from './smokeTestPayloads';
import { diagnoseProviderModelMismatch, type ProviderModelDiagnosis } from './providerProfiles';
import { diagnoseModelName, type ModelNameDiagnostics } from './modelNameUtils';
import { probeProviderModels, findSimilarModels, type ModelListProbeResult } from './modelListProbe';

export interface ProviderSmokeAttempt {
  variantId: SmokeTestVariantId;
  label: string;
  ok: boolean;
  httpStatus?: number;
  errorCategory?: string;
  errorMessage?: string;
  rawResponsePreview?: string;
  contentPreview?: string;
  durationMs: number;
}

export interface ProviderSmokeTestResult {
  ok: boolean;
  passedVariantId?: SmokeTestVariantId;
  attempts: ProviderSmokeAttempt[];
  finalError?: string;
  normalizedEndpoint?: string;
  endpointKind?: string;
  model: string;
  normalizedModel: string;
  durationMs: number;
  /** V5.5: Collect upstream body previews from all attempts for diagnosis */
  upstreamBodySamples?: Array<{ variantId: SmokeTestVariantId; preview: string }>;
  /** V5.5: Provider/model mismatch diagnosis */
  providerDiagnosis?: ProviderModelDiagnosis;
  /** V5.5: Model name diagnostics */
  modelDiagnostics?: ModelNameDiagnostics;
  /** V5.5: Model list probe result (only on failure) */
  modelListProbe?: ModelListProbeResult;
}

/** Fatal errors that should stop trying further variants */
const FATAL_CATEGORIES = new Set(['auth_error', 'permission_error', 'quota_or_rate_limit']);

/**
 * Run provider-compatible smoke test with multiple payload variants.
 * Tries variants in order until one succeeds or all fail.
 */
export async function runProviderSmokeTest(input: {
  apiUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
}): Promise<ProviderSmokeTestResult> {
  const { apiUrl, apiKey, model, timeoutMs = 30000 } = input;
  const startedAt = Date.now();

  // V5.5: Step 0 — Normalize model name
  const modelDiag = diagnoseModelName(model);
  const normalizedModel = modelDiag.normalized;

  // V5.5: Step 0.5 — Provider/model mismatch diagnosis
  const providerDiag = diagnoseProviderModelMismatch({
    apiUrl,
    model: normalizedModel,
  });

  // Step 1: Validate endpoint
  const normalized = normalizeOpenAICompatibleEndpoint(apiUrl);
  if (normalized.kind === 'invalid' || normalized.errors.length > 0) {
    return {
      ok: false,
      attempts: [],
      finalError: `Endpoint 无效：${normalized.errors.join('；') || 'URL 格式不正确'}`,
      normalizedEndpoint: normalized.endpoint,
      endpointKind: normalized.kind,
      model,
      normalizedModel,
      durationMs: Date.now() - startedAt,
      providerDiagnosis: providerDiag,
      modelDiagnostics: modelDiag,
    };
  }

  // Step 2: Build variants with normalized model
  const variants = buildSmokeTestPayloadVariants(normalizedModel);
  const attempts: ProviderSmokeAttempt[] = [];
  let timeoutCount = 0;

  // Step 3: Try each variant
  for (const variant of variants) {
    const attemptStartedAt = Date.now();

    try {
      const signal = AbortSignal?.timeout?.(45000) || undefined;
      const response = await fetch('/api/ai-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          apiUrl: normalizeApiUrl(apiUrl),
          apiKey: apiKey.trim(),
          timeoutMs,
          body: variant.body,
        }),
      });

      const durationMs = Date.now() - attemptStartedAt;
      const rawText = await response.text();

      // Success response
      if (response.ok) {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(rawText);
        } catch {
          attempts.push({
            variantId: variant.id,
            label: variant.label,
            ok: false,
            httpStatus: response.status,
            errorCategory: 'json_parse_error',
            errorMessage: 'Response is not valid JSON',
            rawResponsePreview: rawText.slice(0, 800),
            durationMs,
          });
          continue; // Try next variant
        }

        const content = extractAIContent(data);
        if (content && content.trim().length > 0) {
          // SUCCESS!
          attempts.push({
            variantId: variant.id,
            label: variant.label,
            ok: true,
            httpStatus: response.status,
            contentPreview: content.slice(0, 200),
            durationMs,
          });

          return {
            ok: true,
            passedVariantId: variant.id,
            attempts,
            normalizedEndpoint: normalized.endpoint,
            endpointKind: normalized.kind,
            model,
            normalizedModel,
            durationMs: Date.now() - startedAt,
            providerDiagnosis: providerDiag,
            modelDiagnostics: modelDiag,
          };
        } else {
          // Empty content
          attempts.push({
            variantId: variant.id,
            label: variant.label,
            ok: false,
            httpStatus: response.status,
            errorCategory: 'empty_content',
            errorMessage: 'Model returned empty content',
            rawResponsePreview: rawText.slice(0, 800),
            durationMs,
          });
          continue;
        }
      }

      // Error response
      const parsed = parseApiProxyError({
        status: response.status,
        rawText,
        headers: response.headers,
      });

      attempts.push({
        variantId: variant.id,
        label: variant.label,
        ok: false,
        httpStatus: response.status,
        errorCategory: parsed.errorCategory,
        errorMessage: parsed.message,
        rawResponsePreview: parsed.rawPreview || rawText.slice(0, 800),
        durationMs,
      });

      // Fatal errors: stop immediately
      if (FATAL_CATEGORIES.has(parsed.errorCategory)) {
        break;
      }

      // 404: likely model name issue, try one more minimal variant then stop
      if (response.status === 404) {
        continue;
      }

      // 500: provider internal error, try simpler variants
      if (response.status === 500) {
        continue;
      }

      // Other errors: continue trying
      continue;
    } catch (err) {
      const durationMs = Date.now() - attemptStartedAt;
      const isTimeout =
        err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'TimeoutError';

      if (isTimeout) {
        timeoutCount++;
        attempts.push({
          variantId: variant.id,
          label: variant.label,
          ok: false,
          errorCategory: 'timeout',
          errorMessage: `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
          durationMs,
        });

        // Stop after 2 timeouts
        if (timeoutCount >= 2) {
          break;
        }
      } else {
        attempts.push({
          variantId: variant.id,
          label: variant.label,
          ok: false,
          errorCategory: 'network_error',
          errorMessage: err instanceof Error ? err.message : String(err),
          durationMs,
        });
      }
      continue;
    }
  }

  // All variants failed
  // V5.5: Collect upstream body samples
  const upstreamBodySamples = attempts
    .filter((a) => a.rawResponsePreview)
    .map((a) => ({ variantId: a.variantId, preview: a.rawResponsePreview! }));

  // V5.5: If all failed with 500/404, probe model list
  let modelListProbeResult: ModelListProbeResult | undefined;
  const hasServerError = attempts.some(
    (a) => a.httpStatus === 500 || a.httpStatus === 404 || a.errorCategory === 'provider_internal_error',
  );
  if (hasServerError && apiKey.trim()) {
    try {
      modelListProbeResult = await probeProviderModels({
        apiUrl,
        apiKey: apiKey.trim(),
        timeoutMs: 15000,
      });
    } catch {
      // Probe failed — not critical
    }
  }

  // Build final error with provider/model diagnosis
  const finalError = buildFinalErrorMessage({
    attempts,
    model: normalizedModel,
    providerDiag,
    modelListProbe: modelListProbeResult,
  });

  return {
    ok: false,
    attempts,
    finalError,
    normalizedEndpoint: normalized.endpoint,
    endpointKind: normalized.kind,
    model,
    normalizedModel,
    durationMs: Date.now() - startedAt,
    upstreamBodySamples: upstreamBodySamples.length > 0 ? upstreamBodySamples : undefined,
    providerDiagnosis: providerDiag,
    modelDiagnostics: modelDiag,
    modelListProbe: modelListProbeResult,
  };
}

/**
 * Build user-friendly final error message based on all attempts + diagnostics.
 */
function buildFinalErrorMessage(input: {
  attempts: ProviderSmokeAttempt[];
  model: string;
  providerDiag: ProviderModelDiagnosis;
  modelListProbe?: ModelListProbeResult;
}): string {
  const { attempts, model, providerDiag, modelListProbe } = input;

  if (attempts.length === 0) {
    return '没有可用的测试请求。';
  }

  // Check for fatal errors first
  const authError = attempts.find((a) => a.errorCategory === 'auth_error');
  if (authError) {
    return `API Key 无效或没有权限（HTTP ${authError.httpStatus}）。请检查 API Key 是否正确。`;
  }

  const permError = attempts.find((a) => a.errorCategory === 'permission_error');
  if (permError) {
    return `API Key 无权限访问该模型（HTTP ${permError.httpStatus}）。请在服务商后台确认权限。`;
  }

  const quotaError = attempts.find((a) => a.errorCategory === 'quota_or_rate_limit');
  if (quotaError) {
    return `额度不足或触发限流（HTTP ${quotaError.httpStatus}）。请检查账户余额或稍后重试。`;
  }

  // V5.5: Provider/model mismatch takes priority
  if (providerDiag.errors.length > 0) {
    let msg = providerDiag.errors.join('\n');
    if (providerDiag.suggestions.length > 0) {
      msg += '\n\n' + providerDiag.suggestions.join('\n');
    }
    return msg;
  }

  // Check for 500 on all variants
  const all500 = attempts.every(
    (a) => a.httpStatus === 500 || a.errorCategory === 'provider_internal_error',
  );
  if (all500) {
    let msg =
      `上游服务商在 ${attempts.length} 种 payload variant（含最简化仅 model+messages）下全部返回 HTTP 500。` +
      `\n\n这不是参数兼容性问题——最简请求也失败说明请求本身已到达服务商但被拒绝处理。` +
      `\n\n当前模型名：${model}。`;

    // V5.5: Add model list probe info
    if (modelListProbe?.ok) {
      const found = modelListProbe.models.some((m) => m.toLowerCase() === model.toLowerCase());
      if (!found) {
        msg += `\n\n⚠️ 模型列表中未找到 "${model}"。`;
        const similar = findSimilarModels(model, modelListProbe.models);
        if (similar.length > 0) {
          msg += `\n相似模型：${similar.join('、')}`;
        }
        msg += `\n请从服务商后台复制精确 model id。`;
      }
    } else if (modelListProbe && !modelListProbe.ok) {
      msg += `\n\n模型列表探测：${modelListProbe.errorMessage ?? '不支持'}`;
    }

    // Add provider warnings
    if (providerDiag.warnings.length > 0) {
      msg += '\n\n' + providerDiag.warnings.join('\n');
    }

    msg +=
      `\n\n常见排查：` +
      `\n1. 模型名是否与服务商后台完全一致（大小写、版本号、横线格式）` +
      `\n2. API Key 是否已开通该模型的访问权限` +
      `\n3. 账户余额是否充足`;

    return msg;
  }

  // Check for 404
  const has404 = attempts.some((a) => a.httpStatus === 404);
  if (has404) {
    return (
      `Endpoint 或模型名错误（HTTP 404）。` +
      `\n当前模型名：${model}。请确认服务商后台要求的精确模型名。` +
      `常见问题包括大小写、版本号、横线格式、模型未开通或当前 key 无权限访问该模型。`
    );
  }

  // Timeout
  const allTimeout = attempts.every((a) => a.errorCategory === 'timeout');
  if (allTimeout) {
    return `所有请求均超时（>${Math.round((attempts[0]?.durationMs || 30000) / 1000)}s）。请检查模型速度、网关稳定性或 timeout 设置。`;
  }

  // Generic fallback
  const lastError = attempts[attempts.length - 1];
  return `Smoke Test 失败。最后尝试：${lastError.label} — ${lastError.errorMessage || '未知错误'}`;
}
