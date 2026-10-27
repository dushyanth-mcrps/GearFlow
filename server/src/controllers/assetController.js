const { getDb } = require('../db/connection');

function getAllAssets(req, res) {
  try {
    const db = getDb();
    const { search, category, status, conditionGrade } = req.query;

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

function getAssetById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

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

function checkAvailability(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { startTime, endTime, excludeReservationId } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'startTime and endTime query parameters are required' });
    }

    const start = new Date(startTime).toISOString();
    const end = new Date(endTime).toISOString();

    if (start >= end) {
      return res.status(400).json({ error: 'startTime must be strictly before endTime' });
    }

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
    const params = [id, start, start, end, end, start, end];

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

function createAsset(req, res) {
  try {
    const db = getDb();
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

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'ASSET_CREATED', 'ASSET', ?, ?)
    `).run(
      req.user.id,
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

function updateAsset(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, category, description, imageUrl, conditionGrade, status, hourlyPenaltyRate, replacementCost, accessories, location } = req.body;

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

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
      VALUES (?, ?, 'ASSET_UPDATED', 'ASSET', ?, ?)
    `).run(
      req.user.id,
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

function getCategories(req, res) {
  try {
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
