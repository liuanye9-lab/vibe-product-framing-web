/**
 * V5.6: Provider-Compatible Smoke Test
 *
 * Attempts multiple payload variants to find one that works with the target provider.
 * Stops early on success or on fatal errors (401/403/429).
 * Continues on 500/404/timeout to try simpler variants.
 *
 * V5.6 changes:
 * - 9 payload variants (was 11), strictly minimal-first ordering
 * - modelListProbe receives currentModel, returns currentModelFound + similarModels
 * - Final error message prioritizes provider mismatch > model not found > HTTP 500
 * - Success also calls modelListProbe and computes requestBodyShape
 */

import { normalizeOpenAICompatibleEndpoint } from './endpointNormalizer';
import { normalizeApiUrl, extractAIContent } from './evaluate';
import { parseApiProxyError } from './apiErrorParser';
import { buildSmokeTestPayloadVariants, type SmokeTestVariantId } from './smokeTestPayloads';
import { diagnoseProviderModelMismatch, type ProviderModelDiagnosis } from './providerProfiles';
import { diagnoseModelName, type ModelNameDiagnostics } from './modelNameUtils';
import { probeProviderModels, findSimilarModels, type ModelListProbeResult } from './modelListProbe';

/** V5.6: Request body shape diagnostics */
export interface RequestBodyShape {
  model: string;
  messageCount: number;
  roles: string[];
  hasSystemRole: boolean;
  hasTemperature: boolean;
  hasMaxTokens: boolean;
  hasMaxCompletionTokens: boolean;
  hasStreamField: boolean;
  topLevelKeys: string[];
}

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
  /** Upstream body previews from all attempts for diagnosis */
  upstreamBodySamples?: Array<{ variantId: SmokeTestVariantId; preview: string }>;
  /** Provider/model mismatch diagnosis */
  providerDiagnosis?: ProviderModelDiagnosis;
  /** Model name diagnostics */
  modelDiagnostics?: ModelNameDiagnostics;
  /** Model list probe result (only on failure) */
  modelListProbe?: ModelListProbeResult;
  /** V5.6: Request body shape diagnostics */
  requestBodyShape?: RequestBodyShape;
}

/** Fatal errors that should stop trying further variants */
const FATAL_CATEGORIES = new Set(['auth_error', 'permission_error', 'quota_or_rate_limit']);

