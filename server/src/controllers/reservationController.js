const { getDb } = require('../db/connection');

// Automatically checks and marks overdue checkouts
function syncOverdueReservations(db) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE reservations
    SET status = 'OVERDUE'
    WHERE status = 'CHECKED_OUT' AND endTime < ?
  `).run(now);
}

function getAllReservations(req, res) {
  try {
    const db = getDb();
    syncOverdueReservations(db);

    const { status, assetId, userId } = req.query;
    let query = `
      SELECT r.*,
             a.name as assetName, a.assetTag, a.category as assetCategory, a.imageUrl as assetImage, a.hourlyPenaltyRate, a.location as assetLocation,
             u.name as userName, u.email as userEmail, u.phone as userPhone, u.department as userDepartment,
             cb.name as checkedOutByName,
             rb.name as receivedByName
      FROM reservations r
      JOIN assets a ON r.assetId = a.id
      JOIN users u ON r.userId = u.id
      LEFT JOIN users cb ON r.checkedOutBy = cb.id
      LEFT JOIN users rb ON r.receivedBy = rb.id
      WHERE 1=1
    `;
    const params = [];

    // If borrower, restrict to their own unless custodian/admin
    if (req.user.role === 'borrower') {
      query += ' AND r.userId = ?';
      params.push(req.user.id);
    } else if (userId) {
      query += ' AND r.userId = ?';
      params.push(userId);
    }

    if (status && status !== 'All') {
      query += ' AND r.status = ?';
      params.push(status);
    }

    if (assetId) {
      query += ' AND r.assetId = ?';
      params.push(assetId);
    }

    query += ' ORDER BY r.createdAt DESC';

    const reservations = db.prepare(query).all(...params);

    const parsed = reservations.map(r => {
      const now = new Date();
      const end = new Date(r.endTime);
      let hoursOverdue = 0;
      if ((r.status === 'CHECKED_OUT' || r.status === 'OVERDUE') && now > end) {
        hoursOverdue = Math.ceil((now - end) / (1000 * 60 * 60));
      }

      return {
        ...r,
        checkoutChecklist: JSON.parse(r.checkoutChecklist || '{}'),
        returnInspection: JSON.parse(r.returnInspection || '{}'),
        currentOverdueHours: hoursOverdue,
        estimatedOverdueFee: hoursOverdue * (r.hourlyPenaltyRate || 15)
      };
    });

    return res.json({ reservations: parsed });
  } catch (error) {
    console.error('Get reservations error:', error);
    return res.status(500).json({ error: 'Failed to retrieve reservations' });
  }
}

function getReservationById(req, res) {
  try {
    const db = getDb();
    syncOverdueReservations(db);

    const { id } = req.params;
    const r = db.prepare(`
      SELECT r.*,
             a.name as assetName, a.assetTag, a.category as assetCategory, a.imageUrl as assetImage, a.hourlyPenaltyRate, a.location as assetLocation, a.conditionGrade as assetCondition,
             u.name as userName, u.email as userEmail, u.phone as userPhone, u.department as userDepartment, u.depositBalance,
             cb.name as checkedOutByName,
             rb.name as receivedByName
      FROM reservations r
      JOIN assets a ON r.assetId = a.id
      JOIN users u ON r.userId = u.id
      LEFT JOIN users cb ON r.checkedOutBy = cb.id
      LEFT JOIN users rb ON r.receivedBy = rb.id
      WHERE r.id = ?
    `).get(id);

    if (!r) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Role check: borrowers can only view their own
    if (req.user.role === 'borrower' && r.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied to this reservation' });
    }

    const now = new Date();
    const end = new Date(r.endTime);
    let hoursOverdue = 0;
    if ((r.status === 'CHECKED_OUT' || r.status === 'OVERDUE') && now > end) {
      hoursOverdue = Math.ceil((now - end) / (1000 * 60 * 60));
    }

    return res.json({
      reservation: {
        ...r,
        checkoutChecklist: JSON.parse(r.checkoutChecklist || '{}'),
        returnInspection: JSON.parse(r.returnInspection || '{}'),
        currentOverdueHours: hoursOverdue,
        estimatedOverdueFee: hoursOverdue * (r.hourlyPenaltyRate || 15)
      }
    });
  } catch (error) {
    console.error('Get reservation error:', error);
    return res.status(500).json({ error: 'Failed to retrieve reservation' });
  }
}

function createReservation(req, res) {
  const db = getDb();

  try {
    const { assetId, startTime, endTime, purpose } = req.body;
    const targetUserId = (req.user.role !== 'borrower' && req.body.userId) ? req.body.userId : req.user.id;

    if (!assetId || !startTime || !endTime) {
      return res.status(400).json({ error: 'assetId, startTime, and endTime are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid datetime format for startTime or endTime' });
    }

    if (start < new Date(now.getTime() - 15 * 60 * 1000)) { // allow 15m leeway for client clock skew
      return res.status(400).json({ error: 'Cannot book reservations in the past' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    const durationHours = (end - start) / (1000 * 60 * 60);
    if (durationHours > 168) { // 7 days max
      return res.status(400).json({ error: 'Reservation duration cannot exceed 7 days (168 hours)' });
    }

    // Check borrower profile for unpaid penalties
    const borrower = db.prepare('SELECT id, name, depositBalance FROM users WHERE id = ?').get(targetUserId);
    if (!borrower) {
      return res.status(404).json({ error: 'Target borrower not found' });
    }

    const unpaidPenalties = db.prepare(`
      SELECT COUNT(*) as count FROM reservations
      WHERE userId = ? AND penaltyStatus = 'ASSESSED'
    `).get(targetUserId);

    if (unpaidPenalties && unpaidPenalties.count > 0) {
      return res.status(403).json({
        error: `Borrower has ${unpaidPenalties.count} outstanding unpaid penalty fees. Please settle penalties before new bookings.`
      });
    }

    // Concurrency Check inside transactional block
    const createTx = db.transaction(() => {
      // 1. Check asset status
      const asset = db.prepare('SELECT id, name, status, conditionGrade FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset does not exist');
      }

      if (asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED') {
        throw new Error(`Asset is currently in ${asset.status} state and cannot be reserved`);
      }

      // 2. Conflict overlap check
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const conflicts = db.prepare(`
        SELECT id, startTime, endTime, status
        FROM reservations
        WHERE assetId = ?
          AND status IN ('CONFIRMED', 'CHECKED_OUT', 'OVERDUE')
          AND (
            (startTime <= ? AND endTime > ?) OR
            (startTime < ? AND endTime >= ?) OR
            (startTime >= ? AND endTime <= ?)
          )
      `).all(assetId, startIso, startIso, endIso, endIso, startIso, endIso);

      if (conflicts.length > 0) {
        throw new Error('Slot conflict: Asset is already booked during this time interval');
      }

      // 3. Insert reservation
      const insertResult = db.prepare(`
        INSERT INTO reservations (assetId, userId, startTime, endTime, status, purpose)
        VALUES (?, ?, ?, ?, 'CONFIRMED', ?)
      `).run(assetId, targetUserId, startIso, endIso, purpose || 'Academic Project');

      const reservationId = insertResult.lastInsertRowid;

      // 4. Audit log
      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'RESERVATION_CREATED', 'RESERVATION', ?, ?)
      `).run(
        req.user.id,
        req.user.name,
        reservationId,
        `Booked ${asset.name} from ${start.toLocaleString()} to ${end.toLocaleString()}`
      );

      return { reservationId, assetName: asset.name };
    });

    const result = createTx();
    return res.status(201).json({
      message: 'Reservation confirmed successfully',
      reservationId: result.reservationId,
      assetName: result.assetName
    });
  } catch (error) {
    console.error('Create reservation error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to create reservation' });
  }
}

