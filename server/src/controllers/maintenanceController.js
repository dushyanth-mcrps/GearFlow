const { getDb } = require('../db/connection');
const mongoose = require('mongoose');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const Asset = require('../models/Asset');
const AuditLog = require('../models/AuditLog');

function isMongo() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

function resolveSqliteUserId(db, reqUser) {
  if (!reqUser) return 1;
  if (reqUser.id && !isNaN(Number(reqUser.id))) {
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(reqUser.id));
    if (row) return row.id;
  }
  if (reqUser.email) {
    const byEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(reqUser.email.toLowerCase().trim());
    if (byEmail) return byEmail.id;
  }
  const fallback = db.prepare("SELECT id FROM users WHERE role IN ('custodian', 'admin') LIMIT 1").get();
  return fallback ? fallback.id : 1;
}

async function getAllTickets(req, res) {
  try {
    const { status, severity, assetId } = req.query;

    if (isMongo()) {
      const filter = {};
      if (status && status !== 'All') filter.status = status;
      if (severity && severity !== 'All') filter.severity = severity;
      if (assetId) filter.assetId = assetId;

      const tickets = await MaintenanceTicket.find(filter)
        .populate('assetId')
        .populate('reportedBy', 'name email')
        .sort({ createdAt: -1 });

      const parsed = tickets.map(t => {
        const asset = t.assetId || {};
        return {
          id: t._id.toString(),
          _id: t._id.toString(),
          assetId: asset._id ? asset._id.toString() : t.assetId,
          assetName: asset.name,
          assetTag: asset.assetTag,
          assetCategory: asset.category,
          assetLocation: asset.location,
          assetImage: asset.imageUrl,
          reportedBy: t.reportedBy?._id?.toString() || t.reportedBy,
          reporterName: t.reportedBy?.name,
          reporterEmail: t.reportedBy?.email,
          reservationId: t.reservationId?.toString(),
          issueDescription: t.issueDescription,
          severity: t.severity,
          status: t.status,
          assignedTo: t.assignedTo,
          estimatedRepairCost: t.estimatedRepairCost,
          resolutionNotes: t.resolutionNotes,
          resolvedAt: t.resolvedAt,
          createdAt: t.createdAt
        };
      });

      return res.json({ tickets: parsed });
    }

    const db = getDb();
    let query = `
      SELECT t.*,
             a.name as assetName, a.assetTag, a.category as assetCategory, a.location as assetLocation, a.imageUrl as assetImage,
             u.name as reporterName, u.email as reporterEmail
      FROM maintenance_tickets t
      JOIN assets a ON t.assetId = a.id
      JOIN users u ON t.reportedBy = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'All') {
      query += ' AND t.status = ?';
      params.push(status);
    }

    if (severity && severity !== 'All') {
      query += ' AND t.severity = ?';
      params.push(severity);
    }

    if (assetId) {
      query += ' AND t.assetId = ?';
      params.push(assetId);
    }

    query += ' ORDER BY t.createdAt DESC';

    const tickets = db.prepare(query).all(...params);
    return res.json({ tickets });
  } catch (error) {
    console.error('Get maintenance tickets error:', error);
    return res.status(500).json({ error: 'Failed to fetch maintenance tickets' });
  }
}

async function getTicketById(req, res) {
  try {
    const { id } = req.params;

    if (isMongo() && mongoose.Types.ObjectId.isValid(id)) {
      const t = await MaintenanceTicket.findById(id)
        .populate('assetId')
        .populate('reportedBy', 'name email');

      if (t) {
        const asset = t.assetId || {};
        return res.json({
          ticket: {
            id: t._id.toString(),
            _id: t._id.toString(),
            assetId: asset._id ? asset._id.toString() : t.assetId,
            assetName: asset.name,
            assetTag: asset.assetTag,
            assetCategory: asset.category,
            assetLocation: asset.location,
            assetImage: asset.imageUrl,
            reporterName: t.reportedBy?.name,
            reporterEmail: t.reportedBy?.email,
            reservationId: t.reservationId?.toString(),
            issueDescription: t.issueDescription,
            severity: t.severity,
            status: t.status,
            assignedTo: t.assignedTo,
            estimatedRepairCost: t.estimatedRepairCost,
            resolutionNotes: t.resolutionNotes,
            resolvedAt: t.resolvedAt,
            createdAt: t.createdAt
          }
        });
      }
    }

    const db = getDb();
    const ticket = db.prepare(`
      SELECT t.*,
             a.name as assetName, a.assetTag, a.category as assetCategory, a.location as assetLocation, a.imageUrl as assetImage,
             u.name as reporterName, u.email as reporterEmail
      FROM maintenance_tickets t
      JOIN assets a ON t.assetId = a.id
      JOIN users u ON t.reportedBy = u.id
      WHERE t.id = ?
    `).get(id);

    if (!ticket) {
      return res.status(404).json({ error: 'Maintenance ticket not found' });
    }

    return res.json({ ticket });
  } catch (error) {
    console.error('Get ticket error:', error);
    return res.status(500).json({ error: 'Failed to retrieve ticket' });
  }
}

async function createTicket(req, res) {
  try {
    const { assetId, issueDescription, severity = 'MEDIUM', estimatedRepairCost = 0.0, assignedTo } = req.body;

    if (!assetId || !issueDescription) {
      return res.status(400).json({ error: 'assetId and issueDescription are required' });
    }

    if (isMongo() && mongoose.Types.ObjectId.isValid(assetId)) {
      const asset = await Asset.findById(assetId);
      if (asset) {
        const ticket = await MaintenanceTicket.create({
          assetId,
          reportedBy: req.user.id,
          issueDescription: issueDescription.trim(),
          severity,
          status: 'OPEN',
          assignedTo: assignedTo || 'Unassigned',
          estimatedRepairCost: parseFloat(estimatedRepairCost) || 0.0
        });

        asset.status = 'MAINTENANCE';
        asset.conditionGrade = 'DAMAGED';
        await asset.save();

        await AuditLog.create({
          actorId: req.user.id,
          actorName: req.user.name,
          action: 'MAINTENANCE_TICKET_OPENED',
          targetType: 'MAINTENANCE',
          targetId: ticket._id.toString(),
          details: `Opened maintenance ticket #${ticket._id.toString()} for ${asset.assetTag}. Severity: ${severity}. Locked into quarantine.`
        });

        return res.status(201).json({
          message: 'Maintenance ticket created. Asset quarantined.',
          ticketId: ticket._id.toString()
        });
      }
    }

    const db = getDb();
    const actorId = resolveSqliteUserId(db, req.user);
    const asset = db.prepare('SELECT id, assetTag, name FROM assets WHERE id = ?').get(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const ticketTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO maintenance_tickets (assetId, reportedBy, issueDescription, severity, status, assignedTo, estimatedRepairCost)
        VALUES (?, ?, ?, ?, 'OPEN', ?, ?)
      `).run(
        assetId,
        actorId,
        issueDescription.trim(),
        severity,
        assignedTo || 'Unassigned',
        parseFloat(estimatedRepairCost) || 0.0
      );

      const ticketId = result.lastInsertRowid;
      db.prepare("UPDATE assets SET status = 'MAINTENANCE', conditionGrade = 'DAMAGED' WHERE id = ?").run(assetId);

      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'MAINTENANCE_TICKET_OPENED', 'MAINTENANCE', ?, ?)
      `).run(
        actorId,
        req.user.name,
        ticketId,
        `Opened maintenance ticket #${ticketId} for ${asset.assetTag}. Severity: ${severity}. Locked into quarantine.`
      );

      return ticketId;
    });

    const ticketId = ticketTx();
    return res.status(201).json({
      message: 'Maintenance ticket created. Asset quarantined.',
      ticketId
    });
  } catch (error) {
    console.error('Create ticket error:', error);
    return res.status(500).json({ error: 'Failed to create maintenance ticket' });
  }
}

