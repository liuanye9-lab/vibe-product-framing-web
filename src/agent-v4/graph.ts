/**
 * Agent Graph V4 — fixed graph definition.
 *
 * The orchestrator can dynamically route, but the default edges define
 * the standard product decision workflow.
 */

import type { AgentNodeId } from './types';
import { AGENT_NODE_LABELS, AGENT_NODE_DESCRIPTIONS } from './types';

/** Default linear flow: orchestrator routes between these. */
export const AGENT_GRAPH_FLOW: AgentNodeId[] = [
  'orchestrator',
  'intake',
  'demand',
  'product',
  'mvp',
  'tech',
  'risk',
  'handoff',
  'reviewer',
  'reflection',
  'end',
];

/** Allowed transitions from each node (includes dynamic routing). */
export const AGENT_GRAPH_EDGES: Record<AgentNodeId, AgentNodeId[]> = {
  orchestrator: ['intake', 'demand', 'product', 'mvp', 'tech', 'risk', 'handoff', 'reviewer', 'reflection', 'human_interrupt', 'end'],
  intake: ['demand', 'product', 'human_interrupt', 'orchestrator'],
  demand: ['product', 'mvp', 'human_interrupt', 'orchestrator'],
  product: ['mvp', 'tech', 'human_interrupt', 'orchestrator'],
  mvp: ['tech', 'risk', 'handoff', 'human_interrupt', 'orchestrator'],
  tech: ['risk', 'handoff', 'human_interrupt', 'orchestrator'],
  risk: ['handoff', 'reviewer', 'human_interrupt', 'orchestrator'],
  handoff: ['reviewer', 'reflection', 'end', 'orchestrator'],
  reviewer: ['reflection', 'handoff', 'end', 'orchestrator'],
  reflection: ['handoff', 'reviewer', 'end', 'orchestrator'],
  human_interrupt: ['orchestrator', 'intake', 'demand', 'product', 'mvp', 'tech', 'risk', 'handoff', 'reviewer', 'reflection'],
  end: [],
};

/** Get default next node in the linear flow. */
export function getDefaultNextNode(nodeId: AgentNodeId): AgentNodeId {
  const idx = AGENT_GRAPH_FLOW.indexOf(nodeId);
  if (idx < 0 || idx >= AGENT_GRAPH_FLOW.length - 1) return nodeId;
  return AGENT_GRAPH_FLOW[idx + 1];
}

/** Get previous node in the linear flow. */
export function getPreviousNode(nodeId: AgentNodeId): AgentNodeId {
  const idx = AGENT_GRAPH_FLOW.indexOf(nodeId);
  if (idx <= 0) return AGENT_GRAPH_FLOW[0];
  return AGENT_GRAPH_FLOW[idx - 1];
}

/** Check if a transition is allowed (orchestrator can go anywhere). */
export function canTransition(from: AgentNodeId, to: AgentNodeId): boolean {
  // orchestrator can route anywhere
  if (from === 'orchestrator') return true;
  const allowed = AGENT_GRAPH_EDGES[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/** Get human-readable node label. */
export function getNodeLabel(nodeId: AgentNodeId): string {
  return AGENT_NODE_LABELS[nodeId] || nodeId;
}

/** Get node description. */
export function getNodeDescription(nodeId: AgentNodeId): string {
  return AGENT_NODE_DESCRIPTIONS[nodeId] || '';
}

/** Get node index in the default flow (for progress display). */
export function getNodeIndex(nodeId: AgentNodeId): number {
  return AGENT_GRAPH_FLOW.indexOf(nodeId);
}

/** Get all business nodes (excluding orchestrator, human_interrupt, end). */
export function getBusinessNodes(): AgentNodeId[] {
  return AGENT_GRAPH_FLOW.filter(
    (id) => !['orchestrator', 'human_interrupt', 'end'].includes(id),
  );
}
