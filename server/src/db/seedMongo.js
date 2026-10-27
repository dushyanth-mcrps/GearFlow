const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { connectMongo } = require('./mongoConnection');
const User = require('../models/User');
const Asset = require('../models/Asset');
const Reservation = require('../models/Reservation');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const AuditLog = require('../models/AuditLog');

async function seedMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in server/.env. Please provide your connection string.');
    process.exit(1);
  }

  console.log('🌱 Connecting to MongoDB to seed initial demo dataset...');
  const connected = await connectMongo(uri);
  if (!connected) {
    console.error('❌ Could not connect to MongoDB. Check your credentials and network access in server/.env');
    process.exit(1);
  }

  try {
    // Clear existing collections
    await AuditLog.deleteMany({});
    await MaintenanceTicket.deleteMany({});
    await Reservation.deleteMany({});
    await Asset.deleteMany({});
    await User.deleteMany({});
    console.log('🧹 Cleared existing collections.');

    const passwordHash = bcrypt.hashSync('Password123!', 10);

    // 1. Seed Users
    const custodian = await User.create({
      name: 'Alex Rivers',
      email: 'custodian@gearflow.edu',
      password: passwordHash,
      role: 'custodian',
      department: 'Media Arts Equipment Central',
      phone: '+1 (555) 234-5678',
      depositBalance: 500.0
    });

    const admin = await User.create({
      name: 'Dr. Elena Vance',
      email: 'admin@gearflow.edu',
      password: passwordHash,
      role: 'admin',
      department: 'Department of Media & Technology',
      phone: '+1 (555) 345-6789',
      depositBalance: 1000.0
    });

    const borrower1 = await User.create({
      name: 'Marcus Chen',
      email: 'student@gearflow.edu',
      password: passwordHash,
      role: 'borrower',
      department: 'Film & Digital Media (Year 3)',
      phone: '+1 (555) 890-1234',
      depositBalance: 200.0
    });

    const borrower2 = await User.create({
      name: 'Sophia Martinez',
      email: 'sophia@gearflow.edu',
      password: passwordHash,
      role: 'borrower',
      department: 'Robotics & Embedded Systems',
      phone: '+1 (555) 456-7890',
      depositBalance: 300.0
    });
    console.log('✅ Seeded 4 Users (Borrowers, Custodian, Admin)');

    // 2. Seed Assets
    const redKomodo = await Asset.create({
      assetTag: 'CAM-RED-001',
      name: 'RED Komodo 6K Cinema Camera Kit',
      category: 'Cameras & Optics',
      description: 'Super35 sensor 6K cinema camera, Canon RF mount, dual BP battery plate, top handle, and 512GB CFast 2.0 card.',
      imageUrl: 'https://images.unsplash.com/photo-1589872782352-aa3821a3641b?w=800&auto=format&fit=crop&q=80',
      conditionGrade: 'EXCELLENT',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 25.0,
      replacementCost: 5995.0,
      accessories: ['RF-to-EF Adapter', '2x 98Wh V-Mount Batteries', 'Dual Charger', 'Pelican 1510 Hard Case'],
      location: 'Central Vault Bay 1 - Locker A3'
    });

    const sonyFx3 = await Asset.create({
      assetTag: 'CAM-SNY-002',
      name: 'Sony FX3 Full-Frame Cinema Line',
      category: 'Cameras & Optics',
      description: 'Compact 4K full-frame camera with XLR handle unit, cooling fan for unlimited recording, and IBIS.',
      imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop&q=80',
      conditionGrade: 'GOOD',
      status: 'IN_USE',
      hourlyPenaltyRate: 20.0,
      replacementCost: 3899.0,
      accessories: ['XLR Top Handle Unit', '3x NP-FZ100 Batteries', 'Dual Bay Charger'],
      location: 'Central Vault Bay 1 - Locker A4'
    });

    const djiRonin = await Asset.create({
      assetTag: 'GIM-DJI-001',
      name: 'DJI RS 3 Pro Gimbal Stabilizer Combo',
      category: 'Gimbals & Support',
      description: 'Automated axis locks, extended carbon fiber axis arms, 4.5kg payload capacity, LiDAR focusing compatible.',
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
      conditionGrade: 'GOOD',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 15.0,
      replacementCost: 869.0,
      accessories: ['Focus Motor (2022)', 'RavenEye Image Transmitter', 'Briefcase Handle'],
      location: 'Central Vault Bay 2 - Shelf B1'
    });

    const sennheiserKit = await Asset.create({
      assetTag: 'AUD-SNN-001',
      name: 'Sennheiser MKH 416 Shotgun Mic & Boom Kit',
      category: 'Audio Gear',
      description: 'Industry-standard moisture-resistant interference tube shotgun microphone with K-Tek carbon fiber boom pole and blimp.',
      imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=800&auto=format&fit=crop&q=80',
      conditionGrade: 'EXCELLENT',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 12.0,
      replacementCost: 1199.0,
      accessories: ['Rycote Windshield Blimp', 'K-Tek Avalon 9ft Boom', '25ft Canare StarQuad XLR'],
      location: 'Audio Locker A - Drawer 2'
    });

    const aputureLight = await Asset.create({
      assetTag: 'LGT-APT-001',
      name: 'Aputure LS 600d Pro Daylight LED Kit',
      category: 'Lighting & Grip',
      description: 'Weather-resistant 600W daylight COB LED fixture with Bowens mount, rolling flight case, and hyper reflector.',
      imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80',
      conditionGrade: 'GOOD',
      status: 'AVAILABLE',
      hourlyPenaltyRate: 18.0,
      replacementCost: 1890.0,
      accessories: ['Control Box', '5-Pin XLR Head Cable', 'Quick-Release Clamp', 'Rolling Hard Case'],
      location: 'Grip Bay 4 - Cart 2'
    });

    const questPro = await Asset.create({
      assetTag: 'VR-MTA-001',
      name: 'Meta Quest Pro Mixed Reality Spatial Rig',
      category: 'Spatial Computing',
      description: 'High-resolution color passthrough, eye & face tracking, 12GB RAM, Snapdragon XR2+ platform for spatial development.',
      imageUrl: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1df?w=800&auto=format&fit=crop&q=80',
      conditionGrade: 'DAMAGED',
      status: 'MAINTENANCE',
      hourlyPenaltyRate: 15.0,
      replacementCost: 999.0,
      accessories: ['Touch Pro Controllers (L/R)', 'Charging Dock', '45W USB-C Adapter'],
      location: 'Quarantine Maintenance Shelf - QA02'
    });
    console.log('✅ Seeded 6 Assets across all categories');

    // 3. Seed Reservations
    const now = new Date();
    const activeRes = await Reservation.create({
      assetId: sonyFx3._id,
      userId: borrower1._id,
      startTime: new Date(now.getTime() - 2 * 3600 * 1000),
      endTime: new Date(now.getTime() + 6 * 3600 * 1000),
      status: 'CHECKED_OUT',
      purpose: 'Advanced Cinematography Documentary Thesis',
      checkedOutAt: new Date(now.getTime() - 2 * 3600 * 1000),
      checkedOutBy: custodian._id,
      checkoutChecklist: {
        serialNumberVerified: true,
        batteryCharged: true,
        sensorClean: true,
        accessoriesConfirmed: true
      },
      checkoutNotes: 'Dispatched to student with 3x charged batteries.'
    });

    // 4. Seed Maintenance Quarantine Ticket
    await MaintenanceTicket.create({
      assetId: questPro._id,
      reportedBy: custodian._id,
      issueDescription: 'Left Touch Pro controller analog stick experiencing drift; primary passthrough sensor lens scratched.',
      severity: 'HIGH',
      status: 'OPEN',
      assignedTo: 'Hardware Repair Specialist (Bay 3)',
      estimatedRepairCost: 180.0
    });
    console.log('✅ Seeded Maintenance Quarantine Ticket');

    // 5. Seed Audit Logs
    await AuditLog.create({
      actorId: custodian._id,
      actorName: 'Alex Rivers',
      action: 'CHECKOUT_DISPATCH',
      targetType: 'RESERVATION',
      targetId: activeRes._id.toString(),
      details: 'Dispatched Sony FX3 to Marcus Chen. Pre-flight verification passed.'
    });

    await AuditLog.create({
      actorId: custodian._id,
      actorName: 'Alex Rivers',
      action: 'QUARANTINE_FLAGGED',
      targetType: 'ASSET',
      targetId: questPro._id.toString(),
      details: 'Meta Quest Pro quarantined due to hardware defects. Maintenance workorder opened.'
    });
    console.log('✅ Seeded Audit Logs');

    console.log('\n🎉 MongoDB database seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during MongoDB seeding:', error);
    process.exit(1);
  }
}

seedMongo();
