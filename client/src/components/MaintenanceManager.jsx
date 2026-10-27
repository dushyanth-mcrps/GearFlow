import React, { useState, useEffect } from 'react';
import { maintenanceApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  User,
  DollarSign,
  X,
  Loader2,
  RefreshCw
} from 'lucide-react';

export default function MaintenanceManager() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Form states for resolving/updating
  const [status, setStatus] = useState('OPEN');
  const [assignedTo, setAssignedTo] = useState('');
  const [estimatedRepairCost, setEstimatedRepairCost] = useState(0);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [restoreAsset, setRestoreAsset] = useState(true);
  const [restoredConditionGrade, setRestoredConditionGrade] = useState('GOOD');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await maintenanceApi.getAll();
      setTickets(data.tickets || []);
    } catch (err) {
      console.error('Fetch tickets error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openUpdateModal = (ticket) => {
    setSelectedTicket(ticket);
    setStatus(ticket.status);
    setAssignedTo(ticket.assignedTo || 'Lab Technician Dave O.');
    setEstimatedRepairCost(ticket.estimatedRepairCost || 0);
    setResolutionNotes(ticket.resolutionNotes || '');
    setRestoreAsset(true);
    setRestoredConditionGrade('GOOD');
  };

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSubmitting(true);
    try {
      await maintenanceApi.update(selectedTicket.id, {
        status,
        assignedTo,
        estimatedRepairCost: parseFloat(estimatedRepairCost) || 0,
        resolutionNotes,
        restoreAsset,
        restoredConditionGrade
      });

      setNotification(`Ticket #${selectedTicket.id} updated. Asset status synchronized.`);
      setSelectedTicket(null);
      fetchTickets();
    } catch (err) {
      alert(err.message || 'Failed to update ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-2">
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Quarantine & Technical Calibration</span>
          </div>
          <h2 className="text-xl font-bold text-white">Maintenance Quarantine Queue</h2>
          <p className="text-xs text-slate-400 mt-1">
            Equipment flagged with physical damage or missing components is locked here to prevent booking until repaired and restored to inventory.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {notification && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Tickets List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading quarantine tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500">
          No open maintenance tickets. All inventory is operating normally.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {t.assetTag}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getSeverityBadge(
                          t.severity
                        )}`}
                      >
                        {t.severity} SEVERITY
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-white mt-1.5">{t.assetName}</h4>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      t.status === 'RESOLVED' || t.status === 'CLOSED'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs space-y-2">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Reported Issue:</span>
                    <span className="text-rose-300 font-medium">{t.issueDescription}</span>
                  </div>

                  {t.resolutionNotes && (
                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-500 block text-[10px]">Technician Notes:</span>
                      <span className="text-slate-300">{t.resolutionNotes}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">Assigned Tech:</span>{' '}
                      <span className="text-slate-300 font-medium">{t.assignedTo || 'Unassigned'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Repair Cost:</span>{' '}
                      <span className="text-emerald-400 font-mono font-semibold">${t.estimatedRepairCost?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => openUpdateModal(t)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-1.5"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Update & Service Ticket</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticket Edit / Restore Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">
                  Service Workorder #{selectedTicket.id}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedTicket.assetName} ({selectedTicket.assetTag})
                </h3>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Ticket Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                  >
                    <option value="OPEN">Open (Awaiting Inspection)</option>
                    <option value="IN_PROGRESS">In Progress (Parts Ordered / In Repair)</option>
                    <option value="RESOLVED">Resolved (Repaired & Tested)</option>
                    <option value="CLOSED">Closed (Archived)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Assigned Technician</label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                    placeholder="e.g. Technician Dave O."
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Repair Cost ($)</label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={estimatedRepairCost}
                  onChange={(e) => setEstimatedRepairCost(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Technician Resolution Notes</label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Details of repair, parts replaced, and sensor calibration tests..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {/* Restore to Active Inventory Hook */}
              {(status === 'RESOLVED' || status === 'CLOSED') && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-800/50 rounded-xl space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreAsset}
                      onChange={(e) => setRestoreAsset(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span className="font-semibold text-emerald-200">
                      Restore Asset Status to 'AVAILABLE' in Catalog
                    </span>
                  </label>

                  {restoreAsset && (
                    <div className="pt-2">
                      <label className="block text-[11px] text-slate-400 mb-1">Restored Condition Grade</label>
                      <select
                        value={restoredConditionGrade}
                        onChange={(e) => setRestoredConditionGrade(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                      >
                        <option value="EXCELLENT">EXCELLENT (Like New)</option>
                        <option value="GOOD">GOOD (Minor cosmetic wear)</option>
                        <option value="FAIR">FAIR (Functional with wear)</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
