import React, { useState } from 'react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import {
  ShieldAlert,
  Layers,
  CalendarCheck,
  ClipboardList,
  Wrench,
  BarChart3,
  LogOut,
  UserCheck,
  ChevronDown,
  Sparkles,
  Wallet
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, quickDemoLogin, isCustodianOrAdmin } = useAuth();
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  const navItems = [
    { id: 'catalog', label: 'Gear Catalog', icon: Layers, access: 'all' },
    { id: 'my-loans', label: 'My Custody & Loans', icon: CalendarCheck, access: 'all' },
    { id: 'custody', label: 'Custody Handover', icon: ClipboardList, access: 'custodian' },
    { id: 'maintenance', label: 'Quarantine & Repairs', icon: Wrench, access: 'custodian' },
    { id: 'analytics', label: 'Audit & Analytics', icon: BarChart3, access: 'custodian' }
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('catalog')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-amber-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-xl font-black text-white tracking-tighter">⚡</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">Gear<span className="text-indigo-400">Flow</span></span>
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v2.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Asset Lending & Custody Lifecycle</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              if (item.access === 'custodian' && !isCustodianOrAdmin) return null;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right actions: Demo Switcher + User Info */}
          <div className="flex items-center space-x-3">
            {/* Quick Demo Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowDemoMenu(!showDemoMenu)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
                title="Switch persona for evaluation"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Demo Persona:</span>
                <span className="capitalize font-mono">{user?.role || 'Guest'}</span>
                <ChevronDown className="w-3 h-3 text-amber-400" />
              </button>

              {showDemoMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-xs">
                  <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Instant Persona Switch
                  </div>
                  {Object.entries(DEMO_ACCOUNTS).map(([key, acc]) => (
                    <button
                      key={key}
                      onClick={() => {
                        quickDemoLogin(key);
                        setShowDemoMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-800 flex items-center justify-between transition-colors ${
                        user?.email === acc.email ? 'bg-indigo-950/60 text-indigo-300 font-semibold' : 'text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-200">{acc.roleLabel.split('(')[0]}</div>
                        <div className="text-[10px] text-slate-400">{acc.roleLabel.split('(')[1]?.replace(')', '') || acc.email}</div>
                      </div>
                      {user?.email === acc.email && <UserCheck className="w-4 h-4 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User deposit wallet & profile */}
            {user && (
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
                <div className="hidden lg:flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-800/70 border border-slate-700/60 text-xs">
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-400">Deposit:</span>
                  <span className="font-mono font-semibold text-emerald-300">${user.depositBalance?.toFixed(2)}</span>
                </div>

                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-200 leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-400 capitalize">{user.role}</div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 px-2 py-2 bg-slate-900/90 text-xs">
        {navItems.map((item) => {
          if (item.access === 'custodian' && !isCustodianOrAdmin) return null;
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded font-medium ${
                isActive ? 'text-indigo-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
