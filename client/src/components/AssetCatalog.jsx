import React, { useState, useEffect } from 'react';
import { assetsApi } from '../api/client';
import BookingModal from './BookingModal';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  Wrench,
  AlertOctagon,
  Calendar,
  Layers,
  MapPin,
  Sparkles,
  PackageCheck
} from 'lucide-react';

export default function AssetCatalog({ onBookingCreated }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedAssetForBooking, setSelectedAssetForBooking] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (selectedCategory !== 'All') params.category = selectedCategory;
      if (statusFilter !== 'All') params.status = statusFilter;

      const data = await assetsApi.getAll(params);
      setAssets(data.assets || []);

      const catData = await assetsApi.getCategories();
      setCategories(catData.categories || []);
    } catch (err) {
      console.error('Fetch assets error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [search, selectedCategory, statusFilter]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            <span>Available</span>
          </span>
        );
      case 'IN_USE':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            <span>In Use / Active Custody</span>
          </span>
        );
      case 'MAINTENANCE':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Wrench className="w-3 h-3" />
            <span>Quarantine / Maintenance</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            <AlertOctagon className="w-3 h-3" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const getConditionColor = (cond) => {
    switch (cond) {
      case 'EXCELLENT':
        return 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40';
      case 'GOOD':
        return 'text-blue-400 bg-blue-950/60 border-blue-800/40';
      case 'FAIR':
        return 'text-amber-400 bg-amber-950/60 border-amber-800/40';
      default:
        return 'text-rose-400 bg-rose-950/60 border-rose-800/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-900/40 p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Smart Availability Engine with Auto-Conflict Detection</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Media & Lab Equipment Inventory
          </h1>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Reserve professional production rigs, audio gear, and engineering instruments. Every checkout tracks physical condition, return checklists, and automated overdue penalty policies.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by asset tag, gear name, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="AVAILABLE">Available Now</option>
              <option value="IN_USE">Active Custody (In Use)</option>
              <option value="MAINTENANCE">Under Quarantine</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all ${
              selectedCategory === 'All'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setSelectedCategory(cat.category)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all flex items-center space-x-1.5 ${
                selectedCategory === cat.category
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>{cat.category}</span>
              <span className="text-[10px] opacity-75 font-mono">({cat.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Asset Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-slate-900/50 border border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
          <PackageCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No equipment found matching criteria</h3>
          <p className="text-xs text-slate-500 mt-1">Try clearing your search filters or selecting another category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                {/* Image & Badges */}
                <div className="relative h-44 bg-slate-950 overflow-hidden">
                  <img
                    src={asset.imageUrl}
                    alt={asset.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md text-[11px] font-mono font-bold text-slate-200 border border-slate-700/60 shadow-sm">
                      {asset.assetTag}
                    </span>
                    {getStatusBadge(asset.status)}
                  </div>

                  {/* Bottom Category & Condition */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded backdrop-blur-sm">
                      {asset.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getConditionColor(
                        asset.conditionGrade
                      )}`}
                    >
                      {asset.conditionGrade}
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {asset.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {asset.description}
                    </p>
                  </div>

                  {/* Meta: Location and Late Fee */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center space-x-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span className="truncate max-w-[140px]">{asset.location}</span>
                    </div>
                    <div className="text-[11px]">
                      Late Fee: <span className="font-mono font-semibold text-amber-400">${asset.hourlyPenaltyRate}/hr</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-4 pt-0">
                <button
                  onClick={() => setSelectedAssetForBooking(asset)}
                  disabled={asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED'}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                    asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED'
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {asset.status === 'MAINTENANCE'
                      ? 'Locked for Quarantine'
                      : asset.status === 'IN_USE'
                      ? 'Reserve Next Slot'
                      : 'Schedule Reservation'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      {selectedAssetForBooking && (
        <BookingModal
          asset={selectedAssetForBooking}
          onClose={() => setSelectedAssetForBooking(null)}
          onSuccess={() => {
            setSelectedAssetForBooking(null);
            fetchAssets();
            onBookingCreated?.();
          }}
        />
      )}
    </div>
  );
}
