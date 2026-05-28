import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, type ReactNode } from 'react';
import LandingPage from './pages/LandingPage';
import NewIdeaPage from './pages/NewIdeaPage';
import DemandDiscoveryPage from './pages/DemandDiscoveryPage';
import ProductFramingPage from './pages/ProductFramingPage';
import BusinessFramingPage from './pages/BusinessFramingPage';
import TechnicalPlanningPage from './pages/TechnicalPlanningPage';
import MvpScopePage from './pages/MvpScopePage';
import BlindSpotReviewPage from './pages/BlindSpotReviewPage';
import DeveloperHandoffPage from './pages/DeveloperHandoffPage';
import AgentWorkspacePageV4 from './pages/AgentWorkspacePageV4';
import DecisionOutputPage from './pages/DecisionOutputPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[VibePilot] Render error:', error);
  }

  render() {
    if (this.state.error) {
      const clearAndReload = () => {
        try {
          localStorage.removeItem('vibepilot_briefs');
        } catch {
          // ignore storage cleanup failures
        }
        window.history.replaceState(null, '', '/');
        window.location.reload();
      };

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
        >
          <div className="vp-card" style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>页面加载出错</h1>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
              页面没有白屏，说明我们捕获到了运行时错误。你可以先返回首页继续使用。
            </p>
            <pre
              style={{
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                padding: 12,
                borderRadius: 8,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                marginBottom: 16,
              }}
            >
              {this.state.error.message}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="vp-btn vp-btn-primary"
                onClick={() => {
                  window.history.replaceState(null, '', '/');
                  window.location.reload();
                }}
              >
                返回首页
              </button>
              <button className="vp-btn vp-btn-ghost" onClick={clearAndReload}>
                清理本地项目后重试
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function LegacyRedirect({ to }: { to: 'product' | 'handoff' }) {
  const path = window.location.pathname.split('/');
  const id = path[path.length - 1];
  return <Navigate to={`/${to}/${id}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/new" element={<NewIdeaPage />} />
          <Route path="/discovery/:id" element={<DemandDiscoveryPage />} />
          <Route path="/product/:id" element={<ProductFramingPage />} />
          <Route path="/business/:id" element={<BusinessFramingPage />} />
          <Route path="/technical/:id" element={<TechnicalPlanningPage />} />
          <Route path="/scope/:id" element={<MvpScopePage />} />
          <Route path="/blind-spot/:id" element={<BlindSpotReviewPage />} />
          <Route path="/handoff/:id" element={<DeveloperHandoffPage />} />
          <Route path="/agent/:id" element={<AgentWorkspacePageV4 />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/guide/:id" element={<LegacyRedirect to="product" />} />
          <Route path="/preview/:id" element={<LegacyRedirect to="handoff" />} />
          <Route path="/output/:id" element={<DecisionOutputPage />} />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}
