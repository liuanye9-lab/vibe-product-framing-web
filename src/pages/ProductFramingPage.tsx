import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { AiSuggestion, ProductFramingState, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof ProductFramingState; title: string; desc: string }> = [
  { key: 'productOneLiner', title: '产品一句话定义', desc: '说明产品是什么、给谁用、在什么场景下解决什么问题。' },
  { key: 'targetUser', title: '目标用户', desc: '第一版最关键的用户，不要写成“所有人”。' },
  { key: 'scenario', title: '使用场景', desc: '用户在什么具体任务和时刻需要它。' },
  { key: 'corePainPoint', title: '核心痛点', desc: '用户最难、最慢或最容易出错的地方。' },
  { key: 'alternatives', title: '现有替代方案', desc: '用户现在怎么解决，包括人工方法和通用工具。' },
  { key: 'aiValue', title: 'AI 介入价值', desc: 'AI 到底在哪个环节降低成本或提升质量。' },
];

export default function ProductFramingPage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const suggestions = await suggestStage('product', brief);
      updateStage<ProductFramingState>('product', suggestions);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.product.productOneLiner) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Product Framing / 产品理解"
      subtitle="AI 会先根据你的输入生成产品理解草案。你只需要接受、编辑或要求解释。"
      current={1}
      briefId={brief.id}
      previousPath="/new"
      nextPath={`/business/${brief.id}`}
      nextLabel="进入业务判断"
      aside={<Summary rawIdea={brief.ideaInput.rawIdea} generating={generating} onGenerate={generate} />}
    >
      {FIELDS.map((field) => {
        const suggestion = brief.stages.product[field.key];
        return (
          <SuggestionCard
            key={field.key}
            title={field.title}
            description={field.desc}
            suggestion={suggestion as AiSuggestion | undefined}
            regenerating={generating}
            onAccept={() => updateSuggestion('product', field.key as SuggestionKey, { accepted: true })}
            onChange={(value) => updateSuggestion('product', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
            onRegenerate={generate}
            onExplain={() => explainSuggestion(field.title, brief)}
          />
        );
      })}
    </StageLayout>
  );
}

function Summary({ rawIdea, generating, onGenerate }: { rawIdea: string; generating: boolean; onGenerate: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>原始想法</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{rawIdea}</p>
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
