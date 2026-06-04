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
  | 'messages_plain_no_extra_params'
  | 'system_with_user_minimal'
  | 'system_user_no_extra'
  | 'content_array_format'
  | 'omit_stream_field'
  | 'user_no_stream_minimal';

export interface SmokeTestPayloadVariant {
  id: SmokeTestVariantId;
  label: string;
  description: string;
  body: {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string | Array<{ type: 'text'; text: string }> }>;
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
    {
      id: 'system_with_user_minimal',
      label: 'System + User + max_tokens + temperature',
      description: 'System message + user message (some APIs require system role)',
      body: {
        model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Reply concisely.' },
          { role: 'user', content: 'Reply with exactly one word: pong' },
        ],
        max_tokens: 20,
        temperature: 0,
        stream: false,
      },
    },
    {
      id: 'system_user_no_extra',
      label: 'System + User (no extra params)',
      description: 'System + user, no max_tokens/temperature/stream',
      body: {
        model,
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'pong' },
        ],
      },
    },
    {
      id: 'content_array_format',
      label: 'User content array format',
      description: 'Content as array of text parts (Vision API format)',
      body: {
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Reply with exactly one word: pong' }],
          },
        ],
        max_tokens: 20,
        temperature: 0,
        stream: false,
      },
    },
    {
      id: 'omit_stream_field',
      label: 'User + JSON (omit stream field)',
      description: 'No stream field at all (not even stream: false)',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_tokens: 60,
        temperature: 0,
      },
    },
    {
      id: 'user_no_stream_minimal',
      label: 'User plain text + max_tokens + temp (no stream)',
      description: 'Plain text, max_tokens + temperature, omit stream field',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Reply with exactly one word: pong' },
        ],
        max_tokens: 20,
        temperature: 0,
      },
    },
  ];
}
