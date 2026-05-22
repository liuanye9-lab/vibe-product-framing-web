import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
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

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const suggestions = await suggestStage('discovery', brief);
      updateStage<DemandDiscoveryState>('discovery', suggestions);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.discovery.targetUserEvidence) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Demand Discovery / 需求洞察"
      subtitle="先别急着定义产品。AI 会帮你反推：谁真的痛、现在怎么解决、什么证据能证明需求成立或不成立。"
      current={1}
      briefId={brief.id}
      previousPath="/new"
      nextPath={`/product/${brief.id}`}
      nextLabel="进入产品定义"
      aside={<Aside mode={brief.mode} generating={generating} onGenerate={generate} />}
    >
      {FIELDS.map((field) => (
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

function Aside({ mode, generating, onGenerate }: { mode: string; generating: boolean; onGenerate: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>三钻模型 · 第一钻</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 10 }}>
        当前模式：{mode === 'review' ? 'Review 审查' : mode === 'builder' ? 'Builder 快速构建' : 'Beginner 新手解释'}
      </p>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        这一钻先确认“需求是否真的存在”，再进入产品方案。
      </p>
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : null}
        {generating ? 'AI 正在生成...' : '重新生成洞察'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
