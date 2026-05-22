import { Check, HelpCircle, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { AiSuggestion, GlossaryKey, SuggestionValue } from '../types';
import GlossaryHelp from './GlossaryHelp';

interface SuggestionCardProps<T extends SuggestionValue = SuggestionValue> {
  title: string;
  description?: string;
  suggestion?: AiSuggestion<T>;
  onAccept: () => void;
  onChange: (value: T) => void;
  onRegenerate?: () => Promise<void> | void;
  onExplain?: () => Promise<string>;
  regenerating?: boolean;
  glossaryKey?: GlossaryKey;
  showGlossaryByDefault?: boolean;
}

function valueToText(value: SuggestionValue | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join('\n') : String(value);
}

function textToValue<T extends SuggestionValue>(text: string, original: T | undefined): T {
  if (Array.isArray(original)) {
    return text.split('\n').map((item) => item.trim()).filter(Boolean) as T;
  }
  return text as T;
}

export default function SuggestionCard<T extends SuggestionValue = SuggestionValue>({
  title,
  description,
  suggestion,
  onAccept,
  onChange,
  onRegenerate,
  onExplain,
  regenerating,
  glossaryKey,
  showGlossaryByDefault,
}: SuggestionCardProps<T>) {
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [actionError, setActionError] = useState('');
  const textValue = valueToText(suggestion?.value);

  const handleRegenerate = async () => {
    if (!onRegenerate || regenerating) return;
    setActionError('');
    try {
      await onRegenerate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '重新生成失败，请稍后重试。');
    }
  };

  const handleExplain = async () => {
    if (!onExplain) return;
    setActionError('');
    setExplaining(true);
    try {
      const text = await onExplain();
      setExplanation(text);
    } catch (error) {
      setExplanation(error instanceof Error ? error.message : '解释生成失败，请稍后重试。');
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="vp-card" style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>{title}</h3>
          {description && <p style={{ fontSize: 12, color: 'var(--color-text-hint)', lineHeight: 1.6 }}>{description}</p>}
          <GlossaryHelp glossaryKey={glossaryKey} defaultOpen={showGlossaryByDefault} />
        </div>
        {suggestion?.accepted && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--color-success)' }}>
            <Check size={12} /> 已接受
          </span>
        )}
      </div>

      <textarea
        className="vp-textarea"
        value={textValue}
        rows={Array.isArray(suggestion?.value) ? Math.max(3, suggestion?.value.length || 3) : 4}
        placeholder="AI 建议将在这里生成，你也可以直接编辑。"
        onChange={(event) => onChange(textToValue(event.target.value, suggestion?.value as T | undefined))}
      />

      {suggestion?.reason && (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginTop: 10 }}>
          <strong style={{ color: 'var(--color-text)' }}>推荐理由：</strong>{suggestion.reason}
        </p>
      )}

      {!!suggestion?.risks?.length && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--color-warning-light)' }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-warning)', fontWeight: 600, marginBottom: 4 }}>
            <ShieldAlert size={13} /> 风险
          </p>
          <ul style={{ paddingLeft: 18, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            {suggestion.risks.map((risk) => <li key={risk}>{risk}</li>)}
          </ul>
        </div>
      )}

      {!!suggestion?.alternatives?.length && (
        <p style={{ fontSize: 12, color: 'var(--color-text-hint)', lineHeight: 1.7, marginTop: 10 }}>
          替代方案：{suggestion.alternatives.join(' / ')}
        </p>
      )}

      {explanation && (
        <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{explanation}</p>
        </div>
      )}

      {actionError && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--color-danger-light)', border: '1px solid rgba(226,75,74,0.25)' }}>
          <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6 }}>{actionError}</p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="vp-btn vp-btn-primary" onClick={onAccept} disabled={!suggestion}>
          <Check size={14} /> 接受建议
        </button>
        {onRegenerate && (
          <button className="vp-btn vp-btn-ghost" onClick={handleRegenerate} disabled={regenerating}>
            {regenerating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
            重新生成
          </button>
        )}
        {onExplain && (
          <button className="vp-btn vp-btn-ghost" onClick={handleExplain} disabled={explaining}>
            {explaining ? <Loader2 size={14} className="vp-spin" /> : <HelpCircle size={14} />}
            为什么这样设计
          </button>
        )}
      </div>
    </div>
  );
}
