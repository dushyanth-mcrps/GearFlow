const { getDb } = require('../db/connection');

function getAllTickets(req, res) {
  try {
    const db = getDb();
    const { status, severity, assetId } = req.query;

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

function getTicketById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

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

function createTicket(req, res) {
  const db = getDb();

  try {
    const { assetId, issueDescription, severity = 'MEDIUM', estimatedRepairCost = 0.0, assignedTo } = req.body;

    if (!assetId || !issueDescription) {
      return res.status(400).json({ error: 'assetId and issueDescription are required' });
    }

    const asset = db.prepare('SELECT id, assetTag, name FROM assets WHERE id = ?').get(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const ticketTx = db.transaction(() => {
      // 1. Create ticket
      const result = db.prepare(`
        INSERT INTO maintenance_tickets (assetId, reportedBy, issueDescription, severity, status, assignedTo, estimatedRepairCost)
        VALUES (?, ?, ?, ?, 'OPEN', ?, ?)
      `).run(
        assetId,
        req.user.id,
        issueDescription.trim(),
        severity,
        assignedTo || 'Unassigned',
        parseFloat(estimatedRepairCost) || 0.0
      );

      const ticketId = result.lastInsertRowid;

      // 2. Put asset into MAINTENANCE status
      db.prepare("UPDATE assets SET status = 'MAINTENANCE', conditionGrade = 'DAMAGED' WHERE id = ?").run(assetId);

      // 3. Audit log
      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'MAINTENANCE_TICKET_OPENED', 'MAINTENANCE', ?, ?)
      `).run(
        req.user.id,
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

function updateTicket(req, res) {
  const db = getDb();

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
        estimatedRepairCost !== undefined ? parseFloat(estimatedRepairCost) : undefined,
        resolutionNotes,
        resolvedAt,
        id
      );

      // If resolved and requested to restore, set asset back to AVAILABLE
      if (restoreAsset && (status === 'RESOLVED' || status === 'CLOSED')) {
        db.prepare("UPDATE assets SET status = 'AVAILABLE', conditionGrade = ? WHERE id = ?").run(
          restoredConditionGrade,
          ticket.assetId
        );

        db.prepare(`
          INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
          VALUES (?, ?, 'MAINTENANCE_RESTORED', 'ASSET', ?, ?)
        `).run(
          req.user.id,
          req.user.name,
          ticket.assetId,
          `Asset restored to service from maintenance ticket #${id}. Condition: ${restoredConditionGrade}.`
        );
      }

      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'MAINTENANCE_TICKET_UPDATED', 'MAINTENANCE', ?, ?)
      `).run(
        req.user.id,
        req.user.name,
        id,
        `Updated ticket #${id}. Status: ${status || ticket.status}. Assigned to: ${assignedTo || ticket.assignedTo}`
      );
    });

    updateTx();
    return res.json({ message: 'Maintenance ticket updated successfully' });
  } catch (error) {
    console.error('Update ticket error:', error);
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
}

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket
};
