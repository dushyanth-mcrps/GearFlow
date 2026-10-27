import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AssetCatalog from './components/AssetCatalog';
import BorrowerDashboard from './components/BorrowerDashboard';
import CustodyWorkstation from './components/CustodyWorkstation';
import MaintenanceManager from './components/MaintenanceManager';
import AnalyticsAuditView from './components/AnalyticsAuditView';
import AuthView from './components/AuthView';
import { Loader2 } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('catalog');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f19] text-white">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
        <span className="text-xs text-slate-400 font-mono">Initializing GearFlow Engine...</span>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'catalog' && (
          <AssetCatalog onBookingCreated={() => setActiveTab('my-loans')} />
        )}
        {activeTab === 'my-loans' && <BorrowerDashboard />}
        {activeTab === 'custody' && <CustodyWorkstation />}
        {activeTab === 'maintenance' && <MaintenanceManager />}
        {activeTab === 'analytics' && <AnalyticsAuditView />}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-300">GearFlow</span>
            <span>—</span>
            <span>Academic & Enterprise Asset Custody Platform</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <span>SQLite WAL • React 19 • Tailwind CSS • Express 5</span>
            <span className="text-emerald-400 font-mono font-semibold">● Production Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
