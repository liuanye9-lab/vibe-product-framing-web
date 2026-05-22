import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProductBrief } from '../hooks/useProductBrief';
import { Copy, Check, Download, ChevronLeft, Brain } from 'lucide-react';
import { Loader2 } from 'lucide-react';

export default function OutputPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading } = useProductBrief(id);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!brief?.developmentPrompt) return;
    await navigator.clipboard.writeText(brief.developmentPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    if (!brief) return;
    let md = `# VibePilot Product Brief\n\n## 产品想法\n${brief.rawIdea}\n\n---\n\n`;
    md += `## Development Prompt\n\n${brief.developmentPrompt}\n`;
    md += `\n---\n\n*由 VibePilot 生成 — 基于用户自己的思考结果*\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `development-prompt-${brief.id}.md`;
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

  if (!brief.developmentPrompt) {
    navigate(`/preview/${id}`);
    return null;
  }

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="vp-btn-text" onClick={() => navigate(`/preview/${id}`)} style={{ padding: '4px 0' }}>
            <ChevronLeft size={16} />
            预览
          </button>
          <span style={{ color: 'var(--color-text-hint)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Development Prompt</span>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Brain size={20} style={{ color: 'var(--color-primary)' }} />
            <h1 style={{ fontSize: 22, fontWeight: 600 }}>Development Prompt</h1>
          </div>

          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
            这份开发提示词基于你自己的思考生成。你可以直接复制到
            Cursor / Claude Code / Windsurf 开始 vibe coding。
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button className="vp-btn vp-btn-primary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? '已复制' : '一键复制'}
            </button>
            <button className="vp-btn vp-btn-ghost" onClick={handleDownloadMd}>
              <Download size={14} />
              下载 Markdown
            </button>
          </div>

          {/* Prompt Content */}
          <div
            className="vp-card"
            style={{
              overflow: 'auto',
              maxHeight: '70vh',
            }}
          >
            <pre
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                fontFamily: '"SF Mono", "Fira Code", "Fira Mono", Menlo, monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--color-text)',
              }}
            >
              {brief.developmentPrompt}
            </pre>
          </div>

          <div style={{ textAlign: 'center', marginTop: 32, padding: '24px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 500, marginBottom: 8 }}>
              🎉 恭喜你完成了产品思维训练
            </p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
              现在把这份提示词交给 AI 编程工具，开始把想法变成真正的产品。
            </p>
            <button className="vp-btn vp-btn-ghost" onClick={() => navigate('/')} style={{ marginTop: 8 }}>
              开始新的构思
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
