/**
 * Agent Tool V4 — Tool Type Definitions.
 *
 * Each tool has a name, description, input schema, and an execute function.
 * Tools must not navigate directly or write to localStorage; the runtime collects
 * results and saves.
 *
 * V5.2: Added permissionLevel, sideEffect, requiresApproval for Agent workflow.
 */

import type { ProductBrief } from '../../types';
import type { AgentGraphState } from '../types';

export type ToolPermissionLevel =
  | 'read'
  | 'write_state'
  | 'generate_artifact'
  | 'external_ai'
  | 'dangerous';

export type ToolSideEffect =
  | 'none'
  | 'state_update'
  | 'artifact_generation'
  | 'external_call';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** V5.2: Permission level for agent workflow */
  permissionLevel?: ToolPermissionLevel;
  /** V5.2: Side effect classification */
  sideEffect?: ToolSideEffect;
  /** V5.2: Whether this tool requires human approval before execution */
  requiresApproval?: boolean;
  /** V5.2: Output schema description */
  outputSchema?: Record<string, unknown>;
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
