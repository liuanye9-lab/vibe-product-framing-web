import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { AiSuggestion, BlindSpotReviewState, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof BlindSpotReviewState; title: string; desc: string }> = [
  { key: 'demandRisk', title: '需求风险', desc: '用户为什么可能根本不需要这个产品。' },
  { key: 'businessRisk', title: '业务风险', desc: '收益、切换成本、复用意愿上可能出现的问题。' },
  { key: 'technicalRisk', title: '技术风险', desc: '哪些技术选择可能不稳定或过度工程化。' },
  { key: 'scopeRisk', title: '范围风险', desc: '哪些功能可能只是看起来高级但不必要。' },
  { key: 'whatWouldProveWrong', title: '什么能证明我们错了', desc: '提前定义反证，避免自嗨。' },
  { key: 'recommendedAdjustment', title: '推荐调整', desc: '基于盲点，第一版应该如何收缩或修改。' },
];

export default function BlindSpotReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const suggestions = await suggestStage('blindSpot', brief);
      updateStage<BlindSpotReviewState>('blindSpot', suggestions);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.blindSpot.demandRisk) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Blind Spot Review / 盲点审查"
      subtitle="最后让 AI 反过来挑战你的方案：需求可能不成立在哪里？业务哪里不划算？技术哪里过度？第一版是否仍然太大？"
      current={3}
      briefId={brief.id}
      previousPath={`/technical/${brief.id}`}
      nextPath={`/handoff/${brief.id}`}
      nextLabel="生成开发交付"
      aside={<Aside generating={generating} onGenerate={generate} />}
    >
      {FIELDS.map((field) => (
        <SuggestionCard
          key={field.key}
          title={field.title}
          description={field.desc}
          suggestion={brief.stages.blindSpot[field.key] as AiSuggestion | undefined}
          regenerating={generating}
          onAccept={() => updateSuggestion('blindSpot', field.key as SuggestionKey, { accepted: true })}
          onChange={(value) => updateSuggestion('blindSpot', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
          onRegenerate={generate}
          onExplain={() => explainSuggestion(field.title, brief)}
        />
      ))}
    </StageLayout>
  );
}

function Aside({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>反向挑战</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        好方案不怕被挑战。这里专门找反证、风险和第一版不该做的东西。
      </p>
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : null}
        {generating ? 'AI 正在审查...' : '重新生成盲点审查'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
