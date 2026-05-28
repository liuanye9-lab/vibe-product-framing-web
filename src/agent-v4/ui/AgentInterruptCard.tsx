/**
 * Agent Interrupt Card — displayed when the system needs user input.
 */

import { type FC } from 'react';
import { AlertCircle, ChevronRight, MessageSquare } from 'lucide-react';

interface AgentInterruptCardProps {
  title: string;
  description?: string;
  questions?: string[];
  onAnswer?: (answer: string) => void;
  onContinue?: () => void;
  onSkip?: () => void;
  onMakeAssumption?: () => void;
}

export const AgentInterruptCard: FC<AgentInterruptCardProps> = ({
  title,
  description,
  questions = [],
  onAnswer,
  onContinue,
  onSkip,
  onMakeAssumption,
}) => {
  return (
    <div
      className="vp-card"
      style={{
        margin: '8px 0',
        padding: '12px 16px',
        borderColor: 'var(--color-warning)',
        borderWidth: '1.5px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--color-warning)' }}>
        <AlertCircle size={14} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
      </div>
      {description && (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>
          {description}
        </p>
      )}
      {questions.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {questions.map((q, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                color: 'var(--color-text)',
                marginBottom: 2,
              }}
            >
              <MessageSquare size={10} style={{ color: 'var(--color-text-hint)' }} />
              <button
                className="vp-btn-text"
                onClick={() => onAnswer?.(q)}
                style={{ fontSize: 12, padding: '2px 4px', textAlign: 'left' }}
              >
                {q}
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {onContinue && (
          <button className="vp-btn vp-btn-primary" onClick={onContinue} style={{ fontSize: 11, padding: '4px 10px' }}>
            <ChevronRight size={12} /> 继续下一步
          </button>
        )}
        {onSkip && (
          <button className="vp-btn vp-btn-ghost" onClick={onSkip} style={{ fontSize: 11, padding: '4px 10px' }}>
            先跳过
          </button>
        )}
        {onMakeAssumption && (
          <button className="vp-btn vp-btn-ghost" onClick={onMakeAssumption} style={{ fontSize: 11, padding: '4px 10px' }}>
            帮我做默认假设
          </button>
        )}
      </div>
    </div>
  );
};
