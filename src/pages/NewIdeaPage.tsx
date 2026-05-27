import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Home, MapPin, Sparkles, Target, Users, Zap } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import { evaluateIdea } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { CopilotMode, EvaluateIdeaResult, IdeaInputState, ProjectType } from '../types';

const PROJECT_TYPES: ProjectType[] = ['Web App', 'AI Agent', 'SaaS', 'Portfolio', 'Other'];

export default function NewIdeaPage() {
  const [input, setInput] = useState<IdeaInputState>({ rawIdea: '', projectType: 'Web App' });
  const [mode, setMode] = useState<CopilotMode>('beginner');
  const [evaluation, setEvaluation] = useState<EvaluateIdeaResult | null>(null);
  const { initBrief } = useProductBrief();
  const navigate = useNavigate();
  const location = useLocation();
  const isAgentMode = (location.state as { agentMode?: boolean } | null)?.agentMode ?? false;

  useEffect(() => {
    const state = location.state as { fromHome?: boolean } | null;
    if (!state?.fromHome) {
      navigate('/', { replace: true });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    let alive = true;
    if (!input.rawIdea.trim()) {
      setEvaluation(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await evaluateIdea(input);
      if (alive) setEvaluation(result);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [input]);

  const handleSubmit = () => {
    if (!input.rawIdea.trim()) return;
    const brief = initBrief({ ...input, rawIdea: input.rawIdea.trim() }, mode);
    navigate(isAgentMode ? `/agent/${brief.id}` : `/discovery/${brief.id}`);
  };

  const setField = <K extends keyof IdeaInputState>(key: K, value: IdeaInputState[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <StageLayout
      title="Idea Input / 产品想法输入"
      subtitle="只需写下最少信息。目标用户、场景、问题和产品形态可不完整，后续由 AI 做默认假设并补全专业部分。"
      current={0}
      nextLabel="让 AI 开始构思"
      onNext={handleSubmit}
      nextDisabled={!input.rawIdea.trim()}
      aside={<IdeaScoreCard evaluation={evaluation} />}
    >
      {/* Mode Selector */}
      <div className="vp-card" style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          选择模式
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <ModeChip
            active={mode === 'beginner'}
            icon={<Zap size={14} />}
            title="Quick"
            desc="10 分钟出方案"
            onClick={() => setMode('beginner')}
          />
          <ModeChip
            active={mode === 'builder'}
            icon={<Target size={14} />}
            title="Standard"
            desc="30 分钟认真构思"
            onClick={() => setMode('builder')}
          />
          <ModeChip
            active={mode === 'review'}
            icon={<AlertCircle size={14} />}
            title="Review"
            desc="审查已有方案"
            onClick={() => setMode('review')}
          />
        </div>
      </div>

      {/* Main Idea Input */}
      <div className="vp-card" style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          我想做什么 <span style={{ color: 'var(--vp-coral)' }}>*</span>
        </label>
        <textarea
          className="vp-textarea vp-textarea-lg"
          value={input.rawIdea}
          onChange={(e) => setField('rawIdea', e.target.value)}
          placeholder="比如：我想做一个帮助 vibe coding 新手在写代码前想清楚产品方案的 AI Copilot。"
          rows={4}
        />
      </div>

      {/* Optional Fields Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

      {/* AI Hint Banner */}
      <div className="vp-card-dashed" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(224,74,59,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Sparkles size={16} style={{ color: 'var(--vp-coral)' }} />
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
    </StageLayout>
  );
}

/* ── Mode Chip ── */
function ModeChip({
  active, icon, title, desc, onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        padding: '14px',
        borderRadius: 'var(--radius-lg)',
        border: active
          ? '1.5px solid rgba(224,74,59,0.25)'
          : '1px solid rgba(30,58,76,0.08)',
        background: active
          ? 'linear-gradient(135deg, rgba(224,74,59,0.06), rgba(253,242,239,0.30))'
          : 'rgba(255,255,255,0.34)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6,
        color: active ? 'var(--vp-coral)' : 'var(--color-text-hint)',
      }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 650 }}>{title}</span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-hint)', lineHeight: 1.4 }}>
        {desc}
      </span>
    </button>
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

/* ── Idea Score Aside Card ── */
function IdeaScoreCard({ evaluation }: { evaluation: EvaluateIdeaResult | null }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24, padding: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: 'rgba(30,58,76,0.06)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Home size={15} style={{ color: 'var(--vp-navy)' }} />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 650 }}>输入诊断</h3>
      </div>

      {!evaluation ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', lineHeight: 1.7 }}>
          输入一个产品想法后，这里会显示 AI 的初步诊断。
        </p>
      ) : (
        <>
          <div style={{
            fontSize: 42, fontWeight: 700,
            background: 'linear-gradient(135deg, var(--vp-coral), var(--vp-navy-soft))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 6,
            lineHeight: 1,
          }}>
            {evaluation.score}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
            {evaluation.mainIssue}
          </p>
          {!!evaluation.missingFields.length && (
            <div style={{
              marginTop: 12, padding: '10px 12px',
              background: 'rgba(30,58,76,0.04)',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 4 }}>
                可由 AI 假设
              </p>
              <p style={{ fontSize: 12, color: 'var(--vp-navy)', fontWeight: 500 }}>
                {evaluation.missingFields.join('、')}
              </p>
            </div>
          )}
          {!!evaluation.riskFlags.length && (
            <div style={{
              marginTop: 10, padding: '10px 12px',
              background: 'rgba(224,74,59,0.06)',
              borderRadius: 'var(--radius-md)',
            }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 4 }}>
                范围风险词
              </p>
              <p style={{ fontSize: 12, color: 'var(--vp-coral)', fontWeight: 500 }}>
                {evaluation.riskFlags.join('、')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
