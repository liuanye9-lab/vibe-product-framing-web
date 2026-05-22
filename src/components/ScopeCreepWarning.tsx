import { AlertTriangle } from 'lucide-react';

interface ScopeCreepWarningProps {
  terms: string[];
  warning?: string;
}

export default function ScopeCreepWarning({ terms, warning }: ScopeCreepWarningProps) {
  if (!terms.length && !warning) return null;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--color-warning-light)',
        border: '1px solid rgba(186, 117, 23, 0.35)',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <AlertTriangle size={18} style={{ color: 'var(--color-warning)', marginTop: 2 }} />
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 650, color: 'var(--color-warning)', marginBottom: 6 }}>
            Scope Creep Warning
          </h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            {warning || '当前想法有范围膨胀风险。V1 建议压缩为一个核心闭环。'}
          </p>
          {!!terms.length && (
            <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 8 }}>
              触发词：{terms.join('、')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
