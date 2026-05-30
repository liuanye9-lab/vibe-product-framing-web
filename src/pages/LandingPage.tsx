import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowRightCircle, Bot, Brain, Clock, Code2, Layers3,
  Settings, Sparkles, Target, Zap,
  Shield, Database, FileText,
  Lightbulb, ClipboardCheck,
} from 'lucide-react';
import { isAIReady } from '../api/evaluate';
import { PageReveal, LiquidCard, LiquidStepRail } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';

const PHASES = [
  { key: 'intake', label: 'Intake', progressPercent: 100, status: 'confirmed' },
  { key: 'demand', label: 'Demand', progressPercent: 100, status: 'confirmed' },
  { key: 'product', label: 'Product', progressPercent: 100, status: 'confirmed' },
  { key: 'mvp', label: 'MVP', progressPercent: 100, status: 'confirmed' },
  { key: 'tech', label: 'Tech', progressPercent: 100, status: 'confirmed' },
  { key: 'data', label: 'Data', progressPercent: 100, status: 'confirmed' },
  { key: 'risk', label: 'Risk', progressPercent: 100, status: 'confirmed' },
  { key: 'review', label: 'Review', progressPercent: 100, status: 'confirmed' },
  { key: 'handoff', label: 'Handoff', progressPercent: 100, status: 'confirmed' },
  { key: 'output', label: 'Output', progressPercent: 100, status: 'confirmed' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const aiReady = isAIReady();

  const hasHistory = (() => {
    try {
      const raw = localStorage.getItem('vibepilot_briefs');
      const briefs = raw ? JSON.parse(raw) : [];
      return briefs.length > 0;
    } catch { return false; }
  })();

  return (
    <PageReveal style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <header className="vp-header">
        <div className="vp-header-inner">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--vp-surface-inset)',
            padding: '6px 14px',
            borderRadius: 'var(--vp-radius-pill)',
          }}>
            <Brain size={18} style={{ color: 'var(--vp-accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', color: 'var(--vp-text)' }}>VibePilot</span>
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--vp-text-tertiary)',
              background: 'var(--vp-surface-inset)',
              padding: '2px 7px', borderRadius: 999,
            }}>
              V4.9
            </span>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
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
            borderRadius: 'var(--vp-radius-pill)',
            background: 'var(--vp-surface)',
            border: '1px solid var(--vp-border)',
            color: 'var(--vp-text-secondary)',
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 28,
          }}>
            <Sparkles size={13} style={{ color: 'var(--vp-accent)' }} />
            AI 辅助 · Vibe Decision Copilot V4.9
          </div>

          {/* Main Heading */}
          <h1 style={{
            fontSize: 'clamp(34px, 5vw, 54px)',
            fontWeight: 700,
            lineHeight: 1.14,
            marginBottom: 14,
            letterSpacing: '-0.045em',
            color: 'var(--vp-text)',
          }}>
            Vibe Decision Copilot
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: 17,
            color: 'var(--vp-text-secondary)',
            lineHeight: 1.85,
            margin: '0 auto 28px',
            maxWidth: 680,
            fontWeight: 400,
          }}>
            把模糊产品想法转化为 Codex 可执行任务包的前期决策 Agent
          </p>

          {/* Flow Glass Capsule */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 20px',
            borderRadius: 'var(--vp-radius-pill)',
            background: 'var(--vp-surface)',
            border: '1px solid var(--vp-border)',
            marginBottom: 36,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--vp-text-secondary)',
            boxShadow: 'var(--vp-shadow-sm)',
          }}>
            <span style={{ color: 'var(--vp-text)', fontWeight: 600 }}>Raw Idea</span>
            <ArrowRight size={12} style={{ color: 'var(--vp-text-tertiary)' }} />
            <span style={{ color: 'var(--vp-accent)', fontWeight: 600 }}>DEV_SPEC</span>
            <ArrowRight size={12} style={{ color: 'var(--vp-text-tertiary)' }} />
            <span style={{ color: 'var(--vp-text)', fontWeight: 600 }}>CODEX_TASK_PACK</span>
          </div>

          {/* Step 1 Guide Button */}
          <div style={{ marginBottom: 28 }}>
            {!aiReady ? (
              <button
                onClick={() => navigate('/settings')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 32px',
                  borderRadius: 'var(--vp-radius-pill)',
                  background: 'var(--vp-accent)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--vp-transition)',
                }}
              >
                <Settings size={18} />
                第一步：开始配置
                <ArrowRightCircle size={18} />
              </button>
            ) : (
              <button
                onClick={() => navigate('/new', { state: { fromHome: true, agentMode: true } })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '14px 32px',
                  borderRadius: 'var(--vp-radius-pill)',
                  background: 'var(--vp-accent)',
                  color: '#fff',
                  border: 'none',
                  fontSize: 16,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--vp-transition)',
                }}
              >
                <Bot size={18} />
                开始使用
                <ArrowRightCircle size={18} />
              </button>
            )}
          </div>

          {/* Secondary CTA */}
          <div style={{ marginBottom: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              className="vp-btn vp-btn-ghost"
              onClick={() => navigate('/new', { state: { fromHome: true } })}
              style={{ fontSize: 14, padding: '12px 24px' }}
            >
              <Target size={16} />
              传统四步流程
            </button>
          </div>

          {/* ── Core Loop Section ── */}
          <div style={{ marginBottom: 60 }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 650,
              marginBottom: 20,
              letterSpacing: '-0.02em',
              color: 'var(--vp-text)',
            }}>
              10 阶段决策流程
            </h2>
            <div style={{
              background: 'var(--vp-surface)',
              borderRadius: 'var(--vp-radius-lg)',
              border: '1px solid var(--vp-border)',
              padding: '20px 24px',
              boxShadow: 'var(--vp-shadow-sm)',
            }}>
              <LiquidStepRail phases={PHASES} />
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {PHASES.map((p) => (
                  <span key={p.key} style={{
                    fontSize: 11,
                    color: 'var(--vp-text-tertiary)',
                    padding: '2px 8px',
                    background: 'var(--vp-surface-inset)',
                    borderRadius: 'var(--vp-radius-pill)',
                  }}>
                    {p.label} 100%
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Why Not PRD Generator ── */}
          <div style={{ marginBottom: 60 }}>
            <h2 style={{
              fontSize: 20,
              fontWeight: 650,
              marginBottom: 20,
              letterSpacing: '-0.02em',
              color: 'var(--vp-text)',
            }}>
              Why Not Just a PRD Generator?
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              textAlign: 'left',
            }}>
              <LiquidCard>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--vp-radius-sm)',
                  background: 'var(--vp-surface-inset)',
                  color: 'var(--vp-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  border: '1px solid var(--vp-border)',
                }}>
                  <FileText size={18} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 8, letterSpacing: '-0.01em' }}>
                  普通 PRD 生成器
                </h3>
                <p style={{ fontSize: 13, color: 'var(--vp-text-secondary)', lineHeight: 1.7 }}>
                  直接输出文档，容易空泛，不知道是否值得做。没有决策过程，没有 trade-off 分析。
                </p>
              </LiquidCard>

              <LiquidCard style={{
                borderColor: 'var(--vp-accent-soft)',
              }}>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--vp-radius-sm)',
                  background: 'var(--vp-accent-soft)',
                  color: 'var(--vp-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  border: '1px solid var(--vp-accent-soft)',
                }}>
                  <Brain size={18} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 8, letterSpacing: '-0.01em', color: 'var(--vp-accent)' }}>
                  Vibe Decision Copilot
                </h3>
                <p style={{ fontSize: 13, color: 'var(--vp-text-secondary)', lineHeight: 1.7 }}>
                  先判断需求是否真实，强制收敛 MVP，生成可执行任务包。每个决策都有 trace，每步可回溯。
                </p>
              </LiquidCard>

              <LiquidCard>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: 'var(--vp-radius-sm)',
                  background: 'var(--vp-surface-inset)',
                  color: 'var(--vp-text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  border: '1px solid var(--vp-border)',
                }}>
                  <Lightbulb size={18} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 8, letterSpacing: '-0.01em' }}>
                  AI Coding 失败原因
                </h3>
                <p style={{ fontSize: 13, color: 'var(--vp-text-secondary)', lineHeight: 1.7 }}>
                  不是 AI 不会写代码，是开发前规格不清楚，验收标准缺失。没有明确 Dev Spec 的 Codex 就是在猜。
                </p>
              </LiquidCard>
            </div>
          </div>

          {/* ── Value Cards Grid ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            textAlign: 'left',
            marginBottom: 20,
          }}>
            <GlassValueCard
              icon={<Target size={18} />}
              title="先做产品理解"
              desc="从一句话定义、目标用户、场景、痛点、替代方案开始，避免为了功能而功能。"
            />
            <GlassValueCard
              icon={<Layers3 size={18} />}
              title="AI 补全专业判断"
              desc="技术架构、数据库、数据流、AI API、认证方案由 AI 推荐，你只需确认。"
            />
            <GlassValueCard
              icon={<Code2 size={18} />}
              title="DEV_SPEC + CODEX_TASK_PACK"
              desc="最终输出 DEV_SPEC 开发规格和 CODEX_TASK_PACK 可执行任务包，直接交给 Codex。"
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

          {/* ── Interview-Ready Section ── */}
          <div style={{ marginTop: 60 }}>
            <LiquidCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <ClipboardCheck size={20} style={{ color: 'var(--vp-accent)' }} />
                <h2 style={{ fontSize: 18, fontWeight: 650, letterSpacing: '-0.02em' }}>
                  Interview-Ready 讲述
                </h2>
              </div>
              <p style={{
                fontSize: 14,
                color: 'var(--vp-text-secondary)',
                lineHeight: 1.85,
                textAlign: 'left',
              }}>
                Vibe Decision Copilot 解决的是 AI 辅助软件开发中最被忽视的一环：<strong>写代码之前的决策质量</strong>。
                它不是简单的 PRD 生成器，而是通过 10 个阶段的结构化对话 —— 从需求诊断、产品定义、
                MVP 范围收敛、技术架构、数据结构、AI API 策略到验收标准 —— 确保每个进入开发的
                task 都有清晰的上下文、明确的边界和可验证的完成标准。最终输出的 DEV_SPEC 和
                CODEX_TASK_PACK 可以直接交给 Cursor / Claude Code / GitHub Copilot 执行，
                大幅减少 AI coding 的返工率和"做了但不对"的问题。
              </p>
            </LiquidCard>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: 'center',
        padding: '1.5rem',
        fontSize: 12,
        color: 'var(--vp-text-tertiary)',
      }}>
        Vibe Decision Copilot V4.9 — 把模糊想法转化为 Codex 可执行任务包
      </footer>
    </PageReveal>
  );
}

/* ── Glass Value Card Component ── */
function GlassValueCard({
  icon, title, desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="vp-card" style={{ padding: '22px' }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: 'var(--vp-radius-md)',
        background: 'var(--vp-surface-inset)',
        color: 'var(--vp-text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        border: '1px solid var(--vp-border)',
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 6, letterSpacing: '-0.01em' }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--vp-text-secondary)', lineHeight: 1.7 }}>
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
      borderRadius: 'var(--vp-radius-pill)',
      background: 'var(--vp-surface)',
      border: '1px solid var(--vp-border)',
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--vp-text-secondary)',
    }}>
      {icon}
      {label}
    </div>
  );
}
