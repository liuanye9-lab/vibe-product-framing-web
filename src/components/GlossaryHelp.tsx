import { HelpCircle } from 'lucide-react';
import { useState } from 'react';
import type { GlossaryKey } from '../types';
import { getGlossaryItem } from '../data/glossary';

interface GlossaryHelpProps {
  glossaryKey?: GlossaryKey;
  defaultOpen?: boolean;
}

export default function GlossaryHelp({ glossaryKey, defaultOpen = false }: GlossaryHelpProps) {
  const [open, setOpen] = useState(defaultOpen);
  const item = getGlossaryItem(glossaryKey);

  if (!item) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        className="vp-btn-text"
        onClick={() => setOpen((value) => !value)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0, fontSize: 12, color: 'var(--color-primary)' }}
      >
        <HelpCircle size={13} />
        这是什么？
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <strong style={{ fontSize: 13, color: 'var(--color-text)' }}>{item.plainName}</strong>
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>{item.expertName}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 6 }}>{item.simpleExplanation}</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 6 }}><strong>为什么重要：</strong>{item.whyItMatters}</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 6 }}><strong>例子：</strong>{item.example}</p>
          <p style={{ fontSize: 12, color: 'var(--color-primary)', lineHeight: 1.7 }}><strong>新手行动：</strong>{item.beginnerAction}</p>
        </div>
      )}
    </div>
  );
}
