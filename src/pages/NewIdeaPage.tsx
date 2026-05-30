import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Bot, ChevronRight, Home, MapPin, Settings, Sparkles, Target, Users, Zap } from 'lucide-react';
import { isAIReady } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { CopilotMode, IdeaInputState, ProjectType } from '../types';
import { PageReveal, LiquidInput, LiquidBadge } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';

const PROJECT_TYPES: ProjectType[] = ['Web App', 'AI Agent', 'SaaS', 'Portfolio', 'Other'];

export default function NewIdeaPage() {
  const [input, setInput] = useState<IdeaInputState>({ rawIdea: '', projectType: 'Web App' });
  const [mode, setMode] = useState<CopilotMode>('beginner');
  const { initBrief } = useProductBrief();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { fromHome?: boolean } | null;
    if (!state?.fromHome) {
      navigate('/', { replace: true });
    }
  }, [location.state, navigate]);

  const handleStartAgent = () => {
    if (!isAIReady()) {
      navigate('/settings');
      return;
    }
    if (!input.rawIdea.trim()) return;
    const brief = initBrief({ ...input, rawIdea: input.rawIdea.trim() }, mode);
    navigate(`/agent/${brief.id}`);
  };

  const handleStartLegacy = () => {
    if (!input.rawIdea.trim()) return;
    const brief = initBrief({ ...input, rawIdea: input.rawIdea.trim() }, mode);
    navigate(`/discovery/${brief.id}`);
  };

  const setField = <K extends keyof IdeaInputState>(key: K, value: IdeaInputState[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const apiReady = isAIReady();

  return (
    <PageReveal style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div className="vp-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
            <Home size={18} />
          </button>
          <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
          <span style={{ color: 'var(--color-text-hint)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>New Idea</span>
          <div style={{ marginLeft: 'auto' }}>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', maxWidth: 760, margin: '0 auto', width: '100%' }}>
        {/* Top subtitle */}
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', marginBottom: 8, fontWeight: 500 }}>
          Start with a raw idea
        </p>

        {/* Main input area - LiquidInput */}
        <div style={{ marginBottom: 18 }}>
          <LiquidInput
            value={input.rawIdea}
            onChange={(e) => setField('rawIdea', e.target.value)}
            placeholder="例如：我想做一个帮助雅思学生整理生词和错题的小程序…"
            rows={5}
            style={{ fontSize: 16, lineHeight: 1.8 }}
          />
        </div>

        {/* Mode Selection - iOS Segmented Control Style */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--color-text-secondary)' }}>
            选择模式
          </label>
          <div className="vp-segmented">
            <button
              className={`vp-segmented__item${mode === 'beginner' ? ' vp-segmented__item--active' : ''}`}
              onClick={() => setMode('beginner')}
            >
              <Zap size={12} style={{ marginRight: 4 }} />
              Quick
            </button>
            <button
              className={`vp-segmented__item${mode === 'builder' ? ' vp-segmented__item--active' : ''}`}
              onClick={() => setMode('builder')}
            >
              <Target size={12} style={{ marginRight: 4 }} />
              Standard
            </button>
            <button
              className={`vp-segmented__item${mode === 'review' ? ' vp-segmented__item--active' : ''}`}
              onClick={() => setMode('review')}
            >
              <AlertCircle size={12} style={{ marginRight: 4 }} />
              Review
            </button>
          </div>
        </div>

        {/* Optional Fields Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
          <FieldCard title="给谁用（可选）" icon={<Users size={14} />}>
            <input
              className="vp-input"
              value={input.targetUser || ''}
              onChange={(e) => setField('targetUser', e.target.value)}
              placeholder="准备做第一个 AI 产品的新手"
            />
          </FieldCard>
          <FieldCard title="在什么场景用（可选）" icon={<MapPin size={14} />}>
            <input
              className="vp-input"
              value={input.scenario || ''}
              onChange={(e) => setField('scenario', e.target.value)}
              placeholder="准备交给 Cursor 开发前"
            />
          </FieldCard>
          <FieldCard title="想解决什么问题（可选）" icon={<Target size={14} />}>
            <input
              className="vp-input"
              value={input.problem || ''}
              onChange={(e) => setField('problem', e.target.value)}
              placeholder="不知道技术方案和数据结构"
            />
          </FieldCard>
          <FieldCard title="产品形态（可选）" icon={<Home size={14} />}>
            <select
              className="vp-input"
              value={input.projectType || 'Web App'}
              onChange={(e) => setField('projectType', e.target.value as ProjectType)}
            >
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </FieldCard>
        </div>

        {/* API Status */}
        <div style={{ marginBottom: 18 }}>
          <LiquidBadge variant={apiReady ? 'green' : 'orange'}>
            {apiReady ? 'API Ready' : 'API 未配置'}
          </LiquidBadge>
        </div>

        {/* AI Hint Banner */}
        <div className="vp-card-dashed" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)',
              background: 'rgba(0,122,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Sparkles size={16} style={{ color: 'var(--vp-blue)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>
                不用一次性想完整
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                技术架构、数据库、数据流、AI API、验收标准等专业内容，会在后面由 AI 根据你的产品上下文主动推荐。
              </p>
            </div>
          </div>
        </div>

        {/* Flow Selection */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-secondary)' }}>
            选择你的工作流
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button
              className="vp-card"
              onClick={handleStartAgent}
              style={{
                textAlign: 'left', padding: '20px 22px', cursor: 'pointer',
                background: apiReady
                  ? 'linear-gradient(135deg, rgba(0,122,255,0.04), rgba(232,242,255,0.3))'
                  : 'linear-gradient(135deg, rgba(15,23,42,0.02), rgba(0,122,255,0.04))',
                border: apiReady
                  ? '1.5px solid rgba(0,122,255,0.18)'
                  : '1.5px solid rgba(0,122,255,0.10)',
              }}
            >
              <Bot size={20} style={{ color: 'var(--vp-blue)', marginBottom: 8 }} />
              <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>Agent Decision OS</h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                AI 产品经理多角色对话，图工作流自动推进 + 任务管理 + 记忆沉淀。
              </p>
              {apiReady ? (
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--vp-blue)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  推荐 <ChevronRight size={14} />
                </p>
              ) : (
                <div style={{ marginTop: 8 }}>
                  <p style={{
                    fontSize: 11, color: 'var(--vp-orange)',
                    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6,
                  }}>
                    <AlertCircle size={12} />
                    需先配置 AI API
                  </p>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '4px 10px', borderRadius: 'var(--vp-radius-pill)',
                    background: 'rgba(0,122,255,0.08)', color: 'var(--vp-blue)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                  }}>
                    <Settings size={11} /> 点击去配置
                  </span>
                </div>
              )}
            </button>
            <button
              className="vp-card"
              onClick={handleStartLegacy}
              disabled={!input.rawIdea.trim()}
              style={{
                textAlign: 'left', padding: '20px 22px', cursor: 'pointer',
                background: 'rgba(255,255,255,0.34)',
              }}
            >
              <Target size={20} style={{ color: 'var(--vp-indigo)', marginBottom: 8 }} />
              <h3 style={{ fontSize: 15, fontWeight: 650, marginBottom: 4 }}>四步流程</h3>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                使用传统四步流程（需求诊断 → 产品定义 → MVP 范围 → 技术 + 交付）。
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 8 }}>
                适合快速走通流程
              </p>
            </button>
          </div>
        </div>
      </main>
    </PageReveal>
  );
}

/* ── Field Card ── */
function FieldCard({
  title, icon, children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="vp-card" style={{ display: 'block', padding: '16px 18px' }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, fontWeight: 600, marginBottom: 8,
        color: 'var(--color-text-secondary)',
      }}>
        {icon}
        {title}
      </span>
      {children}
    </label>
  );
}
