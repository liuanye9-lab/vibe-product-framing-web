/**
 * V5.4: Provider-Compatible Smoke Test Payloads
 *
 * Different AI providers/gateways have varying levels of OpenAI API compatibility.
 * Some reject system roles, max_tokens, temperature, or other parameters.
 * This module provides multiple payload variants to maximize compatibility.
 */

export type SmokeTestVariantId =
  | 'user_json_minimal'
  | 'user_plain_minimal'
  | 'user_json_no_temperature'
  | 'user_json_no_max_tokens'
  | 'user_json_max_completion_tokens'
  | 'messages_plain_no_extra_params';

export interface SmokeTestPayloadVariant {
  id: SmokeTestVariantId;
  label: string;
  description: string;
  body: {
    model: string;
    messages: Array<{ role: 'user'; content: string }>;
    max_tokens?: number;
    max_completion_tokens?: number;
    temperature?: number;
    stream?: boolean;
  };
}

/**
 * Build ordered list of smoke test payload variants.
 * Order: most compatible first (simplest), then more specific variants.
 * The goal is to find ANY variant that works, not to test them all.
 */
export function buildSmokeTestPayloadVariants(model: string): SmokeTestPayloadVariant[] {
  return [
    {
      id: 'user_json_minimal',
      label: 'User + JSON + max_tokens + temperature',
      description: 'Standard minimal request with max_tokens and temperature',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_tokens: 60,
        temperature: 0,
        stream: false,
      },
    },
    {
      id: 'user_plain_minimal',
      label: 'User + plain text + max_tokens + temperature',
      description: 'Plain text response, no JSON requirement',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Reply with exactly one word: pong' },
        ],
        max_tokens: 20,
        temperature: 0,
        stream: false,
      },
    },
    {
      id: 'user_json_no_temperature',
      label: 'User + JSON + max_tokens (no temperature)',
      description: 'Omit temperature parameter',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_tokens: 60,
        stream: false,
      },
    },
    {
      id: 'user_json_no_max_tokens',
      label: 'User + JSON + temperature (no max_tokens)',
      description: 'Omit max_tokens parameter',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        temperature: 0,
        stream: false,
      },
    },
    {
      id: 'user_json_max_completion_tokens',
      label: 'User + JSON + max_completion_tokens',
      description: 'Use max_completion_tokens instead of max_tokens',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_completion_tokens: 60,
        temperature: 0,
        stream: false,
      },
    },
    {
      id: 'messages_plain_no_extra_params',
      label: 'Minimal (messages only)',
      description: 'Only model + messages, no extra parameters',
      body: {
        model,
        messages: [
          { role: 'user', content: 'pong' },
        ],
      },
    },
  ];
}
