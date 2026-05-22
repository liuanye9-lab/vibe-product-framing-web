import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { AiSuggestion, SuggestionKey, TechnicalPlanningState } from '../types';

const FIELDS: Array<{ key: keyof TechnicalPlanningState; title: string; desc: string }> = [
  { key: 'frontend', title: '前端形态与技术栈', desc: 'AI 推荐 V1 适合做成什么前端形态，以及用什么栈。' },
  { key: 'backend', title: '是否需要后端', desc: '不要默认上后端；先判断 V1 是否真的需要。' },
  { key: 'database', title: '是否需要数据库', desc: '如果不需要，说明 localStorage / mock data / JSON 如何替代。' },
  { key: 'aiApi', title: '是否需要 AI API', desc: '说明 AI API 放在哪一层调用，避免 key 和 CORS 问题。' },
  { key: 'auth', title: '是否需要认证', desc: '判断 V1 是否真的需要登录注册。' },
  { key: 'fileUpload', title: '是否需要文件上传', desc: '文件上传会增加复杂度，V1 需要明确判断。' },
  { key: 'dataFlow', title: '数据如何流转', desc: '从用户输入到最终输出，中间数据如何变化。' },
  { key: 'mockStrategy', title: 'V1 mock 策略', desc: '无真实后端/模型时如何保证流程可演示。' },
  { key: 'architectureUpgrade', title: '后续架构升级条件', desc: '什么时候再引入数据库、账号、文件存储或更复杂后端。' },
];

export default function TechnicalPlanningPage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const suggestions = await suggestStage('technical', brief);
      updateStage<TechnicalPlanningState>('technical', suggestions);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.technical.frontend) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Technical Planning / 技术规划"
      subtitle="你不需要自己懂架构。AI 会基于前面的产品与业务判断，为 V1 推荐技术方案、理由、风险和替代方案。"
      current={3}
      briefId={brief.id}
      previousPath={`/business/${brief.id}`}
      nextPath={`/scope/${brief.id}`}
      nextLabel="进入范围收敛"
      aside={<Aside generating={generating} onGenerate={generate} />}
    >
      {FIELDS.map((field) => (
        <SuggestionCard
          key={field.key}
          title={field.title}
          description={field.desc}
          suggestion={brief.stages.technical[field.key] as AiSuggestion | undefined}
          regenerating={generating}
          onAccept={() => updateSuggestion('technical', field.key as SuggestionKey, { accepted: true })}
          onChange={(value) => updateSuggestion('technical', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
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
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>技术规划原则</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        V1 优先验证闭环，不默认引入数据库、认证、文件上传、复杂后端。
      </p>
      <p style={{ fontSize: 12, color: 'var(--color-text-hint)', lineHeight: 1.7, marginBottom: 16 }}>
        每项建议都包含推荐方案、理由、风险和替代方案。
      </p>
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : null}
        {generating ? 'AI 正在生成...' : '重新生成技术方案'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
