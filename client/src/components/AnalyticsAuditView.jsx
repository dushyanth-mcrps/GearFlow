import React, { useState, useEffect } from 'react';
import { statsApi } from '../api/client';
import {
  BarChart3,
  Activity,
  Layers,
  Clock,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  RefreshCw,
  Search,
  PackageCheck
} from 'lucide-react';

export default function AnalyticsAuditView() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const statsRes = await statsApi.getDashboard();
      setStats(statsRes.stats);

      const logsRes = await statsApi.getAuditLogs(50);
      setLogs(logsRes.logs || []);
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = logs.filter(
    (l) =>
      l.action?.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.actorName?.toLowerCase().includes(logFilter.toLowerCase()) ||
      l.details?.toLowerCase().includes(logFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 mb-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Administrative Transparency & Security Ledger</span>
          </div>
          <h2 className="text-xl font-bold text-white">Operations Analytics & Custody Audit Trail</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry on equipment utilization, financial penalty recoveries, and non-repudiation audit trails for all custody transfers.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Fleet Availability</span>
              <PackageCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {stats.availableAssets} <span className="text-xs text-slate-500 font-sans font-normal">/ {stats.totalAssets} total</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {stats.inUseAssets} in custody • {stats.maintenanceAssets} quarantined
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Overdue Risk</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${stats.overdueLoans > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {stats.overdueLoans} <span className="text-xs text-slate-500 font-sans font-normal">alerts</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {stats.activeLoans} total loans currently out
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Assessed Penalties</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300">
              ${(stats.financials?.totalOverdue + stats.financials?.totalDamage).toFixed(2)}
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              ${stats.financials?.totalCollected.toFixed(2)} settled into vault
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Quarantine Workorders</span>
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-indigo-300">
              {stats.openTickets} <span className="text-xs text-slate-500 font-sans font-normal">active</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              Repair & calibration backlog
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown Progress */}
      {stats?.categoryBreakdown && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md">
          <h3 className="text-sm font-bold text-white mb-3">Inventory Distribution by Domain</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-medium">{cat.category}</span>
                  <span className="text-slate-400 font-mono">{cat.count} units</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, (cat.count / (stats.totalAssets || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log Stream */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/40">
          <div>
            <h3 className="text-sm font-bold text-white">Immutable Event Ledger (Audit Logs)</h3>
            <p className="text-[11px] text-slate-400">Append-only chronological record of all custody, inspection, and quarantine transactions.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Details & Inspection Sign-off</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                    {new Date(log.createdAt).toLocaleTimeString()} ({new Date(log.createdAt).toLocaleDateString()})
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-200 font-sans">
                    {log.actorName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-indigo-300 font-bold text-[10px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                    {log.targetType} #{log.targetId}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-sans">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
