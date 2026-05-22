import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProductBrief } from '../hooks/useProductBrief';
import { ArrowRight, ThumbsDown, ThumbsUp, Home } from 'lucide-react';

export default function NewIdeaPage() {
  const [idea, setIdea] = useState('');
  const { initBrief } = useProductBrief();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const state = location.state as { fromHome?: boolean } | null;
    if (!state?.fromHome) {
      navigate('/', { replace: true });
    }
  }, [location.state, navigate]);

  const handleSubmit = () => {
    if (!idea.trim()) return;
    const brief = initBrief(idea.trim());
    navigate(`/guide/${brief.id}`);
  };

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="vp-header">
        <div className="vp-header-inner">
          <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
            <Home size={16} />
          </button>
          <span style={{ fontWeight: 500, fontSize: 15, color: 'var(--color-text-secondary)' }}>VibePilot</span>
          <span style={{ color: 'var(--color-text-hint)' }}>/</span>
          <span style={{ fontWeight: 500, fontSize: 15 }}>描述你的想法</span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: 640, width: '100%' }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            用 1-3 句话描述你的产品想法
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24, lineHeight: 1.7 }}>
            不用想得太完美，把脑子里最原始的想法写下来就行。后面我们会一步步帮你把它想清楚。
          </p>

          <textarea
            className="vp-textarea vp-textarea-lg"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="比如：我想做一个帮助独立设计师找第一个客户的工具……"
            rows={4}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && idea.trim()) {
                handleSubmit();
              }
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button
              className="vp-btn-cta"
              onClick={handleSubmit}
              disabled={!idea.trim()}
              style={{ padding: '12px 28px' }}
            >
              开始引导
              <ArrowRight size={18} />
            </button>
            {idea.length > 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                {idea.length} 字 · Ctrl+Enter 开始
              </span>
            )}
          </div>

          <div className="vp-card" style={{ marginTop: 48 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 16 }}>
              什么是好想法 vs 坏想法？
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <ThumbsDown size={16} style={{ color: 'var(--color-danger)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--color-danger)', fontWeight: 500, marginBottom: 4 }}>
                    太模糊
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    "我想做一个 AI 工具" —— 没有说明做什么、给谁用、解决什么问题
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flexShrink: 0, marginTop: 2 }}>
                  <ThumbsUp size={16} style={{ color: 'var(--color-success)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 500, marginBottom: 4 }}>
                    有方向
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    "我想做一个帮助独立设计师找到第一个客户的平台，因为新设计师最大的困难是不知道去哪找客户"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
