/**
 * V5.6: Provider-Compatible Smoke Test Payloads
 *
 * V5.6 change: Exactly 9 variants, strictly ordered from most minimal to
 * progressively more complex. Principles:
 *
 * 1. Minimal request first (model + messages only)
 * 2. No temperature on first attempt
 * 3. No stream=false on first attempt
 * 4. No JSON requirement on first attempt
 * 5. No system role on first attempt
 */

export type SmokeTestVariantId =
  | 'messages_plain_no_extra_params'
  | 'user_plain_no_extra_params'
  | 'user_plain_with_max_tokens'
  | 'user_json_no_extra_params'
  | 'user_json_with_max_tokens'
  | 'user_json_max_completion_tokens'
  | 'user_json_with_temperature'
  | 'system_user_no_extra'
  | 'content_array_format';

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
 * V5.6 order: strictly minimal first, then progressively add parameters.
 * The goal is to find ANY variant that works, not to test them all.
 */
export function buildSmokeTestPayloadVariants(model: string): SmokeTestPayloadVariant[] {
  return [
    // ── Tier 1: Absolute minimum — model + messages only ────────────────
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
    // ── Tier 2: Plain text, no max_tokens ────────────────────────────────
    {
      id: 'user_plain_no_extra_params',
      label: 'User plain (no extra params)',
      description: 'Plain user message with explicit instruction, no max_tokens/temperature/stream',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Reply with one word: pong' },
        ],
      },
    },
    // ── Tier 3: Plain text + max_tokens ──────────────────────────────────
    {
      id: 'user_plain_with_max_tokens',
      label: 'User plain + max_tokens',
      description: 'Plain text + max_tokens, no temperature/stream',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Reply with one word: pong' },
        ],
        max_tokens: 20,
      },
    },
    // ── Tier 4: JSON + no extra params ───────────────────────────────────
    {
      id: 'user_json_no_extra_params',
      label: 'User JSON (no extra params)',
      description: 'JSON request + max_tokens only',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return {"ok":true}' },
        ],
        max_tokens: 60,
      },
    },
    // ── Tier 5: JSON + max_tokens ────────────────────────────────────────
    {
      id: 'user_json_with_max_tokens',
      label: 'User JSON + max_tokens + stream:false',
      description: 'JSON + max_tokens + explicit stream: false',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return {"ok":true}' },
        ],
        max_tokens: 60,
        stream: false,
      },
    },
    // ── Tier 6: max_completion_tokens variant ────────────────────────────
    {
      id: 'user_json_max_completion_tokens',
      label: 'User JSON + max_completion_tokens',
      description: 'Use max_completion_tokens instead of max_tokens',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return {"ok":true}' },
        ],
        max_completion_tokens: 60,
        stream: false,
      },
    },
    // ── Tier 7: + temperature ─────────────────────────────────────────────
    {
      id: 'user_json_with_temperature',
      label: 'User JSON + max_tokens + temperature',
      description: 'Standard minimal request with temperature: 0',
      body: {
        model,
        messages: [
          { role: 'user', content: 'Return {"ok":true}' },
        ],
        max_tokens: 60,
        temperature: 0,
        stream: false,
      },
    },
    // ── Tier 8: System role ───────────────────────────────────────────────
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
    // ── Tier 9: Content array format ─────────────────────────────────────
    {
      id: 'content_array_format',
      label: 'User content array format',
      description: 'Content as array of text parts (Vision API format)',
      body: {
        model,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Reply with one word: pong' }],
          },
        ],
        max_tokens: 20,
      },
    },
  ];
}
