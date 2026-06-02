/**
 * V5.2 TaskGraph Panel — Shows task graph progress and task list
 *
 * Displays:
 * - Current goal
 * - Total progress percent
 * - Tasks list with status
 * - Current task highlighted
 */

import type { AgentTaskGraph, AgentTask, AgentTaskStatus } from '../taskGraph/taskGraphTypes';

interface TaskGraphPanelProps {
  graph: AgentTaskGraph | null;
}

const STATUS_COLORS: Record<AgentTaskStatus, string> = {
  todo: '#9ca3af',
  planning: '#60a5fa',
  running: '#3b82f6',
  waiting_approval: '#f59e0b',
  blocked: '#ef4444',
  done: '#10b981',
  failed: '#ef4444',
  skipped: '#9ca3af',
};

const STATUS_LABELS: Record<AgentTaskStatus, string> = {
  todo: '待开始',
  planning: '规划中',
  running: '执行中',
  waiting_approval: '等待确认',
  blocked: '阻塞',
  done: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

const ROLE_LABELS: Record<string, string> = {
  orchestrator: '编排器',
  problem: '问题分析',
  user_scenario: '用户场景',
  scope: '范围控制',
  risk: '风险分析',
  tech: '技术约束',
  acceptance: '验收标准',
  handoff: '交付物',
  reviewer: '审查器',
  memory: '记忆',
};

function TaskRow({ task, isCurrent }: { task: AgentTask; isCurrent: boolean }) {
  const statusColor = STATUS_COLORS[task.status] || '#9ca3af';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        borderRadius: 6,
        backgroundColor: isCurrent ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
        border: isCurrent ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
        fontSize: 12,
        transition: 'background-color 0.2s',
      }}
    >
      {/* Status dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: statusColor,
          flexShrink: 0,
        }}
      />

      {/* Task info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: isCurrent ? 600 : 400, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task.title}
        </div>
        <div style={{ color: '#6b7280', fontSize: 11, marginTop: 1 }}>
          {ROLE_LABELS[task.ownerAgent] || task.ownerAgent}
          {task.requiresApproval ? ' · 需确认' : ''}
        </div>
      </div>

      {/* Status badge */}
      <span
        style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          backgroundColor: `${statusColor}15`,
          color: statusColor,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        {STATUS_LABELS[task.status]}
      </span>
    </div>
  );
}

export function TaskGraphPanel({ graph }: TaskGraphPanelProps) {
  if (!graph) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
        无活跃 TaskGraph
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
          Task Graph
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.4 }}>
          {graph.goal.length > 60 ? graph.goal.slice(0, 60) + '...' : graph.goal}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 6,
              backgroundColor: '#e5e7eb',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${graph.progressPercent}%`,
                height: '100%',
                backgroundColor: graph.progressPercent >= 100 ? '#10b981' : '#3b82f6',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, minWidth: 32, textAlign: 'right' }}>
            {graph.progressPercent}%
          </span>
        </div>
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {graph.tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            isCurrent={task.id === graph.currentTaskId}
          />
        ))}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 12 }}>
        <span>{graph.tasks.filter(t => t.status === 'done').length}/{graph.tasks.length} 完成</span>
        <span>{graph.observations.length} 观察</span>
        <span>{graph.approvals.filter(a => a.status === 'pending').length} 待确认</span>
      </div>
    </div>
  );
}

export default TaskGraphPanel;
