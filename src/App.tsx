import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Component, lazy, Suspense, type ReactNode } from 'react';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const NewIdeaPage = lazy(() => import('./pages/NewIdeaPage'));
const GuidePage = lazy(() => import('./pages/GuidePage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));
const OutputPage = lazy(() => import('./pages/OutputPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: 13, color: 'var(--color-text-hint)' }}>加载中...</span>
      </div>
    </div>
  );
}

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
            <button
              className="vp-btn vp-btn-primary"
              onClick={() => {
                window.history.replaceState(null, '', '/');
                window.location.reload();
              }}
            >
              返回首页
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/new" element={<NewIdeaPage />} />
            <Route path="/guide/:id" element={<GuidePage />} />
            <Route path="/preview/:id" element={<PreviewPage />} />
            <Route path="/output/:id" element={<OutputPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}
