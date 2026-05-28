import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Check, Copy, Download, FileText, Loader2, RefreshCw, Settings } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import DecisionCard from '../components/DecisionCard';
import { getAIErrorMessage, isAIReady, optimizeHandoff } from '../api/evaluate';
import { applyHandoffFixes } from '../evaluation/applyHandoffFixes';
import { useProductBrief } from '../hooks/useProductBrief';
import { toDisplayText, toDisplayList } from '../lib/utils';
import { extractCoreDecision } from '../rules/coreDecisionExtractor';
import { listHandoffTraces, saveHandoffTrace } from '../trace/traceStore';
import { runRetrievalSelfCheck } from '../quality/runRetrievalSelfCheck';
import { listHandoffSnapshots, saveHandoffSnapshot } from '../snapshot/snapshotStore';
import { compareLatestSnapshots } from '../snapshot/compareSnapshots';
import { buildCaseStudyMarkdown } from '../export/buildCaseStudyMarkdown';
import { DEMO_IDEAS } from '../demo/demoIdeas';
import type { HandoffTrace } from '../trace/types';
import type { RetrievalSelfCheckResult } from '../quality/runRetrievalSelfCheck';
import type { HandoffSnapshot } from '../snapshot/types';
import type { FinalHandoff, HandoffEvaluation, HandoffEvaluationDimension, KnowledgeReference, DecisionStageProgress } from '../types';
import { buildDevSpec } from '../lib/devSpecBuilder';
import { buildCodexTaskPack } from '../lib/codexTaskPackBuilder';
import DevSpecPreview from '../components/DevSpecPreview';
import CodexTaskPackPreview from '../components/CodexTaskPackPreview';
import { calculatePhaseProgress } from '../lib/progressCalculator';

type TextHandoffSectionKey =
  | 'productBrief'
  | 'mvpScope'
  | 'devSpec'
  | 'technicalArchitecture'
  | 'dataStructure'
  | 'acceptanceCriteria'
  | 'developmentPrompt';

const TEXT_SECTIONS: Array<{ key: TextHandoffSectionKey; title: string }> = [
  { key: 'productBrief', title: '1. Product Brief' },
  { key: 'mvpScope', title: '2. MVP Scope' },
  { key: 'devSpec', title: '3. DEV_SPEC' },
  { key: 'technicalArchitecture', title: '4. Technical Architecture' },
  { key: 'dataStructure', title: '5. Data Structure' },
  { key: 'acceptanceCriteria', title: '6. Acceptance Criteria' },
  { key: 'developmentPrompt', title: '7. Codex Development Prompt' },
];

const AI_NOT_READY_MESSAGE = 'AI 模型未连接成功。请先进入设置页完成配置并测试连接，否则无法生成有效分析。';

