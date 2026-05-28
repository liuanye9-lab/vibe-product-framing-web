/**
 * JSON Schema Hints — schema validation helpers for Agent output.
 *
 * Ensures AI outputs conform to expected JSON schemas.
 */

export interface JsonSchemaHint {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  allowedValues?: string[];
}

export const COMMAND_SCHEMA_HINTS: JsonSchemaHint[] = [
  { field: 'type', type: 'string', required: true, description: 'Command type', allowedValues: [
    'ASK_USER', 'UPDATE_BRIEF', 'CREATE_TASK', 'COMPLETE_TASK',
    'CREATE_FINDING', 'MOVE_NODE', 'CALL_TOOL', 'CREATE_CHECKPOINT',
    'CREATE_MEMORY', 'CREATE_SKILL', 'GENERATE_HANDOFF',
    'EVALUATE_HANDOFF', 'INTERRUPT_FOR_USER', 'FINISH',
  ]},
  { field: 'reason', type: 'string', required: true, description: 'Why this command is needed' },
  { field: 'payload', type: 'object', required: false, description: 'Command-specific data' },
];

export function validateCommands(commands: unknown[], allowedTypes: string[]): {
  valid: unknown[];
  errors: string[];
} {
  const valid: unknown[] = [];
  const errors: string[] = [];

  if (!Array.isArray(commands)) return { valid: [], errors: ['commands must be an array'] };

  for (const cmd of commands) {
    if (typeof cmd !== 'object' || !cmd) {
      errors.push('Command must be an object');
      continue;
    }
    const c = cmd as Record<string, unknown>;
    if (!c.type || typeof c.type !== 'string') {
      errors.push('Command missing type');
      continue;
    }
    if (!allowedTypes.includes(c.type)) {
      errors.push(`Command type "${c.type}" not allowed`);
      continue;
    }
    valid.push(c);
  }
  return { valid, errors };
}

export function getJsonOnlyPrompt(): string {
  return `返回严格 JSON，不要 markdown 代码块，不要解释文字，不要 "...". 每个字段必须是真实值。`;
}
