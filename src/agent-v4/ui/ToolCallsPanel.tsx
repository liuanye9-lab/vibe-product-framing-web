/**
 * V5.2 Tool Calls Panel — Shows recent tool calls with status and metadata
 *
 * Displays:
 * - toolName
 * - permissionLevel
 * - status (success/fail)
 * - startedAt / completedAt
 * - error message
 */

import type { AgentToolCallRecord, ToolPermissionLevel } from '../taskGraph/taskGraphTypes';

interface ToolCallsPanelProps {
  toolCalls: AgentToolCallRecord[];
}

const PERMISSION_COLORS: Record<ToolPermissionLevel, string> = {
  read: '#10b981',
  write_state: '#3b82f6',
  generate_artifact: '#8b5cf6',
  external_ai: '#f59e0b',
  dangerous: '#ef4444',
};

const PERMISSION_LABELS: Record<ToolPermissionLevel, string> = {
  read: '读取',
  write_state: '写入状态',
  generate_artifact: '生成产物',
  external_ai: '外部 AI',
  dangerous: '危险',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso.slice(11, 19);
  }
}

export function ToolCallsPanel({ toolCalls }: ToolCallsPanelProps) {
  if (toolCalls.length === 0) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
        暂无工具调用记录
      </div>
    );
  }

  // Show most recent first, max 20
  const recent = toolCalls.slice(-20).reverse();

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 10 }}>
        Tool Calls ({toolCalls.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recent.map(tc => (
          <div
            key={tc.id}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              backgroundColor: tc.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${tc.success ? '#dcfce7' : '#fecaca'}`,
              fontSize: 12,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {/* Success/fail icon */}
              <span style={{ fontSize: 14 }}>{tc.success ? '✓' : '✗'}</span>

              {/* Tool name */}
              <span style={{ fontWeight: 600, color: '#1f2937', fontFamily: 'monospace' }}>
                {tc.toolName}
              </span>

              {/* Permission badge */}
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 3,
                  backgroundColor: `${PERMISSION_COLORS[tc.permissionLevel]}15`,
                  color: PERMISSION_COLORS[tc.permissionLevel],
                  fontWeight: 500,
                }}
              >
                {PERMISSION_LABELS[tc.permissionLevel]}
              </span>
            </div>

            {/* Time */}
            <div style={{ color: '#6b7280', fontSize: 11 }}>
              {formatTime(tc.startedAt)}
              {tc.completedAt ? ` → ${formatTime(tc.completedAt)}` : ''}
            </div>

            {/* Error */}
            {tc.error && (
              <div style={{ color: '#ef4444', fontSize: 11, marginTop: 3, lineHeight: 1.3 }}>
                {tc.error.length > 120 ? tc.error.slice(0, 120) + '...' : tc.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ToolCallsPanel;
