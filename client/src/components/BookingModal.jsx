import React, { useState, useEffect } from 'react';
import { assetsApi, reservationsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  FileText
} from 'lucide-react';

export default function BookingModal({ asset, onClose, onSuccess }) {
  const { user, refreshUser } = useAuth();

  // Default to tomorrow 10:00 AM to tomorrow 4:00 PM
  const getDefaultDates = () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);

    const end = new Date(start);
    end.setHours(16, 0, 0, 0);

    return {
      start: start.toISOString().slice(0, 16),
      end: end.toISOString().slice(0, 16)
    };
  };

  const defaultDates = getDefaultDates();
  const [startTime, setStartTime] = useState(defaultDates.start);
  const [endTime, setEndTime] = useState(defaultDates.end);
  const [purpose, setPurpose] = useState('');

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Conflict detection hook
  useEffect(() => {
    if (!startTime || !endTime) return;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      setAvailability({ available: false, reason: 'Start time must be strictly before end time.' });
      return;
    }

    let isMounted = true;
    setChecking(true);
    setAvailability(null);
    setError('');

    const timer = setTimeout(async () => {
      try {
        const res = await assetsApi.checkAvailability(
          asset.id,
          start.toISOString(),
          end.toISOString()
        );
        if (isMounted) {
          setAvailability(res);
        }
      } catch (err) {
        if (isMounted) {
          setAvailability({ available: false, reason: err.message || 'Availability check failed' });
        }
      } finally {
        if (isMounted) setChecking(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [asset.id, startTime, endTime]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!availability || !availability.available) return;

    setSubmitting(true);
    setError('');

    try {
      await reservationsApi.create({
        assetId: asset.id,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        purpose: purpose.trim() || 'Academic / Production Project'
      });
      await refreshUser();
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to complete reservation');
    } finally {
      setSubmitting(false);
    }
  };

  const durationHours = Math.max(
    0,
    ((new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60)).toFixed(1)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <span className="text-xs font-mono font-semibold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/40">
              {asset.assetTag}
            </span>
            <h3 className="text-lg font-bold text-white mt-1">{asset.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleBook} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Asset summary bar */}
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400">Category:</span>{' '}
              <span className="text-slate-200 font-medium">{asset.category}</span>
            </div>
            <div>
              <span className="text-slate-400">Late Fee:</span>{' '}
              <span className="text-amber-400 font-mono font-semibold">${asset.hourlyPenaltyRate}/hr</span>
            </div>
            <div>
              <span className="text-slate-400">Condition:</span>{' '}
              <span className="text-emerald-400 font-semibold">{asset.conditionGrade}</span>
            </div>
          </div>

          {/* Time Picker Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Borrow Slot (Start)</span>
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Return Slot (End)</span>
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                required
              />
            </div>
          </div>

          {/* Real-time Conflict Engine Status */}
          <div className="p-3 rounded-xl border text-xs">
            {checking ? (
              <div className="flex items-center space-x-2 text-indigo-300">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Evaluating slot concurrency and buffer locks...</span>
              </div>
            ) : availability?.available ? (
              <div className="flex items-start space-x-2 text-emerald-300 bg-emerald-950/20 -m-3 p-3 rounded-xl border border-emerald-800/40">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-200">Slot Available for Reservation</div>
                  <div className="text-[11px] text-emerald-300/80">
                    Duration: {durationHours} hours. No overlapping custody or active loans detected.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-2 text-rose-300 bg-rose-950/20 -m-3 p-3 rounded-xl border border-rose-800/40">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <div className="font-semibold text-rose-200">Slot Conflict Detected</div>
                  <div className="text-[11px] text-rose-300/80">
                    {availability?.reason || 'This asset has an overlapping reservation during the requested timeframe.'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Purpose & Project Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center space-x-1">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Project Purpose & Production Details</span>
            </label>
            <textarea
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Documentary filming, robotics sensor testing, portfolio review..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Included Accessories Checklist */}
          {asset.accessories && asset.accessories.length > 0 && (
            <div>
              <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Included Kit Components
              </span>
              <div className="flex flex-wrap gap-1.5">
                {asset.accessories.map((acc, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-[11px] text-slate-300 font-mono"
                  >
                    ✓ {acc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={checking || !availability?.available || submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 flex items-center space-x-1.5 transition-all"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Reservation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
