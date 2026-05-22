import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lightbulb, Brain, Target, Clock } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  // Check if user has any history
  const hasHistory = (() => {
    try {
      const raw = localStorage.getItem('vibepilot_briefs');
      const briefs = raw ? JSON.parse(raw) : [];
      return briefs.length > 0;
    } catch { return false; }
  })();

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div className="vp-header-inner">
          <Brain size={20} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 500, fontSize: 15 }}>VibePilot</span>
          {hasHistory && (
            <button
              className="vp-btn-text"
              onClick={() => navigate('/history')}
              style={{ marginLeft: 'auto', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Clock size={14} />
              历史记录
            </button>
          )}
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ maxWidth: 640, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: 20,
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 24,
            }}
          >
            产品思维训练工具
          </div>

          <h1
            style={{
              fontSize: 'clamp(28px, 5vw, 42px)',
              fontWeight: 600,
              lineHeight: 1.3,
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            你写完的代码没人用？
            <br />
            <span style={{ color: 'var(--color-primary)' }}>
              可能是你从来没想清楚这 3 个问题
            </span>
          </h1>

          <p
            style={{
              fontSize: 16,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.8,
              marginBottom: 40,
            }}
          >
            Vibe coding 让写代码变得极其容易，但写出来的东西往往没有清晰用户、
            没有真实痛点、功能堆砌。
            <br />
            VibePilot 不是让 AI 替你填表——它帮你
            <strong style={{ color: 'var(--color-text)' }}>
              真正学会产品思维
            </strong>
            。
          </p>

          <button className="vp-btn-cta" onClick={() => navigate('/new')}>
            开始训练产品思维
            <ArrowRight size={18} />
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              marginTop: 64,
              textAlign: 'left',
            }}
          >
            <ValueCard
              icon={<Target size={18} />}
              title="先想清楚"
              desc="10 步引导问答，从目标用户到验收标准，不跳过任何一个关键问题"
            />
            <ValueCard
              icon={<Lightbulb size={18} />}
              title="AI 当教练"
              desc="AI 不替你写答案，而是评价你的思考、追问盲点、展示好坏对比"
            />
            <ValueCard
              icon={<ArrowRight size={18} />}
              title="直接可用"
              desc="思考完成后，自动生成可交给 Cursor / Claude Code 的开发提示词"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ValueCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="vp-card">
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--color-primary-light)',
          color: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
        {desc}
      </p>
    </div>
  );
}
