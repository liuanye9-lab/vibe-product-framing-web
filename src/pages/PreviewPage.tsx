import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProductBrief } from '../hooks/useProductBrief';
import { STEPS } from '../data/steps';
import { generateDevelopmentPrompt } from '../api/evaluate';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Download,
  Loader2,
  Eye,
  Brain,
  Edit3,
} from 'lucide-react';

export default function PreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, save } = useProductBrief(id);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [generating, setGenerating] = useState(false);

  const toggle = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGeneratePrompt = async () => {
    if (!brief) return;
    setGenerating(true);
    try {
      const prompt = await generateDevelopmentPrompt(brief.rawIdea, brief.steps);
      save({ ...brief, developmentPrompt: prompt });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadMd = () => {
    if (!brief) return;
    let md = `# VibePilot Product Brief\n\n## 产品想法\n${brief.rawIdea}\n\n---\n\n`;
    STEPS.forEach((s) => {
      const data = brief.steps[s.key];
      if (data?.userAnswer) {
        md += `## ${s.title}\n${data.userAnswer}\n\n`;
      }
    });
    if (brief.developmentPrompt) {
      md += `---\n\n## Development Prompt\n\n${brief.developmentPrompt}\n`;
    }
    md += `\n---\n\n*由 VibePilot 生成 — 基于用户自己的思考结果*\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-brief-${brief.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !brief) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Loader2 size={24} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  const completedCount = STEPS.filter((s) => brief.steps[s.key]?.userAnswer).length;

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
            <span style={{ color: 'var(--color-text-hint)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Product Brief 预览</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
            已完成 {completedCount} / {STEPS.length} 步
          </span>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Summary Card */}
          <div className="vp-card" style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>产品想法</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {brief.rawIdea}
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 8,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'var(--color-success-light)',
                color: 'var(--color-success)',
                fontSize: 11,
              }}
            >
              <Edit3 size={10} />
              你自己写的
            </div>
          </div>

          {/* Step Sections */}
          {STEPS.map((s) => {
            const data = brief.steps[s.key];
            if (!data?.userAnswer) return null;
            const isCollapsed = collapsed[s.key];
            return (
              <div className="vp-collapse" key={s.key} style={{ marginBottom: 12 }}>
                <button
                  className="vp-collapse-trigger"
                  onClick={() => toggle(s.key)}
                  style={{ background: 'var(--color-bg)' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                    {s.title}
                    {data.aiQuality === 'specific' && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--color-success-light)',
                          color: 'var(--color-success)',
                        }}
                      >
                        已通过
                      </span>
                    )}
                  </span>
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                {!isCollapsed && (
                  <div className="vp-collapse-content" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--color-text)' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'var(--color-success-light)',
                        color: 'var(--color-success)',
                        fontSize: 11,
                        marginBottom: 8,
                      }}
                    >
                      你自己写的
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{data.userAnswer}</p>
                    {data.aiEvaluation && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>AI 评价：</span>
                          {data.aiEvaluation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Generate Prompt */}
          <div className="vp-card-dashed" style={{ marginTop: 32, textAlign: 'center' }}>
            {!brief.developmentPrompt ? (
              <>
                <Eye size={24} style={{ color: 'var(--color-primary)', marginBottom: 12 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  生成 Development Prompt
                </h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px', lineHeight: 1.6 }}>
                  基于你自己的思考结果，生成一份可以直接交给 Cursor / Claude Code 的开发提示词
                </p>
                <button
                  className="vp-btn vp-btn-primary"
                  onClick={handleGeneratePrompt}
                  disabled={generating}
                  style={{ padding: '12px 28px', fontSize: 14 }}
                >
                  {generating ? (
                    <>
                      <Loader2 size={16} className="vp-spin" />
                      正在生成…
                    </>
                  ) : (
                    '生成开发提示词'
                  )}
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 size={24} style={{ color: 'var(--color-success)', marginBottom: 12 }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Development Prompt 已生成
                </h3>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  <button
                    className="vp-btn vp-btn-primary"
                    onClick={() => navigate(`/output/${id}`)}
                  >
                    查看并复制
                    <ChevronRight size={16} />
                  </button>
                  <button className="vp-btn vp-btn-ghost" onClick={handleDownloadMd}>
                    <Download size={14} />
                    下载 Markdown
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Back to guide */}
          <div style={{ textAlign: 'center', marginTop: 24, paddingBottom: 24 }}>
            <button className="vp-btn-text" onClick={() => navigate(`/guide/${id}`)}>
              返回修改
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
