import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Clock, Code2, Layers3, Settings, Sparkles, Target } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

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
          <span style={{ fontWeight: 600, fontSize: 15 }}>VibePilot</span>
          <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>Copilot</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="vp-btn-text"
              onClick={() => navigate('/settings')}
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Settings size={14} />
              AI 设置
            </button>
            {hasHistory && (
              <button
                className="vp-btn-text"
                onClick={() => navigate('/history')}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Clock size={14} />
                历史记录
              </button>
            )}
          </div>
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
        <div style={{ maxWidth: 820, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 20,
              background: 'var(--color-primary-light)',
              color: 'var(--color-primary)',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            <Sparkles size={13} />
            AI 辅助的 Vibe Coding 产品前期构思 Copilot
          </div>

          <h1
            style={{
              fontSize: 'clamp(30px, 5vw, 48px)',
              fontWeight: 700,
              lineHeight: 1.22,
              marginBottom: 18,
              letterSpacing: '-0.04em',
            }}
          >
            不要把一句模糊想法
            <br />
            直接丢给 AI 写代码
          </h1>

          <p
            style={{
              fontSize: 16,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.9,
              margin: '0 auto 36px',
              maxWidth: 680,
            }}
          >
            VibePilot 帮你从产品、业务、技术三个角度完成前期构思：AI 主动推断你不知道的技术架构、数据结构、MVP 范围和验收标准，最后生成可直接交给 Codex / Claude Code / Cursor 的 Development Prompt。
          </p>

          <button
            className="vp-btn-cta"
            onClick={() => navigate('/new', { state: { fromHome: true } })}
          >
            开始 AI 辅助构思
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
              title="先做产品理解"
              desc="从一句话定义、目标用户、场景、痛点和替代方案开始，避免为了功能而功能。"
            />
            <ValueCard
              icon={<Layers3 size={18} />}
              title="AI 补全专业判断"
              desc="技术架构、数据库、数据流、AI API、认证、文件上传由 AI 推荐，你负责确认。"
            />
            <ValueCard
              icon={<Code2 size={18} />}
              title="交付开发提示词"
              desc="最终输出 Product Brief、MVP Scope、Technical Architecture、Data Structure 和 Development Prompt。"
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
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  );
}
