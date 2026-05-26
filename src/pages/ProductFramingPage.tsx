import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import { explainSuggestion, isAIReady, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { AiSuggestion, GlossaryKey, ProductFramingState, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof ProductFramingState; title: string; desc: string; glossaryKey?: GlossaryKey }> = [
  { key: 'productOneLiner', title: '产品一句话定义', desc: '说明产品是什么、给谁用、在什么场景下解决什么问题。' },
  { key: 'targetUser', title: '目标用户', desc: '第一版最关键的用户，不要写成“所有人”。' },
  { key: 'scenario', title: '使用场景', desc: '用户在什么具体任务和时刻需要它。' },
  { key: 'corePainPoint', title: '核心痛点', desc: '用户最难、最慢或最容易出错的地方。' },
  { key: 'alternatives', title: '现有替代方案', desc: '用户现在怎么解决，包括人工方法和通用工具。' },
  { key: 'aiValue', title: 'AI 介入价值', desc: 'AI 到底在哪个环节降低成本或提升质量。', glossaryKey: 'aiApi' },
];

const AI_NOT_READY_MESSAGE = 'AI 模型未连接成功。请先进入设置页完成配置并测试连接，否则无法生成有效分析。';

export default function ProductFramingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const autoRequestedRef = useRef<string | null>(null);

  const generate = useCallback(async () => {
    if (!brief || generating) return;
    if (!isAIReady()) {
      setError(AI_NOT_READY_MESSAGE);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const suggestions = await suggestStage('product', brief);
      updateStage<ProductFramingState>('product', suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试。');
    } finally {
      setGenerating(false);
    }
  }, [brief, generating, updateStage]);

  useEffect(() => {
    if (!brief || loading) return;
    if (!isAIReady()) {
      setError(AI_NOT_READY_MESSAGE);
      return;
    }
    const requestKey = `${brief.id}:product`;
    if (!brief.stages.product.productOneLiner && autoRequestedRef.current !== requestKey) {
      autoRequestedRef.current = requestKey;
      generate();
    }
  }, [brief, generate, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Product Framing / 产品理解"
      subtitle="AI 会先根据你的输入生成产品理解草案。你只需要接受、编辑或要求解释。"
      current={0}
      briefId={brief.id}
      previousPath={`/discovery/${brief.id}`}
      nextPath={`/business/${brief.id}`}
      nextLabel="进入业务判断"
      aside={<Summary rawIdea={brief.ideaInput.rawIdea} generating={generating} onGenerate={generate} error={error} onSettings={() => navigate('/settings')} />}
    >
      {FIELDS.map((field) => {
        const suggestion = brief.stages.product[field.key];
        return (
          <SuggestionCard
            key={field.key}
            title={field.title}
            description={field.desc}
            glossaryKey={field.glossaryKey}
            showGlossaryByDefault={brief.mode === 'beginner' && Boolean(field.glossaryKey)}
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

function Summary({ rawIdea, generating, onGenerate, error, onSettings }: { rawIdea: string; generating: boolean; onGenerate: () => void; error: string; onSettings: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>原始想法</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>{rawIdea}</p>
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6, marginBottom: 10 }}>{error}</p>}
      {error === AI_NOT_READY_MESSAGE && (
        <button className="vp-btn vp-btn-primary" onClick={onSettings} style={{ width: '100%', marginBottom: 8 }}>
          <Settings size={14} /> 去设置
        </button>
      )}
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
        {generating ? 'AI 正在生成...' : '重新生成本页建议'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
