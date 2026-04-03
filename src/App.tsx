import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Downloads from './pages/Downloads';
import Settings from './pages/Settings';
import Influencer from './pages/Influencer';
import About from './pages/About';
import KOCAnalysis from './pages/KOCAnalysis';
import { useDownloadStore } from './stores/downloadStore';

function App() {
  const { initListener } = useDownloadStore();
  
  // Initialize download progress listener at app level
  useEffect(() => {
    const cleanup = initListener();
    return cleanup;
  }, [initListener]);
  
  return (
    <HashRouter>
      <div className="flex h-screen bg-mesh overflow-hidden">
        {/* Sidebar */}
        <Sidebar />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <Header />
          
          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/influencer" element={<Influencer />} />
              <Route path="/history" element={<History />} />
              <Route path="/downloads" element={<Downloads />} />
<Route path="/settings" element={<Settings />} />
              <Route path="/koc-analysis" element={<KOCAnalysis />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