async function updateTicket(req, res) {
  try {
    const { id } = req.params;
    const {
      status,
      assignedTo,
      estimatedRepairCost,
      resolutionNotes,
      restoreAsset = false,
      restoredConditionGrade = 'GOOD'
    } = req.body;

    if (isMongo() && mongoose.Types.ObjectId.isValid(id)) {
      const ticket = await MaintenanceTicket.findById(id);
      if (ticket) {
        if (status) ticket.status = status;
        if (assignedTo !== undefined) ticket.assignedTo = assignedTo;
        if (estimatedRepairCost !== undefined) ticket.estimatedRepairCost = parseFloat(estimatedRepairCost);
        if (resolutionNotes !== undefined) ticket.resolutionNotes = resolutionNotes;
        if (status === 'RESOLVED' || status === 'CLOSED') {
          ticket.resolvedAt = new Date();
        }
        await ticket.save();

        let restoredTag = null;
        if (restoreAsset || status === 'RESOLVED' || status === 'CLOSED') {
          const asset = await Asset.findById(ticket.assetId);
          if (asset) {
            asset.status = 'AVAILABLE';
            asset.conditionGrade = restoredConditionGrade;
            await asset.save();
            restoredTag = asset.assetTag;
          }
        }

        await AuditLog.create({
          actorId: req.user.id,
          actorName: req.user.name,
          action: 'MAINTENANCE_TICKET_UPDATED',
          targetType: 'MAINTENANCE',
          targetId: id,
          details: `Updated ticket #${id}. Status: ${ticket.status}. ${restoredTag ? `Asset ${restoredTag} released from quarantine.` : ''}`
        });

        return res.json({
          message: 'Ticket updated successfully',
          ticketId: id,
          status: ticket.status,
          assetRestored: !!restoredTag
        });
      }
    }

    const db = getDb();
    const actorId = resolveSqliteUserId(db, req.user);
    const ticket = db.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updateTx = db.transaction(() => {
      const resolvedAt = (status === 'RESOLVED' || status === 'CLOSED') ? new Date().toISOString() : ticket.resolvedAt;

      db.prepare(`
        UPDATE maintenance_tickets SET
          status = COALESCE(?, status),
          assignedTo = COALESCE(?, assignedTo),
          estimatedRepairCost = COALESCE(?, estimatedRepairCost),
          resolutionNotes = COALESCE(?, resolutionNotes),
          resolvedAt = ?
        WHERE id = ?
      `).run(
        status,
        assignedTo,
        estimatedRepairCost !== undefined ? parseFloat(estimatedRepairCost) : null,
        resolutionNotes,
        resolvedAt,
        id
      );

      let restoredTag = null;
      if (restoreAsset || status === 'RESOLVED' || status === 'CLOSED') {
        const asset = db.prepare('SELECT id, assetTag FROM assets WHERE id = ?').get(ticket.assetId);
        if (asset) {
          db.prepare("UPDATE assets SET status = 'AVAILABLE', conditionGrade = ? WHERE id = ?").run(restoredConditionGrade, asset.id);
          restoredTag = asset.assetTag;
        }
      }

      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'MAINTENANCE_TICKET_UPDATED', 'MAINTENANCE', ?, ?)
      `).run(
        actorId,
        req.user.name,
        id,
        `Updated ticket #${id}. Status: ${status || ticket.status}. ${restoredTag ? `Asset ${restoredTag} released from quarantine.` : ''}`
      );

      return { restoredTag };
    });

    const result = updateTx();
    return res.json({
      message: 'Ticket updated successfully',
      ticketId: id,
      status: status || ticket.status,
      assetRestored: !!result.restoredTag
    });
  } catch (error) {
    console.error('Update ticket error:', error);
    return res.status(500).json({ error: 'Failed to update maintenance ticket' });
  }
}

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket
};
