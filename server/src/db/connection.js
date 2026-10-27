const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../gearflow.sqlite');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('borrower', 'custodian', 'admin')),
      department TEXT,
      phone TEXT,
      depositBalance REAL DEFAULT 250.0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetTag TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      imageUrl TEXT,
      conditionGrade TEXT NOT NULL DEFAULT 'EXCELLENT' CHECK(conditionGrade IN ('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED')),
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'RESERVED', 'IN_USE', 'MAINTENANCE', 'DECOMMISSIONED')),
      hourlyPenaltyRate REAL NOT NULL DEFAULT 15.0,
      replacementCost REAL NOT NULL DEFAULT 2000.0,
      accessories TEXT DEFAULT '[]',
      location TEXT DEFAULT 'Central Media Vault (Bay 1)',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      startTime DATETIME NOT NULL,
      endTime DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('PENDING', 'CONFIRMED', 'CHECKED_OUT', 'RETURNED', 'OVERDUE', 'CANCELLED', 'FLAGGED_DAMAGE')),
      purpose TEXT,
      checkedOutAt DATETIME,
      checkedOutBy INTEGER REFERENCES users(id),
      checkoutChecklist TEXT DEFAULT '{}',
      checkoutNotes TEXT,
      returnedAt DATETIME,
      receivedBy INTEGER REFERENCES users(id),
      returnInspection TEXT DEFAULT '{}',
      returnNotes TEXT,
      overduePenaltyFee REAL DEFAULT 0.0,
      damagePenaltyFee REAL DEFAULT 0.0,
      penaltyStatus TEXT DEFAULT 'NONE' CHECK(penaltyStatus IN ('NONE', 'ASSESSED', 'PAID', 'WAIVED')),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS maintenance_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      reportedBy INTEGER NOT NULL REFERENCES users(id),
      reservationId INTEGER REFERENCES reservations(id),
      issueDescription TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
      status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
      assignedTo TEXT,
      estimatedRepairCost REAL DEFAULT 0.0,
      resolutionNotes TEXT,
      resolvedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actorId INTEGER REFERENCES users(id),
      actorName TEXT NOT NULL,
      action TEXT NOT NULL,
      targetType TEXT NOT NULL,
      targetId INTEGER NOT NULL,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_res_asset_time ON reservations(assetId, startTime, endTime, status);
    CREATE INDEX IF NOT EXISTS idx_res_user ON reservations(userId);
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_tickets_asset ON maintenance_tickets(assetId);
  `);
}

module.exports = { getDb };
