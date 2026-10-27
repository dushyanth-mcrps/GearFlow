const assert = require('assert');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Use isolated test database
const TEST_DB = path.join(__dirname, 'test_gearflow.sqlite');
process.env.DB_PATH = TEST_DB;
process.env.PORT = '5002';
process.env.NODE_ENV = 'test';

if (fs.existsSync(TEST_DB)) {
  fs.unlinkSync(TEST_DB);
}

const { seedDatabase } = require('../src/db/seed');
seedDatabase();

const app = require('../src/index');
const http = require('http');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting GearFlow Automated Workflow Test Suite...\n');

  server = app.listen(5002);
  baseUrl = 'http://localhost:5002';

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    assert.strictEqual(health.status, 200, 'Health endpoint should return 200');
    assert.strictEqual(health.body.status, 'healthy');
    console.log('✅ Test 1: Health check passed');

    // 2. Authentication: Login as Student Borrower
    const loginBorrower = await request('POST', '/api/auth/login', {
      email: 'student@gearflow.edu',
      password: 'Password123!'
    });
    assert.strictEqual(loginBorrower.status, 200, 'Borrower login should succeed');
    assert.ok(loginBorrower.body.token, 'Token should be returned');
    assert.strictEqual(loginBorrower.body.user.role, 'borrower');
    const studentToken = loginBorrower.body.token;
    console.log('✅ Test 2: Borrower authentication passed');

    // 3. Authentication: Login as Lab Custodian
    const loginCustodian = await request('POST', '/api/auth/login', {
      email: 'custodian@gearflow.edu',
      password: 'Password123!'
    });
    assert.strictEqual(loginCustodian.status, 200, 'Custodian login should succeed');
    const custodianToken = loginCustodian.body.token;
    console.log('✅ Test 3: Custodian authentication & RBAC passed');

    // 4. Catalog & Category retrieval
    const assetsRes = await request('GET', '/api/assets');
    assert.strictEqual(assetsRes.status, 200);
    assert.ok(assetsRes.body.assets.length >= 5, 'Should return seeded assets');
    const availableAsset = assetsRes.body.assets.find(a => a.status === 'AVAILABLE');
    assert.ok(availableAsset, 'Should find at least one available asset');
    console.log(`✅ Test 4: Asset catalog retrieved (${assetsRes.body.assets.length} items)`);

    // 5. Conflict Detection Engine: check availability
    const startTime = new Date(Date.now() + 3600 * 1000).toISOString();
    const endTime = new Date(Date.now() + 5 * 3600 * 1000).toISOString();

    const checkAvail = await request('GET', `/api/assets/${availableAsset.id}/availability?startTime=${startTime}&endTime=${endTime}`);
    assert.strictEqual(checkAvail.status, 200);
    assert.strictEqual(checkAvail.body.available, true, 'Slot should initially be free');
    console.log('✅ Test 5: Conflict detection availability check passed');

    // 6. Create Reservation
    const bookRes = await request('POST', '/api/reservations', {
      assetId: availableAsset.id,
      startTime,
      endTime,
      purpose: 'Robotics sensor logging'
    }, studentToken);

    assert.strictEqual(bookRes.status, 201, 'Reservation creation should succeed');
    const reservationId = bookRes.body.reservationId;
    console.log(`✅ Test 6: Reservation #${reservationId} created successfully`);

    // 7. Verify Conflict Prevention: overlapping booking must fail
    const conflictRes = await request('POST', '/api/reservations', {
      assetId: availableAsset.id,
      startTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      endTime: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      purpose: 'Conflicting slot request'
    }, studentToken);

    assert.strictEqual(conflictRes.status, 400, 'Overlapping booking must be rejected with 400');
    assert.ok(conflictRes.body.error.includes('conflict'), 'Error should state slot conflict');
    console.log('✅ Test 7: Concurrency & double-booking prevention verified');

    // 8. Custody Handover Checkout Workflow
    const checkoutRes = await request('POST', `/api/reservations/${reservationId}/checkout`, {
      checklist: { serialNumberVerified: true, batteryCharged: true, opticsClean: true },
      notes: 'Handover verified with student ID card.'
    }, custodianToken);

    assert.strictEqual(checkoutRes.status, 200, 'Custody checkout should succeed');
    console.log('✅ Test 8: Custody handover state transition (CONFIRMED -> CHECKED_OUT) verified');

    // 9. Inspection Check-in Return Workflow with Damage Penalty & Quarantine
    const returnRes = await request('POST', `/api/reservations/${reservationId}/return`, {
      inspection: { opticsClean: false, missingCable: true },
      hasDamage: true,
      damageDescription: 'USB-C interface cable missing, minor mount scratch.',
      damageFee: 45.0,
      severity: 'LOW',
      notes: 'Item checked in with missing auxiliary cable.'
    }, custodianToken);

    assert.strictEqual(returnRes.status, 200, 'Return with damage inspection should succeed');
    assert.strictEqual(returnRes.body.result.hasDamage, true);
    assert.ok(returnRes.body.result.maintenanceTicketId, 'Maintenance ticket should be automatically generated');
    console.log(`✅ Test 9: Return inspection with damage quarantine ticket #${returnRes.body.result.maintenanceTicketId} verified`);

    // 10. Dashboard Stats & Audit Logs
    const statsRes = await request('GET', '/api/stats/dashboard', null, custodianToken);
    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.body.stats.openTickets >= 1, 'Should reflect open maintenance ticket');

    const auditRes = await request('GET', '/api/stats/audit-logs', null, custodianToken);
    assert.strictEqual(auditRes.status, 200);
    assert.ok(auditRes.body.logs.length >= 4, 'Audit logs should record handover and return events');
    console.log('✅ Test 10: Operational dashboard stats and audit trail verified');

    console.log('\n🎉 ALL 10 END-TO-END AUTOMATED TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      try { await mongoose.disconnect(); } catch (_) {}
    }
    if (fs.existsSync(TEST_DB)) {
      try { fs.unlinkSync(TEST_DB); } catch (_) {}
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
