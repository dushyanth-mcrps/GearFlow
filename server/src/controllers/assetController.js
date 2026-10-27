const { getDb } = require('../db/connection');
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const Reservation = require('../models/Reservation');
const MaintenanceTicket = require('../models/MaintenanceTicket');
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

async function getAllAssets(req, res) {
  try {
    const { search, category, status, conditionGrade } = req.query;

    if (isMongo()) {
      const filter = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { assetTag: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      if (category && category !== 'All') filter.category = category;
      if (status && status !== 'All') filter.status = status;
      if (conditionGrade && conditionGrade !== 'All') filter.conditionGrade = conditionGrade;

      const assets = await Asset.find(filter).sort({ createdAt: 1 });
      return res.json({ assets: assets.map(a => a.toJSON()) });
    }

    const db = getDb();
    let query = 'SELECT * FROM assets WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (name LIKE ? OR assetTag LIKE ? OR description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (status && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (conditionGrade && conditionGrade !== 'All') {
      query += ' AND conditionGrade = ?';
      params.push(conditionGrade);
    }

    query += ' ORDER BY id ASC';

    const assets = db.prepare(query).all(...params);

    const parsedAssets = assets.map(asset => ({
      ...asset,
      accessories: JSON.parse(asset.accessories || '[]')
    }));

    return res.json({ assets: parsedAssets });
  } catch (error) {
    console.error('Get assets error:', error);
    return res.status(500).json({ error: 'Failed to fetch assets' });
  }
}

async function getAssetById(req, res) {
  try {
    const { id } = req.params;

    if (isMongo()) {
      const asset = await Asset.findById(id);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      const reservations = await Reservation.find({
        assetId: id,
        status: { $in: ['CONFIRMED', 'CHECKED_OUT'] }
      }).populate('userId', 'name email').sort({ startTime: 1 });

      const tickets = await MaintenanceTicket.find({ assetId: id })
        .populate('reportedBy', 'name email')
        .sort({ createdAt: -1 });

      return res.json({
        asset: asset.toJSON(),
        activeReservations: reservations.map(r => ({
          ...r.toJSON(),
          userName: r.userId?.name,
          userEmail: r.userId?.email
        })),
        maintenanceTickets: tickets.map(t => ({
          ...t.toJSON(),
          reporterName: t.reportedBy?.name
        }))
      });
    }

    const db = getDb();
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const reservations = db.prepare(`
      SELECT r.*, u.name as userName, u.email as userEmail
      FROM reservations r
      JOIN users u ON r.userId = u.id
      WHERE r.assetId = ? AND r.status IN ('CONFIRMED', 'CHECKED_OUT')
      ORDER BY r.startTime ASC
    `).all(id);

    const tickets = db.prepare(`
      SELECT t.*, u.name as reporterName
      FROM maintenance_tickets t
      JOIN users u ON t.reportedBy = u.id
      WHERE t.assetId = ?
      ORDER BY t.createdAt DESC
    `).all(id);

    return res.json({
      asset: {
        ...asset,
        accessories: JSON.parse(asset.accessories || '[]')
      },
      activeReservations: reservations,
      maintenanceTickets: tickets
    });
  } catch (error) {
    console.error('Get asset by id error:', error);
    return res.status(500).json({ error: 'Failed to retrieve asset details' });
  }
}

