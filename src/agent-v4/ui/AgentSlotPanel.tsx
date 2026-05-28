/**
 * Agent Slot Panel — shows all key info slots and their status.
 *
 * This is the answer to "what does the system know about my product?"
 * Each slot shows: label, status, value, confidence, source.
 */

import { type FC } from 'react';
import { Check, HelpCircle, Lightbulb, SkipForward, AlertCircle } from 'lucide-react';
import type { InfoSlot, InfoSlotStatus } from '../types';

interface AgentSlotPanelProps {
  slots?: Record<string, InfoSlot>;
}

const STATUS_STYLES: Record<InfoSlotStatus, { color: string; icon: React.ReactNode; label: string }> = {
  answered: { color: 'var(--color-success)', icon: <Check size={10} />, label: '已回答' },
  assumed: { color: 'var(--color-warning)', icon: <Lightbulb size={10} />, label: '假设' },
  skipped: { color: 'var(--color-text-hint)', icon: <SkipForward size={10} />, label: '跳过' },
  unknown: { color: 'var(--color-danger)', icon: <AlertCircle size={10} />, label: '未知' },
  asked: { color: 'var(--color-primary)', icon: <HelpCircle size={10} />, label: '追问中' },
};

export const AgentSlotPanel: FC<AgentSlotPanelProps> = ({ slots }) => {
  if (!slots) {
    return <div style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', padding: 8 }}>暂无信息槽</div>;
  }

  const entries = Object.values(slots).filter((s) => s && s.key);

  if (entries.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', padding: 8 }}>暂无信息槽</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
      {entries.map((slot) => {
        const style = STATUS_STYLES[slot.status] || STATUS_STYLES.unknown;
        return (
          <div
            key={slot.key}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '5px 8px',
              borderRadius: 6,
              background: slot.status === 'unknown' ? 'var(--color-background-danger)' : 'transparent',
              borderBottom: '0.5px solid var(--color-border)',
              fontSize: 11,
            }}
          >
            {/* Status icon */}
            <span style={{ color: style.color, flexShrink: 0, marginTop: 1 }}>
              {style.icon}
            </span>

            {/* Slot details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {slot.label}
                </span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 4,
                  background: style.color + '20', color: style.color, fontWeight: 500,
                }}>
                  {style.label}
                </span>
                {slot.askedCount > 1 && (
                  <span style={{ fontSize: 9, color: 'var(--color-warning)' }}>
                    问过 {slot.askedCount} 次
                  </span>
                )}
              </div>

              {slot.value ? (
                <p style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2, wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {slot.value}
                </p>
              ) : (
                <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginTop: 2, fontStyle: 'italic' }}>
                  （未填写）
                </p>
              )}

              {slot.confidence > 0 && slot.confidence < 0.9 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--color-text-hint)' }}>
                    conf:
                  </span>
                  <div style={{
                    width: 40, height: 3, borderRadius: 2,
                    background: 'var(--color-surface)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.round(slot.confidence * 100)}%`,
                      height: '100%',
                      background: slot.confidence < 0.5 ? 'var(--color-danger)' : slot.confidence < 0.7 ? 'var(--color-warning)' : 'var(--color-success)',
                      borderRadius: 2,
                    }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--color-text-hint)' }}>
                    {Math.round(slot.confidence * 100)}%
                  </span>
                </div>
              )}

              {slot.source && (
                <span style={{ fontSize: 8, color: 'var(--color-text-hint)' }}>
                  {slot.source === 'user' ? '用户提供' : slot.source === 'agent_assumption' ? 'AI 假设' : slot.source === 'legacy_brief' ? '历史数据' : '本地规则'}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
