import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { AiSuggestion, BusinessFramingState, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof BusinessFramingState; title: string; desc: string }> = [
  { key: 'userValue', title: '用户价值', desc: '用户为什么愿意使用，它节省什么成本或降低什么风险。' },
  { key: 'ownerValue', title: '产品所有者价值', desc: '这个产品对你/团队/作品集的价值是什么。' },
  { key: 'valueHypothesis', title: '价值假设', desc: 'V1 最需要验证的业务判断。' },
  { key: 'metrics', title: '后续可验证指标', desc: '用哪些行为指标判断产品是否有效。' },
  { key: 'monetization', title: '商业化可能性', desc: 'V1 不急着变现，但要知道未来可能性。' },
  { key: 'risksAndBlindSpots', title: '风险与盲点', desc: '提前识别用户、市场、AI 输出质量等风险。' },
];

export default function BusinessFramingPage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const suggestions = await suggestStage('business', brief);
      updateStage<BusinessFramingState>('business', suggestions);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.business.userValue) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Business Framing / 业务判断"
      subtitle="这里不是写商业计划书，而是判断这个 V1 是否值得做、如何验证、有哪些盲点。"
      current={2}
      briefId={brief.id}
      previousPath={`/product/${brief.id}`}
      nextPath={`/technical/${brief.id}`}
      nextLabel="进入技术规划"
      aside={<Aside generating={generating} onGenerate={generate} />}
    >
      {FIELDS.map((field) => (
        <SuggestionCard
          key={field.key}
          title={field.title}
          description={field.desc}
          suggestion={brief.stages.business[field.key] as AiSuggestion | undefined}
          regenerating={generating}
          onAccept={() => updateSuggestion('business', field.key as SuggestionKey, { accepted: true })}
          onChange={(value) => updateSuggestion('business', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
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
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>判断标准</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        好的 V1 不一定能赚钱，但必须能验证一个真实用户价值假设。
      </p>
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : null}
        {generating ? 'AI 正在生成...' : '重新生成本页建议'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
