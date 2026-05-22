import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import GlossaryHelp from '../components/GlossaryHelp';
import { explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
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
  const technical = brief.stages.technical;

  return (
    <StageLayout
      title="Technical Translation / 技术翻译"
      subtitle="你不需要先懂技术名词。这里把用户需求翻译成技术能力，再说明 V1 怎么低成本实现，以及什么时候才需要升级。"
      current={4}
      briefId={brief.id}
      previousPath={`/business/${brief.id}`}
      nextPath={`/scope/${brief.id}`}
      nextLabel="进入 MVP 压缩"
      aside={<Aside generating={generating} onGenerate={generate} />}
    >
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
            <tr key={`${row.userNeed}-${index}`}>
              <td style={cellStyle}>{row.userNeed}</td>
              <td style={cellStyle}>{row.requiredCapability}</td>
              <td style={cellStyle}>{row.v1Implementation}</td>
              <td style={cellStyle}>{row.whyThisIsEnough}</td>
              <td style={cellStyle}>{row.upgradeCondition}</td>
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

function Info({ title, value, mono }: { title: string; value?: string | string[]; mono?: boolean }) {
  const text = Array.isArray(value) ? value.join('、') : value;
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-hint)', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, fontFamily: mono ? 'var(--font-mono)' : undefined }}>{text || '待生成'}</div>
    </div>
  );
}

function Aside({ generating, onGenerate }: { generating: boolean; onGenerate: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>第三钻：技术翻译</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 12 }}>
        V1 优先验证闭环，不默认引入数据库、认证、文件上传、复杂后端。
      </p>
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : null}
        {generating ? 'AI 正在生成...' : '重新生成技术翻译'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
