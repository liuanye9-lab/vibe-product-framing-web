import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, Copy, Download, Loader2, RefreshCw } from 'lucide-react';
import StageLayout from '../components/StageLayout';
import DecisionCard from '../components/DecisionCard';
import { optimizeHandoff } from '../api/evaluate';
import { useProductBrief } from '../hooks/useProductBrief';
import { extractCoreDecision } from '../rules/coreDecisionExtractor';
import type { FinalHandoff } from '../types';

const SECTIONS: Array<{ key: keyof FinalHandoff; title: string }> = [
  { key: 'productBrief', title: '1. Product Brief' },
  { key: 'mvpScope', title: '2. MVP Scope' },
  { key: 'technicalArchitecture', title: '3. Technical Architecture' },
  { key: 'dataStructure', title: '4. Data Structure' },
  { key: 'acceptanceCriteria', title: '5. Acceptance Criteria' },
  { key: 'developmentPrompt', title: '6. Development Prompt' },
];

export default function DeveloperHandoffPage() {
  const { id } = useParams<{ id: string }>();
  const { brief, loading, saveFinalHandoff } = useProductBrief(id);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState('');
  const [view, setView] = useState<'focus' | 'detail'>('focus');

  const generate = async () => {
    if (!brief || generating) return;
    setGenerating(true);
    try {
      const handoff = await optimizeHandoff(brief);
      saveFinalHandoff(handoff);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!brief || loading) return;
    if (!brief.finalHandoff?.developmentPrompt) generate();
  }, [brief?.id, loading]);

  if (loading || !brief) return <Loader />;

  const handoff = brief.finalHandoff;
  const decision = extractCoreDecision(brief, 'handoff');

  const copyText = async (key: keyof FinalHandoff, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  };

  const download = () => {
    if (!handoff) return;
    const content = `# VibePilot Developer Handoff\n\n${SECTIONS.map((section) => `## ${section.title}\n\n${handoff[section.key]}`).join('\n\n---\n\n')}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibepilot-handoff-${brief.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <StageLayout
      title="Developer Handoff / 开发交付"
      subtitle="最后只判断一件事：这份方案是否已经足够清晰，可以交给 Codex / Claude Code / Cursor 开发。"
      current={3}
      briefId={brief.id}
      previousPath={`/technical/${brief.id}`}
      aside={<Aside view={view} onViewChange={setView} generating={generating} onGenerate={generate} onDownload={download} hasHandoff={Boolean(handoff)} />}
    >
      {view === 'focus' && (
        <DecisionCard
          decision={decision}
          glossaryKey="acceptanceCriteria"
          accepted={Boolean(handoff?.developmentPrompt)}
          loading={generating}
          onAccept={generate}
          onSimplify={generate}
          editableValue={handoff?.developmentPrompt || ''}
          onEdit={() => undefined}
        />
      )}

      {generating && !handoff && (
        <div className="vp-card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Loader2 size={16} className="vp-spin" />
          <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>AI 正在整合最终开发交付内容...</span>
        </div>
      )}

      {view === 'detail' && handoff && SECTIONS.map((section) => (
        <div className="vp-card" key={section.key} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650 }}>{section.title}</h2>
            <button className="vp-btn vp-btn-ghost" onClick={() => copyText(section.key, handoff[section.key])}>
              {copied === section.key ? <Check size={14} /> : <Copy size={14} />}
              {copied === section.key ? '已复制' : '复制'}
            </button>
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13, lineHeight: 1.75, color: 'var(--color-text)', fontFamily: 'inherit' }}>
            {handoff[section.key]}
          </pre>
        </div>
      ))}
    </StageLayout>
  );
}

function Aside({ view, onViewChange, generating, onGenerate, onDownload, hasHandoff }: { view: 'focus' | 'detail'; onViewChange: (view: 'focus' | 'detail') => void; generating: boolean; onGenerate: () => void; onDownload: () => void; hasHandoff: boolean }) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="vp-btn vp-btn-primary" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 size={14} className="vp-spin" /> : <RefreshCw size={14} />}
          {generating ? '正在优化...' : '重新优化交付内容'}
        </button>
        <button className="vp-btn vp-btn-ghost" onClick={onDownload} disabled={!hasHandoff}>
          <Download size={14} /> 下载 Markdown
        </button>
      </div>
    </div>
  );
}

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader2 className="vp-spin" /></div>;
}
