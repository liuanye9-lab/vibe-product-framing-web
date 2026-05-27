import { Brain, ChevronLeft, ChevronRight, Home, Check } from 'lucide-react';
import { memo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const STAGES = [
  { label: 'Idea 诊断', path: 'discovery' },
  { label: 'MVP 决策', path: 'scope' },
  { label: '技术决策', path: 'technical' },
  { label: '交付文档', path: 'handoff' },
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

const StageLayout = memo(function StageLayout({
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
      {/* ── Header ── */}
      <header className="vp-header">
        <div className="vp-header-inner" style={{ justifyContent: 'space-between' }}>
          {/* Left: Home + Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="vp-btn-text"
              onClick={() => navigate('/')}
              style={{ padding: '6px', borderRadius: 'var(--radius-md)' }}
              title="返回首页"
            >
              <Home size={15} />
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, rgba(224,74,59,0.08), rgba(30,58,76,0.04))',
            }}>
              <Brain size={16} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>VibePilot</span>
            </div>
          </div>

          {/* Right: Stage Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(255,255,255,0.38)',
            padding: '3px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255,255,255,0.52)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            {STAGES.map((stage, index) => {
              const active = index === current;
              const done = index < current;
              const enabled = Boolean(briefId);
              const path = `/${stage.path}/${briefId}`;

              return (
                <button
                  key={stage.label}
                  className="vp-step-btn"
                  disabled={!enabled}
                  onClick={() => enabled && navigate(path)}
                  style={{
                    fontSize: 11,
                    padding: '5px 12px',
                    background: active
                      ? 'linear-gradient(135deg, rgba(224,74,59,0.10), rgba(30,58,76,0.04))'
                      : done
                        ? 'rgba(74,156,129,0.06)'
                        : 'transparent',
                    color: active
                      ? 'var(--vp-coral)'
                      : done
                        ? 'var(--color-success)'
                        : 'var(--color-text-hint)',
                    fontWeight: active ? 700 : done ? 600 : 500,
                    border: active
                      ? '1px solid rgba(224,74,59,0.16)'
                      : done
                        ? '1px solid rgba(74,156,129,0.14)'
                        : '1px solid transparent',
                  }}
                >
                  {done && <Check size={10} />}
                  {stage.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, padding: '2.5rem 2rem' }}>
        <div style={{ maxWidth: aside ? 1160 : 880, margin: '0 auto' }}>
          {/* Title Section */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: 10,
              color: 'var(--vp-navy)',
            }}>
              {title}
            </h1>
            <p style={{
              fontSize: 15,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.8,
              maxWidth: 720,
            }}>
              {subtitle}
            </p>
          </div>

          {/* Body + Aside Layout */}
          <div style={{
            display: aside ? 'grid' : 'block',
            gridTemplateColumns: aside ? 'minmax(0, 1fr) 340px' : undefined,
            gap: 24,
            alignItems: 'start',
          }}>
            <section>{children}</section>
            {aside && <aside>{aside}</aside>}
          </div>

          {/* Bottom Navigation Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 36,
            paddingTop: 22,
            borderTop: '1px solid rgba(30,58,76,0.08)',
          }}>
            {previousPath ? (
              <button
                className="vp-btn vp-btn-ghost"
                onClick={() => navigate(previousPath)}
                style={{ fontSize: 13 }}
              >
                <ChevronLeft size={15} />
                上一步
              </button>
            ) : <span />}

            {(nextPath || onNext) && (
              <button
                className="vp-btn vp-btn-primary"
                onClick={goNext}
                disabled={nextDisabled}
                style={{ fontSize: 13, padding: '10px 22px' }}
              >
                {nextLabel}
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
});

StageLayout.displayName = 'StageLayout';

export default StageLayout;
