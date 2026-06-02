/**
 * V5.2 Approvals Panel — Shows pending and resolved approvals
 *
 * Displays:
 * - Pending approvals with approve/reject buttons
 * - Resolved approvals (approved/rejected)
 */

import type { HumanApproval } from '../taskGraph/taskGraphTypes';

interface ApprovalsPanelProps {
  approvals: HumanApproval[];
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string, reason: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  approved: '已通过',
  rejected: '已拒绝',
};

export function ApprovalsPanel({ approvals, onApprove, onReject }: ApprovalsPanelProps) {
  if (approvals.length === 0) {
    return (
      <div style={{ padding: 16, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
        暂无确认请求
      </div>
    );
  }

  const pending = approvals.filter(a => a.status === 'pending');
  const resolved = approvals.filter(a => a.status !== 'pending');

  return (
    <div style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', marginBottom: 10 }}>
        Approvals ({pending.length} pending)
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {pending.map(approval => (
            <div
              key={approval.id}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                fontSize: 12,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>⏳</span>
                <span style={{ fontWeight: 600, color: '#1f2937' }}>{approval.title}</span>
              </div>

              {/* Description */}
              <div style={{ color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>
                {approval.description}
              </div>

              {/* Required before */}
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
                需要在「{approval.requiredBefore}」之前确认
              </div>

              {/* Action buttons */}
              {onApprove && onReject && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => onApprove(approval.id)}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: '#10b981',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    通过
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('请输入拒绝原因:');
                      if (reason) onReject(approval.id, reason);
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #e5e7eb',
                      backgroundColor: 'white',
                      color: '#374151',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resolved approvals */}
      {resolved.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>
            历史记录
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {resolved.slice(-10).reverse().map(approval => (
              <div
                key={approval.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  borderRadius: 4,
                  backgroundColor: '#f9fafb',
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: STATUS_COLORS[approval.status],
                  }}
                />
                <span style={{ flex: 1, color: '#374151' }}>{approval.title}</span>
                <span style={{ color: STATUS_COLORS[approval.status], fontWeight: 500 }}>
                  {STATUS_LABELS[approval.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalsPanel;
