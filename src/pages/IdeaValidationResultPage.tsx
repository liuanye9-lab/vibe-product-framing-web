/**
 * Idea Validation Result Page — V6.0
 *
 * Displays the full validation report for an Idea Validation task.
 * Shows: Idea Summary, Research Results, Evaluation, Decision.
 *
 * UI: Minimalist monochrome, iOS frosted glass, clear sections.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Home,
  History,
  ArrowLeft,
  Package,
  FileText,
  Building2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Download,
  ExternalLink,
  Copy,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { getIdeaValidationTask } from '../storage/ideaValidationStorage';
import { ensureProductBriefFromIdeaValidationTask } from '../storage/ideaValidationHandoff';
import { getLastAITiming } from '../api/aiDiagnostics';
import type {
  IdeaValidationTask,
  GitHubReference,
  PaperReference,
  CompetitorReference,
  OpportunityEvaluation,
  FinalValidationDecision,
} from '../types/ideaValidation';
import {
  IDEA_GOAL_LABELS,
  VALIDATION_DECISION_LABELS,
} from '../types/ideaValidation';
import ThemeToggle from '../components/ThemeToggle';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IdeaValidationResultPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<IdeaValidationTask | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      const existing = getIdeaValidationTask(id);
      if (existing) {
        setTask(existing);
      } else {
        navigate('/validate');
      }
    }
  }, [id, navigate]);

  if (!task) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--vp-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--vp-text-secondary)' }}>加载中...</div>
      </div>
    );
  }

  // ─── Export Markdown ──────────────────────────────────────────────────────

  function exportMarkdown() {
    const md = buildMarkdownReport(task!);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `idea-validation-${task!.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyToClipboard() {
    const md = buildMarkdownReport(task!);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openDevSpec() {
    const briefId = ensureProductBriefFromIdeaValidationTask(task!);
    navigate(`/output/${briefId}`);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: 'var(--vp-bg)' }}>
      {/* Header */}
      <header className="vp-header">
        <div className="vp-header-inner">
          <button className="vp-btn-text" onClick={() => navigate('/validate')} style={{ padding: '4px 6px' }}>
            <ArrowLeft size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>验证报告</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <ThemeToggle />
            <button className="vp-btn-text" onClick={copyToClipboard} style={{ padding: '4px 6px' }}>
              <Copy size={16} />
            </button>
            <button className="vp-btn-text" onClick={exportMarkdown} style={{ padding: '4px 6px' }}>
              <Download size={16} />
            </button>
            <button className="vp-btn-text" onClick={() => navigate('/history')} style={{ padding: '4px 6px' }}>
              <History size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
        {/* Copied Toast */}
        {copied && (
          <div
            style={{
              position: 'fixed',
              top: 60,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--vp-success)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              zIndex: 1000,
            }}
          >
            已复制到剪贴板
          </div>
        )}

        {/* Idea Summary */}
        <Section title="想法概要" icon={<Lightbulb size={16} />}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--vp-text)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{task.clarifiedIdea ?? task.rawIdea}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <InfoItem label="目标类型" value={IDEA_GOAL_LABELS[task.goalType]} />
              <InfoItem label="目标用户" value={task.targetUser ?? '未指定'} />
              <InfoItem label="使用场景" value={task.useCase ?? '未指定'} />
              <InfoItem label="成功标准" value={task.successDefinition ?? '未指定'} />
            </div>
          </div>
        </Section>

        <Section title="API 状态" icon={<Activity size={16} />}>
          <ApiStatusPanel />
        </Section>

        <Section title="Agent 节点进度" icon={<ShieldCheck size={16} />}>
          <NodeProgressPanel task={task} />
        </Section>

        {/* Decision */}
        {task.decision && (
          <Section title="最终决策" icon={<CheckCircle2 size={16} />}>
            <DecisionCard decision={task.decision} />
          </Section>
        )}

        {/* Evaluation */}
        {task.evaluation && (
          <Section title="机会评估" icon={<BarChart3 size={16} />}>
            <EvaluationCard evaluation={task.evaluation} />
          </Section>
        )}

        {task.evaluatorReport && (
          <Section title="Evaluator 结构化输出" icon={<ShieldCheck size={16} />}>
            <EvaluatorReportPanel task={task} />
          </Section>
        )}

        {/* GitHub References */}
        {task.research.githubRepos.length > 0 && (
          <Section
            title={`GitHub 开源项目 (${task.research.githubRepos.length})`}
            icon={<Package size={16} />}
          >
            <ReferenceList
              items={task.research.githubRepos}
              renderItem={(repo) => <GitHubRepoCard key={repo.id} repo={repo} />}
            />
          </Section>
        )}

        {/* Paper References */}
        {task.research.papers.length > 0 && (
          <Section
            title={`学术论文 (${task.research.papers.length})`}
            icon={<FileText size={16} />}
          >
            <ReferenceList
              items={task.research.papers}
              renderItem={(paper) => <PaperCard key={paper.id} paper={paper} />}
            />
          </Section>
        )}

        {/* Competitor References */}
        {task.research.competitors.length > 0 && (
          <Section
            title={`竞品/公司 (${task.research.competitors.length})`}
            icon={<Building2 size={16} />}
          >
            <ReferenceList
              items={task.research.competitors}
              renderItem={(comp) => <CompetitorCard key={comp.id} competitor={comp} />}
            />
          </Section>
        )}

        {/* Missing Evidence */}
        {task.evaluation?.missingEvidence && task.evaluation.missingEvidence.length > 0 && (
          <Section title="缺失证据" icon={<AlertTriangle size={16} />}>
            <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
              {task.evaluation.missingEvidence.map((e, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--vp-text-secondary)', lineHeight: 1.6 }}>
                  {e}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          {task.decision?.shouldGenerateDevSpec && (
            <button
              className="vp-btn vp-btn-primary"
              onClick={openDevSpec}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <FileText size={14} />
              生成 DEV_SPEC
            </button>
          )}
          <button
            className="vp-btn vp-btn-ghost"
            onClick={() => navigate(`/validate/${task.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={14} />
            继续验证
          </button>
          <button
            className="vp-btn vp-btn-ghost"
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Home size={14} />
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Component ───────────────────────────────────────────────────────

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="vp-card" style={{ padding: 20, marginBottom: 16 }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--vp-text)',
        }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Info Item ────────────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--vp-text)' }}>{value}</div>
    </div>
  );
}

function ApiStatusPanel() {
  const timing = getLastAITiming();

  if (!timing) {
    return (
      <div style={{ fontSize: 13, color: 'var(--vp-text-secondary)', lineHeight: 1.6 }}>
        暂无 API 调用记录。请先在设置页运行「测试并保存 API」，或完成一次 Agent 分析。
      </div>
    );
  }

  const rows = [
    ['状态', timing.ok ? 'OK' : 'Failed'],
    ['HTTP', String(timing.status)],
    ['模型', timing.model],
    ['Endpoint', timing.normalizedEndpoint ?? timing.endpoint],
    ['总耗时', `${timing.durationMs}ms`],
    ['上游耗时', `${timing.upstreamDurationMs}ms`],
    ['错误分类', timing.errorCategory ?? '-'],
    ['更新时间', new Date(timing.timestamp).toLocaleString('zh-CN')],
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
      {rows.map(([label, value]) => (
        <InfoItem key={label} label={label} value={value} />
      ))}
      {timing.errorMessage && (
        <div style={{ gridColumn: '1 / -1' }}>
          <InfoItem label="错误信息" value={timing.errorMessage} />
        </div>
      )}
      {timing.requestDebug && (
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 6 }}>请求调试信息</div>
          <JsonBlock value={timing.requestDebug} />
        </div>
      )}
    </div>
  );
}

function NodeProgressPanel({ task }: { task: IdeaValidationTask }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {task.nodes.map((node) => (
        <div
          key={node.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 80px',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--vp-text)' }}>{node.title}</span>
          <div
            style={{
              height: 6,
              background: 'var(--vp-border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${node.progressPercent}%`,
                height: '100%',
                background: node.status === 'failed'
                  ? 'var(--vp-error)'
                  : node.status === 'completed'
                    ? 'var(--vp-success)'
                    : 'var(--vp-primary)',
              }}
            />
          </div>
          <span style={{ color: 'var(--vp-text-secondary)', textAlign: 'right' }}>
            {node.status} · {node.progressPercent}%
          </span>
        </div>
      ))}
    </div>
  );
}

