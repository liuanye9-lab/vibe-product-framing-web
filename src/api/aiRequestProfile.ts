export type AiTokenParamMode = 'max_tokens' | 'max_completion_tokens' | 'none';

export interface AIRequestProfile {
  supportsSystemRole: boolean;
  supportsTemperature: boolean;
  tokenParam: AiTokenParamMode;
  includeStreamFalse: boolean;
  sourceVariantId?: string;
  updatedAt: string;
}

const AI_REQUEST_PROFILE_KEY = 'vibepilot_ai_request_profile_v1';

const DEFAULT_PROFILE: AIRequestProfile = {
  supportsSystemRole: true,
  supportsTemperature: true,
  tokenParam: 'max_tokens',
  includeStreamFalse: false,
  updatedAt: '',
};

const VARIANT_PROFILES: Record<string, Omit<AIRequestProfile, 'sourceVariantId' | 'updatedAt'>> = {
  messages_plain_no_extra_params: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'none',
    includeStreamFalse: false,
  },
  user_plain_minimal: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
  user_plain_no_extra_params: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'none',
    includeStreamFalse: false,
  },
  user_plain_with_max_tokens: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
  user_json_no_extra_params: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'none',
    includeStreamFalse: false,
  },
  user_json_with_max_tokens: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
  user_json_no_temperature: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'max_tokens',
    includeStreamFalse: true,
  },
  user_json_max_completion_tokens: {
    supportsSystemRole: false,
    supportsTemperature: false,
    tokenParam: 'max_completion_tokens',
    includeStreamFalse: false,
  },
  user_json_with_temperature: {
    supportsSystemRole: false,
    supportsTemperature: true,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
  user_json_minimal: {
    supportsSystemRole: false,
    supportsTemperature: true,
    tokenParam: 'max_tokens',
    includeStreamFalse: true,
  },
  system_user_no_extra: {
    supportsSystemRole: true,
    supportsTemperature: false,
    tokenParam: 'none',
    includeStreamFalse: false,
  },
  system_with_user_minimal: {
    supportsSystemRole: true,
    supportsTemperature: true,
    tokenParam: 'max_tokens',
    includeStreamFalse: true,
  },
  content_array_format: {
    supportsSystemRole: false,
    supportsTemperature: true,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
  omit_stream_field: {
    supportsSystemRole: false,
    supportsTemperature: true,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
  user_no_stream_minimal: {
    supportsSystemRole: false,
    supportsTemperature: true,
    tokenParam: 'max_tokens',
    includeStreamFalse: false,
  },
};

export function getAIRequestProfile(): AIRequestProfile {
  try {
    const raw = localStorage.getItem(AI_REQUEST_PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<AIRequestProfile>;
    if (!parsed.updatedAt) return DEFAULT_PROFILE;
    return {
      supportsSystemRole: parsed.supportsSystemRole ?? DEFAULT_PROFILE.supportsSystemRole,
      supportsTemperature: parsed.supportsTemperature ?? DEFAULT_PROFILE.supportsTemperature,
      tokenParam: parsed.tokenParam ?? DEFAULT_PROFILE.tokenParam,
      includeStreamFalse: parsed.includeStreamFalse ?? DEFAULT_PROFILE.includeStreamFalse,
      sourceVariantId: parsed.sourceVariantId,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveAIRequestProfileFromSmokeVariant(variantId: string): AIRequestProfile {
  const profileBase = VARIANT_PROFILES[variantId] || DEFAULT_PROFILE;
  const profile: AIRequestProfile = {
    ...profileBase,
    sourceVariantId: variantId,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(AI_REQUEST_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function clearAIRequestProfile(): void {
  localStorage.removeItem(AI_REQUEST_PROFILE_KEY);
}

export function adaptOpenAICompatibleBodyForProfile<T extends Record<string, unknown>>(
  body: T,
  profile = getAIRequestProfile(),
): T {
  const adapted: Record<string, unknown> = { ...body };

  if (!profile.supportsTemperature) {
    delete adapted.temperature;
  }

  const requestedMaxTokens = typeof adapted.max_tokens === 'number'
    ? adapted.max_tokens
    : typeof adapted.max_completion_tokens === 'number'
      ? adapted.max_completion_tokens
      : undefined;

  delete adapted.max_tokens;
  delete adapted.max_completion_tokens;
  if (requestedMaxTokens && profile.tokenParam === 'max_tokens') {
    adapted.max_tokens = requestedMaxTokens;
  } else if (requestedMaxTokens && profile.tokenParam === 'max_completion_tokens') {
    adapted.max_completion_tokens = requestedMaxTokens;
  }

  if (profile.includeStreamFalse) {
    adapted.stream = false;
  } else {
    delete adapted.stream;
  }

  if (!profile.supportsSystemRole && Array.isArray(adapted.messages)) {
    const messages = adapted.messages as Array<{ role?: string; content?: unknown }>;
    const systemText = messages
      .filter((message) => message.role === 'system')
      .map((message) => stringifyMessageContent(message.content))
      .filter(Boolean)
      .join('\n\n');
    const nonSystemMessages = messages.filter((message) => message.role !== 'system');

    if (systemText && nonSystemMessages.length > 0) {
      const [firstMessage, ...restMessages] = nonSystemMessages;
      adapted.messages = [
        {
          ...firstMessage,
          role: 'user',
          content: `${systemText}\n\n${stringifyMessageContent(firstMessage.content)}`.trim(),
        },
        ...restMessages.map((message) => ({
          ...message,
          role: message.role === 'assistant' ? 'assistant' : 'user',
        })),
      ];
    } else {
      adapted.messages = nonSystemMessages.map((message) => ({
        ...message,
        role: message.role === 'assistant' ? 'assistant' : 'user',
      }));
    }
  }

  return adapted as T;
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content == null) return '';
  return String(content);
}
