import { memo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Check, Circle } from 'lucide-react';
import type { CodexTaskPack } from '../types';
import { formatCodexTaskPackMarkdown } from '../lib/codexTaskPackBuilder';

interface CodexTaskPackPreviewProps {
  taskPack: CodexTaskPack;
}

const CodexTaskPackPreview = memo(function CodexTaskPackPreview({ taskPack }: CodexTaskPackPreviewProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="vp-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>CODEX_TASK_PACK</h2>
          <span style={{ fontSize: 11, color: 'var(--color-text-hint)', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 999 }}>
            {taskPack.tasks.length} 任务
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {open && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>约束条件</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {taskPack.constraints.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>任务列表</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {taskPack.tasks.map((task) => (
                <div key={task.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{task.id}: {task.name}</strong>
                    <span style={{ fontSize: 11, color: task.priority === 'P0' ? '#EF4444' : task.priority === 'P1' ? '#F59E0B' : '#3B82F6', fontWeight: 600 }}>
                      {task.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0' }}>{task.description}</p>
                  {task.dependencies.length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>依赖: {task.dependencies.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>实现步骤</h3>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {taskPack.implementationSteps.map((step, i) => <li key={i}>{step}</li>)}
            </ol>
          </div>

          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>文件计划</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {taskPack.filePlan.map((f, i) => <li key={i}><code style={{ fontSize: 12 }}>{f.path}</code> — {f.purpose}</li>)}
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650, marginBottom: 4, color: '#EF4444' }}>禁止修改</h3>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              {taskPack.forbiddenChanges.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>

          <div>
            <h3 style={{ fontSize: 12, fontWeight: 650, marginBottom: 4 }}>进度清单</h3>
            <div style={{ display: 'grid', gap: 4 }}>
              {taskPack.progressChecklist.map((p) => (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  {p.done ? <Check size={12} color="var(--color-success)" /> : <Circle size={12} color="var(--color-text-hint)" />}
                  <span style={{ color: p.done ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-hint)', marginLeft: 'auto' }}>{p.percent}%</span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="vp-btn vp-btn-ghost"
            onClick={(e) => {
              e.stopPropagation();
              const text = formatCodexTaskPackMarkdown(taskPack);
              const blob = new Blob([text], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'CODEX_TASK_PACK.md';
              a.click();
              URL.revokeObjectURL(url);
            }}
            style={{ fontSize: 12, alignSelf: 'flex-start' }}
          >
            <Download size={14} /> 下载 CODEX_TASK_PACK.md
          </button>
        </div>
      )}
    </div>
  );
});

CodexTaskPackPreview.displayName = 'CodexTaskPackPreview';
export default CodexTaskPackPreview;
