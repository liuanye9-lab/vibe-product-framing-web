/**
 * Agent Event Timeline — observable event stream.
 *
 * Shows the last 30 events with type, node, time, and summary.
 */

import { type FC } from 'react';
import type { AgentGraphEvent } from '../types';
import { AGENT_NODE_LABELS } from '../types';

interface AgentEventTimelineProps {
  events: AgentGraphEvent[];
  maxEvents?: number;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  user_message: 'var(--color-primary)',
  agent_message: 'var(--color-success)',
  node_started: 'var(--color-text-secondary)',
  node_completed: 'var(--color-success)',
  tool_called: 'var(--color-warning)',
  tool_completed: 'var(--color-success)',
  state_updated: 'var(--color-text-hint)',
  human_interrupt: 'var(--color-danger)',
  checkpoint_created: 'var(--color-text-hint)',
  evaluation_completed: 'var(--color-primary)',
  reflection_created: 'var(--color-primary)',
  ai_call_started: 'var(--color-primary)',
  ai_call_completed: 'var(--color-success)',
  ai_call_failed: 'var(--color-danger)',
  slot_asked: 'var(--color-warning)',
  slot_answered: 'var(--color-success)',
  slot_assumed: 'var(--color-warning)',
  slot_skipped: 'var(--color-text-hint)',
  phase_advanced: 'var(--color-primary)',
  repeated_question_prevented: 'var(--color-warning)',
  user_action_clicked: 'var(--color-text-secondary)',
  error: 'var(--color-danger)',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  user_message: '用户',
  agent_message: 'Agent',
  node_started: '开始',
  node_completed: '完成',
  tool_called: '工具',
  tool_completed: '工具✓',
  state_updated: '状态',
  human_interrupt: '中断',
  checkpoint_created: '快照',
  evaluation_completed: '评估',
  reflection_created: '反思',
  ai_call_started: 'AI 调用',
  ai_call_completed: 'AI ✓',
  ai_call_failed: 'AI ✗',
  slot_asked: '追问',
  slot_answered: '回答',
  slot_assumed: '假设',
  slot_skipped: '跳过',
  phase_advanced: '推进',
  repeated_question_prevented: '防重复',
  user_action_clicked: '操作',
  error: '错误',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const AgentEventTimeline: FC<AgentEventTimelineProps> = ({
  events,
  maxEvents = 30,
}) => {
  const recent = events.slice(-maxEvents).reverse();

  if (recent.length === 0) {
    return (
      <div style={{ padding: 8, fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center' }}>
        暂无事件
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 300, overflowY: 'auto' }}>
      {recent.map((event) => {
        const color = EVENT_TYPE_COLORS[event.type] || 'var(--color-text-hint)';
        const label = EVENT_TYPE_LABELS[event.type] || event.type;
        const nodeLabel = event.nodeId ? (AGENT_NODE_LABELS[event.nodeId] || event.nodeId) : '';

        return (
          <div
            key={event.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 6px',
              fontSize: 10,
              fontFamily: 'monospace',
              borderRadius: 4,
              background: event.type === 'error' ? 'var(--color-background-danger)' : 'transparent',
            }}
          >
            <span style={{ color: 'var(--color-text-hint)', minWidth: 50 }}>
              {formatTime(event.createdAt)}
            </span>
            <span
              style={{
                padding: '0 4px',
                borderRadius: 3,
                background: color + '20',
                color,
                fontWeight: 500,
                fontSize: 9,
              }}
            >
              {label}
            </span>
            {nodeLabel && (
              <span style={{ color: 'var(--color-text-hint)', fontSize: 9 }}>
                {nodeLabel}
              </span>
            )}
            <span
              style={{
                color: 'var(--color-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {event.message?.slice(0, 60)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
