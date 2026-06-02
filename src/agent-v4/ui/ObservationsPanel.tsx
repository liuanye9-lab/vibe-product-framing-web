/**
 * V5.2 Observations Panel — Shows recent observations with evidence and risks
 *
 * Displays:
 * - title
 * - content
 * - evidence
 * - risks
 * - nextSuggestion
 */

import type { AgentObservation } from '../taskGraph/taskGraphTypes';

interface ObservationsPanelProps {
  observations: AgentObservation[];
}

const SOURCE_ICONS: Record<string, string> = {
  tool: '🔧',
  ai: '🤖',
  user: '👤',
  system: '⚙️',
};

export function ObservationsPanel({ observations }: ObservationsPanelProps) {
  if (observations.length === 0) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
        暂无观察记录
      </div>
    );
  }

  // Show most recent first, max 20
  const recent = observations.slice(-20).reverse();

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 10 }}>
        Observations ({observations.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recent.map(obs => (
          <div
            key={obs.id}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              fontSize: 12,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 14 }}>{SOURCE_ICONS[obs.source] || '📝'}</span>
              <span style={{ fontWeight: 600, color: '#1f2937' }}>{obs.title}</span>
              <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>
                {obs.source}
              </span>
            </div>

            {/* Content */}
            <div style={{ color: '#374151', lineHeight: 1.5, marginBottom: 6 }}>
              {obs.content.length > 300 ? obs.content.slice(0, 300) + '...' : obs.content}
            </div>

            {/* Evidence */}
            {obs.evidence.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#059669', marginBottom: 2 }}>
                  Evidence:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: '#374151' }}>
                  {obs.evidence.slice(0, 3).map((e, i) => (
                    <li key={i} style={{ fontSize: 11, lineHeight: 1.4 }}>{e}</li>
                  ))}
                  {obs.evidence.length > 3 && (
                    <li style={{ fontSize: 11, color: '#9ca3af' }}>+{obs.evidence.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Risks */}
            {obs.risks.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#dc2626', marginBottom: 2 }}>
                  Risks:
                </div>
                <ul style={{ margin: 0, paddingLeft: 16, color: '#374151' }}>
                  {obs.risks.slice(0, 3).map((r, i) => (
                    <li key={i} style={{ fontSize: 11, lineHeight: 1.4 }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next suggestion */}
            {obs.nextSuggestion && (
              <div style={{ fontSize: 11, color: '#3b82f6', fontStyle: 'italic', marginTop: 4 }}>
                → {obs.nextSuggestion}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ObservationsPanel;
