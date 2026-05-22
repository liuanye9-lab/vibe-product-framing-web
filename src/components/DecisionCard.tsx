import { Check, ChevronDown, ChevronUp, HelpCircle, Loader2, RefreshCw, ShieldAlert, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { CoreDecision, GlossaryKey } from '../types';
import GlossaryHelp from './GlossaryHelp';

interface DecisionCardProps {
  decision: CoreDecision;
  onAccept?: () => void;
  onSimplify?: () => Promise<void> | void;
  onExplain?: () => Promise<string>;
  glossaryKey?: GlossaryKey;
  editableValue?: string;
  onEdit?: (value: string) => void;
  accepted?: boolean;
  loading?: boolean;
  children?: React.ReactNode;
}

export default function DecisionCard({
  decision,
  onAccept,
  onSimplify,
  onExplain,
  glossaryKey,
  editableValue,
  onEdit,
  accepted,
  loading,
  children,
}: DecisionCardProps) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [actionError, setActionError] = useState('');

  const handleSimplify = async () => {
    if (!onSimplify || loading) return;
    setActionError('');
    try {
      await onSimplify();
      setOpen(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '重新生成失败，请稍后重试。');
    }
  };

  const handleExplain = async () => {
    if (!onExplain) return;
    setActionError('');
    setExplaining(true);
    try {
      setExplanation(await onExplain());
      setOpen(true);
    } catch (error) {
      setExplanation(error instanceof Error ? error.message : '解释生成失败，请稍后重试。');
      setOpen(true);
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="vp-card" style={{ marginBottom: 18, borderColor: 'var(--color-primary)', boxShadow: '0 18px 50px rgba(79, 70, 229, 0.12)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 700, letterSpacing: '0.04em' }}>CORE DECISION</span>
        {accepted && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-success)' }}><Check size={13} /> 已接受</span>}
      </div>

      <h2 style={{ fontSize: 22, lineHeight: 1.35, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14 }}>{decision.mainDecision}</h2>

      <div style={{ padding: 14, borderRadius: 12, background: 'var(--color-primary-light)', border: '1px solid rgba(79, 70, 229, 0.18)', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Wand2 size={16} style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 650, marginBottom: 5 }}>AI 推荐方案</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, color: 'var(--color-text)', lineHeight: 1.7 }}>{decision.recommendedChoice || '等待 AI 生成推荐方案。'}</div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
        <strong style={{ color: 'var(--color-text)' }}>为什么：</strong>{decision.why || '先让 AI 完成分析，用户只确认关键决策。'}
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 10, background: 'var(--color-warning-light)', marginBottom: 14 }}>
        <ShieldAlert size={14} style={{ color: 'var(--color-warning)', marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}><strong style={{ color: 'var(--color-warning)' }}>最大风险：</strong>{decision.keyRisk}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {onAccept && <button className="vp-btn vp-btn-primary" onClick={onAccept} disabled={loading}><Check size={14} /> 接受推荐</button>}
        {onSimplify && <button className="vp-btn vp-btn-ghost" onClick={handleSimplify} disabled={loading}>{loading ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />} {loading ? '正在生成...' : '换一个更简单版本'}</button>}
        {onExplain && <button className="vp-btn vp-btn-ghost" onClick={handleExplain} disabled={explaining}>{explaining ? <Loader2 size={14} className="vp-spin" /> : <HelpCircle size={14} />} 为什么这样设计</button>}
        <button className="vp-btn vp-btn-ghost" onClick={() => setOpen((value) => !value)}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {open ? '收起详情' : '展开详情'}</button>
      </div>

      {actionError && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--color-danger-light)', border: '1px solid rgba(226,75,74,0.25)' }}>
          <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6 }}>{actionError}</p>
        </div>
      )}

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          {!!decision.details?.length && (
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 650, marginBottom: 8 }}>完整理由 / 细节</h3>
              <ul style={{ paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                {decision.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            </div>
          )}

          {!!decision.alternatives.length && (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
              <strong style={{ color: 'var(--color-text)' }}>替代方案：</strong>{decision.alternatives.join(' / ')}
            </p>
          )}

          <GlossaryHelp glossaryKey={glossaryKey} />

          {editableValue !== undefined && onEdit && (
            <textarea
              className="vp-textarea"
              value={editableValue}
              rows={4}
              onChange={(event) => onEdit(event.target.value)}
              style={{ marginTop: 12 }}
            />
          )}

          {explanation && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{explanation}</p>
            </div>
          )}

          {children && <div style={{ marginTop: 12 }}>{children}</div>}
        </div>
      )}
    </div>
  );
}