export default function DeveloperHandoffPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, saveFinalHandoff } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [view, setView] = useState<'focus' | 'detail'>('focus');
  const [traces, setTraces] = useState<HandoffTrace[]>([]);
  const [snapshots, setSnapshots] = useState<HandoffSnapshot[]>([]);
  const [selfCheckResults] = useState<RetrievalSelfCheckResult[]>(() => runRetrievalSelfCheck());
  const autoRequestedRef = useRef<string | null>(null);

  const refreshTraces = useCallback(() => {
    if (!brief) return;
    setTraces(listHandoffTraces(brief.id).slice(0, 3));
  }, [brief]);

  const refreshSnapshots = useCallback(() => {
    if (!brief) return;
    setSnapshots(listHandoffSnapshots(brief.id));
  }, [brief]);

  const writeSnapshot = useCallback((handoff: FinalHandoff, action: HandoffSnapshot['action'], appliedFixIds?: string[]) => {
    if (!brief) return;
    saveHandoffSnapshot({
      id: `${brief.id}-snapshot-${Date.now()}`,
      briefId: brief.id,
      createdAt: new Date().toISOString(),
      action,
      schemaVersion: handoff.schemaVersion || 'legacy',
      score: handoff.evaluation?.totalScore || 0,
      readiness: handoff.evaluation?.readiness || 'needs-review',
      handoff,
      appliedFixIds,
    });
    refreshSnapshots();
  }, [brief, refreshSnapshots]);

  const writeTrace = useCallback((handoff: FinalHandoff, useAI: boolean, appliedFixIds: string[] = []) => {
    if (!brief) return;
    try {
      const lastTrace = listHandoffTraces(brief.id)[0];
      const currentScore = handoff.evaluation?.totalScore || 0;
      const currentIssueCount = handoff.evaluation?.issues?.length || 0;
      const docCount = handoff.knowledgeReferences?.length || 0;
      saveHandoffTrace({
        id: `${brief.id}-${Date.now()}`,
        briefId: brief.id,
        createdAt: new Date().toISOString(),
        mode: useAI ? 'ai' : 'local',
        rawIdea: brief.ideaInput.rawIdea,
        retrievedDocIds: handoff.knowledgeReferences?.map((ref) => ref.id) || [],
        retrievalExplanation: handoff.knowledgeReferences?.map((ref) => `${ref.title}: ${ref.reason}`).join('；') || '暂无知识引用',
        evaluationScore: currentScore,
        readiness: handoff.evaluation?.readiness || 'needs-review',
        issueCount: currentIssueCount,
        previousScore: lastTrace?.evaluationScore,
        scoreDelta: lastTrace ? currentScore - lastTrace.evaluationScore : undefined,
        previousReadiness: lastTrace?.readiness,
        fixedIssueCount: lastTrace ? Math.max(0, lastTrace.issueCount - currentIssueCount) : undefined,
        appliedFixIds,
        remainingIssues: handoff.evaluation?.issues || [],
        summary: appliedFixIds.length
          ? `应用 ${appliedFixIds.length} 条本地修复，评分 ${lastTrace?.evaluationScore ?? '-'} -> ${currentScore}。`
          : `生成 Developer Handoff，引用 ${docCount} 份知识文档，评分 ${currentScore}。`,
      });
      refreshTraces();
    } catch {
      // Trace is diagnostic only and should never block the handoff.
    }
  }, [brief, refreshTraces]);

  const generate = useCallback(async () => {
    if (!brief || generating) return;
    if (!isAIReady()) {
      setError(AI_NOT_READY_MESSAGE);
      return;
    }
    setGenerating(true);
    setError('');
    try {
      // V4.4: Only AI-generated handoff. No local-rule fallback.
      const handoff = await optimizeHandoff(brief);
      saveFinalHandoff(handoff);
      writeTrace(handoff, true);
      writeSnapshot(handoff, 'generate');
    } catch (err) {
      setError(getAIErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }, [brief, generating, saveFinalHandoff, writeSnapshot, writeTrace]);

  useEffect(() => {
    if (!brief || loading) return;
    refreshTraces();
    refreshSnapshots();
    const needsV14Upgrade =
      brief.finalHandoff?.schemaVersion !== 'v1.4' ||
      !brief.finalHandoff?.developmentPrompt?.includes('Codex Execution Wrapper') ||
      !brief.finalHandoff?.knowledgeReferences?.every((ref) => ref.appliedTo?.length && ref.influence) ||
      !brief.finalHandoff?.evaluation?.fixSuggestions;
    const needsEnhancedHandoff =
      !brief.finalHandoff?.developmentPrompt ||
      !brief.finalHandoff?.devSpec ||
      !brief.finalHandoff?.knowledgeReferences?.length ||
      !brief.finalHandoff?.evaluation ||
      needsV14Upgrade;
    const requestKey = `${brief.id}:handoff-enhanced-v14`;
    if (needsEnhancedHandoff && autoRequestedRef.current !== requestKey) {
      autoRequestedRef.current = requestKey;
      generate();
    }
  }, [brief, generate, loading, refreshSnapshots, refreshTraces]);

  const phases = useMemo<DecisionStageProgress[]>(() => {
    if (!brief) return [];
    return calculatePhaseProgress(brief);
  }, [brief]);

  const devSpecData = useMemo(() => {
    if (!brief) return null;
    return buildDevSpec(brief);
  }, [brief]);

  const codexTaskPackData = useMemo(() => {
    if (!devSpecData) return null;
    return buildCodexTaskPack({ devSpec: devSpecData });
  }, [devSpecData]);

  if (loading || !brief) return <Loader />;

  const handoff = brief.finalHandoff;
  const decision = extractCoreDecision(brief, 'handoff');

  const copyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  };

  const download = () => {
    if (!handoff) return;
    const content = buildMarkdownDownload(handoff);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibepilot-handoff-${brief.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCaseStudy = () => {
    if (!handoff) return;
    const content = buildCaseStudyMarkdown({ brief, handoff, snapshots, traces });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibepilot-case-study-${brief.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyLocalFixes = () => {
    if (!handoff) return;
    const result = applyHandoffFixes(handoff);
    if (!result.changed) {
      setError('当前没有新的本地修复可应用。');
      return;
    }
    saveFinalHandoff(result.handoff);
    writeTrace(result.handoff, false, result.appliedFixIds);
    writeSnapshot(result.handoff, 'apply-fixes', result.appliedFixIds);
  };

  return (
    <StageLayout
      title="Developer Handoff / 开发交付"
      subtitle="最后只判断一件事：这份方案是否已经足够清晰，可以交给 Codex / Claude Code / Cursor 开发。"
      current={3}
      briefId={brief.id}
      phases={phases}
      previousPath={`/technical/${brief.id}`}
      aside={<Aside view={view} onViewChange={setView} generating={generating} onGenerate={generate} onDownload={download} onExportCaseStudy={exportCaseStudy} hasHandoff={Boolean(handoff)} error={error} onSettings={() => navigate('/settings')} onSwitchAgent={() => navigate(`/agent/${brief.id}`)} onViewDecisionOutput={() => navigate(`/output/${brief.id}`)} />}
    >
      {view === 'focus' && (
        <DecisionCard
          decision={decision}
          glossaryKey="acceptanceCriteria"
          accepted={Boolean(handoff?.developmentPrompt)}
          loading={generating}
          onAccept={() => generate()}
          onSimplify={generate}
          editableValue={toDisplayText(handoff?.developmentPrompt)}
          onEdit={() => undefined}
        />
      )}

      {view === 'focus' && handoff?.knowledgeReferences && (
        <div className="vp-card" style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          已基于 {handoff.knowledgeReferences.length} 份知识文档增强生成。
        </div>
      )}

      {generating && !handoff && (
        <div className="vp-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 size={16} className="vp-spin" />
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>AI 正在整合最终开发交付内容...</span>
        </div>
      )}

      {view === 'detail' && handoff && (
        <>
          <KnowledgeReferencesCard references={handoff.knowledgeReferences} copied={copied} onCopy={copyText} />
          {TEXT_SECTIONS.map((section) => (
            <TextSectionCard
              key={section.key}
              section={section}
              handoff={handoff}
              copied={copied}
              onCopy={copyText}
            />
          ))}
          <StructuredSpecPreviewCard devSpec={handoff.devSpec} />
          <EvaluationReportCard evaluation={handoff.evaluation} copied={copied} onCopy={copyText} onApplyFixes={applyLocalFixes} />
          <QualityCompareCard snapshots={snapshots} />
          <GenerationTraceCard traces={traces} />
          <DemoSamplesCard />
          <RetrievalSelfCheckCard results={selfCheckResults} />
          {devSpecData && <DevSpecPreview devSpec={devSpecData} />}
          {codexTaskPackData && <CodexTaskPackPreview taskPack={codexTaskPackData} />}
        </>
      )}
    </StageLayout>
  );
}

function TextSectionCard({ section, handoff, copied, onCopy }: { section: { key: TextHandoffSectionKey; title: string }; handoff: FinalHandoff; copied: string; onCopy: (key: string, text: string) => void }) {
  const text = toDisplayText(handoff[section.key]) || '暂无';
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 650 }}>{section.title}</h2>
          {handoff.source && handoff.source !== 'ai' && (
            <p style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 4 }}>
              {handoff.source === 'mock' ? 'Mock 输出' : '本地规则'}，不是 AI 真实分析
            </p>
          )}
        </div>
        <button className="vp-btn vp-btn-ghost" onClick={() => onCopy(section.key, text)}>
          {copied === section.key ? <Check size={14} /> : <Copy size={14} />}
          {copied === section.key ? '已复制' : '复制'}
        </button>
      </div>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.75, color: 'var(--color-text)', fontFamily: 'inherit' }}>
        {text}
      </pre>
    </div>
  );
}

