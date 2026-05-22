import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import NewIdeaPage from './pages/NewIdeaPage';
import GuidePage from './pages/GuidePage';
import PreviewPage from './pages/PreviewPage';
import OutputPage from './pages/OutputPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/new" element={<NewIdeaPage />} />
        <Route path="/guide/:id" element={<GuidePage />} />
        <Route path="/preview/:id" element={<PreviewPage />} />
        <Route path="/output/:id" element={<OutputPage />} />
      </Routes>
    </BrowserRouter>
  );
}
