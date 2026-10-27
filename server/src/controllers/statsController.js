const { getDb } = require('../db/connection');

function getDashboardStats(req, res) {
  try {
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

function getAuditLogs(req, res) {
  try {
    const db = getDb();
    const { limit = 50 } = req.query;

    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(Math.min(parseInt(limit, 10) || 50, 100));

    return res.json({ logs });
  } catch (error) {
    console.error('Audit logs error:', error);
    return res.status(500).json({ error: 'Failed to retrieve audit logs' });
  }
}

module.exports = { getDashboardStats, getAuditLogs };
