const { getDb } = require('../db/connection');
const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Asset = require('../models/Asset');
const User = require('../models/User');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const AuditLog = require('../models/AuditLog');

function isMongo() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

// Automatically checks and marks overdue checkouts
async function syncOverdueReservations() {
  if (isMongo()) {
    const now = new Date();
    await Reservation.updateMany(
      { status: 'CHECKED_OUT', endTime: { $lt: now } },
      { $set: { status: 'OVERDUE' } }
    );
    return;
  }
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE reservations
    SET status = 'OVERDUE'
    WHERE status = 'CHECKED_OUT' AND endTime < ?
  `).run(now);
}

async function getAllReservations(req, res) {
  try {
    await syncOverdueReservations();

    const { status, assetId, userId } = req.query;

    if (isMongo()) {
      const filter = {};
      if (req.user.role === 'borrower') {
        filter.userId = req.user.id;
      } else if (userId) {
        filter.userId = userId;
      }

      if (status && status !== 'All') {
        filter.status = status;
      }

      if (assetId) {
        filter.assetId = assetId;
      }

      const reservations = await Reservation.find(filter)
        .populate('assetId')
        .populate('userId', 'name email phone department depositBalance')
        .populate('checkedOutBy', 'name')
        .populate('receivedBy', 'name')
        .sort({ createdAt: -1 });

      const now = new Date();
      const parsed = reservations.map(r => {
        const end = new Date(r.endTime);
        let hoursOverdue = 0;
        if ((r.status === 'CHECKED_OUT' || r.status === 'OVERDUE') && now > end) {
          hoursOverdue = Math.ceil((now - end) / (1000 * 60 * 60));
        }

        const asset = r.assetId || {};
        const borrower = r.userId || {};

        return {
          id: r._id.toString(),
          _id: r._id.toString(),
          assetId: asset._id ? asset._id.toString() : r.assetId,
          assetName: asset.name || 'Unknown Asset',
          assetTag: asset.assetTag || 'TAG',
          assetCategory: asset.category,
          assetImage: asset.imageUrl,
          hourlyPenaltyRate: asset.hourlyPenaltyRate || 15.0,
          assetLocation: asset.location,
          userId: borrower._id ? borrower._id.toString() : r.userId,
          userName: borrower.name || 'Unknown User',
          userEmail: borrower.email || '',
          userPhone: borrower.phone,
          userDepartment: borrower.department,
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
          purpose: r.purpose,
          checkedOutAt: r.checkedOutAt,
          checkedOutByName: r.checkedOutBy?.name,
          returnedAt: r.returnedAt,
          receivedByName: r.receivedBy?.name,
          checkoutChecklist: r.checkoutChecklist || {},
          checkoutNotes: r.checkoutNotes,
          returnInspection: r.returnInspection || {},
          returnNotes: r.returnNotes,
          overduePenaltyFee: r.overduePenaltyFee || 0,
          damagePenaltyFee: r.damagePenaltyFee || 0,
          penaltyStatus: r.penaltyStatus,
          createdAt: r.createdAt,
          currentOverdueHours: hoursOverdue,
          estimatedOverdueFee: hoursOverdue * (asset.hourlyPenaltyRate || 15)
        };
      });

      return res.json({ reservations: parsed });
    }

    const db = getDb();
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

async function getReservationById(req, res) {
  try {
    await syncOverdueReservations();
    const { id } = req.params;

    if (isMongo()) {
      const r = await Reservation.findById(id)
        .populate('assetId')
        .populate('userId')
        .populate('checkedOutBy', 'name')
        .populate('receivedBy', 'name');

      if (!r) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      const borrower = r.userId || {};
      const asset = r.assetId || {};

      if (req.user.role === 'borrower' && borrower._id?.toString() !== req.user.id) {
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
          id: r._id.toString(),
          _id: r._id.toString(),
          assetId: asset._id?.toString(),
          assetName: asset.name,
          assetTag: asset.assetTag,
          assetCategory: asset.category,
          assetImage: asset.imageUrl,
          hourlyPenaltyRate: asset.hourlyPenaltyRate || 15.0,
          assetLocation: asset.location,
          assetCondition: asset.conditionGrade,
          userId: borrower._id?.toString(),
          userName: borrower.name,
          userEmail: borrower.email,
          userPhone: borrower.phone,
          userDepartment: borrower.department,
          depositBalance: borrower.depositBalance,
          startTime: r.startTime,
          endTime: r.endTime,
          status: r.status,
          purpose: r.purpose,
          checkedOutAt: r.checkedOutAt,
          checkedOutByName: r.checkedOutBy?.name,
          returnedAt: r.returnedAt,
          receivedByName: r.receivedBy?.name,
          checkoutChecklist: r.checkoutChecklist || {},
          returnInspection: r.returnInspection || {},
          overduePenaltyFee: r.overduePenaltyFee || 0,
          damagePenaltyFee: r.damagePenaltyFee || 0,
          penaltyStatus: r.penaltyStatus,
          createdAt: r.createdAt,
          currentOverdueHours: hoursOverdue,
          estimatedOverdueFee: hoursOverdue * (asset.hourlyPenaltyRate || 15)
        }
      });
    }

    const db = getDb();
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

async function createReservation(req, res) {
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

    if (start < new Date(now.getTime() - 15 * 60 * 1000)) {
      return res.status(400).json({ error: 'Cannot book reservations in the past' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    const durationHours = (end - start) / (1000 * 60 * 60);
    if (durationHours > 168) {
      return res.status(400).json({ error: 'Reservation duration cannot exceed 7 days (168 hours)' });
    }

    if (isMongo()) {
      const borrower = await User.findById(targetUserId);
      if (!borrower) {
        return res.status(404).json({ error: 'Target borrower not found' });
      }

      const unpaidPenalties = await Reservation.countDocuments({
        userId: targetUserId,
        penaltyStatus: 'ASSESSED'
      });

      if (unpaidPenalties > 0) {
        return res.status(403).json({
          error: `Borrower has ${unpaidPenalties} outstanding unpaid penalty fees. Please settle penalties before new bookings.`
        });
      }

      const asset = await Asset.findById(assetId);
      if (!asset) {
        return res.status(404).json({ error: 'Asset does not exist' });
      }

      if (asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED') {
        return res.status(400).json({ error: `Asset is currently in ${asset.status} state and cannot be reserved` });
      }

      // Check slot conflicts
      const conflicts = await Reservation.find({
        assetId,
        status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'OVERDUE'] },
        $or: [
          { startTime: { $lte: start }, endTime: { $gt: start } },
          { startTime: { $lt: end }, endTime: { $gte: end } },
          { startTime: { $gte: start }, endTime: { $lte: end } }
        ]
      });

      if (conflicts.length > 0) {
        return res.status(400).json({ error: 'Slot conflict: Asset is already booked during this time interval' });
      }

      const reservation = await Reservation.create({
        assetId,
        userId: targetUserId,
        startTime: start,
        endTime: end,
        status: 'CONFIRMED',
        purpose: purpose || 'Academic Project'
      });

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'RESERVATION_CREATED',
        targetType: 'RESERVATION',
        targetId: reservation._id.toString(),
        details: `Booked ${asset.name} from ${start.toLocaleString()} to ${end.toLocaleString()}`
      });

      return res.status(201).json({
        message: 'Reservation confirmed successfully (MongoDB)',
        reservationId: reservation._id.toString(),
        assetName: asset.name
      });
    }

    // SQLite Flow
    const db = getDb();
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

    const createTx = db.transaction(() => {
      const asset = db.prepare('SELECT id, name, status, conditionGrade FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset does not exist');
      }

      if (asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED') {
        throw new Error(`Asset is currently in ${asset.status} state and cannot be reserved`);
      }

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

      const insertResult = db.prepare(`
        INSERT INTO reservations (assetId, userId, startTime, endTime, status, purpose)
        VALUES (?, ?, ?, ?, 'CONFIRMED', ?)
      `).run(assetId, targetUserId, startIso, endIso, purpose || 'Academic Project');

      const reservationId = insertResult.lastInsertRowid;

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

async function cancelReservation(req, res) {
  try {
    const { id } = req.params;

    if (isMongo()) {
      const reservation = await Reservation.findById(id);
      if (!reservation) {
        return res.status(404).json({ error: 'Reservation not found' });
      }

      if (req.user.role === 'borrower' && reservation.userId.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Unauthorized to cancel this reservation' });
      }

      if (reservation.status !== 'CONFIRMED' && reservation.status !== 'PENDING') {
        return res.status(400).json({ error: `Cannot cancel a reservation in ${reservation.status} status` });
      }

      reservation.status = 'CANCELLED';
      await reservation.save();

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'RESERVATION_CANCELLED',
        targetType: 'RESERVATION',
        targetId: id,
        details: 'Reservation cancelled by user/custodian'
      });

      return res.json({ message: 'Reservation cancelled successfully' });
    }

    const db = getDb();
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

async function checkoutReservation(req, res) {
  try {
    const { id } = req.params;
    const { checklist = {}, notes = '' } = req.body;

    if (isMongo()) {
      const reservation = await Reservation.findById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

      if (reservation.status !== 'CONFIRMED') {
        return res.status(400).json({ error: `Cannot checkout reservation with status '${reservation.status}'. Must be 'CONFIRMED'.` });
      }

      const asset = await Asset.findById(reservation.assetId);
      if (!asset) return res.status(404).json({ error: 'Associated asset not found' });

      if (asset.status !== 'AVAILABLE' && asset.status !== 'RESERVED') {
        return res.status(400).json({ error: `Asset cannot be checked out because its status is ${asset.status}` });
      }

      reservation.status = 'CHECKED_OUT';
      reservation.checkedOutAt = new Date();
      reservation.checkedOutBy = req.user.id;
      reservation.checkoutChecklist = checklist;
      reservation.checkoutNotes = notes;
      await reservation.save();

      asset.status = 'IN_USE';
      await asset.save();

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'CUSTODY_HANDOVER',
        targetType: 'RESERVATION',
        targetId: id,
        details: `Custody handed over for asset ${asset.assetTag} (${asset.name}). Checklist completed.`
      });

      return res.json({
        message: 'Asset checked out successfully. Custody is now active.',
        assetTag: asset.assetTag,
        assetName: asset.name
      });
    }

    const db = getDb();
    const checkoutTx = db.transaction(() => {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status !== 'CONFIRMED') throw new Error(`Cannot checkout reservation with status '${reservation.status}'. Must be 'CONFIRMED'.`);

      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(reservation.assetId);
      if (!asset) throw new Error('Associated asset not found');
      if (asset.status !== 'AVAILABLE' && asset.status !== 'RESERVED') throw new Error(`Asset cannot be checked out because its status is ${asset.status}`);

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE reservations
        SET status = 'CHECKED_OUT',
            checkedOutAt = ?,
            checkedOutBy = ?,
            checkoutChecklist = ?,
            checkoutNotes = ?
        WHERE id = ?
      `).run(now, req.user.id, JSON.stringify(checklist), notes, id);

      db.prepare("UPDATE assets SET status = 'IN_USE' WHERE id = ?").run(reservation.assetId);

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

