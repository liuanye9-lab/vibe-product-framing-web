/**
 * Agent Thinking Bubble — shows immediate acknowledgement + animated dots.
 *
 * Displayed during sending, before the full agent reply arrives.
 * Never saved to session. Removed when runtime completes.
 */

import { type FC } from 'react';
import { Bot, Loader2 } from 'lucide-react';

interface AgentThinkingBubbleProps {
  message: string;
  phase?: string;
  slowHint?: string;
}

export const AgentThinkingBubble: FC<AgentThinkingBubbleProps> = ({
  message,
  phase,
  slowHint,
}) => {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Bot size={14} />
      </div>

      <div style={{ maxWidth: '80%' }}>
        {/* Phase label */}
        {phase && (
          <p style={{
            fontSize: 10, color: 'var(--color-text-hint)',
            marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Loader2 size={10} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
            {phase}
          </p>
        )}

        {/* Message */}
        <div style={{
          padding: '10px 16px',
          background: 'rgba(224, 74, 59, 0.04)',
          border: '0.5px solid rgba(224, 74, 59, 0.10)',
          borderRadius: 10,
          fontSize: 13,
          lineHeight: 1.6,
          color: 'var(--color-text)',
          borderBottomLeftRadius: 2,
        }}>
          {message}
        </div>

        {/* Slow hint */}
        {slowHint && (
          <p style={{
            fontSize: 11, color: 'var(--color-warning)',
            marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Loader2 size={10} className="vp-spin" />
            {slowHint}
          </p>
        )}
      </div>
    </div>
  );
};
