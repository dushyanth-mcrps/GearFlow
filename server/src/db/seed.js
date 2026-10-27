const bcrypt = require('bcryptjs');
const { getDb } = require('./connection');

function seedDatabase() {
  const db = getDb();
  console.log('🌱 Starting GearFlow database seed...');

  // Clear existing data in reverse dependency order
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM maintenance_tickets;
    DELETE FROM reservations;
    DELETE FROM assets;
    DELETE FROM users;
  `);

  const passwordHash = bcrypt.hashSync('Password123!', 10);

  // 1. Seed Users (Roles: borrower, custodian, admin)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password, role, department, phone, depositBalance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const custodian = insertUser.run(
    'Alex Rivers',
    'custodian@gearflow.edu',
    passwordHash,
    'custodian',
    'Media Arts Equipment Central',
    '+1 (555) 234-5678',
    500.0
  );

  const admin = insertUser.run(
    'Dr. Elena Vance',
    'admin@gearflow.edu',
    passwordHash,
    'admin',
    'Department of Media & Technology',
    '+1 (555) 345-6789',
    1000.0
  );

  const borrower1 = insertUser.run(
    'Marcus Chen',
    'student@gearflow.edu',
    passwordHash,
    'borrower',
    'Film & Digital Media (Year 3)',
    '+1 (555) 890-1234',
    200.0
  );

  const borrower2 = insertUser.run(
    'Sophia Martinez',
    'sophia@gearflow.edu',
    passwordHash,
    'borrower',
    'Robotics & Embedded Systems',
    '+1 (555) 901-2345',
    150.0
  );

  console.log('✅ Users seeded successfully.');

  // 2. Seed Assets
  const insertAsset = db.prepare(`
    INSERT INTO assets (assetTag, name, category, description, imageUrl, conditionGrade, status, hourlyPenaltyRate, replacementCost, accessories, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const assetsData = [
    {
      assetTag: 'CAM-A7IV-01',
      name: 'Sony Alpha A7 IV Cinema Rig',
      category: 'Cinematography',
      description: '33MP Full-frame hybrid cinema mirrorless camera with 4K 60p, SmallRig full cage, and top handle.',
      imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
      conditionGrade: 'EXCELLENT',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 20.0,
      replacementCost: 2800.0,
      accessories: JSON.stringify(['2x 128GB V90 SD Cards', '3x NP-FZ100 Batteries', 'Dual Charger', 'HDMI Lock']),
      location: 'Vault Bay 1 - Locker 102'
    },
    {
      assetTag: 'CAM-RED-02',
      name: 'RED Komodo 6K Production Kit',
      category: 'Cinematography',
      description: 'Super 35 Global Shutter Cinema Camera with Canon RF mount, Outrigger handle, and Wing grip.',
      imageUrl: 'https://images.unsplash.com/photo-1589872765879-c5c7ce1a547b?auto=format&fit=crop&w=600&q=80',
      conditionGrade: 'GOOD',
      status: 'IN_USE',
      hourlyPenaltyRate: 35.0,
      replacementCost: 6500.0,
      accessories: JSON.stringify(['2x 512GB CFast 2.0', '4x BP-975 Batteries', 'Wooden Camera Cage', 'D-Tap Cable']),
      location: 'Vault Bay 1 - Locker 108'
    },
    {
      assetTag: 'GIM-RS3-01',
      name: 'DJI RS 3 Pro 3-Axis Gimbal',
      category: 'Stabilizers & Support',
      description: 'Automated axis locks, extended carbon fiber axis arms, 4.5kg tested payload, LiDAR focusing support.',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
      conditionGrade: 'EXCELLENT',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 15.0,
      replacementCost: 1100.0,
      accessories: JSON.stringify(['Briefcase Handle', 'Focus Motor', 'LiDAR Range Finder Cable', 'RavenEye Transmitter']),
      location: 'Gimbal Rack C - Slot 03'
    },
    {
      assetTag: 'AUD-SENN-01',
      name: 'Sennheiser MKH 416 Boom Mic Kit',
      category: 'Audio Gear',
      description: 'Industry-standard moisture-resistant interference tube shotgun microphone with Rycote blimp and boom pole.',
      imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=600&q=80',
      conditionGrade: 'GOOD',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 12.0,
      replacementCost: 1250.0,
      accessories: JSON.stringify(['Rycote Windshield Blimp', 'Windjammer Fur', 'K-Tek Carbon Pole', '10m Canare XLR']),
      location: 'Audio Cabinet - Drawer 2'
    },
    {
      assetTag: 'VR-META-01',
      name: 'Meta Quest Pro Spatial Lab Headset',
      category: 'Computing & VR',
      description: 'Enterprise XR headset with full-color passthrough, eye-tracking, and high-res stereoscopic displays.',
      imageUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?auto=format&fit=crop&w=600&q=80',
      conditionGrade: 'DAMAGED',
      status: 'MAINTENANCE',
      hourlyPenaltyRate: 25.0,
      replacementCost: 1600.0,
      accessories: JSON.stringify(['2x Touch Pro Controllers', 'Charging Dock', '65W GaN Adapter', 'Link Cable']),
      location: 'Quarantine Rack - Tech Bay B'
    },
    {
      assetTag: 'LAB-RIGOL-01',
      name: 'Rigol DS1054Z Digital Oscilloscope',
      category: 'Lab Instruments',
      description: '50 MHz 4-Channel digital storage oscilloscope, 1 GSa/s, 24 Mpts memory depth, ultra-low noise floor.',
      imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
      conditionGrade: 'EXCELLENT',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 15.0,
      replacementCost: 850.0,
      accessories: JSON.stringify(['4x Passive Probes (150MHz)', 'Power Cable', 'USB Calibration Lead']),
      location: 'Hardware Engineering Bench 4'
    }
  ];

  const assetIds = {};
  for (const asset of assetsData) {
    const res = insertAsset.run(
      asset.assetTag,
      asset.name,
      asset.category,
      asset.description,
      asset.imageUrl,
      asset.conditionGrade,
      asset.status,
      asset.hourlyPenaltyRate,
      asset.replacementCost,
      asset.accessories,
      asset.location
    );
    assetIds[asset.assetTag] = res.lastInsertRowid;
  }
  console.log(`✅ Assets seeded (${Object.keys(assetIds).length} items).`);

  // 3. Seed Reservations demonstrating diverse lifecycle states
  const insertReservation = db.prepare(`
    INSERT INTO reservations (
      assetId, userId, startTime, endTime, status, purpose,
      checkedOutAt, checkedOutBy, checkoutChecklist, checkoutNotes,
      returnedAt, receivedBy, returnInspection, returnNotes,
      overduePenaltyFee, damagePenaltyFee, penaltyStatus
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const past2Days = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();
  const past24Hours = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const past4Hours = new Date(now.getTime() - 4 * 3600 * 1000).toISOString();
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const next3Days = new Date(now.getTime() + 72 * 3600 * 1000).toISOString();

  // Reservation 1: Active Loan (In Use) - RED Komodo with Marcus Chen
  const res1 = insertReservation.run(
    assetIds['CAM-RED-02'],
    borrower1.lastInsertRowid,
    past24Hours,
    tomorrow,
    'CHECKED_OUT',
    'Graduation Thesis Short Film - Principal Photography Day 1',
    past24Hours,
    custodian.lastInsertRowid,
    JSON.stringify({ batteryOk: true, sensorClean: true, accessoriesVerified: true, firmwareChecked: true }),
    'Borrower verified sensor cleanliness and took cage assembled.',
    null,
    null,
    '{}',
    null,
    0.0,
    0.0,
    'NONE'
  );

  // Reservation 2: Completed and Clean Return
  const res2 = insertReservation.run(
    assetIds['CAM-A7IV-01'],
    borrower1.lastInsertRowid,
    past2Days,
    past24Hours,
    'RETURNED',
    'Documentary Interview Recording for Campus Innovation Week',
    past2Days,
    custodian.lastInsertRowid,
    JSON.stringify({ batteryOk: true, sensorClean: true, accessoriesVerified: true }),
    'All parts checked and functioning.',
    past24Hours,
    custodian.lastInsertRowid,
    JSON.stringify({ conditionMatched: true, accessoriesAllReturned: true, physicalDamage: false }),
    'Gear inspected clean. Returned with full battery recharge.',
    0.0,
    0.0,
    'NONE'
  );

  // Reservation 3: Upcoming Confirmed Reservation for Sophia
  insertReservation.run(
    assetIds['LAB-RIGOL-01'],
    borrower2.lastInsertRowid,
    tomorrow,
    next3Days,
    'CONFIRMED',
    'Autonomous Drone Motor ESC Waveform Signal Debugging',
    null,
    null,
    '{}',
    null,
    null,
    null,
    '{}',
    null,
    0.0,
    0.0,
    'NONE'
  );

  // Reservation 4: Returned with Damage / Overdue Penalty Demonstration
  const res4 = insertReservation.run(
    assetIds['VR-META-01'],
    borrower2.lastInsertRowid,
    past2Days,
    past4Hours,
    'FLAGGED_DAMAGE',
    'XR Spatial Mapping Pilot Demo',
    past2Days,
    custodian.lastInsertRowid,
    JSON.stringify({ lensesFlawless: true, controllersPaired: true }),
    'Issued in pristine condition.',
    past4Hours,
    custodian.lastInsertRowid,
    JSON.stringify({
      conditionMatched: false,
      rightControllerDrift: true,
      frontFaceplateCracked: true,
      accessoriesAllReturned: true
    }),
    'Returned with hairline crack on front sensor array cover.',
    25.0, // overdue fee
    180.0, // damage assessment
    'ASSESSED'
  );

  console.log('✅ Reservations seeded with active, completed, and flagged states.');

  // 4. Seed Maintenance Ticket linked to Reservation 4
  const insertTicket = db.prepare(`
    INSERT INTO maintenance_tickets (assetId, reportedBy, reservationId, issueDescription, severity, status, assignedTo, estimatedRepairCost, resolutionNotes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTicket.run(
    assetIds['VR-META-01'],
    custodian.lastInsertRowid,
    res4.lastInsertRowid,
    'Front glass sensor casing cracked during spatial mapping run. Right haptic trigger sticky.',
    'HIGH',
    'IN_PROGRESS',
    'Lab Technician Dave O.',
    210.0,
    'Replacement front visor ordered from vendor. Right joystick contact cleaner applied.'
  );

  console.log('✅ Maintenance quarantine ticket seeded.');

  // 5. Seed Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (actorId, actorName, action, targetType, targetId, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    custodian.lastInsertRowid,
    'Alex Rivers (Custodian)',
    'CUSTODY_HANDOVER',
    'RESERVATION',
    res1.lastInsertRowid,
    'Handed over RED Komodo 6K to Marcus Chen. Digital safety checklist signed.'
  );

  insertAudit.run(
    custodian.lastInsertRowid,
    'Alex Rivers (Custodian)',
    'RETURN_INSPECTED',
    'RESERVATION',
    res2.lastInsertRowid,
    'Received Sony Alpha A7 IV back from Marcus Chen. Condition EXCELLENT, deposit intact.'
  );

  insertAudit.run(
    custodian.lastInsertRowid,
    'Alex Rivers (Custodian)',
    'DAMAGE_FLAGGED',
    'ASSET',
    assetIds['VR-META-01'],
    'Asset VR-META-01 automatically locked into MAINTENANCE quarantine following damage inspection.'
  );

  console.log('✅ Audit logs seeded.');
  console.log('🎉 Database initialization complete!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