function cancelReservation(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (req.user.role === 'borrower' && reservation.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to cancel this reservation' });
    }

    if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
      return res.status(400).json({ error: `Cannot cancel a reservation in ${reservation.status} status` });
    }

    db.prepare("UPDATE reservations SET status = 'CANCELLED' WHERE id = ?").run(id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'RESERVATION_CANCELLED', 'RESERVATION', ?, 'Reservation cancelled by user/custodian')
    `).run(req.user.id, req.user.name, id);

    return res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    console.error('Cancel reservation error:', error);
    return res.status(500).json({ error: 'Failed to cancel reservation' });
  }
}

// Handover Check-out Workflow
function checkoutReservation(req, res) {
  const db = getDb();

  try {
    const { id } = req.params;
    const { checklist = {}, notes = '' } = req.body;

    const checkoutTx = db.transaction(() => {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'CONFIRMED') {
        throw new Error(`Cannot checkout reservation with status '${reservation.status}'. Must be 'CONFIRMED'.`);
      }

      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(reservation.assetId);
      if (!asset) {
        throw new Error('Associated asset not found');
      }

      if (asset.status !== 'AVAILABLE' && asset.status !== 'RESERVED') {
        throw new Error(`Asset cannot be checked out because its status is ${asset.status}`);
      }

      const now = new Date().toISOString();

      // Update reservation to CHECKED_OUT
      db.prepare(`
        UPDATE reservations
        SET status = 'CHECKED_OUT',
            checkedOutAt = ?,
            checkedOutBy = ?,
            checkoutChecklist = ?,
            checkoutNotes = ?
        WHERE id = ?
      `).run(now, req.user.id, JSON.stringify(checklist), notes, id);

      // Update asset to IN_USE
      db.prepare("UPDATE assets SET status = 'IN_USE' WHERE id = ?").run(reservation.assetId);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'CUSTODY_HANDOVER', 'RESERVATION', ?, ?)
      `).run(
        req.user.id,
        req.user.name,
        id,
        `Custody handed over for asset ${asset.assetTag} (${asset.name}). Checklist completed.`
      );

      return { assetTag: asset.assetTag, assetName: asset.name };
    });

    const outcome = checkoutTx();
    return res.json({
      message: 'Asset checked out successfully. Custody is now active.',
      assetTag: outcome.assetTag,
      assetName: outcome.assetName
    });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to checkout asset' });
  }
}