async function checkAvailability(req, res) {
  try {
    const { id } = req.params;
    const { startTime, endTime, excludeReservationId } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime query parameters are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return res.status(400).json({ error: 'startTime must be strictly before endTime' });
    }

    if (isMongo()) {
      const asset = await Asset.findById(id);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      if (asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED') {
        return res.json({
          available: false,
          reason: `Asset is currently under ${asset.status} lock and cannot be booked.`,
          conflicts: []
        });
      }

      const conflictFilter = {
        assetId: id,
        status: { $in: ['CONFIRMED', 'CHECKED_OUT'] },
        $or: [
          { startTime: { $lte: start }, endTime: { $gt: start } },
          { startTime: { $lt: end }, endTime: { $gte: end } },
          { startTime: { $gte: start }, endTime: { $lte: end } }
        ]
      };

      if (excludeReservationId) {
        conflictFilter._id = { $ne: excludeReservationId };
      }

      const conflicts = await Reservation.find(conflictFilter);

      return res.json({
        available: conflicts.length === 0,
        conflicts: conflicts.map(c => c.toJSON()),
        reason: conflicts.length === 0 ? 'Slot is available for booking' : 'Overlaps with existing confirmed/active booking'
      });
    }

    const db = getDb();
    const asset = db.prepare('SELECT id, name, status, conditionGrade FROM assets WHERE id = ?').get(id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.status === 'MAINTENANCE' || asset.status === 'DECOMMISSIONED') {
      return res.json({
        available: false,
        reason: `Asset is currently under ${asset.status} lock and cannot be booked.`,
        conflicts: []
      });
    }

    const startIso = start.toISOString();
    const endIso = end.toISOString();

    let conflictQuery = `
      SELECT id, startTime, endTime, status
      FROM reservations
      WHERE assetId = ?
        AND status IN ('CONFIRMED', 'CHECKED_OUT')
        AND (
          (startTime <= ? AND endTime > ?) OR
          (startTime < ? AND endTime >= ?) OR
          (startTime >= ? AND endTime <= ?)
        )
    `;
    const params = [id, startIso, startIso, endIso, endIso, startIso, endIso];

    if (excludeReservationId) {
      conflictQuery += ' AND id != ?';
      params.push(excludeReservationId);
    }

    const conflicts = db.prepare(conflictQuery).all(...params);

    return res.json({
      available: conflicts.length === 0,
      conflicts,
      reason: conflicts.length === 0 ? 'Slot is available for booking' : 'Overlaps with existing confirmed/active booking'
    });
  } catch (error) {
    console.error('Check availability error:', error);
    return res.status(500).json({ error: 'Failed to check asset availability' });
  }
}

async function createAsset(req, res) {
  try {
    const {
      assetTag,
      name,
      category,
      description,
      imageUrl,
      conditionGrade = 'EXCELLENT',
      hourlyPenaltyRate = 15.0,
      replacementCost = 2000.0,
      accessories = [],
      location = 'Central Media Vault (Bay 1)'
    } = req.body;

    if (!assetTag || !name || !category) {
      return res.status(400).json({ error: 'assetTag, name, and category are required' });
    }

    if (isMongo()) {
      const existing = await Asset.findOne({ assetTag: assetTag.trim().toUpperCase() });
      if (existing) {
        return res.status(409).json({ error: 'Asset with this assetTag already exists' });
      }

      const asset = await Asset.create({
        assetTag: assetTag.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim(),
        description: description || '',
        imageUrl: imageUrl || '',
        conditionGrade,
        hourlyPenaltyRate,
        replacementCost,
        accessories: Array.isArray(accessories) ? accessories : [],
        location
      });

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'ASSET_CREATED',
        targetType: 'ASSET',
        targetId: asset._id.toString(),
        details: `Created new asset ${asset.assetTag}: ${asset.name}`
      });

      return res.status(201).json({
        message: 'Asset created successfully',
        asset: asset.toJSON(),
        assetId: asset._id.toString()
      });
    }

    const db = getDb();
    const actorId = resolveSqliteUserId(db, req.user);
    const existing = db.prepare('SELECT id FROM assets WHERE assetTag = ?').get(assetTag.trim());
    if (existing) {
      return res.status(409).json({ error: 'Asset with this assetTag already exists' });
    }

    const result = db.prepare(`
      INSERT INTO assets (assetTag, name, category, description, imageUrl, conditionGrade, hourlyPenaltyRate, replacementCost, accessories, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      assetTag.trim().toUpperCase(),
      name.trim(),
      category.trim(),
      description || '',
      imageUrl || '',
      conditionGrade,
      hourlyPenaltyRate,
      replacementCost,
      JSON.stringify(Array.isArray(accessories) ? accessories : []),
      location
    );

    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'ASSET_CREATED', 'ASSET', ?, ?)
    `).run(
      actorId,
      req.user.name,
      result.lastInsertRowid,
      `Created new asset ${assetTag.trim().toUpperCase()}: ${name.trim()}`
    );

    return res.status(201).json({
      message: 'Asset created successfully',
      assetId: result.lastInsertRowid
    });
  } catch (error) {
    console.error('Create asset error:', error);
    return res.status(500).json({ error: 'Failed to create asset' });
  }
}

