import { useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { useProductBrief } from '../hooks/useProductBrief';
import { calculatePhaseProgress } from '../lib/progressCalculator';
import { evaluateRequirementQuality } from '../lib/requirementQuality';
import { detectRequirementAmbiguity } from '../lib/ambiguityDetector';
import { deriveScopeControl } from '../lib/scopeControl';
import { generateEarsAcceptanceCriteria, formatEarsMarkdown } from '../lib/ears';
import { buildDevSpec, formatDevSpecMarkdown } from '../lib/devSpecBuilder';
import { buildCodexTaskPack, formatCodexTaskPackMarkdown } from '../lib/codexTaskPackBuilder';
import { addDecisionLogEntry } from '../lib/decisionLog';
import ProgressBar from '../components/ProgressBar';
import DevSpecPreview from '../components/DevSpecPreview';
import CodexTaskPackPreview from '../components/CodexTaskPackPreview';

export default function DecisionOutputPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading } = useProductBrief(id);

  const data = useMemo(() => {
    if (!brief) return null;
    const phases = calculatePhaseProgress(brief);
    const quality = evaluateRequirementQuality(brief);
    const ambiguity = detectRequirementAmbiguity({
      rawIdea: brief.rawIdea,
      problemFraming: brief.stages.product?.corePainPoint?.value as string,
      userScenario: brief.stages.product?.scenario?.value as string,
      mvpScope: brief.stages.mvp?.mustHave?.value ? (brief.stages.mvp.mustHave.value as string[]).join(', ') : undefined,
      acceptanceCriteria: brief.finalHandoff?.acceptanceCriteria,
    });
    const scope = deriveScopeControl({ rawIdea: brief.rawIdea });
    const ears = generateEarsAcceptanceCriteria({
      p0Features: scope.p0.length ? scope.p0 : (brief.stages.mvp?.mustHave?.value as string[] || []),
      userScenarios: [brief.stages.product?.scenario?.value as string].filter(Boolean),
      outOfScope: scope.outOfScope,
    });
    const devSpec = buildDevSpec(brief);
    const codexTaskPack = buildCodexTaskPack({ devSpec });

    // NOTE: Decision log recording moved to useEffect below (V4.5 fix).
    return { phases, quality, ambiguity, scope, ears, devSpec, codexTaskPack };
  }, [brief]);

  const loggedRef = useRef(false);

  useEffect(() => {
    if (data && brief?.id && !loggedRef.current) {
      loggedRef.current = true;
      addDecisionLogEntry(brief.id, 'devSpec', `Generated DEV_SPEC with ${data.devSpec.p0Features.length} P0 features`);
      addDecisionLogEntry(brief.id, 'codexTaskPack', `Generated CODEX_TASK_PACK with ${data.codexTaskPack.tasks.length} tasks`);
    }
  }, [data, brief?.id]);

  if (loading || !brief || !data) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><p>加载中...</p></div>;
  }

  const { phases, quality, ambiguity, scope, ears, devSpec, codexTaskPack } = data;
  const allConfirmed = phases.every((p) => p.status !== 'empty');

  const downloadAll = () => {
    const content = [
      '# Vibe Decision Copilot — 决策输出包',
      '',
      `> 生成时间: ${new Date().toISOString()}`,
      `> 项目 ID: ${brief.id}`,
      `> 质量评分: ${quality.total}/40`,
      '',
      '---',
      '',
      '## 需求质量评分',
      '',
      `总分: ${quality.total}/40`,
      `清晰度: ${quality.clarity}/5`,
      `具体性: ${quality.specificity}/5`,
      `用户证据: ${quality.userEvidence}/5`,
      `范围控制: ${quality.scopeControl}/5`,
      `可测试性: ${quality.testability}/5`,
      `技术可行性: ${quality.technicalFeasibility}/5`,
      `风险意识: ${quality.riskAwareness}/5`,
      `Codex 可执行性: ${quality.codexExecutability}/5`,
      '',
      ...(quality.issues.length ? ['### 问题', ...quality.issues.map((i) => `- ${i}`)] : []),
      '',
      '---',
      '',
      '## EARS 验收标准',
      '',
      formatEarsMarkdown(ears),
      '',
      '---',
      '',
      formatDevSpecMarkdown(devSpec),
      '',
      '---',
      '',
      formatCodexTaskPackMarkdown(codexTaskPack),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibe-decision-output-${brief.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addDecisionLogEntry(brief.id, 'devSpec', 'Downloaded full decision output');
  };

  return (
    <div className="vp-page" style={{ minHeight: '100vh', padding: '2.5rem 2rem', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <button className="vp-btn vp-btn-ghost" onClick={() => navigate(`/handoff/${brief.id}`)} style={{ marginBottom: 8 }}>
              <ArrowLeft size={14} /> 返回交付页
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--vp-navy)' }}>
              Vibe Decision Copilot
            </h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 6 }}>
              把模糊产品想法转化为 Codex 可执行任务包
            </p>
          </div>
          <button className="vp-btn vp-btn-primary" onClick={downloadAll}>
            <Download size={14} /> 下载全部
          </button>
        </div>

        {/* Progress Bar */}
        <ProgressBar phases={phases} />

        {/* Warning if not all confirmed */}
        {!allConfirmed && (
          <div className="vp-card" style={{ marginBottom: 16, border: '1px solid #F59E0B' }}>
            <p style={{ fontSize: 13, color: '#92400E', margin: 0 }}>
              ⚠️ 以下任务包基于未完全确认的需求生成，Codex 执行前建议人工复核。
            </p>
          </div>
        )}

        {/* Quality Score */}
        <div className="vp-card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 650 }}>需求质量评分</h2>
            <span style={{ fontSize: 24, fontWeight: 700, color: quality.total >= 30 ? 'var(--color-success)' : quality.total >= 20 ? '#F59E0B' : '#EF4444' }}>
              {quality.total}/40
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
            {[
              { label: '清晰度', score: quality.clarity },
              { label: '具体性', score: quality.specificity },
              { label: '用户证据', score: quality.userEvidence },
              { label: '范围控制', score: quality.scopeControl },
              { label: '可测试性', score: quality.testability },
              { label: '技术可行性', score: quality.technicalFeasibility },
              { label: '风险意识', score: quality.riskAwareness },
              { label: 'Codex 可执行', score: quality.codexExecutability },
            ].map((dim) => (
              <div key={dim.label} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{dim.score}/5</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{dim.label}</div>
              </div>
            ))}
          </div>
          {quality.issues.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 650, color: '#EF4444' }}>问题</h3>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {quality.issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Ambiguity Issues */}
        {ambiguity.length > 0 && (
          <div className="vp-card" style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>歧义检测 ({ambiguity.length})</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {ambiguity.slice(0, 5).map((issue) => (
                <div key={issue.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: issue.severity === 'high' ? '#EF4444' : issue.severity === 'medium' ? '#F59E0B' : 'var(--color-text-secondary)' }}>
                      [{issue.severity}] {issue.message}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>💡 {issue.question}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scope Control */}
        <div className="vp-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>MVP 范围控制</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>P0 ({scope.p0.length})</span>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {scope.p0.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div>
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Out of Scope</span>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {scope.outOfScope.slice(0, 8).map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            {scope.scopeRisks.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600 }}>范围风险</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {scope.scopeRisks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* EARS Acceptance Criteria */}
        <div className="vp-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>EARS 验收标准</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            {ears.map((r) => <li key={r.id}>[{r.type}] {r.text}</li>)}
          </ul>
        </div>

        {/* DEV_SPEC */}
        <DevSpecPreview devSpec={devSpec} />

        {/* CODEX_TASK_PACK */}
        <CodexTaskPackPreview taskPack={codexTaskPack} />

        {/* Phase Details */}
        <div className="vp-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>10 阶段决策详情</h2>
          <div style={{ display: 'grid', gap: 4 }}>
            {phases.map((phase) => (
              <div key={phase.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: phase.status === 'confirmed' ? 'rgba(16,185,129,0.06)' : phase.status === 'draft' ? 'rgba(245,158,11,0.04)' : 'transparent',
                border: '1px solid var(--color-border)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: phase.status === 'confirmed' ? '#10B981' : phase.status === 'draft' ? '#F59E0B' : 'var(--color-border)',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 500, flexShrink: 0, width: 90 }}>{phase.label}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--color-border)' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--color-primary)', width: `${phase.progressPercent}%` }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{phase.progressPercent}%</span>
                {phase.missingInfo.length > 0 && (
                  <span style={{ fontSize: 11, color: '#F59E0B' }}>{phase.missingInfo.length} 缺失</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
