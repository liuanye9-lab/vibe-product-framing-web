import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import GlossaryHelp from '../components/GlossaryHelp';
import { explainSuggestion, isAIReady, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import type { AiSuggestion, BusinessFramingState, BusinessRoi, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof BusinessFramingState; title: string; desc: string; glossaryKey?: 'valueHypothesis' }> = [
  { key: 'userValue', title: '用户价值', desc: '用户为什么愿意使用，它节省什么成本或降低什么风险。' },
  { key: 'ownerValue', title: '产品所有者价值', desc: '这个产品对你/团队/作品集的价值是什么。' },
  { key: 'valueHypothesis', title: '价值假设', desc: 'V1 最需要验证的业务判断。', glossaryKey: 'valueHypothesis' },
  { key: 'metrics', title: '后续可验证指标', desc: '用哪些行为指标判断产品是否有效。' },
  { key: 'monetization', title: '商业化可能性', desc: 'V1 不急着变现，但要知道未来可能性。' },
  { key: 'risksAndBlindSpots', title: '风险与盲点', desc: '提前识别用户、市场、AI 输出质量等风险。' },
];

const AI_NOT_READY_MESSAGE = 'AI 模型未连接成功。请先进入设置页完成配置并测试连接，否则无法生成有效分析。';

export default function BusinessFramingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const autoRequestedRef = useRef<string | null>(null);

  const generate = async () => {
    if (!brief || generating) return;
    if (!isAIReady()) {
      setError(AI_NOT_READY_MESSAGE);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const suggestions = await suggestStage('business', brief);
      updateStage<BusinessFramingState>('business', suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后重试。');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!isAIReady()) {
      setError(AI_NOT_READY_MESSAGE);
      return;
    }
    const requestKey = `${brief.id}:business`;
    if (!brief.stages.business.userValue && autoRequestedRef.current !== requestKey) {
      autoRequestedRef.current = requestKey;
      generate();
    }
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  return (
    <StageLayout
      title="Business Reasoning / 业务推理"
      subtitle="这里不用写复杂商业计划书，只做新手能理解的成本收益判断：用户得到什么、做出来贵不贵、是否值得先做 MVP。"
      current={0}
      briefId={brief.id}
      previousPath={`/product/${brief.id}`}
      nextPath={`/technical/${brief.id}`}
      nextLabel="进入技术翻译"
      aside={<Aside generating={generating} onGenerate={generate} error={error} onSettings={() => navigate('/settings')} />}
    >
      <RoiPanel roi={brief.stages.business.roi} />
      {FIELDS.map((field) => (
        <SuggestionCard
          key={field.key}
          title={field.title}
          description={field.desc}
          glossaryKey={field.glossaryKey}
          showGlossaryByDefault={brief.mode === 'beginner' && Boolean(field.glossaryKey)}
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

function RoiPanel({ roi }: { roi?: BusinessRoi }) {
  if (!roi) return null;
  const judgement = safeText(roi.roiJudgement?.value) || 'uncertain';
  const judgementText = judgement === 'positive' ? '值得先做 MVP' : judgement === 'negative' ? '暂不建议开工' : '需要先验证';
  const color = judgement === 'positive' ? 'var(--color-success)' : judgement === 'negative' ? 'var(--color-danger)' : 'var(--color-warning)';

  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 4 }}>简化 ROI 判断</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>ROI = 用户能获得什么收益，做出来要花多少成本，值不值得先做第一版。</p>
          <GlossaryHelp glossaryKey="roi" />
        </div>
        <span style={{ fontSize: 12, color, padding: '4px 10px', border: `1px solid ${color}`, borderRadius: 999 }}>{judgementText}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12 }}>
        <Score label="用户收益" value={roi.userBenefitScore?.value} />
        <Score label="所有者收益" value={roi.ownerBenefitScore?.value} />
        <Score label="开发成本" value={roi.developmentCostScore?.value} inverse />
        <Score label="维护成本" value={roi.maintenanceCostScore?.value} inverse />
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 6 }}><strong>AI 成本风险：</strong>{safeText(roi.aiCostRisk?.value)}</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 6 }}><strong>用户切换成本：</strong>{safeText(roi.userSwitchingCost?.value)}</p>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}><strong>判断理由：</strong>{safeText(roi.reason?.value)}</p>
    </div>
  );
}

function safeText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(safeText).filter(Boolean).join('；');
  if (typeof value === 'object' && 'value' in value) return safeText((value as { value?: unknown }).value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function Score({ label, value, inverse }: { label: string; value?: unknown; inverse?: boolean }) {
  const score = Number(safeText(value) || 0);
  const good = inverse ? score <= 2 : score >= 4;
  return (
    <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-hint)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: good ? 'var(--color-success)' : 'var(--color-primary)' }}>{score || '-'}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>1-5 分</div>
    </div>
  );
}

function Aside({ generating, onGenerate, error, onSettings }: { generating: boolean; onGenerate: () => void; error: string; onSettings: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>第二钻：业务推理</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        不做复杂财务模型，只判断：用户收益是否明显、开发成本是否可控、是否值得先压成 MVP。
      </p>
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6, marginBottom: 10 }}>{error}</p>}
      {error === AI_NOT_READY_MESSAGE && (
        <button className="vp-btn vp-btn-primary" onClick={onSettings} style={{ width: '100%', marginBottom: 8 }}>
          <Settings size={14} /> 去设置
        </button>
      )}
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
        {generating ? 'AI 正在生成...' : '重新生成业务判断'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
