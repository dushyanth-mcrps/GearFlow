import React, { useState, useEffect } from 'react';
import { reservationsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  CalendarCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  Package,
  Calendar,
  FileText
} from 'lucide-react';

export default function BorrowerDashboard() {
  const { user, refreshUser } = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const data = await reservationsApi.getAll();
      setReservations(data.reservations || []);
    } catch (err) {
      console.error('Fetch borrower reservations error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this booking slot?')) return;
    setCancellingId(id);
    try {
      await reservationsApi.cancel(id);
      setFeedback('Reservation cancelled successfully.');
      fetchReservations();
      refreshUser();
    } catch (err) {
      alert(err.message || 'Failed to cancel reservation');
    } finally {
      setCancellingId(null);
    }
  };

  const activeLoans = reservations.filter(
    (r) => r.status === 'CHECKED_OUT' || r.status === 'OVERDUE'
  );
  const upcomingBookings = reservations.filter((r) => r.status === 'CONFIRMED');
  const pastHistory = reservations.filter(
    (r) => r.status === 'RETURNED' || r.status === 'CANCELLED' || r.status === 'FLAGGED_DAMAGE'
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-indigo-400" />
            <span>Borrower Custody & Reservation Desk</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Logged in as <span className="text-indigo-300 font-semibold">{user?.name}</span> ({user?.department || 'Department Member'})
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs">
            <div className="text-slate-400">Security Deposit Ledger</div>
            <div className="text-base font-mono font-bold text-emerald-400">
              ${user?.depositBalance?.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/50 rounded-xl text-xs text-indigo-300 flex items-center justify-between">
          <span>{feedback}</span>
          <button onClick={() => setFeedback('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 1. Active Custody Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Package className="w-4 h-4 text-blue-400" />
          <span>Active In-Hand Custody ({activeLoans.length})</span>
        </h3>

        {activeLoans.length === 0 ? (
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
            You currently hold no checked-out equipment in your custody.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLoans.map((loan) => {
              const isOverdue = loan.status === 'OVERDUE' || loan.currentOverdueHours > 0;
              return (
                <div
                  key={loan.id}
                  className={`bg-slate-900 border rounded-2xl p-5 shadow-lg space-y-4 ${
                    isOverdue
                      ? 'border-rose-500/50 bg-rose-950/10'
                      : 'border-blue-500/40 bg-blue-950/10'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {loan.assetTag}
                      </span>
                      <h4 className="text-base font-bold text-white mt-1">{loan.assetName}</h4>
                      <p className="text-xs text-slate-400">{loan.purpose}</p>
                    </div>

                    <div>
                      {isOverdue ? (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                          <span>OVERDUE ({loan.currentOverdueHours}h)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          <Clock className="w-3.5 h-3.5 text-blue-400" />
                          <span>ACTIVE CUSTODY</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Overdue alert banner */}
                  {isOverdue && (
                    <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-200 space-y-1">
                      <div className="font-semibold flex items-center space-x-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span>Return Deadline Elapsed</span>
                      </div>
                      <p className="text-[11px] text-rose-300/80">
                        Late fee accumulating at <span className="font-mono font-bold">${loan.hourlyPenaltyRate}/hour</span>. Current estimated penalty: <span className="font-mono font-bold">${loan.estimatedOverdueFee?.toFixed(2)}</span>.
                      </p>
                    </div>
                  )}

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Checked Out On:</span>
                      <span className="text-slate-300 font-medium">
                        {loan.checkedOutAt ? new Date(loan.checkedOutAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Due Back By:</span>
                      <span className={`font-medium ${isOverdue ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                        {new Date(loan.endTime).toLocaleString()}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-800/60">
                      <span className="text-slate-500 block text-[10px]">Return Location:</span>
                      <span className="text-slate-300 font-medium">{loan.assetLocation}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Upcoming Confirmed Reservations */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>Upcoming Confirmed Pickups ({upcomingBookings.length})</span>
        </h3>

        {upcomingBookings.length === 0 ? (
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
            No upcoming reservations scheduled. Browse the catalog to book equipment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingBookings.map((res) => (
              <div
                key={res.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {res.assetTag}
                      </span>
                      <h4 className="text-base font-bold text-white mt-1">{res.assetName}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{res.purpose}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      CONFIRMED
                    </span>
                  </div>

                  <div className="mt-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled Start:</span>
                      <span className="text-slate-300 font-medium">{new Date(res.startTime).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Scheduled End:</span>
                      <span className="text-slate-300 font-medium">{new Date(res.endTime).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleCancel(res.id)}
                    disabled={cancellingId === res.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:text-white hover:bg-rose-950/60 border border-rose-900/40 transition-colors"
                  >
                    {cancellingId === res.id ? 'Cancelling...' : 'Cancel Reservation'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Past Lending & Inspection History */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Past Custody History & Condition Reports</span>
        </h3>

        {pastHistory.length === 0 ? (
          <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500 text-center">
            No past custody history yet.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Slot Duration</th>
                    <th className="px-4 py-3">Returned At</th>
                    <th className="px-4 py-3">Inspection Status</th>
                    <th className="px-4 py-3">Penalties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pastHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{item.assetName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{item.assetTag}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>{new Date(item.startTime).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">to {new Date(item.endTime).toLocaleDateString()}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.returnedAt ? new Date(item.returnedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === 'FLAGGED_DAMAGE' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            DAMAGE FLAGGED
                          </span>
                        ) : item.status === 'RETURNED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            CLEAN RETURN
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {(item.overduePenaltyFee > 0 || item.damagePenaltyFee > 0) ? (
                          <div className="text-rose-400 font-mono font-semibold">
                            ${(item.overduePenaltyFee + item.damagePenaltyFee).toFixed(2)} ({item.penaltyStatus})
                          </div>
                        ) : (
                          <span className="text-emerald-400 font-mono">$0.00</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