async function updateAsset(req, res) {
  try {
    const { id } = req.params;
    const { name, category, description, imageUrl, conditionGrade, status, hourlyPenaltyRate, replacementCost, accessories, location } = req.body;

    if (isMongo()) {
      const updateData = {};
      if (name) updateData.name = name;
      if (category) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (conditionGrade) updateData.conditionGrade = conditionGrade;
      if (status) updateData.status = status;
      if (hourlyPenaltyRate !== undefined) updateData.hourlyPenaltyRate = hourlyPenaltyRate;
      if (replacementCost !== undefined) updateData.replacementCost = replacementCost;
      if (accessories) updateData.accessories = accessories;
      if (location) updateData.location = location;

      const asset = await Asset.findByIdAndUpdate(id, updateData, { new: true });
      if (!asset) return res.status(404).json({ error: 'Asset not found' });

      await AuditLog.create({
        actorId: req.user.id,
        actorName: req.user.name,
        action: 'ASSET_UPDATED',
        targetType: 'ASSET',
        targetId: asset._id.toString(),
        details: `Updated asset ${asset.assetTag}`
      });

      return res.json({ message: 'Asset updated successfully', asset: asset.toJSON() });
    }

    const db = getDb();
    const actorId = resolveSqliteUserId(db, req.user);
    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    db.prepare(`
      UPDATE assets SET
        name = COALESCE(?, name),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        imageUrl = COALESCE(?, imageUrl),
        conditionGrade = COALESCE(?, conditionGrade),
        status = COALESCE(?, status),
        hourlyPenaltyRate = COALESCE(?, hourlyPenaltyRate),
        replacementCost = COALESCE(?, replacementCost),
        accessories = COALESCE(?, accessories),
        location = COALESCE(?, location)
      WHERE id = ?
    `).run(
      name,
      category,
      description,
      imageUrl,
      conditionGrade,
      status,
      hourlyPenaltyRate,
      replacementCost,
      accessories ? JSON.stringify(accessories) : null,
      location,
      id
    );

    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'ASSET_UPDATED', 'ASSET', ?, ?)
    `).run(
      actorId,
      req.user.name,
      id,
      `Updated asset ${existing.assetTag}`
    );

    return res.json({ message: 'Asset updated successfully' });
  } catch (error) {
    console.error('Update asset error:', error);
    return res.status(500).json({ error: 'Failed to update asset' });
  }
}

async function getCategories(req, res) {
  try {
    if (isMongo()) {
      const distinctCategories = await Asset.distinct('category');
      const counts = await Promise.all(
        distinctCategories.map(async cat => ({
          category: cat,
          count: await Asset.countDocuments({ category: cat })
        }))
      );
      counts.sort((a, b) => b.count - a.count);
      return res.json({ categories: counts });
    }

    const db = getDb();
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM assets
      GROUP BY category
      ORDER BY count DESC
    `).all();
    return res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({ error: 'Failed to retrieve categories' });
  }
}

module.exports = {
  getAllAssets,
  getAssetById,
  checkAvailability,
  createAsset,
  updateAsset,
  getCategories
};
