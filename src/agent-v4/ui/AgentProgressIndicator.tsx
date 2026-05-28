/**
 * Agent Progress Indicator — shows what the Agent is doing step by step.
 *
 * Lightweight card showing current phase and progress steps.
 * Used during sending to give user visibility into Agent's work.
 */

import { type FC } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { AgentTurnLifecycle, AgentTurnProgressStep } from '../turnLifecycle';
import { getPhaseLabel } from '../turnLifecycle';

interface AgentProgressIndicatorProps {
  lifecycle: AgentTurnLifecycle | null;
}

export const AgentProgressIndicator: FC<AgentProgressIndicatorProps> = ({ lifecycle }) => {
  if (!lifecycle) return null;

  const steps = lifecycle.progressSteps;
  if (steps.length === 0) return null;

  const currentPhase = lifecycle.phase;

  return (
    <div
      style={{
        marginTop: 8, marginBottom: 8,
        fontSize: 12,
      }}
    >
      {/* Current phase */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px', borderRadius: 6,
        background: 'rgba(224, 74, 59, 0.04)',
        border: '0.5px solid rgba(224, 74, 59, 0.10)',
        marginBottom: 4,
      }}>
        <Loader2 size={12} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
          当前：{getPhaseLabel(currentPhase)}
        </span>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
};

function StepRow({ step }: { step: AgentTurnProgressStep }) {
  const icon =
    step.status === 'done' ? <Check size={10} style={{ color: 'var(--color-success)' }} /> :
    step.status === 'running' ? <Loader2 size={10} className="vp-spin" style={{ color: 'var(--color-primary)' }} /> :
    step.status === 'failed' ? <AlertCircle size={10} style={{ color: 'var(--color-danger)' }} /> :
    <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-border)' }} />;

  const color =
    step.status === 'done' ? 'var(--color-text-hint)' :
    step.status === 'running' ? 'var(--color-text)' :
    step.status === 'failed' ? 'var(--color-danger)' :
    'var(--color-text-hint)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '2px 10px', fontSize: 11,
      color, opacity: step.status === 'done' ? 0.6 : 1,
    }}>
      {icon}
      <span>{step.description}</span>
    </div>
  );
}