function EvaluatorReportPanel({ task }: { task: IdeaValidationTask }) {
  if (!task.evaluatorReport) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <InfoItem label="完整性" value={`${task.evaluatorReport.completenessScore}/100`} />
        <InfoItem label="可行性" value={`${task.evaluatorReport.feasibilityScore}/100`} />
        <InfoItem label="证据强度" value={`${task.evaluatorReport.evidenceScore}/100`} />
        <InfoItem label="准备度" value={`${task.evaluatorReport.decisionReadinessScore}/100`} />
      </div>
      <div style={{ fontSize: 13, color: 'var(--vp-text)', lineHeight: 1.6 }}>
        {task.evaluatorReport.summary}
      </div>
      <JsonBlock value={task.evaluatorReport} />
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        maxHeight: 420,
        overflow: 'auto',
        borderRadius: 8,
        border: '1px solid var(--vp-border)',
        background: 'var(--vp-surface)',
        color: 'var(--vp-text-secondary)',
        fontSize: 11,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ─── Decision Card ───────────────────────────────────────────────────────────

function DecisionCard({ decision }: { decision: FinalValidationDecision }) {
  const decisionColors: Record<string, string> = {
    do: 'var(--vp-success)',
    do_not_do: 'var(--vp-error)',
    validate_first: 'var(--vp-warning)',
    pivot: 'var(--vp-primary)',
  };

  return (
    <div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 8,
          background: decisionColors[decision.decision] + '20',
          color: decisionColors[decision.decision],
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 12,
        }}
      >
        {VALIDATION_DECISION_LABELS[decision.decision]}
      </div>

      <div style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>{decision.recommendation}</div>

      {decision.bestPositioning && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 4 }}>最佳定位</div>
          <div style={{ fontSize: 13 }}>{decision.bestPositioning}</div>
        </div>
      )}

      {decision.why.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 4 }}>理由</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            {decision.why.map((w, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {decision.nextValidationActions.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 4 }}>下一步行动</div>
          <ol style={{ margin: 0, padding: '0 0 0 16px' }}>
            {decision.nextValidationActions.map((a, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{a}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ─── Evaluation Card ─────────────────────────────────────────────────────────

function EvaluationCard({ evaluation }: { evaluation: OpportunityEvaluation }) {
  const metrics = [
    { label: '需求强度', value: evaluation.demandStrength },
    { label: '用户清晰度', value: evaluation.userClarity },
    { label: '竞品成熟度', value: evaluation.competitorMaturity },
    { label: '差异化空间', value: evaluation.differentiationSpace },
    { label: '技术可行性', value: evaluation.technicalFeasibility },
    { label: '商业化潜力', value: evaluation.commercializationPotential },
    { label: '作品集价值', value: evaluation.portfolioValue },
    { label: 'Agent 价值', value: evaluation.agentWorkflowValue },
  ];

  return (
    <div>
      {/* Overall Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--vp-text)' }}>
          {evaluation.overallScore}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>总分</div>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)' }}>加权平均</div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {metrics.map((m) => (
          <div key={m.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--vp-text-secondary)' }}>{m.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{m.value}</span>
            </div>
            <div
              style={{
                height: 4,
                background: 'var(--vp-border)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${m.value}%`,
                  height: '100%',
                  background:
                    m.value >= 70
                      ? 'var(--vp-success)'
                      : m.value >= 40
                        ? 'var(--vp-warning)'
                        : 'var(--vp-error)',
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Key Reasons */}
      {evaluation.keyReasons.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 4 }}>关键理由</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            {evaluation.keyReasons.map((r, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--vp-success)' }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Risks */}
      {evaluation.keyRisks.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', marginBottom: 4 }}>关键风险</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
            {evaluation.keyRisks.map((r, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--vp-error)' }}>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Reference List ──────────────────────────────────────────────────────────

function ReferenceList<T>({
  items,
  renderItem,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item) => renderItem(item))}
    </div>
  );
}

// ─── GitHub Repo Card ────────────────────────────────────────────────────────

function GitHubRepoCard({ repo }: { repo: GitHubReference }) {
  return (
    <a
      href={repo.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        padding: '12px',
        background: 'var(--vp-surface)',
        borderRadius: 8,
        border: '1px solid var(--vp-border)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Package size={14} style={{ color: 'var(--vp-text-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{repo.fullName}</span>
        <ExternalLink size={12} style={{ color: 'var(--vp-text-secondary)', marginLeft: 'auto' }} />
      </div>
      {repo.description && (
        <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', lineHeight: 1.4, marginBottom: 6 }}>
          {repo.description}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--vp-text-secondary)' }}>
        {repo.stars && <span>⭐ {repo.stars.toLocaleString()}</span>}
        {repo.language && <span>{repo.language}</span>}
        {repo.license && <span>{repo.license}</span>}
      </div>
      {repo.whatItDoes && (
        <div style={{ fontSize: 12, marginTop: 6, color: 'var(--vp-text)' }}>
          <strong>作用：</strong> {repo.whatItDoes}
        </div>
      )}
    </a>
  );
}

// ─── Paper Card ──────────────────────────────────────────────────────────────

function PaperCard({ paper }: { paper: PaperReference }) {
  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--vp-surface)',
        borderRadius: 8,
        border: '1px solid var(--vp-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <FileText size={14} style={{ color: 'var(--vp-text-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{paper.title}</span>
      </div>
      {paper.authors && paper.authors.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--vp-text-secondary)', marginBottom: 4 }}>
          {paper.authors.slice(0, 3).join(', ')}
          {paper.authors.length > 3 ? ' 等' : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--vp-text-secondary)', marginBottom: 6 }}>
        {paper.year && <span>{paper.year}</span>}
        {paper.url && (
          <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--vp-primary)' }}>
            查看原文
          </a>
        )}
      </div>
      {paper.summary && (
        <div style={{ fontSize: 12, color: 'var(--vp-text)', lineHeight: 1.4 }}>{paper.summary}</div>
      )}
    </div>
  );
}

// ─── Competitor Card ─────────────────────────────────────────────────────────

function CompetitorCard({ competitor }: { competitor: CompetitorReference }) {
  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--vp-surface)',
        borderRadius: 8,
        border: '1px solid var(--vp-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Building2 size={14} style={{ color: 'var(--vp-text-secondary)' }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{competitor.name}</span>
        {competitor.url && (
          <a href={competitor.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--vp-primary)', marginLeft: 'auto' }}>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      {competitor.positioning && (
        <div style={{ fontSize: 12, color: 'var(--vp-text-secondary)', lineHeight: 1.4, marginBottom: 6 }}>
          {competitor.positioning}
        </div>
      )}
      {competitor.strengths.length > 0 && (
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          <strong>优势：</strong> {competitor.strengths.join('；')}
        </div>
      )}
      {competitor.opportunityGap.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--vp-success)' }}>
          <strong>差异化机会：</strong> {competitor.opportunityGap.join('；')}
        </div>
      )}
    </div>
  );
}

// ─── Markdown Report Builder ─────────────────────────────────────────────────

function buildMarkdownReport(task: IdeaValidationTask): string {
  const lines: string[] = [];

  lines.push('# Idea Validation Report');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  // Idea Summary
  lines.push('## 想法概要');
  lines.push('');
  lines.push(`**想法：** ${task.clarifiedIdea ?? task.rawIdea}`);
  lines.push(`**目标类型：** ${IDEA_GOAL_LABELS[task.goalType]}`);
  lines.push(`**目标用户：** ${task.targetUser ?? '未指定'}`);
  lines.push(`**使用场景：** ${task.useCase ?? '未指定'}`);
  lines.push(`**成功标准：** ${task.successDefinition ?? '未指定'}`);
  lines.push('');

  // Decision
  if (task.decision) {
    lines.push('## 最终决策');
    lines.push('');
    lines.push(`**决策：** ${VALIDATION_DECISION_LABELS[task.decision.decision]}`);
    lines.push(`**建议：** ${task.decision.recommendation}`);
    lines.push(`**最佳定位：** ${task.decision.bestPositioning}`);
    lines.push('');
    lines.push('**理由：**');
    task.decision.why.forEach((w) => lines.push(`- ${w}`));
    lines.push('');
    lines.push('**下一步行动：**');
    task.decision.nextValidationActions.forEach((a, i) => lines.push(`${i + 1}. ${a}`));
    lines.push('');
  }

  // Evaluation
  if (task.evaluation) {
    lines.push('## 机会评估');
    lines.push('');
    lines.push(`**总分：** ${task.evaluation.overallScore}/100`);
    lines.push('');
    lines.push('| 维度 | 分数 |');
    lines.push('|------|------|');
    lines.push(`| 需求强度 | ${task.evaluation.demandStrength} |`);
    lines.push(`| 用户清晰度 | ${task.evaluation.userClarity} |`);
    lines.push(`| 竞品成熟度 | ${task.evaluation.competitorMaturity} |`);
    lines.push(`| 差异化空间 | ${task.evaluation.differentiationSpace} |`);
    lines.push(`| 技术可行性 | ${task.evaluation.technicalFeasibility} |`);
    lines.push(`| 商业化潜力 | ${task.evaluation.commercializationPotential} |`);
    lines.push('');

    if (task.evaluation.keyReasons.length > 0) {
      lines.push('**关键理由：**');
      task.evaluation.keyReasons.forEach((r) => lines.push(`- ${r}`));
      lines.push('');
    }

    if (task.evaluation.keyRisks.length > 0) {
      lines.push('**关键风险：**');
      task.evaluation.keyRisks.forEach((r) => lines.push(`- ${r}`));
      lines.push('');
    }
  }

  if (task.evaluatorReport) {
    lines.push('## Evaluator 结构化输出');
    lines.push('');
    lines.push(`**准备度：** ${task.evaluatorReport.overallScore}/100`);
    lines.push(`**是否值得做：** ${VALIDATION_DECISION_LABELS[task.evaluatorReport.worthDoingDecision]}`);
    lines.push(`**理由：** ${task.evaluatorReport.worthDoingReason}`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(task.evaluatorReport, null, 2));
    lines.push('```');
    lines.push('');
  }

  // GitHub References
  if (task.research.githubRepos.length > 0) {
    lines.push('## GitHub 开源项目');
    lines.push('');
    task.research.githubRepos.forEach((repo) => {
      lines.push(`### [${repo.fullName}](${repo.url})`);
      lines.push(`⭐ ${repo.stars ?? 0} | ${repo.language ?? 'Unknown'}`);
      lines.push(repo.description);
      if (repo.whatItDoes) lines.push(`**作用：** ${repo.whatItDoes}`);
      lines.push('');
    });
  }

  // Paper References
  if (task.research.papers.length > 0) {
    lines.push('## 学术论文');
    lines.push('');
    task.research.papers.forEach((paper) => {
      lines.push(`### ${paper.title}`);
      if (paper.authors) lines.push(`**作者：** ${paper.authors.join(', ')}`);
      if (paper.year) lines.push(`**年份：** ${paper.year}`);
      if (paper.summary) lines.push(paper.summary);
      lines.push('');
    });
  }

  // Competitor References
  if (task.research.competitors.length > 0) {
    lines.push('## 竞品/公司');
    lines.push('');
    task.research.competitors.forEach((comp) => {
      lines.push(`### ${comp.name}`);
      if (comp.url) lines.push(`**链接：** ${comp.url}`);
      if (comp.positioning) lines.push(`**定位：** ${comp.positioning}`);
      if (comp.strengths.length > 0) lines.push(`**优势：** ${comp.strengths.join('；')}`);
      if (comp.opportunityGap.length > 0) lines.push(`**差异化机会：** ${comp.opportunityGap.join('；')}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}