// Inspection Check-in / Return Workflow & Penalty Engine
function returnReservation(req, res) {
  const db = getDb();

  try {
    const { id } = req.params;
    const {
      inspection = {},
      notes = '',
      hasDamage = false,
      damageDescription = '',
      damageFee = 0,
      severity = 'MEDIUM'
    } = req.body;

    const returnTx = db.transaction(() => {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.status !== 'CHECKED_OUT' && reservation.status !== 'OVERDUE') {
        throw new Error(`Cannot return reservation with status '${reservation.status}'. Must be 'CHECKED_OUT' or 'OVERDUE'.`);
      }

      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(reservation.assetId);
      const borrower = db.prepare('SELECT * FROM users WHERE id = ?').get(reservation.userId);

      const now = new Date();
      const endTime = new Date(reservation.endTime);
      let overdueHours = 0;
      let overdueFee = 0.0;

      if (now > endTime) {
        overdueHours = Math.ceil((now - endTime) / (1000 * 60 * 60));
        overdueFee = overdueHours * (asset.hourlyPenaltyRate || 15.0);
      }

      const parsedDamageFee = hasDamage ? Math.max(0, parseFloat(damageFee) || 0) : 0.0;
      const totalFee = overdueFee + parsedDamageFee;
      let penaltyStatus = totalFee > 0 ? 'ASSESSED' : 'NONE';

      let newReservationStatus = hasDamage ? 'FLAGGED_DAMAGE' : 'RETURNED';
      let newAssetStatus = hasDamage ? 'MAINTENANCE' : 'AVAILABLE';
      let newConditionGrade = hasDamage ? 'DAMAGED' : (inspection.newConditionGrade || asset.conditionGrade);

      // Deduct from deposit balance if available
      let deduction = 0;
      if (totalFee > 0 && borrower.depositBalance >= totalFee) {
        deduction = totalFee;
        penaltyStatus = 'PAID';
        db.prepare('UPDATE users SET depositBalance = depositBalance - ? WHERE id = ?').run(deduction, borrower.id);
      }

      // Update reservation
      db.prepare(`
        UPDATE reservations
        SET status = ?,
            returnedAt = ?,
            receivedBy = ?,
            returnInspection = ?,
            returnNotes = ?,
            overduePenaltyFee = ?,
            damagePenaltyFee = ?,
            penaltyStatus = ?
        WHERE id = ?
      `).run(
        newReservationStatus,
        now.toISOString(),
        req.user.id,
        JSON.stringify(inspection),
        notes,
        overdueFee,
        parsedDamageFee,
        penaltyStatus,
        id
      );

      // Update asset status
      db.prepare(`
        UPDATE assets
        SET status = ?, conditionGrade = ?
        WHERE id = ?
      `).run(newAssetStatus, newConditionGrade, asset.id);

      // If damaged, automatically create maintenance quarantine ticket
      let maintenanceTicketId = null;
      if (hasDamage) {
        const ticketResult = db.prepare(`
          INSERT INTO maintenance_tickets (assetId, reportedBy, reservationId, issueDescription, severity, status, estimatedRepairCost)
          VALUES (?, ?, ?, ?, ?, 'OPEN', ?)
        `).run(
          asset.id,
          req.user.id,
          id,
          damageDescription || notes || 'Damaged upon return inspection',
          severity,
          parsedDamageFee
        );
        maintenanceTicketId = ticketResult.lastInsertRowid;

        // Audit log for maintenance quarantine
        db.prepare(`
          INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
          VALUES (?, ?, 'MAINTENANCE_QUARANTINED', 'ASSET', ?, ?)
        `).run(
          req.user.id,
          req.user.name,
          asset.id,
          `Asset ${asset.assetTag} quarantined into maintenance ticket #${maintenanceTicketId} due to return damage.`
        );
      }

      // Audit log for return
      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, 'RETURN_INSPECTED', 'RESERVATION', ?, ?)
      `).run(
        req.user.id,
        req.user.name,
        id,
        `Inspected return of ${asset.assetTag}. Overdue fee: $${overdueFee}, Damage fee: $${parsedDamageFee}. Status: ${newReservationStatus}.`
      );

      return {
        overdueHours,
        overdueFee,
        damageFee: parsedDamageFee,
        totalFee,
        penaltyStatus,
        hasDamage,
        maintenanceTicketId
      };
    });

    const result = returnTx();
    return res.json({
      message: result.hasDamage ? 'Gear returned with damage. Asset placed in Maintenance Quarantine.' : 'Gear returned and verified clean.',
      result
    });
  } catch (error) {
    console.error('Return error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to process gear return' });
  }
}

// Settle / Waive penalty
function settlePenalty(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { action } = req.body; // 'PAY' or 'WAIVE'

    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.penaltyStatus !== 'ASSESSED') {
      return res.status(400).json({ error: `Penalty status is already ${reservation.penaltyStatus}` });
    }

    const nextStatus = action === 'WAIVE' ? 'WAIVED' : 'PAID';
    db.prepare('UPDATE reservations SET penaltyStatus = ? WHERE id = ?').run(nextStatus, id);

    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'PENALTY_SETTLED', 'RESERVATION', ?, ?)
    `).run(
      req.user.id,
      req.user.name,
      id,
      `Penalty for reservation #${id} marked as ${nextStatus}`
    );

    return res.json({ message: `Penalty successfully marked as ${nextStatus}` });
  } catch (error) {
    console.error('Settle penalty error:', error);
    return res.status(500).json({ error: 'Failed to settle penalty' });
  }
}

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  cancelReservation,
  checkoutReservation,
  returnReservation,
  settlePenalty
};
