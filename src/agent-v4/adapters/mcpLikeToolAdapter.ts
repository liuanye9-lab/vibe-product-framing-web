/**
 * MCP-like Tool Adapter — aligns internal tools with MCP conventions.
 *
 * NOT a real MCP Server. Just exposes tools in MCP-like format so
 * the UI Debug panel can show "Agent 可调用工具" and prepare for
 * future MCP Server migration.
 */

import { listTools } from '../tools/toolRegistry';

export interface McpLikeTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export function listMcpLikeTools(): McpLikeTool[] {
  return listTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

export function getMcpLikeTool(name: string): McpLikeTool | undefined {
  return listMcpLikeTools().find((t) => t.name === name);
}
