import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, RefreshCw, Settings } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import DecisionCard from '../components/DecisionCard';
import GlossaryHelp from '../components/GlossaryHelp';
import { explainSuggestion, isAIReady, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import { toDisplayText } from '../lib/utils';
import { extractCoreDecision } from '../rules/coreDecisionExtractor';
import type { AiSuggestion, GlossaryKey, SuggestionKey, TechnicalPlanningState, TechnicalTranslation } from '../types';

const FIELDS: Array<{ key: keyof TechnicalPlanningState; title: string; desc: string; glossaryKey?: GlossaryKey }> = [
  { key: 'frontend', title: '前端形态与技术栈', desc: 'AI 推荐 V1 适合做成什么前端形态，以及用什么栈。' },
  { key: 'backend', title: '是否需要后端', desc: '不要默认上后端；先判断 V1 是否真的需要。', glossaryKey: 'backend' },
  { key: 'database', title: '是否需要数据库', desc: '如果不需要，说明 localStorage / mock data / JSON 如何替代。', glossaryKey: 'database' },
  { key: 'aiApi', title: '是否需要 AI API', desc: '说明 AI API 放在哪一层调用，避免 key 和 CORS 问题。', glossaryKey: 'aiApi' },
  { key: 'auth', title: '是否需要认证', desc: '判断 V1 是否真的需要登录注册。', glossaryKey: 'auth' },
  { key: 'fileUpload', title: '是否需要文件上传', desc: '文件上传会增加复杂度，V1 需要明确判断。' },
  { key: 'dataFlow', title: '数据如何流转', desc: '从用户输入到最终输出，中间数据如何变化。', glossaryKey: 'dataFlow' },
  { key: 'mockStrategy', title: 'V1 mock 策略', desc: '无真实后端/模型时如何保证流程可演示。', glossaryKey: 'mockStrategy' },
  { key: 'architectureUpgrade', title: '后续架构升级条件', desc: '什么时候再引入数据库、账号、文件存储或更复杂后端。' },
];

const AI_NOT_READY_MESSAGE = 'AI 模型未连接成功。请先进入设置页完成配置并测试连接，否则无法生成有效分析。';

export default function TechnicalPlanningPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'focus' | 'detail'>('focus');
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
      const suggestions = await suggestStage('technical', brief);
      updateStage<TechnicalPlanningState>('technical', suggestions);
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
    const requestKey = `${brief.id}:technical`;
    if (!brief.stages.technical.frontend && autoRequestedRef.current !== requestKey) {
      autoRequestedRef.current = requestKey;
      generate();
    }
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;
  const technical = brief.stages.technical;
  const decision = extractCoreDecision(brief, 'tech');

  return (
    <StageLayout
      title="Tech Decision / 技术决策"
      subtitle="AI 把需求翻译成最低成本技术方案。你只确认：第一版是否足够简单、可开发、可替换。"
      current={2}
      briefId={brief.id}
      previousPath={`/scope/${brief.id}`}
      nextPath={`/handoff/${brief.id}`}
      nextLabel="生成开发交付"
      aside={<Aside view={view} onViewChange={setView} generating={generating} onGenerate={generate} error={error} onSettings={() => navigate('/settings')} />}
    >
      {view === 'focus' ? (
        <DecisionCard
          decision={decision}
          glossaryKey="mockStrategy"
          accepted={Boolean(technical.frontend?.accepted)}
          loading={generating}
          onAccept={() => updateSuggestion('technical', 'frontend', { accepted: true })}
          onSimplify={generate}
          onExplain={() => explainSuggestion('最低成本技术方案', brief)}
          editableValue={toDisplayText(technical.frontend?.value)}
          onEdit={(value) => updateSuggestion('technical', 'frontend', { value, editedByUser: true, accepted: false })}
        />
      ) : (
        <>
          <TranslationTable translations={technical.translations || []} />
          <MockStrategyPanel technical={technical} />
          {FIELDS.map((field) => (
            <SuggestionCard
              key={field.key}
              title={field.title}
              description={field.desc}
              glossaryKey={field.glossaryKey}
              showGlossaryByDefault={brief.mode === 'beginner' && Boolean(field.glossaryKey)}
              suggestion={technical[field.key] as AiSuggestion | undefined}
              regenerating={generating}
              onAccept={() => updateSuggestion('technical', field.key as SuggestionKey, { accepted: true })}
              onChange={(value) => updateSuggestion('technical', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
              onRegenerate={generate}
              onExplain={() => explainSuggestion(field.title, brief)}
            />
          ))}
        </>
      )}
    </StageLayout>
  );
}

function TranslationTable({ translations }: { translations: TechnicalTranslation[] }) {
  if (!translations.length) return null;
  return (
    <div className="vp-card" style={{ marginBottom: 16, overflowX: 'auto' }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 6 }}>需求 → 技术能力 → V1 实现 → 以后升级</h2>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        这张表把“用户想要什么”翻译成“技术上需要什么”，再压缩成第一版够用的实现。
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--color-text-hint)', textAlign: 'left' }}>
            <th style={cellStyle}>用户需求</th>
            <th style={cellStyle}>技术能力</th>
            <th style={cellStyle}>V1 实现</th>
            <th style={cellStyle}>为什么够用</th>
            <th style={cellStyle}>升级条件</th>
          </tr>
        </thead>
        <tbody>
          {translations.map((row, index) => (
            <tr key={`${toDisplayText(row.userNeed)}-${index}`}>
              <td style={cellStyle}>{toDisplayText(row.userNeed)}</td>
              <td style={cellStyle}>{toDisplayText(row.requiredCapability)}</td>
              <td style={cellStyle}>{toDisplayText(row.v1Implementation)}</td>
              <td style={cellStyle}>{toDisplayText(row.whyThisIsEnough)}</td>
              <td style={cellStyle}>{toDisplayText(row.upgradeCondition)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle: React.CSSProperties = { padding: 10, borderBottom: '1px solid var(--color-border)', verticalAlign: 'top', lineHeight: 1.6 };

function MockStrategyPanel({ technical }: { technical: TechnicalPlanningState }) {
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 6 }}>Mock 策略白话解释</h2>
      <GlossaryHelp glossaryKey="mockStrategy" defaultOpen />
      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        <Info title="V1 哪些地方可以 mock" value={technical.mockableParts?.value} />
        <Info title="mock 数据长什么样" value={technical.mockDataExample?.value} mono />
        <Info title="什么时候换真实 API" value={technical.realApiTrigger?.value} />
        <Info title="如果 mock 失败，用户会看到什么" value={technical.mockFailureFallback?.value} />
      </div>
    </div>
  );
}

function Info({ title, value, mono }: { title: string; value?: unknown; mono?: boolean }) {
  const text = toDisplayText(value);
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-hint)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, fontFamily: mono ? 'var(--font-mono)' : undefined }}>{text || '待生成'}</div>
    </div>
  );
}

function Aside({ view, onViewChange, generating, onGenerate, error, onSettings }: { view: 'focus' | 'detail'; onViewChange: (view: 'focus' | 'detail') => void; generating: boolean; onGenerate: () => void; error: string; onSettings: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>第三关：技术决策</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button className={view === 'focus' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('focus')}>Focus</button>
        <button className={view === 'detail' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('detail')}>Detail</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        V1 优先验证闭环，不默认引入数据库、认证、文件上传、复杂后端。
      </p>
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6, marginBottom: 10 }}>{error}</p>}
      {error === AI_NOT_READY_MESSAGE && (
        <button className="vp-btn vp-btn-primary" onClick={onSettings} style={{ width: '100%', marginBottom: 8 }}>
          <Settings size={14} /> 去设置
        </button>
      )}
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
        {generating ? 'AI 正在生成...' : '重新生成技术翻译'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
