import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import SuggestionCard from '../components/SuggestionCard';
import DecisionCard from '../components/DecisionCard';
import ScopeCreepWarning from '../components/ScopeCreepWarning';
import { detectScopeCreep, explainSuggestion, suggestStage } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import { extractCoreDecision } from '../rules/coreDecisionExtractor';
import type { AiSuggestion, GlossaryKey, MvpScopeState, SuggestionKey } from '../types';

const FIELDS: Array<{ key: keyof MvpScopeState; title: string; desc: string; glossaryKey?: GlossaryKey }> = [
  { key: 'mustHave', title: 'Must Have', desc: 'V1 没有这些就无法完成核心闭环。', glossaryKey: 'mvp' },
  { key: 'shouldHave', title: 'Should Have', desc: '有了更好，但不阻塞第一版。' },
  { key: 'outOfScope', title: 'Out of Scope', desc: '第一版明确不做，防止范围失控。', glossaryKey: 'outOfScope' },
  { key: 'v2Later', title: 'V2 Later', desc: '后续可验证后再做的能力。' },
  { key: 'minimumLoop', title: '最小闭环', desc: '用户从进入产品到得到结果的最短完整路径。', glossaryKey: 'mvp' },
  { key: 'scopeRisks', title: '范围膨胀风险', desc: '哪些想法会把 V1 做成大平台。', glossaryKey: 'scopeCreep' },
];

export default function MvpScopePage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, updateStage, updateSuggestion } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [view, setView] = useState<'focus' | 'detail'>('focus');

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const suggestions = await suggestStage('mvp', brief);
      updateStage<MvpScopeState>('mvp', suggestions);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.stages.mvp.mustHave) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  const creepTerms = detectScopeCreep(JSON.stringify(brief.ideaInput) + JSON.stringify(brief.stages.product));
  const decision = extractCoreDecision(brief, 'mvp');

  return (
    <StageLayout
      title="MVP Decision / 第一版决策"
      subtitle="这里不展开完整规划，只确认第一版验证哪个最小闭环，哪些功能必须砍掉。"
      current={1}
      briefId={brief.id}
      previousPath={`/discovery/${brief.id}`}
      nextPath={`/technical/${brief.id}`}
      nextLabel="进入技术决策"
      aside={<Aside view={view} onViewChange={setView} generating={generating} onGenerate={generate} />}
    >
      <ScopeCreepWarning terms={creepTerms} warning={brief.stages.mvp.scopeCreepWarning} />
      {view === 'focus' ? (
        <DecisionCard
          decision={decision}
          glossaryKey="mvp"
          accepted={Boolean(brief.stages.mvp.minimumLoop?.accepted)}
          loading={generating}
          onAccept={() => updateSuggestion('mvp', 'minimumLoop', { accepted: true })}
          onSimplify={generate}
          onExplain={() => explainSuggestion('MVP 第一版核心决策', brief)}
          editableValue={brief.stages.mvp.minimumLoop?.value || ''}
          onEdit={(value) => updateSuggestion('mvp', 'minimumLoop', { value, editedByUser: true, accepted: false })}
        />
      ) : FIELDS.map((field) => (
        <SuggestionCard
          key={field.key}
          title={field.title}
          description={field.desc}
          glossaryKey={field.glossaryKey}
          showGlossaryByDefault={brief.mode === 'beginner' && Boolean(field.glossaryKey)}
          suggestion={brief.stages.mvp[field.key] as AiSuggestion | undefined}
          regenerating={generating}
          onAccept={() => updateSuggestion('mvp', field.key as SuggestionKey, { accepted: true })}
          onChange={(value) => updateSuggestion('mvp', field.key as SuggestionKey, { value, editedByUser: true, accepted: false })}
          onRegenerate={generate}
          onExplain={() => explainSuggestion(field.title, brief)}
        />
      ))}
    </StageLayout>
  );
}

function Aside({ view, onViewChange, generating, onGenerate }: { view: 'focus' | 'detail'; onViewChange: (view: 'focus' | 'detail') => void; generating: boolean; onGenerate: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>第二关：第一版决策</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button className={view === 'focus' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('focus')}>Focus</button>
        <button className={view === 'detail' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('detail')}>Detail</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        V1 只证明一个核心闭环，不做“全能平台”。
      </p>
      <button className="vp-btn vp-btn-ghost" onClick={onGenerate} disabled={generating} style={{ width: '100%' }}>
        {generating ? <Loader2 size={14} className="vp-spin" /> : null}
        {generating ? 'AI 正在生成...' : '重新生成范围建议'}
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