function KnowledgeReferencesCard({ references, copied, onCopy }: { references?: KnowledgeReference[]; copied: string; onCopy: (key: string, text: string) => void }) {
  const items = references || [];
  const copyValue = items.length ? items.map(formatKnowledgeReference).join('\n\n') : '暂无';
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650 }}>0. Knowledge References</h2>
        <button className="vp-btn vp-btn-ghost" onClick={() => onCopy('knowledgeReferences', copyValue)}>
          {copied === 'knowledgeReferences' ? <Check size={14} /> : <Copy size={14} />}
          {copied === 'knowledgeReferences' ? '已复制' : '复制'}
        </button>
      </div>
      {items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <div key={item.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                <strong style={{ fontSize: 14 }}>{toDisplayText(item.title)}</strong>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{toDisplayText(item.type)} · score {toDisplayText(item.score ?? 0)}</span>
              </div>
              <KeywordRow label="Matched Aliases" items={item.matchedAliases} />
              <KeywordRow label="Matched Tags" items={item.matchedTags} />
              <KeywordRow label="Matched Fields" items={item.matchedFields} />
              <KeywordRow label="Applied To" items={item.appliedTo} />
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{toDisplayText(item.reason)}</p>
              {item.influence && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 6 }}>Influence: {toDisplayText(item.influence)}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>暂无</p>
      )}
    </div>
  );
}

