/**
 * Provider Profiles — V5.5
 *
 * Infers the API provider from the URL and diagnoses provider/model mismatches.
 * All rules are warnings/suggestions, never hard-block requests.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderId =
  | 'openai'
  | 'deepseek'
  | 'moonshot_kimi'
  | 'xiaomi_mimo'
  | 'glm'
  | 'custom';

export interface ProviderProfile {
  id: ProviderId;
  label: string;
  hostPatterns: RegExp[];
  likelyModelPatterns: RegExp[];
  unlikelyModelPatterns?: RegExp[];
  modelHint: string;
  dashboardHint?: string;
}

export interface ProviderModelDiagnosis {
  providerId: ProviderId;
  providerLabel: string;
  confidence: number;
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

// ─── Provider Profiles ────────────────────────────────────────────────────────

const PROVIDER_PROFILES: ProviderProfile[] = [
  {
    id: 'xiaomi_mimo',
    label: 'Xiaomi MiMo',
    hostPatterns: [/xiaomimo/i, /mimo/i],
    likelyModelPatterns: [/mimo/i],
    unlikelyModelPatterns: [/kimi/i, /moonshot/i, /deepseek/i, /gpt-/i, /glm/i, /qwen/i, /claude/i],
    modelHint: '请填写小米后台显示的精确 MiMo model id，例如服务商后台展示的模型名称。',
    dashboardHint: 'https://mimo.xiaomi.com 或小米 AI 开放平台后台',
  },
  {
    id: 'moonshot_kimi',
    label: 'Moonshot / Kimi',
    hostPatterns: [/moonshot/i, /kimi/i],
    likelyModelPatterns: [/kimi/i, /moonshot/i],
    unlikelyModelPatterns: [/mimo/i, /deepseek/i, /gpt-/i, /glm/i, /qwen/i],
    modelHint: '请填写 Moonshot / Kimi 官方 API 地址和后台展示的精确 model id。',
    dashboardHint: 'https://platform.moonshot.cn',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    hostPatterns: [/deepseek/i],
    likelyModelPatterns: [/deepseek/i],
    unlikelyModelPatterns: [/mimo/i, /kimi/i, /gpt-/i, /glm/i],
    modelHint: '请填写 DeepSeek 后台展示的精确 model id，如 deepseek-chat、deepseek-reasoner。',
    dashboardHint: 'https://platform.deepseek.com',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    hostPatterns: [/api\.openai\.com/i],
    likelyModelPatterns: [/gpt/i, /o[0-9]/i, /text-/i, /dall-/i, /whisper/i],
    unlikelyModelPatterns: [/mimo/i, /kimi/i, /deepseek/i, /glm/i, /qwen/i],
    modelHint: '请填写 OpenAI 支持的模型名，如 gpt-4o-mini、gpt-4o、o3-mini。',
    dashboardHint: 'https://platform.openai.com',
  },
  {
    id: 'glm',
    label: 'GLM / 智谱',
    hostPatterns: [/bigmodel/i, /zhipu/i],
    likelyModelPatterns: [/glm/i],
    unlikelyModelPatterns: [/mimo/i, /kimi/i, /deepseek/i, /gpt-/i],
    modelHint: '请填写智谱后台展示的精确 model id，如 glm-4-flash。',
    dashboardHint: 'https://open.bigmodel.cn',
  },
];

const CUSTOM_PROFILE: ProviderProfile = {
  id: 'custom',
  label: '自定义网关',
  hostPatterns: [],
  likelyModelPatterns: [],
  modelHint: '如果第三方网关同时代理多家模型，请以该网关后台显示的 endpoint 和 model id 为准。',
};

// ─── Provider Inference ───────────────────────────────────────────────────────

export function inferProviderFromApiUrl(apiUrl: string): ProviderProfile {
  const lower = apiUrl.toLowerCase();
  for (const profile of PROVIDER_PROFILES) {
    for (const pattern of profile.hostPatterns) {
      if (pattern.test(lower)) {
        return profile;
      }
    }
  }
  return CUSTOM_PROFILE;
}

// ─── Provider-Model Mismatch Diagnosis ────────────────────────────────────────

export function diagnoseProviderModelMismatch(input: {
  apiUrl: string;
  model: string;
}): ProviderModelDiagnosis {
  const { apiUrl, model } = input;
  const provider = inferProviderFromApiUrl(apiUrl);
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check if model matches the inferred provider
  if (provider.id !== 'custom') {
    const modelLower = model.toLowerCase();

    // Check unlikely patterns (model belongs to a different provider)
    if (provider.unlikelyModelPatterns) {
      for (const pattern of provider.unlikelyModelPatterns) {
        if (pattern.test(modelLower)) {
          const matchedName = extractMatchName(modelLower, pattern);
          errors.push(
            `当前 API URL 看起来属于 ${provider.label}，但模型名 "${model}" 像 ${matchedName} 模型。请确认 endpoint 和 model 是否属于同一服务商。`,
          );
          suggestions.push(
            `如果你使用 ${provider.label}，请从 ${provider.dashboardHint ?? '服务商后台'} 复制精确 model id。`,
          );
          // Suggest the likely alternative provider
          const altProvider = findAlternativeProvider(modelLower);
          if (altProvider) {
            suggestions.push(
              `如果你使用 ${altProvider.label}，请切换到对应的官方 API 地址。`,
            );
          }
          break;
        }
      }
    }

    // Check if model matches likely patterns
    let matchesLikely = false;
    for (const pattern of provider.likelyModelPatterns) {
      if (pattern.test(modelLower)) {
        matchesLikely = true;
        break;
      }
    }

    if (!matchesLikely && errors.length === 0) {
      warnings.push(
        `模型名 "${model}" 不常见于 ${provider.label}。请确认模型名是否正确。`,
      );
      suggestions.push(provider.modelHint);
    }
  }

  // Confidence: 1.0 if we found a specific provider, 0.3 for custom
  const confidence = provider.id === 'custom' ? 0.3 : 0.85;

  return {
    providerId: provider.id,
    providerLabel: provider.label,
    confidence,
    warnings,
    errors,
    suggestions,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMatchName(_model: string, pattern: RegExp): string {
  const source = pattern.source.toLowerCase().replace(/[\\^$|]/g, '').replace(/\//g, '');
  if (source.includes('kimi') || source.includes('moonshot')) return 'Kimi / Moonshot';
  if (source.includes('mimo')) return 'Xiaomi MiMo';
  if (source.includes('deepseek')) return 'DeepSeek';
  if (source.includes('gpt')) return 'OpenAI GPT';
  if (source.includes('glm')) return 'GLM / 智谱';
  if (source.includes('qwen')) return 'Qwen / 通义';
  if (source.includes('claude')) return 'Claude / Anthropic';
  return '其他服务商';
}

function findAlternativeProvider(model: string): ProviderProfile | null {
  for (const profile of PROVIDER_PROFILES) {
    if (profile.id === 'custom') continue;
    for (const pattern of profile.likelyModelPatterns) {
      if (pattern.test(model)) {
        return profile;
      }
    }
  }
  return null;
}
