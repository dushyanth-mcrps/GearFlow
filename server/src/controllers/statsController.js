const { getDb } = require('../db/connection');
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Reservation = require('../models/Reservation');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const AuditLog = require('../models/AuditLog');

function isMongo() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

async function getDashboardStats(req, res) {
  try {
    if (isMongo()) {
      const [
        totalAssets,
        availableAssets,
        inUseAssets,
        maintenanceAssets,
        activeLoans,
        overdueLoans,
        pendingPickups,
        openTickets,
        distinctCategories
      ] = await Promise.all([
        Asset.countDocuments(),
        Asset.countDocuments({ status: 'AVAILABLE' }),
        Asset.countDocuments({ status: 'IN_USE' }),
        Asset.countDocuments({ status: 'MAINTENANCE' }),
        Reservation.countDocuments({ status: 'CHECKED_OUT' }),
        Reservation.countDocuments({ status: 'OVERDUE' }),
        Reservation.countDocuments({ status: 'CONFIRMED' }),
        MaintenanceTicket.countDocuments({ status: { $in: ['OPEN', 'IN_PROGRESS'] } }),
        Asset.distinct('category')
      ]);

      const categoryBreakdown = await Promise.all(
        distinctCategories.map(async cat => ({
          category: cat,
          count: await Asset.countDocuments({ category: cat })
        }))
      );

      const allReservations = await Reservation.find();
      let totalOverdue = 0;
      let totalDamage = 0;
      let totalCollected = 0;
      let totalPending = 0;

      for (const r of allReservations) {
        const overdue = r.overduePenaltyFee || 0;
        const damage = r.damagePenaltyFee || 0;
        const total = overdue + damage;
        totalOverdue += overdue;
        totalDamage += damage;
        if (r.penaltyStatus === 'PAID') {
          totalCollected += total;
        } else if (r.penaltyStatus === 'ASSESSED') {
          totalPending += total;
        }
      }

      return res.json({
        stats: {
          totalAssets,
          availableAssets,
          inUseAssets,
          maintenanceAssets,
          activeLoans,
          overdueLoans,
          pendingPickups,
          openTickets,
          financials: {
            totalOverdue,
            totalDamage,
            totalCollected,
            totalPending
          },
          categoryBreakdown
        }
      });
    }

    const db = getDb();

    // 1. Asset metrics
    const totalAssets = db.prepare('SELECT COUNT(*) as count FROM assets').get().count;
    const availableAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'AVAILABLE'").get().count;
    const inUseAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'IN_USE'").get().count;
    const maintenanceAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE status = 'MAINTENANCE'").get().count;

    // 2. Reservation metrics
    const activeLoans = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'CHECKED_OUT'").get().count;
    const overdueLoans = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'OVERDUE'").get().count;
    const pendingPickups = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status = 'CONFIRMED'").get().count;

    // 3. Financial / Penalty metrics
    const penaltySums = db.prepare(`
      SELECT
        COALESCE(SUM(overduePenaltyFee), 0) as totalOverdue,
        COALESCE(SUM(damagePenaltyFee), 0) as totalDamage,
        COALESCE(SUM(CASE WHEN penaltyStatus = 'PAID' THEN (overduePenaltyFee + damagePenaltyFee) ELSE 0 END), 0) as totalCollected,
        COALESCE(SUM(CASE WHEN penaltyStatus = 'ASSESSED' THEN (overduePenaltyFee + damagePenaltyFee) ELSE 0 END), 0) as totalPending
      FROM reservations
    `).get();

    // 4. Open maintenance tickets
    const openTickets = db.prepare("SELECT COUNT(*) as count FROM maintenance_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')").get().count;

    // 5. Category breakdown
    const categoryBreakdown = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM assets
      GROUP BY category
    `).all();

    return res.json({
      stats: {
        totalAssets,
        availableAssets,
        inUseAssets,
        maintenanceAssets,
        activeLoans,
        overdueLoans,
        pendingPickups,
        openTickets,
        financials: {
          totalOverdue: penaltySums.totalOverdue,
          totalDamage: penaltySums.totalDamage,
          totalCollected: penaltySums.totalCollected,
          totalPending: penaltySums.totalPending
        },
        categoryBreakdown
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const { limit = 50 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);

    if (isMongo()) {
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limitNum);
      return res.json({
        logs: logs.map(l => ({
          id: l._id.toString(),
          _id: l._id.toString(),
          actorId: l.actorId?.toString(),
          actorName: l.actorName,
          action: l.action,
          targetType: l.targetType,
          targetId: l.targetId,
          details: l.details,
          createdAt: l.createdAt
        }))
      });
    }

    const db = getDb();
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(limitNum);

    return res.json({ logs });
  } catch (error) {
    console.error('Audit logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
}

module.exports = { getDashboardStats, getAuditLogs };
