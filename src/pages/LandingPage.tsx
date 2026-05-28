import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Brain, Clock, Code2, Layers3,
  Settings, Sparkles, Target, Zap, Bot,
  Shield, Database, FileText
} from 'lucide-react';
import { isAIReady } from '../api/evaluate';

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
      {/* ── Ambient Orbs ── */}
      <div className="vp-orb vp-orb--coral" />
      <div className="vp-orb vp-orb--navy" />
      <div className="vp-orb vp-orb--sage" />

      {/* ── Header ── */}
      <header className="vp-header">
        <div className="vp-header-inner">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, rgba(224,74,59,0.10), rgba(30,58,76,0.06))',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
          }}>
            <Brain size={18} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em' }}>VibePilot</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--vp-navy)', opacity: 0.5,
              background: 'rgba(30,58,76,0.08)',
              padding: '2px 7px', borderRadius: 999,
            }}>
              COPILOT
            </span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="vp-btn-text"
              onClick={() => navigate('/settings')}
              style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <Settings size={14} />
              AI 设置
            </button>
            {hasHistory && (
              <button
                className="vp-btn-text"
                onClick={() => navigate('/history')}
                style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Clock size={14} />
                历史记录
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
      }}>
        <div style={{ maxWidth: 880, textAlign: 'center' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 14px',
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, rgba(224,74,59,0.10), rgba(30,58,76,0.05))',
            border: '1px solid rgba(224,74,59,0.12)',
            color: 'var(--color-primary)',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 28,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
            <Sparkles size={13} style={{ color: 'var(--color-primary)' }} />
            AI 辅助 · Vibe Decision Copilot
          </div>

          {/* Main Heading */}
          <h1 style={{
            fontSize: 'clamp(34px, 5vw, 54px)',
            fontWeight: 700,
            lineHeight: 1.14,
            marginBottom: 22,
            letterSpacing: '-0.045em',
            color: 'var(--vp-navy)',
          }}>
            不要把一句模糊想法
            <br />
            <span style={{
              background: 'linear-gradient(135deg, var(--vp-coral) 0%, #D44236 60%, var(--vp-navy-soft) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              直接丢给 AI 写代码
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 17,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.85,
            margin: '0 auto 40px',
            maxWidth: 640,
            fontWeight: 400,
          }}>
            VibePilot 帮你从产品、业务、技术三个维度完成前期构思，
            AI 主动推断技术架构、数据结构、MVP 范围和验收标准，
            最后生成可直接交给 Cursor / Claude Code 的 Development Prompt。
          </p>

          {/* CTA Buttons */}
          <div style={{ marginBottom: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Agent 工作流 — Primary CTA */}
            <button
              className="vp-btn-cta"
              onClick={() => {
                if (!isAIReady()) {
                  navigate('/settings');
                } else {
                  navigate('/new', { state: { fromHome: true, agentMode: true } });
                }
              }}
              style={{
                background: isAIReady()
                  ? 'linear-gradient(135deg, var(--vp-coral) 0%, #D44236 100%)'
                  : 'linear-gradient(135deg, var(--vp-navy) 0%, #1a3a5c 100%)',
                boxShadow: isAIReady()
                  ? 'var(--glass-highlight), 0 12px 36px rgba(224, 74, 59, 0.32), 0 4px 10px rgba(224, 74, 59, 0.18)'
                  : 'var(--glass-highlight), 0 12px 36px rgba(30, 58, 76, 0.32), 0 4px 10px rgba(30, 58, 76, 0.18)',
              }}
            >
              {isAIReady() ? (
                <>
                  <Bot size={18} />
                  Agent Decision OS
                  <ArrowRight size={18} />
                </>
              ) : (
                <>
                  <Settings size={18} />
                  配置 AI API 以使用 Agent
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* 传统四步流程 — Secondary */}
            <button
              className="vp-btn vp-btn-ghost"
              onClick={() => navigate('/new', { state: { fromHome: true } })}
              style={{ fontSize: 14, padding: '12px 24px' }}
            >
              <Target size={16} />
              传统四步流程
            </button>
          </div>

          {/* ── Value Cards Grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            textAlign: 'left',
          }}>
            <GlassValueCard
              icon={<Target size={18} />}
              title="先做产品理解"
              desc="从一句话定义、目标用户、场景、痛点、替代方案开始，避免为了功能而功能。"
              accent="coral"
            />
            <GlassValueCard
              icon={<Layers3 size={18} />}
              title="AI 补全专业判断"
              desc="技术架构、数据库、数据流、AI API、认证方案由 AI 推荐，你只需确认。"
              accent="navy"
            />
            <GlassValueCard
              icon={<Code2 size={18} />}
              title="DEV_SPEC + CODEX_TASK_PACK"
              desc="最终输出 DEV_SPEC 开发规格和 CODEX_TASK_PACK 可执行任务包，直接交给 Codex。"
              accent="sage"
            />
          </div>

          {/* ── Feature Highlight ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            marginTop: 20,
          }}>
            <MiniFeature icon={<Zap size={15} />} label="10 步引导流程" />
            <MiniFeature icon={<Shield size={15} />} label="AI 质量检查" />
            <MiniFeature icon={<Database size={15} />} label="数据模型生成" />
            <MiniFeature icon={<FileText size={15} />} label="CODEX_TASK_PACK" />
            <MiniFeature icon={<Target size={15} />} label="进度可视化" />
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        fontSize: 12,
        color: 'var(--color-text-hint)',
      }}>
        Vibe Decision Copilot — 把模糊想法转化为 Codex 可执行任务包
      </footer>
    </div>
  );
}

/* ── Glass Value Card Component ── */
function GlassValueCard({
  icon, title, desc, accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: 'coral' | 'navy' | 'sage';
}) {
  const accentColors = {
    coral: { bg: 'rgba(224,74,59,0.08)', color: 'var(--vp-coral)', border: 'rgba(224,74,59,0.12)' },
    navy:  { bg: 'rgba(30,58,76,0.08)',  color: 'var(--vp-navy)',  border: 'rgba(30,58,76,0.12)' },
    sage:  { bg: 'rgba(74,156,129,0.08)', color: 'var(--color-success)', border: 'rgba(74,156,129,0.12)' },
  };
  const c = accentColors[accent];

  return (
    <div className="vp-card" style={{ padding: '22px' }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: 'var(--radius-md)',
        background: c.bg,
        color: c.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        border: `1px solid ${c.border}`,
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 6, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  );
}

/* ── Mini Feature Pill ── */
function MiniFeature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '8px 14px',
      borderRadius: 'var(--radius-full)',
      background: 'rgba(255,255,255,0.42)',
      border: '1px solid rgba(255,255,255,0.56)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--color-text-secondary)',
    }}>
      {icon}
      {label}
    </div>
  );
}
