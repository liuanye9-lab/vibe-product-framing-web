/**
 * Agent Task Board — task management panel.
 *
 * Shows tasks by status: todo, doing, blocked, done, skipped.
 * Tasks come from AgentCommand CREATE_TASK and node local rules.
 */

import { type FC } from 'react';
import { Check, AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import type { AgentGraphTask } from '../types';

interface AgentTaskBoardProps {
  tasks: AgentGraphTask[];
  onToggleTask?: (taskId: string, newStatus: 'done' | 'skipped' | 'todo') => void;
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'var(--color-text-hint)',
  doing: 'var(--color-primary)',
  blocked: 'var(--color-danger)',
  done: 'var(--color-success)',
  skipped: 'var(--color-text-hint)',
};

export const AgentTaskBoard: FC<AgentTaskBoardProps> = ({ tasks, onToggleTask }) => {
  if (tasks.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center' }}>
        暂无任务
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');
  const doneTasks = tasks.filter((t) => t.status === 'done' || t.status === 'skipped');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
      {activeTasks.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', marginBottom: 4 }}>
            进行中 ({activeTasks.length})
          </p>
          {activeTasks.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggleTask} />
          ))}
        </div>
      )}
      {doneTasks.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-hint)', marginBottom: 4, marginTop: 4 }}>
            已完成 ({doneTasks.length})
          </p>
          {doneTasks.slice(0, 5).map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggleTask} />
          ))}
        </div>
      )}
    </div>
  );
};

function TaskRow({
  task,
  onToggle,
}: {
  task: AgentGraphTask;
  onToggle?: (taskId: string, newStatus: 'done' | 'skipped' | 'todo') => void;
}) {
  const color = STATUS_COLORS[task.status] || 'var(--color-text-hint)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        padding: '4px 6px',
        fontSize: 11,
        borderRadius: 4,
        borderBottom: '0.5px solid var(--color-border)',
      }}
    >
      <span style={{ color, flexShrink: 0, marginTop: 1 }}>
        {task.status === 'done' ? <Check size={12} /> : task.status === 'blocked' ? <AlertCircle size={12} /> : task.status === 'doing' ? <Loader2 size={12} className="vp-spin" /> : <ChevronRight size={12} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: 'var(--color-text)' }}>{task.title}</span>
        {task.required && (
          <span style={{ color: 'var(--color-danger)', fontSize: 9, marginLeft: 4 }}>必做</span>
        )}
      </div>
      {onToggle && task.status !== 'done' && (
        <button
          className="vp-btn-text"
          onClick={() => onToggle(task.id, 'done')}
          style={{ fontSize: 9, padding: '0 4px', flexShrink: 0 }}
        >
          完成
        </button>
      )}
    </div>
  );
}
