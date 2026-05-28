/**
 * Agent Debug Panel — internal state inspection for transparency.
 */

import { type FC } from 'react';
import { Bug } from 'lucide-react';
import type { AgentGraphSession } from '../types';
import { AGENT_NODE_LABELS } from '../types';

interface AgentDebugPanelProps {
  session: AgentGraphSession | null;
}

export const AgentDebugPanel: FC<AgentDebugPanelProps> = ({ session }) => {
  if (!session) {
    return (
      <div style={{ fontSize: 11, color: 'var(--color-text-hint)', padding: 8 }}>
        无活跃 Session
      </div>
    );
  }

  const { state, events, checkpoints } = session;

  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: 'monospace',
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 8,
        padding: 10,
        maxHeight: 400,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <Bug size={10} />
        <span style={{ fontWeight: 600 }}>Debug Panel</span>
      </div>

      <div style={{ display: 'grid', gap: 2 }}>
        <Row label="Session" value={session.id} />
        <Row label="Brief" value={session.briefId} />
        <Row label="Schema" value={session.schemaVersion} />
        <Row label="Status" value={state.status} />
        <Row label="Current Node" value={AGENT_NODE_LABELS[state.currentNodeId] || state.currentNodeId} />
        <Row label="Previous Node" value={state.previousNodeId || '-'} />
        <Row label="Events" value={String(events.length)} />
        <Row label="Checkpoints" value={String(checkpoints.length)} />
        <Row label="Tasks" value={`${state.tasks.length} (${state.tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped').length} active)`} />
        <Row label="Findings" value={String(state.findings.length)} />
        <Row label="Pending Qs" value={String(state.pendingQuestions.length)} />
        <Row label="Commands" value={String(state.pendingCommands.length)} />
        {state.lastEvaluation && (
          <>
            <Row label="Eval Score" value={`${state.lastEvaluation.score}`} />
            <Row label="Readiness" value={state.lastEvaluation.readiness} />
          </>
        )}
      </div>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <span style={{ color: 'var(--color-text-hint)', minWidth: 90 }}>{label}:</span>
      <span style={{ color: 'var(--color-text)' }}>{value}</span>
    </div>
  );
}
