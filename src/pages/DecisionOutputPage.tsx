import { useMemo, useEffect, useRef, useState } from 'react';
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
import DevSpecPreview from '../components/DevSpecPreview';
import CodexTaskPackPreview from '../components/CodexTaskPackPreview';
import { PageReveal, LiquidCard, LiquidProgress } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';

// V5.2: TaskGraph imports
import type { AgentTaskGraph } from '../agent-v4/taskGraph/taskGraphTypes';
import { getTaskGraph } from '../agent-v4/taskGraph/taskGraphStore';
import { listMemories } from '../agent-v4/taskGraph/memoryRuntime';
import { listSkills } from '../agent-v4/taskGraph/skillLibrary';

export default function DecisionOutputPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading } = useProductBrief(id);

  // V5.2: TaskGraph state
  const [taskGraph, setTaskGraph] = useState<AgentTaskGraph | null>(null);

  useEffect(() => {
    if (id) {
      try {
        const tg = getTaskGraph(id);
        setTaskGraph(tg);
      } catch {
        // non-fatal
      }
    }
  }, [id]);

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
  const totalProgress = phases.length ? Math.round(phases.reduce((sum, p) => sum + p.progressPercent, 0) / phases.length) : 0;

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
    <PageReveal style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Header Hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: 'var(--vp-text)',
            marginBottom: 8,
          }}>
            Decision Output
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 16px' }}>
            从模糊想法到 Codex Task Pack — 每个决策都有痕迹，每一步都可回溯
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ThemeToggle />
            <button className="vp-btn vp-btn-ghost" onClick={() => navigate(`/handoff/${brief.id}`)}>
              <ArrowLeft size={14} /> 返回交付页
            </button>
            <button className="vp-btn vp-btn-primary" onClick={downloadAll}>
              <Download size={14} /> 下载全部
            </button>
          </div>
        </div>

        {/* Progress Card */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650 }}>整体进度</h2>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--vp-blue)' }}>{totalProgress}%</span>
          </div>
          <LiquidProgress percent={totalProgress} />
        </LiquidCard>

        {/* Warning if not all confirmed */}
        {!allConfirmed && (
          <div className="vp-card" style={{ marginBottom: 16, border: '1px solid rgba(255,149,0,0.3)' }}>
            <p style={{ fontSize: 13, color: 'var(--vp-orange)', margin: 0 }}>
              ⚠️ 以下任务包基于未完全确认的需求生成，Codex 执行前建议人工复核。
            </p>
          </div>
        )}

        {/* Quality Score — 8 dimension grid */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650 }}>需求质量评分</h2>
            <span style={{ fontSize: 24, fontWeight: 700, color: quality.total >= 30 ? 'var(--vp-green)' : quality.total >= 20 ? 'var(--vp-orange)' : 'var(--vp-red)' }}>
              {quality.total}/40
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
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
              <div key={dim.label} style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--vp-radius-sm)',
                padding: 12,
                textAlign: 'center',
                background: 'rgba(255,255,255,0.32)',
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: dim.score >= 4 ? 'var(--vp-green)' : dim.score >= 3 ? 'var(--vp-orange)' : 'var(--vp-red)' }}>
                  {dim.score}/5
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>{dim.label}</div>
              </div>
            ))}
          </div>
          {quality.issues.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 650, color: 'var(--color-danger)' }}>问题</h3>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                {quality.issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
            </div>
          )}
        </LiquidCard>

        {/* Ambiguity Issues */}
        {ambiguity.length > 0 && (
          <LiquidCard style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>歧义检测 ({ambiguity.length})</h2>
            <div style={{ display: 'grid', gap: 8 }}>
              {ambiguity.slice(0, 5).map((issue) => (
                <div key={issue.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: issue.severity === 'high' ? 'var(--color-danger)' : issue.severity === 'medium' ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                      [{issue.severity}] {issue.message}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>💡 {issue.question}</p>
                </div>
              ))}
            </div>
          </LiquidCard>
        )}

        {/* Scope Control */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>MVP 范围控制</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600 }}>P0 ({scope.p0.length})</span>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {scope.p0.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--color-text-hint)', fontWeight: 600 }}>Out of Scope</span>
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {scope.outOfScope.slice(0, 8).map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            {scope.scopeRisks.length > 0 && (
              <div>
                <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 600 }}>范围风险</span>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {scope.scopeRisks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </LiquidCard>

        {/* EARS Acceptance Criteria */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>EARS 验收标准</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
            {ears.map((r) => <li key={r.id}>[{r.type}] {r.text}</li>)}
          </ul>
        </LiquidCard>

        {/* DEV_SPEC */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>DEV_SPEC</h2>
          <DevSpecPreview devSpec={devSpec} />
        </LiquidCard>

        {/* CODEX_TASK_PACK */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 8 }}>CODEX_TASK_PACK</h2>
          <CodexTaskPackPreview taskPack={codexTaskPack} />
        </LiquidCard>

        {/* V5.2: Agent Execution Trace */}
        {taskGraph && (
          <LiquidCard style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>Agent 执行追踪</h2>

            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { label: '任务完成', value: `${taskGraph.tasks.filter(t => t.status === 'done').length}/${taskGraph.tasks.length}` },
                { label: '工具调用', value: String(taskGraph.tasks.flatMap(t => t.toolCalls).length) },
                { label: '观察记录', value: String(taskGraph.observations.length) },
                { label: '确认请求', value: String(taskGraph.approvals.length) },
              ].map(stat => (
                <div key={stat.label} style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--vp-radius-sm)',
                  padding: 10,
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.32)',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--vp-blue)' }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Task list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {taskGraph.tasks.map(task => {
                const statusColors: Record<string, string> = {
                  todo: 'var(--color-border)',
                  running: 'var(--vp-blue)',
                  waiting_approval: 'var(--vp-orange)',
                  done: 'var(--vp-green)',
                  failed: 'var(--vp-red)',
                  blocked: 'var(--vp-red)',
                  skipped: 'var(--color-text-hint)',
                  planning: 'var(--vp-blue)',
                };
                return (
                  <div key={task.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--color-border)',
                    background: task.status === 'done' ? 'rgba(52,199,89,0.04)' : 'transparent',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColors[task.status] || 'var(--color-border)',
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{task.title}</span>
                    <span style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>
                      {task.toolCalls.length} 工具 · {task.observations.length} 观察
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Pending approvals warning */}
            {taskGraph.approvals.some(a => a.status === 'pending') && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,149,0,0.3)',
                background: 'rgba(255,149,0,0.04)',
                fontSize: 12,
                color: 'var(--vp-orange)',
              }}>
                ⚠️ 有 {taskGraph.approvals.filter(a => a.status === 'pending').length} 个待确认请求，建议在 Agent 工作区完成确认后再使用此任务包。
              </div>
            )}

            {/* Skills and Memories */}
            {(() => {
              const memories = listMemories({ briefId: brief.id, limit: 5 });
              const skills = listSkills().slice(0, 3);
              return (memories.length > 0 || skills.length > 0) && (
                <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                  {memories.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        决策记忆 ({memories.length})
                      </p>
                      {memories.map(m => (
                        <p key={m.id} style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '2px 0' }}>
                          [{m.type}] {m.title}
                        </p>
                      ))}
                    </div>
                  )}
                  {skills.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                        引用技能
                      </p>
                      {skills.map(s => (
                        <p key={s.id} style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '2px 0' }}>
                          {s.title}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </LiquidCard>
        )}

        {/* Phase Details */}
        <LiquidCard style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, marginBottom: 12 }}>10 阶段决策详情</h2>
          <div style={{ display: 'grid', gap: 4 }}>
            {phases.map((phase) => (
              <div key={phase.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: phase.status === 'confirmed' ? 'rgba(52,199,89,0.06)' : phase.status === 'draft' ? 'rgba(255,149,0,0.04)' : 'transparent',
                border: '1px solid var(--color-border)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: phase.status === 'confirmed' ? 'var(--vp-green)' : phase.status === 'draft' ? 'var(--vp-orange)' : 'var(--color-border)',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 500, flexShrink: 0, width: 90 }}>{phase.label}</span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--color-border)' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: 'var(--vp-blue)', width: `${phase.progressPercent}%` }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{phase.progressPercent}%</span>
                {phase.missingInfo.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--color-warning)' }}>{phase.missingInfo.length} 缺失</span>
                )}
              </div>
            ))}
          </div>
        </LiquidCard>
      </div>
    </PageReveal>
  );
}
