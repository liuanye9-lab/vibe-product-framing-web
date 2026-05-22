import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const NewIdeaPage = lazy(() => import('./pages/NewIdeaPage'));
const GuidePage = lazy(() => import('./pages/GuidePage'));
const PreviewPage = lazy(() => import('./pages/PreviewPage'));
const OutputPage = lazy(() => import('./pages/OutputPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

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

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/new" element={<NewIdeaPage />} />
          <Route path="/guide/:id" element={<GuidePage />} />
          <Route path="/preview/:id" element={<PreviewPage />} />
          <Route path="/output/:id" element={<OutputPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