function KeywordRow({ label, items }: { label: string; items?: string[] }) {
  const values = items?.length ? items : ['暂无明确命中词'];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{label}:</span>
      {values.map((item) => (
        <span key={`${label}-${toDisplayText(item)}`} style={{ fontSize: 12, border: '1px solid var(--color-border)', borderRadius: 999, padding: '2px 7px', color: 'var(--color-text-secondary)' }}>
          {toDisplayText(item)}
        </span>
      ))}
    </div>
  );
}

function EvaluationReportCard({ evaluation, copied, onCopy, onApplyFixes }: { evaluation?: HandoffEvaluation; copied: string; onCopy: (key: string, text: string) => void; onApplyFixes: () => void }) {
  const text = evaluation ? formatEvaluation(evaluation) : '暂无';
  const legacyDimensions = evaluation ? Object.entries(evaluation.dimensionScores) : [];
  const explainableDimensions = evaluation?.dimensions ? Object.entries(evaluation.dimensions) : [];
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650 }}>8. Evaluation Report</h2>
        <button className="vp-btn vp-btn-ghost" onClick={() => onCopy('evaluation', text)}>
          {copied === 'evaluation' ? <Check size={14} /> : <Copy size={14} />}
          {copied === 'evaluation' ? '已复制' : '复制'}
        </button>
      </div>
      {evaluation ? (
        <div style={{ display: 'grid', gap: 14 }}>
          <button className="vp-btn vp-btn-primary" onClick={onApplyFixes} disabled={!evaluation.fixSuggestions?.length} style={{ justifySelf: 'start' }}>
            Apply Local Fixes
          </button>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{evaluation.totalScore}/{evaluation.maxScore}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Raw Score</div>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{evaluation.weightedScore ?? 0}/{evaluation.weightedMaxScore ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Weighted Score</div>
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{toDisplayText(evaluation.readiness)}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Readiness</div>
            </div>
          </div>
          {explainableDimensions.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {explainableDimensions.map(([key, dimension]) => (
                <EvaluationDimensionCard key={key} dimension={dimension} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {legacyDimensions.map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span>{dimensionLabel(key)}</span>
                  <strong>{value}/5</strong>
                </div>
              ))}
            </div>
          )}
          <EvaluationList title="Strengths" items={evaluation.strengths} />
          <EvaluationList title="Issues" items={evaluation.issues} />
          <EvaluationList title="Suggestions" items={evaluation.suggestions} />
          <FixSuggestionsList fixes={evaluation.fixSuggestions || []} />
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>暂无</p>
      )}
    </div>
  );
}

