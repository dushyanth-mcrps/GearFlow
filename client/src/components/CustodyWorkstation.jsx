import React, { useState, useEffect } from 'react';
import { reservationsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardCheck,
  PackageOpen,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  ShieldAlert,
  Loader2,
  DollarSign,
  Search,
  Filter,
  Check,
  FileCheck
} from 'lucide-react';

export default function CustodyWorkstation() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'pending'
  const [search, setSearch] = useState('');

  // Modals state
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);

  // Checkout form state
  const [checkoutChecklist, setCheckoutChecklist] = useState({
    serialNumberVerified: true,
    batteryCharged: true,
    opticsClean: true,
    cablesIncluded: true
  });
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Return inspection form state
  const [returnChecklist, setReturnChecklist] = useState({
    allAccessoriesReturned: true,
    opticsUndamaged: true,
    cleanExterior: true
  });
  const [hasDamage, setHasDamage] = useState(false);
  const [damageDescription, setDamageDescription] = useState('');
  const [damageFee, setDamageFee] = useState(0);
  const [severity, setSeverity] = useState('MEDIUM');
  const [newConditionGrade, setNewConditionGrade] = useState('GOOD');
  const [returnNotes, setReturnNotes] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  const [notification, setNotification] = useState('');

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const data = await reservationsApi.getAll();
      setReservations(data.reservations || []);
    } catch (err) {
      console.error('Fetch reservations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!checkoutTarget) return;

    setSubmittingCheckout(true);
    try {
      await reservationsApi.checkout(checkoutTarget.id, {
        checklist: checkoutChecklist,
        notes: checkoutNotes
      });
      setNotification(`Custody handover complete for ${checkoutTarget.assetName}. Marked IN_USE.`);
      setCheckoutTarget(null);
      setCheckoutNotes('');
      fetchReservations();
    } catch (err) {
      alert(err.message || 'Checkout failed');
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!returnTarget) return;

    setSubmittingReturn(true);
    try {
      const res = await reservationsApi.returnGear(returnTarget.id, {
        inspection: {
          ...returnChecklist,
          newConditionGrade
        },
        notes: returnNotes,
        hasDamage,
        damageDescription,
        damageFee: parseFloat(damageFee) || 0,
        severity
      });

      setNotification(res.message || 'Gear returned and inspected successfully.');
      setReturnTarget(null);
      setHasDamage(false);
      setDamageDescription('');
      setDamageFee(0);
      setReturnNotes('');
      fetchReservations();
    } catch (err) {
      alert(err.message || 'Return inspection failed');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleSettlePenalty = async (id, action) => {
    try {
      await reservationsApi.settlePenalty(id, action);
      setNotification(`Penalty successfully ${action === 'WAIVE' ? 'waived' : 'marked paid'}.`);
      fetchReservations();
    } catch (err) {
      alert(err.message || 'Failed to settle penalty');
    }
  };

  const pendingPickups = reservations.filter((r) => r.status === 'CONFIRMED');
  const activeLoans = reservations.filter(
    (r) => r.status === 'CHECKED_OUT' || r.status === 'OVERDUE'
  );

  const filteredItems = (activeTab === 'active' ? activeLoans : pendingPickups).filter(
    (item) =>
      item.assetName?.toLowerCase().includes(search.toLowerCase()) ||
      item.assetTag?.toLowerCase().includes(search.toLowerCase()) ||
      item.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-2">
            <ClipboardCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Staff / Custodian Operations Desk</span>
          </div>
          <h2 className="text-xl font-bold text-white">Equipment Custody Workstation</h2>
          <p className="text-xs text-slate-400 mt-1">
            Dispatch booked assets with digital condition checklists and inspect returned gear with automated overdue penalty calculations.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>In Custody & Overdue ({activeLoans.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              activeTab === 'pending'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <PackageOpen className="w-3.5 h-3.5" />
            <span>Awaiting Pickup ({pendingPickups.length})</span>
          </button>
        </div>
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

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Filter by borrower name, gear model, or asset tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading custody records...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No records found for the current view.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Asset Details</th>
                  <th className="px-5 py-3.5">Borrower</th>
                  <th className="px-5 py-3.5">Scheduled Window</th>
                  <th className="px-5 py-3.5">Status & Timer</th>
                  <th className="px-5 py-3.5 text-right">Custodian Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredItems.map((item) => {
                  const isOverdue = item.status === 'OVERDUE' || item.currentOverdueHours > 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={item.assetImage}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-white text-sm">{item.assetName}</div>
                            <div className="text-[11px] font-mono text-indigo-400">{item.assetTag}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-200">{item.userName}</div>
                        <div className="text-[11px] text-slate-400">{item.userDepartment || item.userEmail}</div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-300">{new Date(item.startTime).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-500">Due: {new Date(item.endTime).toLocaleString()}</div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {isOverdue ? (
                          <div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
                              <span>OVERDUE ({item.currentOverdueHours}h)</span>
                            </span>
                            <div className="text-[10px] text-rose-400 font-mono mt-0.5">
                              Fee: +${item.estimatedOverdueFee?.toFixed(2)}
                            </div>
                          </div>
                        ) : item.status === 'CHECKED_OUT' ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 inline-flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-blue-400" />
                            <span>In Custody</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            Awaiting Pickup
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {item.status === 'CONFIRMED' ? (
                          <button
                            onClick={() => setCheckoutTarget(item)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
                          >
                            Dispatch Handover
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setReturnTarget(item);
                              setDamageFee(0);
                              setHasDamage(false);
                            }}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all"
                          >
                            Inspect & Return
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checkout Handover Modal */}
      {checkoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-widest">
                  Custody Verification
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Handover: {checkoutTarget.assetName}
                </h3>
              </div>
              <button
                onClick={() => setCheckoutTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <div className="text-slate-400">Borrower:</div>
                  <div className="text-white font-semibold">{checkoutTarget.userName}</div>
                </div>
                <div>
                  <div className="text-slate-400">Asset Tag:</div>
                  <div className="text-indigo-400 font-mono font-bold">{checkoutTarget.assetTag}</div>
                </div>
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Pre-Dispatch Safety Inspection
                </span>
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkoutChecklist.serialNumberVerified}
                      onChange={(e) =>
                        setCheckoutChecklist({ ...checkoutChecklist, serialNumberVerified: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-slate-200">Hardware Serial Number verified against custody tag</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkoutChecklist.batteryCharged}
                      onChange={(e) =>
                        setCheckoutChecklist({ ...checkoutChecklist, batteryCharged: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-slate-200">Batteries / power supply tested and fully charged</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkoutChecklist.opticsClean}
                      onChange={(e) =>
                        setCheckoutChecklist({ ...checkoutChecklist, opticsClean: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-slate-200">Sensors, optics, and calibrated leads free of defects</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkoutChecklist.cablesIncluded}
                      onChange={(e) =>
                        setCheckoutChecklist({ ...checkoutChecklist, cablesIncluded: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-slate-200">All kit accessories and cases physically verified</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Handover Custodian Notes</label>
                <textarea
                  rows={2}
                  value={checkoutNotes}
                  onChange={(e) => setCheckoutNotes(e.target.value)}
                  placeholder="e.g. Student ID verified, issued with protective pelican case..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setCheckoutTarget(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCheckout}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center space-x-1.5 shadow-lg shadow-indigo-600/30"
                >
                  {submittingCheckout && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Sign & Transfer Custody</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Inspection Modal */}
      {returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">
                  Return & Condition Audit
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Inspection: {returnTarget.assetName}
                </h3>
              </div>
              <button
                onClick={() => setReturnTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Overdue calculation display */}
              {returnTarget.currentOverdueHours > 0 && (
                <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-200">
                  <div className="font-bold flex items-center space-x-1 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    <span>Calculated Overdue Penalty:</span>
                  </div>
                  <div className="text-[11px] mt-1 text-rose-300">
                    {returnTarget.currentOverdueHours} hours late @ ${returnTarget.hourlyPenaltyRate}/hr ={' '}
                    <span className="font-mono font-bold text-rose-200">
                      ${(returnTarget.currentOverdueHours * returnTarget.hourlyPenaltyRate).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Inspection Checkpoints */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Condition Verification Checklist
                </span>
                <div className="space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={returnChecklist.allAccessoriesReturned}
                      onChange={(e) =>
                        setReturnChecklist({ ...returnChecklist, allAccessoriesReturned: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span className="text-slate-200">All peripheral cables, SD cards, and lenses returned</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={returnChecklist.opticsUndamaged}
                      onChange={(e) =>
                        setReturnChecklist({ ...returnChecklist, opticsUndamaged: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span className="text-slate-200">Optical sensors, displays, and buttons functional</span>
                  </label>
                  <label className="flex items-center space-x-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={returnChecklist.cleanExterior}
                      onChange={(e) =>
                        setReturnChecklist({ ...returnChecklist, cleanExterior: e.target.checked })
                      }
                      className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <span className="text-slate-200">Exterior casing clean, no excessive dirt or moisture</span>
                  </label>
                </div>
              </div>

              {/* Damage Report Toggle */}
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 space-y-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDamage}
                    onChange={(e) => setHasDamage(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-rose-600 focus:ring-0"
                  />
                  <span className="font-semibold text-slate-200">Flag Physical Damage / Quarantine Required</span>
                </label>

                {hasDamage && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-slate-400 mb-1">Issue Description for Repair Ticket</label>
                      <input
                        type="text"
                        value={damageDescription}
                        onChange={(e) => setDamageDescription(e.target.value)}
                        placeholder="e.g. Scratched lens element, bent USB-C port, dented cage..."
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Quarantine Severity</label>
                        <select
                          value={severity}
                          onChange={(e) => setSeverity(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                        >
                          <option value="LOW">Low (Cosmetic)</option>
                          <option value="MEDIUM">Medium (Minor Repair)</option>
                          <option value="HIGH">High (Component Swap)</option>
                          <option value="CRITICAL">Critical (Non-functional)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Assessed Damage Fee ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="5"
                          value={damageFee}
                          onChange={(e) => setDamageFee(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Return Inspection Notes</label>
                <textarea
                  rows={2}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Custodian observations regarding gear condition..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReturnTarget(null)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="px-5 py-2 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center space-x-1.5 shadow-lg shadow-emerald-600/30"
                >
                  {submittingReturn && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Complete Return & Settle</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