async function returnReservation(req, res) {
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

    if (isMongo()) {
      const reservation = await Reservation.findById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      if (reservation.status !== 'CHECKED_OUT' && reservation.status !== 'OVERDUE') {
        return res.status(400).json({ error: `Cannot return reservation with status '${reservation.status}'. Must be 'CHECKED_OUT' or 'OVERDUE'.` });
      }

      const asset = await Asset.findById(reservation.assetId);
      const borrower = await User.findById(reservation.userId);

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

      let deduction = 0;
      if (totalFee > 0 && borrower.depositBalance >= totalFee) {
        deduction = totalFee;
        penaltyStatus = 'PAID';
        borrower.depositBalance -= deduction;
        await borrower.save();
      }

      reservation.status = newReservationStatus;
      reservation.returnedAt = now;
      reservation.receivedBy = req.user.id;
      reservation.returnInspection = inspection;
      reservation.returnNotes = notes;
      reservation.overduePenaltyFee = overdueFee;
      reservation.damagePenaltyFee = parsedDamageFee;
      reservation.penaltyStatus = penaltyStatus;
      await reservation.save();

      asset.status = newAssetStatus;
      asset.conditionGrade = newConditionGrade;
      await asset.save();

      let maintenanceTicketId = null;
      if (hasDamage) {
        const ticket = await MaintenanceTicket.create({
          assetId: asset._id,
          reportedBy: req.user.id,
          reservationId: reservation._id,
          issueDescription: damageDescription || 'Damage detected during custodian return inspection',
          severity: severity || 'MEDIUM',
          status: 'OPEN',
          estimatedRepairCost: parsedDamageFee,
          resolutionNotes: `Reported on return inspection by custodian ${req.user.name}`
        });
        maintenanceTicketId = ticket._id.toString();
      }

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: hasDamage ? 'RETURN_WITH_DAMAGE' : 'RETURN_CLEAN',
        targetType: 'RESERVATION',
        targetId: id,
        details: `Return inspected for ${asset.assetTag}. Overdue Fee: $${overdueFee}, Damage Fee: $${parsedDamageFee}. Status: ${newReservationStatus}`
      });

      return res.json({
        message: hasDamage
          ? 'Asset returned with damage flagged. Asset moved to MAINTENANCE quarantine.'
          : 'Asset returned in good condition and restocked to AVAILABLE.',
        result: {
          reservationId: id,
          hasDamage,
          overdueHours,
          overdueFee,
          damageFee: parsedDamageFee,
          totalPenalty: totalFee,
          deductedFromBalance: deduction,
          penaltyStatus,
          assetStatus: newAssetStatus,
          maintenanceTicketId
        }
      });
    }

    const db = getDb();
    const returnTx = db.transaction(() => {
      const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
      if (!reservation) throw new Error('Reservation not found');
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

      let deduction = 0;
      if (totalFee > 0 && borrower.depositBalance >= totalFee) {
        deduction = totalFee;
        penaltyStatus = 'PAID';
        db.prepare('UPDATE users SET depositBalance = depositBalance - ? WHERE id = ?').run(deduction, borrower.id);
      }

      const nowIso = now.toISOString();
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
        nowIso,
        req.user.id,
        JSON.stringify(inspection),
        notes,
        overdueFee,
        parsedDamageFee,
        penaltyStatus,
        id
      );

      db.prepare(`
        UPDATE assets
        SET status = ?,
            conditionGrade = ?
        WHERE id = ?
      `).run(newAssetStatus, newConditionGrade, asset.id);

      let maintenanceTicketId = null;
      if (hasDamage) {
        const ticketResult = db.prepare(`
          INSERT INTO maintenance_tickets (assetId, reportedBy, reservationId, issueDescription, severity, status, estimatedRepairCost, resolutionNotes)
          VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)
        `).run(
          asset.id,
          req.user.id,
          id,
          damageDescription || 'Damage detected during custodian return inspection',
          severity || 'MEDIUM',
          parsedDamageFee,
          `Reported on return inspection by custodian ${req.user.name}`
        );
        maintenanceTicketId = ticketResult.lastInsertRowid;
      }

      db.prepare(`
        INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
        VALUES (?, ?, ?, 'RESERVATION', ?, ?)
      `).run(
        req.user.id,
        req.user.name,
        hasDamage ? 'RETURN_WITH_DAMAGE' : 'RETURN_CLEAN',
        id,
        `Return inspected for ${asset.assetTag}. Overdue Fee: $${overdueFee}, Damage Fee: $${parsedDamageFee}. Status: ${newReservationStatus}`
      );

      return {
        reservationId: id,
        hasDamage,
        overdueHours,
        overdueFee,
        damageFee: parsedDamageFee,
        totalPenalty: totalFee,
        deductedFromBalance: deduction,
        penaltyStatus,
        assetStatus: newAssetStatus,
        maintenanceTicketId
      };
    });

    const result = returnTx();
    return res.json({
      message: hasDamage
        ? 'Asset returned with damage flagged. Asset moved to MAINTENANCE quarantine.'
        : 'Asset returned in good condition and restocked to AVAILABLE.',
      result
    });
  } catch (error) {
    console.error('Return error:', error.message);
    return res.status(400).json({ error: error.message || 'Failed to process asset return' });
  }
}

async function settlePenalty(req, res) {
  try {
    const { id } = req.params;

    if (isMongo()) {
      const reservation = await Reservation.findById(id);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      reservation.penaltyStatus = 'PAID';
      await reservation.save();

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'PENALTY_SETTLED',
        targetType: 'RESERVATION',
        targetId: id,
        details: 'Outstanding penalty fee was marked settled/paid.'
      });

      return res.json({ message: 'Penalty settled successfully' });
    }

    const db = getDb();
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(id);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    db.prepare("UPDATE reservations SET penaltyStatus = 'PAID' WHERE id = ?").run(id);

    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'PENALTY_SETTLED', 'RESERVATION', ?, 'Outstanding penalty fee was marked settled/paid.')
    `).run(req.user.id, req.user.name, id);

    return res.json({ message: 'Penalty settled successfully' });
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
