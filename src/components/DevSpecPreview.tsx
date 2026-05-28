import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import type { DevSpec } from '../types';
import { formatDevSpecMarkdown } from '../lib/devSpecBuilder';

interface DevSpecPreviewProps {
  devSpec: DevSpec;
}

const DevSpecPreview = memo(function DevSpecPreview({ devSpec }: DevSpecPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>DEV_SPEC</h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: 999 }}>
            {devSpec.p0Features.length} P0 · {devSpec.p1Features.length} P1
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {open && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <Section title="产品目标" content={devSpec.productGoal} />
          <Section title="目标用户" items={devSpec.targetUsers} />
          <Section title="用户场景" items={devSpec.userScenarios} />
          <Section title="P0 功能（V1 必须实现）" items={devSpec.p0Features} variant="p0" />
          <Section title="P1 功能（V1 建议实现）" items={devSpec.p1Features} variant="p1" />
          <Section title="P2 功能（后续版本）" items={devSpec.p2Features} variant="p2" />
          <Section title="Out of Scope" items={devSpec.outOfScope} variant="out" />
          <Section title="数据实体" items={devSpec.dataEntities} />
          <Section title="核心流程" items={devSpec.coreFlows} numbered />
          <Section title="验收标准" items={devSpec.acceptanceCriteria} />
          <Section title="非功能需求" items={devSpec.nonFunctionalRequirements} />
          <Section title="风险" items={devSpec.risks} variant="risk" />

          <button
            className="vp-btn vp-btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              const text = formatDevSpecMarkdown(devSpec);
              const blob = new Blob([text], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'DEV_SPEC.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ fontSize: 12, alignSelf: 'flex-start' }}
          >
            <Download size={14} /> 下载 DEV_SPEC.md
          </button>
        </div>
      )}
    </div>
  );
});

function Section({ title, content, items, variant, numbered }: {
  title: string;
  content?: string;
  items?: string[];
  variant?: 'p0' | 'p1' | 'p2' | 'out' | 'risk';
  numbered?: boolean;
}) {
  const colors: Record<string, string> = {
    p0: '#EF4444', p1: '#F59E0B', p2: '#3B82F6', out: '#6B7280', risk: '#EF4444',
  };

  return (
    <div>
      <h3 style={{
        fontSize: 12,
        fontWeight: 650,
        color: variant ? colors[variant] || 'var(--color-text)' : 'var(--color-text)',
        marginBottom: 4,
      }}>
        {title}
      </h3>
      {content ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: 0 }}>{content}</p>
      ) : items && items.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          {items.map((item, i) => <li key={i}>{numbered ? `${i + 1}. ${item}` : item}</li>)}
        </ul>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--color-text-hint)', margin: 0 }}>暂无</p>
      )}
    </div>
  );
}

DevSpecPreview.displayName = 'DevSpecPreview';
export default DevSpecPreview;
