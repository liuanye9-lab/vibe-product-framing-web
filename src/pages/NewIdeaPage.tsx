import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Home, Sparkles } from 'lucide-react';
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
    navigate(`/discovery/${brief.id}`);
  };

  const setField = <K extends keyof IdeaInputState>(key: K, value: IdeaInputState[K]) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <StageLayout
      title="Idea Input / 产品想法输入"
      subtitle="只需要先写最少信息。目标用户、场景、问题和产品形态都可以不完整，后续由 AI 帮你做默认假设并补全专业部分。"
      current={0}
      nextLabel="让 AI 开始构思"
      onNext={handleSubmit}
      nextDisabled={!input.rawIdea.trim()}
      aside={<IdeaScore evaluation={evaluation} />}
    >
      <div className="vp-card" style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>选择模式</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <ModeButton active={mode === 'beginner'} title="Beginner" desc="解释更多术语" onClick={() => setMode('beginner')} />
          <ModeButton active={mode === 'builder'} title="Builder" desc="更快生成交付" onClick={() => setMode('builder')} />
          <ModeButton active={mode === 'review'} title="Review" desc="直接审查风险" onClick={() => setMode('review')} />
        </div>
      </div>

      <div className="vp-card" style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>我想做什么 *</label>
        <textarea
          className="vp-textarea vp-textarea-lg"
          value={input.rawIdea}
          onChange={(e) => setField('rawIdea', e.target.value)}
          placeholder="比如：我想做一个帮助 vibe coding 新手在写代码前想清楚产品方案的 AI Copilot。"
          rows={4}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field title="给谁用（可选）">
          <input className="vp-input" value={input.targetUser || ''} onChange={(e) => setField('targetUser', e.target.value)} placeholder="例如：准备做第一个 AI 产品的新手" />
        </Field>
        <Field title="在什么场景用（可选）">
          <input className="vp-input" value={input.scenario || ''} onChange={(e) => setField('scenario', e.target.value)} placeholder="例如：准备交给 Cursor 开发前" />
        </Field>
        <Field title="想解决什么问题（可选）">
          <input className="vp-input" value={input.problem || ''} onChange={(e) => setField('problem', e.target.value)} placeholder="例如：不知道技术方案和数据结构" />
        </Field>
        <Field title="产品形态（可选）">
          <select className="vp-input" value={input.projectType || 'Web App'} onChange={(e) => setField('projectType', e.target.value as ProjectType)}>
            {PROJECT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </Field>
      </div>

      <div className="vp-card-dashed" style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Sparkles size={18} style={{ color: 'var(--color-primary)', marginTop: 2 }} />
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>不用一次性想完整</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              技术架构、数据库、数据流、AI API、验收标准等专业内容，会在后面由 AI 根据你的产品上下文主动推荐。
            </p>
          </div>
        </div>
      </div>
    </StageLayout>
  );
}

function ModeButton({ active, title, desc, onClick }: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="vp-card"
      onClick={onClick}
      style={{ textAlign: 'left', borderColor: active ? 'var(--color-primary)' : 'var(--color-border)', background: active ? 'var(--color-primary-light)' : undefined }}
    >
      <span style={{ display: 'block', fontSize: 13, fontWeight: 650, marginBottom: 4 }}>{title} Mode</span>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{desc}</span>
    </button>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="vp-card" style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{title}</span>
      {children}
    </label>
  );
}

function IdeaScore({ evaluation }: { evaluation: EvaluateIdeaResult | null }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Home size={14} style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ fontSize: 14, fontWeight: 650 }}>输入诊断</h3>
      </div>
      {!evaluation ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', lineHeight: 1.7 }}>输入一个产品想法后，这里会显示 AI 的初步诊断。</p>
      ) : (
        <>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>{evaluation.score}</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{evaluation.mainIssue}</p>
          {!!evaluation.missingFields.length && (
            <p style={{ fontSize: 12, color: 'var(--color-text-hint)', marginTop: 10 }}>可由 AI 假设：{evaluation.missingFields.join('、')}</p>
          )}
          {!!evaluation.riskFlags.length && (
            <p style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 10 }}>范围风险词：{evaluation.riskFlags.join('、')}</p>
          )}
          <button className="vp-btn vp-btn-primary" onClick={() => undefined} style={{ width: '100%', marginTop: 14, pointerEvents: 'none' }}>
            继续后由 AI 补全 <ArrowRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}
