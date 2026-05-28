/**
 * Agent Memory Panel — displays working memory, episodic reflections,
 * and semantic references.
 */

import { type FC } from 'react';
import { Brain, Lightbulb, BookOpen } from 'lucide-react';
import { getRecentReflections } from '../memory/episodicMemory';

interface AgentMemoryPanelProps {
  workingMemory: Record<string, unknown>;
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string') return v.length > 100 ? v.slice(0, 100) + '...' : v;
  if (Array.isArray(v)) return v.map(String).join(', ').slice(0, 100);
  return String(v).slice(0, 100);
}

export const AgentMemoryPanel: FC<AgentMemoryPanelProps> = ({ workingMemory }) => {
  const reflections = getRecentReflections(5);
  const wmKeys = Object.entries(workingMemory).filter(
    ([, v]) => v !== '' && v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
      {/* Working Memory */}
      {wmKeys.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Brain size={12} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>工作记忆</span>
          </div>
          <div style={{ display: 'grid', gap: 2 }}>
            {wmKeys.map(([key, value]) => (
              <div key={key} style={{ display: 'flex', gap: 4, fontSize: 10 }}>
                <span style={{ color: 'var(--color-text-hint)', minWidth: 80 }}>{key}</span>
                <span style={{ color: 'var(--color-text)' }}>{fmtVal(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reflections */}
      {reflections.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, marginTop: 8 }}>
            <Lightbulb size={12} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>反思 ({reflections.length})</span>
          </div>
          {reflections.slice(0, 3).map((r) => (
            <div key={r.id} style={{ padding: '4px 0', borderBottom: '0.5px solid var(--color-border)' }}>
              <p style={{ fontSize: 10, fontWeight: 500 }}>{r.title}</p>
              <p style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{r.content.slice(0, 100)}</p>
            </div>
          ))}
        </div>
      )}

      {wmKeys.length === 0 && reflections.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', padding: 8 }}>
          <BookOpen size={14} style={{ marginBottom: 4, display: 'block', margin: '0 auto' }} />
          暂无记忆
        </div>
      )}
    </div>
  );
};
