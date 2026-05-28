/**
 * Agent Tool V4 — Tool Type Definitions.
 *
 * Each tool has a name, description, input schema, and an execute function.
 * Tools must not navigate directly or write to localStorage; the runtime collects
 * results and saves.
 */

import type { ProductBrief } from '../../types';
import type { AgentGraphState } from '../types';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: {
    brief: ProductBrief;
    state: AgentGraphState;
    payload: Record<string, unknown>;
  }): Promise<AgentToolResult>;
}

export interface AgentToolResult {
  success: boolean;
  message: string;
  data?: unknown;
  briefPatch?: Partial<ProductBrief>;
  statePatch?: Partial<AgentGraphState>;
}

export function makeToolResult(
  success: boolean,
  message: string,
  opts?: {
    data?: unknown;
    briefPatch?: Partial<ProductBrief>;
    statePatch?: Partial<AgentGraphState>;
  },
): AgentToolResult {
  return {
    success,
    message,
    data: opts?.data,
    briefPatch: opts?.briefPatch,
    statePatch: opts?.statePatch,
  };
}
