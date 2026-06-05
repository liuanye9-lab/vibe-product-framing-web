/**
 * V5.5: Provider-Compatible Smoke Test Payloads
 *
 * Different AI providers/gateways have varying levels of OpenAI API compatibility.
 * Some reject system roles, max_tokens, temperature, stream, or other parameters.
 *
 * V5.5 change: Most minimal payload first. Many gateways reject extra fields
 * like temperature/stream/max_tokens on the first request.
 */

export type SmokeTestVariantId =
  | 'messages_plain_no_extra_params'
  | 'user_plain_minimal'
  | 'user_json_no_extra_params'
  | 'user_json_no_temperature'
  | 'user_json_max_completion_tokens'
  | 'user_json_minimal'
  | 'system_user_no_extra'
  | 'content_array_format'
  | 'omit_stream_field'
  | 'user_no_stream_minimal'
  | 'system_with_user_minimal';

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
 * V5.5 order: most minimal first (model + messages only), then progressively add parameters.
 * The goal is to find ANY variant that works, not to test them all.
 */
export function buildSmokeTestPayloadVariants(model: string): SmokeTestPayloadVariant[] {
  return [
    // ── Tier 1: Absolute minimum ──────────────────────────────────────────
    {
      id: 'messages_plain_no_extra_params',
      label: 'Minimal (model + messages only)',
      description: 'Only model + messages, zero extra parameters — maximum compatibility',
      body: {
        model,
        messages: [
          { role: 'user', content: 'pong' },
        ],
      },
    },
    // ── Tier 2: + max_tokens only ──────────────────────────────────────────
    {
      id: 'user_plain_minimal',
      label: 'User plain + max_tokens',
      description: 'Plain text response + max_tokens, no temperature/stream',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Reply with exactly one word: pong' },
        ],
        max_tokens: 20,
      },
    },
    // ── Tier 3: JSON + max_tokens ──────────────────────────────────────────
    {
      id: 'user_json_no_extra_params',
      label: 'User JSON + max_tokens',
      description: 'JSON response + max_tokens, no temperature/stream',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_tokens: 60,
      },
    },
    // ── Tier 4: + stream: false ────────────────────────────────────────────
    {
      id: 'user_json_no_temperature',
      label: 'User JSON + max_tokens + stream:false',
      description: 'Add stream: false explicitly',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_tokens: 60,
        stream: false,
      },
    },
    // ── Tier 5: max_completion_tokens variant ──────────────────────────────
    {
      id: 'user_json_max_completion_tokens',
      label: 'User JSON + max_completion_tokens',
      description: 'Use max_completion_tokens instead of max_tokens',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return exactly: {"ok":true}' },
        ],
        max_completion_tokens: 60,
        stream: false,
      },
    },
    // ── Tier 6: + temperature ──────────────────────────────────────────────
    {
      id: 'user_json_minimal',
      label: 'User JSON + max_tokens + temperature',
      description: 'Standard minimal request with temperature',
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
    // ── Tier 7: System role variants ───────────────────────────────────────
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
      id: 'system_with_user_minimal',
      label: 'System + User + max_tokens + temperature',
      description: 'System message + user message with all params',
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
    // ── Tier 8: Special formats ────────────────────────────────────────────
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
    // ── Tier 9: Omit stream field entirely ─────────────────────────────────
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
      label: 'User plain + max_tokens + temp (no stream)',
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