function FixSuggestionsList({ fixes }: { fixes: NonNullable<HandoffEvaluation['fixSuggestions']> }) {
  if (!fixes.length) return <EvaluationList title="Fix Suggestions" items={['暂无本地修复建议']} />;
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 650, marginBottom: 6 }}>Fix Suggestions</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {fixes.map((fix) => (
          <div key={fix.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>{toDisplayText(fix.targetSection)}</strong>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{toDisplayText(fix.id)}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{toDisplayText(fix.issue)}</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.6, color: 'var(--color-text-secondary)', fontFamily: 'inherit', margin: 0 }}>{toDisplayText(fix.patch)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvaluationDimensionCard({ dimension }: { dimension: HandoffEvaluationDimension }) {
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{toDisplayText(dimension.label)}</strong>
        <strong style={{ fontSize: 13 }}>{toDisplayText(dimension.score)}/5</strong>
      </div>
      <EvaluationList title="Evidence" items={dimension.evidence.length ? dimension.evidence : ['暂无明确证据']} />
      <EvaluationList title="Issues" items={dimension.issues.length ? dimension.issues : ['暂无明显问题']} />
      <EvaluationList title="Suggestions" items={dimension.suggestions.length ? dimension.suggestions : ['暂无建议']} />
    </div>
  );
}

function EvaluationList({ title, items }: { title: string; items: string[] }) {
  const safeItems = toDisplayList(items);
  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 650, marginBottom: 6 }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
        {safeItems.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function GenerationTraceCard({ traces }: { traces: HandoffTrace[] }) {
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Generation Trace</h2>
      {traces.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {traces.map((trace) => (
            <div key={trace.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <strong>{new Date(trace.createdAt).toLocaleString()}</strong>
                <span style={{ color: 'var(--color-text-secondary)' }}>{trace.mode}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {trace.summary && <span style={{ flexBasis: '100%' }}>{trace.summary}</span>}
                <span>Score: {trace.previousScore === undefined ? trace.evaluationScore : `${trace.previousScore} -> ${trace.evaluationScore}`}</span>
                {trace.scoreDelta !== undefined && <span>Delta: {trace.scoreDelta >= 0 ? '+' : ''}{trace.scoreDelta}</span>}
                <span>Readiness: {trace.previousReadiness ? `${trace.previousReadiness} -> ${trace.readiness}` : trace.readiness}</span>
                {trace.fixedIssueCount !== undefined && <span>Fixed Issues: {trace.fixedIssueCount}</span>}
                <span>Docs: {trace.retrievedDocIds.length}</span>
                {trace.appliedFixIds?.length ? <span>Fixes: {trace.appliedFixIds.join(', ')}</span> : null}
              </div>
              {trace.remainingIssues?.length ? (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  {trace.remainingIssues.slice(0, 2).map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>暂无</p>
      )}
    </div>
  );
}

function RetrievalSelfCheckCard({ results }: { results: RetrievalSelfCheckResult[] }) {
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Retrieval Self Check</h2>
      <div style={{ display: 'grid', gap: 10 }}>
        {results.map((result) => (
          <div key={result.input} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>{result.input}</strong>
              <span style={{ fontSize: 12, color: result.passed ? 'var(--color-success)' : 'var(--color-danger)' }}>{result.passed ? 'passed' : 'failed'}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
              Retrieved: {result.retrievedDocIds.join(', ') || '暂无'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 4 }}>
              Expected: {result.expectedDocs.join(', ')}
            </p>
            {result.issues.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6 }}>
                {result.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function extractMarkdownSection(source: string, heading: string): string[] {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => line.toLowerCase().includes(heading.toLowerCase()));
  if (start < 0) return ['暂无'];
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (collected.length && /^#{1,3}\s+/.test(line)) break;
    if (line) collected.push(line.replace(/^[-*]\s*/, ''));
    else if (collected.length) break;
  }
  return collected.slice(0, 6).length ? collected.slice(0, 6) : ['暂无'];
}

function StructuredSpecPreviewCard({ devSpec }: { devSpec: string }) {
  const sections = [
    ['Project Overview', extractMarkdownSection(devSpec, 'Project Overview')],
    ['MVP Scope', extractMarkdownSection(devSpec, 'MVP Scope')],
    ['Data Models', extractMarkdownSection(devSpec, 'Data Model')],
    ['Acceptance Criteria', extractMarkdownSection(devSpec, 'Acceptance Criteria')],
    ['Risks', extractMarkdownSection(devSpec, 'Risks')],
  ];
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Structured Spec Preview</h2>
      <div style={{ display: 'grid', gap: 12 }}>
        {sections.map(([title, items]) => (
          <div key={title as string}>
            <h3 style={{ fontSize: 13, fontWeight: 650, marginBottom: 6 }}>{title as string}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
              {(items as string[]).map((item) => <li key={`${title}-${item}`}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualityCompareCard({ snapshots }: { snapshots: HandoffSnapshot[] }) {
  const compare = compareLatestSnapshots(snapshots);
  if (snapshots.length < 2 || !compare.from || !compare.to) {
    return (
      <div className="vp-card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>Quality Compare</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>至少生成两次后可查看质量对比。</p>
      </div>
    );
  }
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Quality Compare</h2>
      <div style={{ display: 'grid', gap: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <p>Score: {compare.from.score} → {compare.to.score}</p>
        <p>Readiness: {compare.from.readiness} → {compare.to.readiness}</p>
        <p>Snapshot time: {new Date(compare.from.createdAt).toLocaleString()} → {new Date(compare.to.createdAt).toLocaleString()}</p>
        <EvaluationList title="Changed Sections" items={compare.changedSections.length ? compare.changedSections : ['暂无变化']} />
        <EvaluationList title="Applied Fixes" items={compare.appliedFixIds.length ? compare.appliedFixIds : ['暂无']} />
      </div>
    </div>
  );
}

function DemoSamplesCard() {
  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Demo Samples</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {DEMO_IDEAS.map((demo) => (
          <div key={demo.label} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
            <strong style={{ fontSize: 13 }}>{demo.label}</strong>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: 4 }}>{demo.ideaInput.rawIdea}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function dimensionLabel(key: string): string {
  const labels: Record<string, string> = {
    userScenarioClarity: 'User Scenario Clarity',
    mvpFocus: 'MVP Focus',
    technicalExecutability: 'Technical Executability',
    acceptanceCriteriaCompleteness: 'Acceptance Criteria Completeness',
    promptExecutability: 'Prompt Executability',
  };
  return labels[key] || key;
}

function formatEvaluation(evaluation: HandoffEvaluation): string {
  const dimensions = evaluation.dimensions
    ? [
      '',
      'dimensions:',
      ...Object.entries(evaluation.dimensions).flatMap(([, dimension]) => [
        `- ${dimension.label}: ${dimension.score}/5`,
        `  evidence: ${dimension.evidence.join('；') || '暂无明确证据'}`,
        `  issues: ${dimension.issues.join('；') || '暂无明显问题'}`,
        `  suggestions: ${dimension.suggestions.join('；') || '暂无建议'}`,
      ]),
    ]
    : [];
  const fixes = evaluation.fixSuggestions?.length
    ? [
      '',
      'fixSuggestions:',
      ...evaluation.fixSuggestions.flatMap((fix) => [
        `- ${fix.targetSection}: ${fix.issue}`,
        `  patch: ${fix.patch.replace(/\n/g, ' / ')}`,
      ]),
    ]
    : [];
  return [
    `totalScore: ${evaluation.totalScore} / ${evaluation.maxScore}`,
    `weightedScore: ${evaluation.weightedScore ?? 0} / ${evaluation.weightedMaxScore ?? 0}`,
    `readiness: ${evaluation.readiness}`,
    '',
    'dimensionScores:',
    ...Object.entries(evaluation.dimensionScores).map(([key, value]) => `- ${dimensionLabel(key)}: ${value}/5`),
    ...dimensions,
    '',
    'strengths:',
    ...evaluation.strengths.map((item) => `- ${item}`),
    '',
    'issues:',
    ...evaluation.issues.map((item) => `- ${item}`),
    '',
    'suggestions:',
    ...evaluation.suggestions.map((item) => `- ${item}`),
    ...fixes,
  ].join('\n');
}

function formatKnowledgeReference(item: KnowledgeReference): string {
  return [
    `- ${item.title}`,
    `  - type: ${item.type}`,
    `  - score: ${item.score ?? 0}`,
    `  - matchedAliases: ${item.matchedAliases?.join('、') || '暂无明确命中词'}`,
    `  - matchedTags: ${item.matchedTags?.join('、') || '暂无明确命中词'}`,
    `  - matchedFields: ${item.matchedFields?.join('、') || '暂无明确命中词'}`,
    `  - appliedTo: ${item.appliedTo?.join('、') || '暂无'}`,
    `  - influence: ${item.influence || '暂无'}`,
    `  - reason: ${item.reason}`,
  ].join('\n');
}

function buildMarkdownDownload(handoff: FinalHandoff): string {
  const references = handoff.knowledgeReferences?.length
    ? handoff.knowledgeReferences.map(formatKnowledgeReference).join('\n')
    : '暂无';
  return [
    '# Vibe Copilot Developer Handoff',
    '',
    `- Schema Version: ${handoff.schemaVersion || 'legacy'}`,
    `- Readiness: ${handoff.evaluation?.readiness || 'needs-review'}`,
    `- Score: ${handoff.evaluation?.totalScore || 0} / ${handoff.evaluation?.maxScore || 25}`,
    `- Knowledge References: ${handoff.knowledgeReferences?.length || 0}`,
    `- Generated At: ${new Date().toISOString()}`,
    '',
    '## 0. Knowledge References',
    references,
    '',
    '## 1. Product Brief',
    toDisplayText(handoff.productBrief) || '暂无',
    '',
    '## 2. MVP Scope',
    toDisplayText(handoff.mvpScope) || '暂无',
    '',
    '## 3. DEV_SPEC',
    toDisplayText(handoff.devSpec) || '暂无',
    '',
    '## 4. Technical Architecture',
    toDisplayText(handoff.technicalArchitecture) || '暂无',
    '',
    '## 5. Data Structure',
    toDisplayText(handoff.dataStructure) || '暂无',
    '',
    '## 6. Acceptance Criteria',
    toDisplayText(handoff.acceptanceCriteria) || '暂无',
    '',
    '## 7. Codex Development Prompt',
    toDisplayText(handoff.developmentPrompt) || '暂无',
    '',
    '## 8. Evaluation Report',
    handoff.evaluation ? formatEvaluation(handoff.evaluation) : '暂无',
  ].join('\n\n');
}

function Aside({ view, onViewChange, generating, onGenerate, onDownload, onExportCaseStudy, hasHandoff, error, onSettings, onSwitchAgent, onViewDecisionOutput }: { view: 'focus' | 'detail'; onViewChange: (view: 'focus' | 'detail') => void; generating: boolean; onGenerate: () => void; onDownload: () => void; onExportCaseStudy: () => void; hasHandoff: boolean; error: string; onSettings: () => void; onSwitchAgent: () => void; onViewDecisionOutput: () => void }) {
  return (
    <div className="vp-card" style={{ position: 'sticky', top: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 8 }}>第四关：开发交付</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <button className={view === 'focus' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('focus')}>Focus</button>
        <button className={view === 'detail' ? 'vp-btn vp-btn-primary' : 'vp-btn vp-btn-ghost'} onClick={() => onViewChange('detail')}>Detail</button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
        Development Prompt 包含 14 个部分，可直接交给 Codex / Claude Code / Cursor。
      </p>
      {error && <p style={{ fontSize: 12, color: 'var(--color-danger)', lineHeight: 1.6, marginBottom: 10 }}>{error}</p>}
      {error === AI_NOT_READY_MESSAGE && (
        <button className="vp-btn vp-btn-primary" onClick={onSettings} style={{ width: '100%', marginBottom: 8 }}>
          <Settings size={14} /> 去设置
        </button>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vp-btn vp-btn-primary" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
          {generating ? '正在优化...' : 'AI 优化交付内容'}
        </button>
        <button className="vp-btn vp-btn-ghost" onClick={onDownload} disabled={!hasHandoff}>
          <Download size={14} /> 下载 Markdown
        </button>
        <button className="vp-btn vp-btn-ghost" onClick={onExportCaseStudy} disabled={!hasHandoff}>
          <Download size={14} /> Export Case Study
        </button>
      </div>
      <button className="vp-btn vp-btn-ghost" onClick={onViewDecisionOutput} style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
        <FileText size={14} /> 查看决策输出
      </button>
      <button className="vp-btn vp-btn-ghost" onClick={onSwitchAgent} style={{ width: '100%', marginTop: 8, fontSize: 12 }}>
        <Bot size={14} /> 切换到 Agent 工作流
      </button>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
