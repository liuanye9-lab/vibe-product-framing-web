import { Brain, ChevronLeft, ChevronRight, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const STAGES = [
  { label: 'Idea', path: 'new' },
  { label: 'Demand', path: 'discovery' },
  { label: 'Product', path: 'product' },
  { label: 'Business', path: 'business' },
  { label: 'Technical', path: 'technical' },
  { label: 'MVP', path: 'scope' },
  { label: 'Review', path: 'blind-spot' },
  { label: 'Handoff', path: 'handoff' },
];

interface StageLayoutProps {
  title: string;
  subtitle: string;
  current: number;
  briefId?: string;
  children: ReactNode;
  nextLabel?: string;
  previousPath?: string;
  nextPath?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  aside?: ReactNode;
}

export default function StageLayout({
  title,
  subtitle,
  current,
  briefId,
  children,
  nextLabel = '下一步',
  previousPath,
  nextPath,
  onNext,
  nextDisabled,
  aside,
}: StageLayoutProps) {
  const navigate = useNavigate();

  const goNext = () => {
    if (onNext) {
      onNext();
      return;
    }
    if (nextPath) navigate(nextPath);
  };

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div className="vp-header-inner" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回首页">
              <Home size={16} />
            </button>
            <Brain size={18} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>VibePilot Copilot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {STAGES.map((stage, index) => {
              const active = index === current;
              const enabled = index === 0 || briefId;
              const path = index === 0 ? '/new' : `/${stage.path}/${briefId}`;
              return (
                <button
                  key={stage.label}
                  className="vp-btn-text"
                  disabled={!enabled}
                  onClick={() => enabled && navigate(path)}
                  style={{
                    fontSize: 11,
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: active ? 'var(--color-primary-light)' : 'transparent',
                    color: active ? 'var(--color-primary)' : 'var(--color-text-hint)',
                  }}
                >
                  {index + 1}. {stage.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem' }}>
        <div style={{ maxWidth: aside ? 1120 : 880, margin: '0 auto' }}>
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.02em', marginBottom: 8 }}>{title}</h1>
            <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.8, maxWidth: 720 }}>{subtitle}</p>
          </div>

          <div style={{ display: aside ? 'grid' : 'block', gridTemplateColumns: aside ? 'minmax(0, 1fr) 320px' : undefined, gap: 24, alignItems: 'start' }}>
            <section>{children}</section>
            {aside && <aside>{aside}</aside>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--color-border)' }}>
            {previousPath ? (
              <button className="vp-btn vp-btn-ghost" onClick={() => navigate(previousPath)}>
                <ChevronLeft size={14} />
                上一步
              </button>
            ) : <span />}
            {(nextPath || onNext) && (
              <button className="vp-btn vp-btn-primary" onClick={goNext} disabled={nextDisabled}>
                {nextLabel}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
