import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import DecisionCard from '../components/DecisionCard';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import { extractCoreDecision } from '../rules/coreDecisionExtractor';
import type { AiSuggestion, DemandDiscoveryState, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof DemandDiscoveryState; title: string; desc: string }> = [
  { key: 'targetUserEvidence', title: '谁真的有这个问题', desc: '用证据描述哪类用户最可能真的痛。' },
  { key: 'painFrequency', title: '问题发生频率', desc: '判断这是高频、低频、刚需还是偶发问题。' },
  { key: 'currentAlternative', title: '用户现在怎么解决', desc: '包括 ChatGPT、人工、Excel、Notion、竞品或干脆不做。' },
  { key: 'consequenceIfUnsolved', title: '如果不解决会怎样', desc: '不解决会带来什么损失、返工、焦虑或机会成本。' },
  { key: 'demandEvidence', title: '需求成立证据', desc: '有哪些迹象说明这个需求可能真的存在。' },
  { key: 'falsificationEvidence', title: '需求不成立证据', desc: '哪些信号能证明我们想错了。' },
  { key: 'smallestValidationAction', title: '最小验证动作', desc: '不用完整开发，也能验证需求的最小动作。' },
];

export default function DemandDiscoveryPage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'focus' | 'detail'>('focus');

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    setError('');
    try {
      const suggestions = await suggestStage('discovery', brief);
      updateStage<DemandDiscoveryState>('discovery', suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试。');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.discovery.targetUserEvidence) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;
  const decision = extractCoreDecision(brief, 'idea');

  return (
    <StageLayout
      title="Idea Diagnosis / 想法诊断"
      subtitle="AI 先完成需求、产品和业务的发散分析；你只需要确认：这个想法是否值得进入 MVP 收敛。"
      current={0}
      briefId={brief.id}
      previousPath="/new"
      nextPath={`/scope/${brief.id}`}
      nextLabel="进入第一版决策"
      aside={<Aside mode={brief.mode} view={view} onViewChange={setView} generating={generating} onGenerate={generate} error={error} />}
    >
      {view === 'focus' ? (
        <DecisionCard
          decision={decision}
          glossaryKey="valueHypothesis"
          accepted={Boolean(brief.stages.discovery.targetUserEvidence?.accepted)}
          loading={generating}
          onAccept={() => updateSuggestion('discovery', 'targetUserEvidence', { accepted: true })}
          onSimplify={generate}
          onExplain={() => explainSuggestion('想法诊断核心决策', brief)}
          editableValue={brief.stages.discovery.targetUserEvidence?.value || ''}
          onEdit={(value) => updateSuggestion('discovery', 'targetUserEvidence', { value, editedByUser: true, accepted: false })}
        />
      ) : FIELDS.map((field) => (
        <SuggestionCard
          key={field.key}
          title={field.title}
          description={field.desc}
          suggestion={brief.stages.discovery[field.key] as AiSuggestion | undefined}
          regenerating={generating}
          onAccept={() => updateSuggestion('discovery', field.key as SuggestionKey, { accepted: true })}
          onChange={(value) => updateSuggestion('discovery', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
          onRegenerate={generate}
          onExplain={() => explainSuggestion(field.title, brief)}
        />
      ))}
    </StageLayout>
  );
}

function Aside({ mode, view, onViewChange, generating, onGenerate, error }: { mode: string; view: 'focus' | 'detail'; onViewChange: (view: 'focus' | 'detail') => void; generating: boolean; onGenerate: () => void; error: string }) {
  const modeLabel = mode === 'review' ? 'Review Mode · 审查已有方案' : mode === 'builder' ? 'Standard Mode · 30 分钟认真构思' : 'Quick Mode · 10 分钟出方案';
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>第一关：想法诊断</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
        当前模式：{modeLabel}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button className={view === 'focus' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('focus')}>Focus</button>
        <button className={view === 'detail' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('detail')}>Detail</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        默认只看一个核心判断；需要完整产品/业务地图时再切到 Detail。
      </p>
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6, marginBottom: 10 }}>{error}</p>}
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
        {generating ? 'AI 正在生成...' : '重新生成诊断'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
