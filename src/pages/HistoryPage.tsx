import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Clock,
  CheckCircle2,
  ChevronRight,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Inbox,
  Home,
} from 'lucide-react';
import type { ProductBrief } from '../types';
import { STEPS } from '../data/steps';

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

function getCompletionInfo(steps: Record<string, ProductBrief['steps'][string]>) {
  let completed = 0;
  let specific = 0;
  for (const s of STEPS) {
    const data = steps[s.key];
    if (data?.userAnswer) completed++;
    if (data?.aiQuality === 'specific') specific++;
  }
  return { completed, specific, total: STEPS.length };
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [briefs, setBriefs] = useState<ProductBrief[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBriefs(loadAllBriefs().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, []);

  useEffect(() => {
    refresh();
    // Listen for storage changes from other tabs
    const handler = () => refresh();
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [refresh]);

  const handleDelete = (id: string) => {
    deleteBrief(id);
    setDeleteConfirm(null);
    refresh();
  };

  const handleContinue = (id: string) => {
    navigate(`/guide/${id}`);
  };

  const handlePreview = (id: string) => {
    navigate(`/preview/${id}`);
  };

  if (briefs.length === 0) {
    return (
      <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="vp-header">
          <div className="vp-header-inner">
            <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
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
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <Inbox size={28} style={{ color: 'var(--color-text-hint)' }} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>还没有任何记录</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
              开始你的第一次产品思维训练，创建一个 Product Brief
            </p>
            <button className="vp-btn vp-btn-primary" onClick={() => navigate('/new')}>
              开始训练
              <ChevronRight size={16} />
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
            <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
              <Home size={16} />
            </button>
            <Brain size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
            <span style={{ color: 'var(--color-text-hint)' }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>历史记录</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)', marginLeft: 4 }}>
              ({briefs.length})
            </span>
          </div>
          <button className="vp-btn vp-btn-primary" onClick={() => navigate('/new')} style={{ padding: '8px 16px', fontSize: 13 }}>
            <FileText size={14} />
            新建
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: '2rem' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {briefs.map((brief) => {
              const info = getCompletionInfo(brief.steps);
              const pct = Math.round((info.completed / info.total) * 100);
              const isComplete = info.completed === info.total;
              const isPending = deleteConfirm === brief.id;

              return (
                <div
                  key={brief.id}
                  className="vp-card"
                  style={{
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    ...(isPending ? { borderColor: 'var(--color-danger)', background: 'var(--color-danger-light)' } : {}),
                  }}
                  onClick={() => !isPending && handlePreview(brief.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        {isComplete ? (
                          <CheckCircle2 size={14} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                        ) : (
                          <FileText size={14} style={{ color: 'var(--color-text-hint)', flexShrink: 0 }} />
                        )}
                        <h3
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {brief.rawIdea || '未命名项目'}
                        </h3>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-hint)' }}>
                          <Clock size={12} />
                          {formatDate(brief.createdAt)}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                          {info.completed} / {info.total} 步完成
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--color-border)', marginBottom: 12, overflow: 'hidden' }}>
                    <div
                      className="vp-progress-fill"
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isComplete ? 'var(--color-success)' : 'var(--color-primary)',
                        borderRadius: 2,
                      }}
                    />
                  </div>

                  {/* Actions */}
                  {isPending ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
                      <AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} />
                      <span style={{ fontSize: 13, color: 'var(--color-danger)', flex: 1 }}>确定删除这个项目？</span>
                      <button
                        className="vp-btn vp-btn-ghost"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        取消
                      </button>
                      <button
                        className="vp-btn vp-btn-primary"
                        onClick={(e) => { e.stopPropagation(); handleDelete(brief.id); }}
                        style={{ padding: '6px 12px', fontSize: 12, background: 'var(--color-danger)' }}
                      >
                        确认删除
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="vp-btn-text"
                        onClick={() => handleContinue(brief.id)}
                        style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <RotateCcw size={12} />
                        继续编辑
                      </button>
                      <button
                        className="vp-btn-text"
                        onClick={() => handlePreview(brief.id)}
                        style={{ fontSize: 12, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        查看预览
                        <ChevronRight size={12} />
                      </button>
                      <button
                        className="vp-btn-text"
                        onClick={() => setDeleteConfirm(brief.id)}
                        style={{ fontSize: 12, padding: '6px 10px', color: 'var(--color-danger)' }}
                      >
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
