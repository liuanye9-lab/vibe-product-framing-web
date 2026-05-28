/**
 * Agent Graph Panel — visual node flow display.
 *
 * Shows all graph nodes with current node highlighted.
 * Uses flex/grid — no complex chart library.
 */

import { type FC } from 'react';
import { Check, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import type { AgentNodeId } from '../types';
import { AGENT_NODE_LABELS } from '../types';
import { AGENT_GRAPH_FLOW } from '../graph';

interface AgentGraphPanelProps {
  currentNodeId: AgentNodeId;
  completedNodes?: AgentNodeId[];
  skippedNodes?: AgentNodeId[];
  status?: string;
}

export const AgentGraphPanel: FC<AgentGraphPanelProps> = ({
  currentNodeId,
  completedNodes = [],
  skippedNodes = [],
  status = 'idle',
}) => {
  // Only show business nodes (exclude orchestrator, human_interrupt, end)
  const displayNodes = AGENT_GRAPH_FLOW.filter(
    (id) => !['orchestrator', 'human_interrupt', 'end'].includes(id),
  );

  const currentIdx = displayNodes.indexOf(currentNodeId);

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 0 }}>
        {displayNodes.map((nodeId, idx) => {
          const isCurrent = nodeId === currentNodeId;
          const isCompleted = completedNodes.includes(nodeId);
          const isSkipped = skippedNodes.includes(nodeId);
          const isPassed = idx < currentIdx;
          const label = AGENT_NODE_LABELS[nodeId] || nodeId;

          return (
            <div key={nodeId} style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* Connector arrow */}
              {idx > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '0 2px', height: 32, color: 'var(--color-text-hint)',
                }}>
                  <ChevronRight size={10} />
                </div>
              )}

              {/* Node chip */}
              <div
                title={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 400,
                  whiteSpace: 'nowrap',
                  background: isCurrent
                    ? 'var(--color-primary)'
                    : isCompleted
                      ? 'var(--color-success)'
                      : isSkipped
                        ? 'var(--color-warning)'
                        : isPassed
                          ? 'rgba(224, 74, 59, 0.08)'
                          : 'var(--color-surface)',
                  color: isCurrent
                    ? '#fff'
                    : isCompleted
                      ? '#fff'
                      : isPassed
                        ? 'var(--color-primary)'
                        : 'var(--color-text-hint)',
                  border: isCurrent || isCompleted
                    ? 'none'
                    : '0.5px solid var(--color-border)',
                  transition: 'all 0.2s ease',
                }}
              >
                {isCompleted && <Check size={10} />}
                {isCurrent && status === 'running' && <Loader2 size={10} className="vp-spin" />}
                {isCurrent && status === 'waiting_user' && <AlertCircle size={10} />}
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
