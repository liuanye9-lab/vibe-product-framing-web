/**
 * HistoryPage — V2.1
 *
 * Now detects Agent workflows and shows proper entry points:
 * - Continue Agent → /agent/:id
 * - Continue Legacy → /discovery/:id
 * - View Handoff → /handoff/:id
 * - Delete removes both brief and agent workflow
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Clock,
  CheckCircle2,
  ChevronRight,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Inbox,
  Home,
  Brain,
} from 'lucide-react';
import type { ProductBrief } from '../types';
import { getAgentWorkflowSummary, deleteAgentWorkflow } from '../agent/workflowStore';
import { getPhaseLabel } from '../agent/phaseUtils';

const STORAGE_KEY = 'vibepilot_briefs';

function loadAllBriefs(): ProductBrief[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function deleteBrief(id: string) {
  const all = loadAllBriefs();
  const filtered = all.filter((b) => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHr < 24) return `${diffHr} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<ProductBrief[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBriefs(loadAllBriefs().sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [refresh]);

  const handleDelete = (id: string) => {
    deleteBrief(id);
    deleteAgentWorkflow(id);
    setDeleteConfirm(null);
    refresh();
  };

  if (briefs.length === 0) {
    return (
      <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="vp-header">
          <div className="vp-header-inner">
            <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }}>
              <Home size={16} />
            </button>
            <Brain size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontWeight: 500, fontSize: 15 }}>VibePilot</span>
            <span style={{ color: 'var(--color-text-hint)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>历史记录</span>
          </div>
        </header>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Inbox size={28} style={{ color: 'var(--color-text-hint)' }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>还没有任何记录</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
              开始你的第一次产品思维训练，创建一个 Product Brief
            </p>
            <button className="vp-btn vp-btn-primary" onClick={() => navigate('/new')}>
              开始训练 <ChevronRight size={16} />
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }}>
              <Home size={16} />
            </button>
            <Brain size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
            <span style={{ color: 'var(--color-text-hint)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>历史记录</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)', marginLeft: 4 }}>({briefs.length})</span>
          </div>
          <button className="vp-btn vp-btn-primary" onClick={() => navigate('/new')} style={{ padding: '8px 16px', fontSize: 13 }}>
            <FileText size={14} /> 新建
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {briefs.map((brief) => {
              const agentSummary = getAgentWorkflowSummary(brief.id);
              const hasAgent = agentSummary.exists;
              const isPending = deleteConfirm === brief.id;

              return (
                <div
                  key={brief.id}
                  className="vp-card"
                  style={{
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    ...(isPending ? { borderColor: 'var(--color-danger)', background: 'var(--color-background-danger)' } : {}),
                  }}
                  onClick={() => {
                    if (!isPending) navigate(hasAgent ? `/agent/${brief.id}` : `/discovery/${brief.id}`);
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {hasAgent ? (
                          <Bot size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                        ) : (
                          <CheckCircle2 size={14} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                        )}
                        <h3 style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {brief.rawIdea || '未命名项目'}
                        </h3>
                        {hasAgent && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', flexShrink: 0 }}>
                            Agent
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-hint)' }}>
                          <Clock size={12} /> {formatDate(brief.createdAt)}
                        </span>
                        {hasAgent && (
                          <>
                            <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                              {getPhaseLabel(agentSummary.currentPhase || 'intake')}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                              {agentSummary.messageCount} 条消息
                            </span>
                            {agentSummary.findingCount > 0 && (
                              <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                                {agentSummary.findingCount} 个判断
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
                      <span style={{ fontSize: 13, color: 'var(--color-danger)', flex: 1 }}>确定删除这个项目？Agent 工作流也会一并删除。</span>
                      <button className="vp-btn vp-btn-ghost" onClick={() => setDeleteConfirm(null)} style={{ padding: '6px 12px', fontSize: 12 }}>取消</button>
                      <button className="vp-btn vp-btn-primary" onClick={() => handleDelete(brief.id)} style={{ padding: '6px 12px', fontSize: 12, background: 'var(--color-danger)' }}>确认删除</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                      {hasAgent && (
                        <button className="vp-btn vp-btn-primary" onClick={() => navigate(`/agent/${brief.id}`)} style={{ fontSize: 12, padding: '6px 10px' }}>
                          <Bot size={12} /> 继续 Agent
                        </button>
                      )}
                      <button className="vp-btn-text" onClick={() => navigate(`/discovery/${brief.id}`)} style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <RotateCcw size={12} /> {hasAgent ? '四步流程' : '继续编辑'}
                      </button>
                      <button className="vp-btn-text" onClick={() => navigate(`/handoff/${brief.id}`)} style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <FileText size={12} /> 查看交付
                      </button>
                      <button className="vp-btn-text" onClick={() => setDeleteConfirm(brief.id)} style={{ fontSize: 12, padding: '6px 10px', color: 'var(--color-danger)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
