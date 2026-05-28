import { memo } from 'react';
import type { DecisionStageProgress } from '../types';
import { getOverallProgress } from '../lib/progressCalculator';

interface ProgressBarProps {
  phases: DecisionStageProgress[];
}

const STATUS_COLORS: Record<string, string> = {
  empty: 'var(--color-border)',
  draft: '#F59E0B',
  needs_review: '#3B82F6',
  confirmed: '#10B981',
  blocked: '#EF4444',
};

const STATUS_DOTS: Record<string, string> = {
  empty: '○',
  draft: '◐',
  needs_review: '◑',
  confirmed: '●',
  blocked: '✕',
};

const ProgressBar = memo(function ProgressBar({ phases }: ProgressBarProps) {
  const overall = getOverallProgress(phases);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          决策进度
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {overall.completed}/{overall.total} 阶段 · {overall.percentage}%
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3 }}>
        {phases.map((phase) => (
          <div
            key={phase.key}
            title={`${phase.label}: ${phase.status} (${phase.qualityScore}/5)`}
            style={{
              height: 6,
              borderRadius: 3,
              background: STATUS_COLORS[phase.status] || 'var(--color-border)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3, marginTop: 4 }}>
        {phases.map((phase) => (
          <span
            key={phase.key}
            title={phase.label}
            style={{
              fontSize: 8,
              color: 'var(--color-text-hint)',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {STATUS_DOTS[phase.status] || '○'}
          </span>
        ))}
      </div>
    </div>
  );
});

ProgressBar.displayName = 'ProgressBar';
export default ProgressBar;