/** V5.6: Extract request body shape from payload variant */
function extractRequestBodyShapeFromVariant(body: Record<string, unknown>): RequestBodyShape {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return {
    model: typeof body.model === 'string' ? body.model : 'unknown',
    messageCount: messages.length,
    roles: messages.map((m: { role?: string }) => m?.role).filter((r): r is string => Boolean(r)),
    hasSystemRole: messages.some((m: { role?: string }) => m?.role === 'system'),
    hasTemperature: 'temperature' in body,
    hasMaxTokens: 'max_tokens' in body,
    hasMaxCompletionTokens: 'max_completion_tokens' in body,
    hasStreamField: 'stream' in body,
    topLevelKeys: Object.keys(body),
  };
}

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

  // Step 0: Normalize model name
  const modelDiag = diagnoseModelName(model);
  const normalizedModel = modelDiag.normalized;

  // Step 0.5: Provider/model mismatch diagnosis
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

  // Step 1.5: For providers with reliable model catalogs, verify the exact
  // model before burning through chat variants. Some providers wrap model
  // misses or missing entitlements as HTTP 500 on /chat/completions.
  let modelListProbeResult: ModelListProbeResult | undefined;
  const shouldPreflightModelList = providerDiag.providerId === 'stepfun';
  if (shouldPreflightModelList && apiKey.trim()) {
    try {
      modelListProbeResult = await probeProviderModels({
        apiUrl,
        apiKey: apiKey.trim(),
        currentModel: normalizedModel,
        timeoutMs: 15000,
      });
      if (
        modelListProbeResult.ok &&
        modelListProbeResult.models.length > 0 &&
        modelListProbeResult.currentModelFound === false
      ) {
        return {
          ok: false,
          attempts: [],
          finalError: buildFinalErrorMessage({
            attempts: [],
            model: normalizedModel,
            providerDiag,
            modelListProbe: modelListProbeResult,
          }),
          normalizedEndpoint: normalized.endpoint,
          endpointKind: normalized.kind,
          model,
          normalizedModel,
          durationMs: Date.now() - startedAt,
          providerDiagnosis: providerDiag,
          modelDiagnostics: modelDiag,
          modelListProbe: modelListProbeResult,
        };
      }
    } catch {
      // Continue to chat smoke test if the provider does not expose models.
    }
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

          // V5.6: Probe model list even on success to verify model availability
          let successModelProbe: ModelListProbeResult | undefined;
          try {
            successModelProbe = await probeProviderModels({
              apiUrl,
              apiKey: apiKey.trim(),
              currentModel: normalizedModel,
              timeoutMs: 10000,
            });
          } catch {
            // Probe failed — not critical
          }

          // V5.6: Extract request body shape from the passed variant
          const requestBodyShape = extractRequestBodyShapeFromVariant(variant.body);

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
            modelListProbe: successModelProbe,
            requestBodyShape,
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
  // Collect upstream body samples
  const upstreamBodySamples = attempts
    .filter((a) => a.rawResponsePreview)
    .map((a) => ({ variantId: a.variantId, preview: a.rawResponsePreview! }));

  // V5.6: If all failed with 500/404, probe model list
  const hasServerError = attempts.some(
    (a) => a.httpStatus === 500 || a.httpStatus === 404 || a.errorCategory === 'provider_internal_error' || a.errorCategory === 'model_not_found',
  );
  if (hasServerError && apiKey.trim() && !modelListProbeResult) {
    try {
      modelListProbeResult = await probeProviderModels({
        apiUrl,
        apiKey: apiKey.trim(),
        currentModel: normalizedModel,
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
 * V5.6 priority:
 * 1. Provider/model mismatch
 * 2. Model not found in list
 * 3. Auth/permission/quota errors
 * 4. All-500 specific message
 * 5. 404
 * 6. Timeout
 * 7. Generic fallback
 */
function buildFinalErrorMessage(input: {
  attempts: ProviderSmokeAttempt[];
  model: string;
  providerDiag: ProviderModelDiagnosis;
  modelListProbe?: ModelListProbeResult;
}): string {
  const { attempts, model, providerDiag, modelListProbe } = input;

  // Priority 1: Provider/model mismatch
  if (providerDiag.errors.length > 0) {
    let msg = 'API URL 与模型名疑似不匹配。请先确认服务商和模型名是否属于同一平台。\n\n';
    msg += providerDiag.errors.join('\n');
    if (providerDiag.suggestions.length > 0) {
      msg += '\n\n' + providerDiag.suggestions.join('\n');
    }
    return msg;
  }

  // Priority 2: Model not found in list
  if (modelListProbe?.ok && modelListProbe.currentModelFound === false) {
    let msg = `模型列表中没有找到当前模型名 "${model}"。请从服务商后台复制精确 model id。`;
    if (modelListProbe.similarModels && modelListProbe.similarModels.length > 0) {
      msg += `\n\n相似模型：${modelListProbe.similarModels.join('、')}`;
    }
    return msg;
  }

  if (attempts.length === 0) {
    if (providerDiag.providerId === 'stepfun' && modelListProbe?.ok && modelListProbe.models.length === 0) {
      return `StepFun 模型列表探测成功但没有返回模型。请在 StepFun 控制台确认当前 API Key 是否有模型访问权限，再复制精确 model id。当前模型名：${model}。`;
    }
    return '没有可用的测试请求。';
  }

  // Priority 3: Auth/permission/quota errors
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

  // Check for 500 on all variants
  const all500 = attempts.every(
    (a) => a.httpStatus === 500 || a.errorCategory === 'provider_internal_error',
  );
  if (all500) {
    let msg =
      `上游在最小请求下仍返回 HTTP 500。` +
      `\n\n最简请求也失败，说明请求已到达服务商，但服务商没有接受当前模型/API Key/账户状态组合。` +
      `\n\n当前模型名：${model}。`;

    if (providerDiag.providerId === 'stepfun') {
      msg +=
        `\n\nStepFun 专项判断：endpoint 已按 OpenAI-compatible 规则归一化到 /v1/chat/completions。` +
        `持续 HTTP 500 时，优先检查该 API Key 是否开通当前模型，或改用 StepFun 控制台模型列表中可见的精确 model id。`;
    }

    // Add model list probe info
    if (modelListProbe?.ok) {
      if (modelListProbe.currentModelFound === false) {
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

    // Add suggestions
    if (providerDiag.suggestions.length > 0) {
      msg += '\n\n' + providerDiag.suggestions.join('\n');
    }

    msg +=
      `\n\n常见排查：` +
      `\n1. 模型名是否与服务商后台完全一致（大小写、版本号、横线格式）` +
      `\n2. API Key 是否已开通该模型的访问权限` +
      `\n3. 账户余额是否充足` +
      `\n4. 服务商可能把模型不存在 / 权限不足包装成 HTTP 500`;

    return msg;
  }

  // Check for 404
  const has404 = attempts.some((a) => a.httpStatus === 404);
  if (has404) {
    let msg =
      `Endpoint 或模型名错误（HTTP 404）。` +
      `\n当前模型名：${model}。请确认服务商后台要求的精确模型名。` +
      `\n常见问题包括大小写、版本号、横线格式、模型未开通或当前 key 无权限访问该模型。`;

    if (modelListProbe?.ok && modelListProbe.currentModelFound === false) {
      const similar = findSimilarModels(model, modelListProbe.models);
      if (similar.length > 0) {
        msg += `\n\n相似模型：${similar.join('、')}`;
      }
    }

    return msg;
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
