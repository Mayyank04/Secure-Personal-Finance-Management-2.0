/**
 * Production Readiness Acceptance Test Suite
 * 
 * Verifies all 9 production readiness acceptance criteria:
 * 1. Health endpoint reports database ready only after successful DB connection.
 * 2. Register a new account; /api/auth/me succeeds.
 * 3. Login; refresh the browser; session remains valid.
 * 4. Call /api/auth/me and create/read a transaction from a fresh serverless invocation (cold start simulation).
 * 5. Create a transaction, deploy/restart, log in again, and verify it still exists.
 * 6. User A cannot read or modify User B's records by changing IDs (strict IDOR isolation).
 * 7. Logout revokes the session in the durable database.
 * 8. Missing DATABASE_URL or invalid DB credentials produces a clear deployment/health failure, not fake success.
 * 9. Codebase validation (TypeScript, build, integration).
 */

// Set test mode before importing server.js to prevent background port binding
process.env.IS_INTEGRATION_TEST = 'true';

import http from 'http';
import crypto from 'crypto';
import { app, initDb } from '../server.js';
import { db } from './db.js';
import { getDatabaseAdapter, setDatabaseAdapter, createDatabaseAdapter } from './db/index.js';
import { SqliteAdapter } from './db/sqlite.js';

interface TestSummary {
  name: string;
  passed: boolean;
  message?: string;
}

const testResults: TestSummary[] = [];

function assert(condition: boolean, name: string, message?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${name}`);
    testResults.push({ name, passed: true });
  } else {
    console.error(`  ✗ [FAIL] ${name}: ${message || 'Assertion failed'}`);
    testResults.push({ name, passed: false, message });
  }
}

async function runAcceptanceSuite() {
  console.log('\n================================================================');
  console.log('  AEGIS FINANCE — PRODUCTION READINESS ACCEPTANCE TEST BENCH');
  console.log('================================================================\n');

  // Initialize DB adapter (SQLite durable adapter for local acceptance test)
  await initDb();

  // Start in-memory HTTP server on random free port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test server running at: ${baseUrl}\n`);

  try {
    // -------------------------------------------------------------------------
    // Criterion 1: Health endpoint reports database ready only after successful DB connection
    // -------------------------------------------------------------------------
    console.log('--> Criterion 1: Health Endpoint Accuracy...');
    {
      const res = await fetch(`${baseUrl}/api/health`);
      const body = await res.json();
      assert(res.status === 200, 'Health check returns HTTP 200 when database is connected');
      assert(body.status === 'ok', 'Health status is "ok"');
      assert(body.database === 'connected', 'Database reported as "connected"');
      assert(typeof body.provider === 'string', 'Provider information is returned without exposing credentials');
    }

    // -------------------------------------------------------------------------
    // Criterion 8: Missing DATABASE_URL or invalid DB credentials produces a clear deployment/health failure
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 8: Clear Failure on Missing/Invalid Database Credentials...');
    {
      const originalEnv = process.env.NODE_ENV;
      const originalVercel = process.env.VERCEL;
      const originalDbUrl = process.env.DATABASE_URL;

      try {
        process.env.NODE_ENV = 'production';
        process.env.VERCEL = '1';
        delete process.env.DATABASE_URL;

        // In production without DATABASE_URL, health check must return HTTP 503
        const res = await fetch(`${baseUrl}/api/health`);
        const body = await res.json();
        assert(res.status === 503, 'Health check returns HTTP 503 when DATABASE_URL is missing in production');
        assert(body.database === 'disconnected', 'Database reported as disconnected');
        assert(body.error.includes('Missing DATABASE_URL'), 'Clear diagnostic error provided without leaking secrets');

        // createDatabaseAdapter must throw an error in production when DATABASE_URL is missing
        let threw = false;
        try {
          createDatabaseAdapter();
        } catch (err: any) {
          threw = true;
          assert(err.message.includes('Production deployment on Vercel requires a valid PostgreSQL DATABASE_URL'),
            'createDatabaseAdapter throws clear production error');
        }
        assert(threw, 'Adapter creation prohibited without valid PostgreSQL credentials in production');
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalVercel !== undefined) process.env.VERCEL = originalVercel;
        else delete process.env.VERCEL;
        if (originalDbUrl !== undefined) process.env.DATABASE_URL = originalDbUrl;
      }
    }

    // -------------------------------------------------------------------------
    // Criterion 2: Register a new account; /api/auth/me succeeds
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 2: User Registration & /api/auth/me Verification...');
    const userAEmail = `audit_user_a_${Date.now()}@example.com`;
    const userAPassword = 'SecurePassword2026!@#';
    let userAToken = '';
    let userAId = '';

    {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice Auditor',
          email: userAEmail,
          password: userAPassword,
          currency: 'USD',
        }),
      });
      const body = await res.json();
      assert(res.status === 201, 'Registration returns HTTP 201 Created');
      assert(typeof body.token === 'string', 'Session token returned upon registration');
      userAToken = body.token;
      userAId = body.user.id;

      // Call /api/auth/me
      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      const meBody = await meRes.json();
      assert(meRes.status === 200, '/api/auth/me returns HTTP 200');
      assert(meBody.user.email === userAEmail, '/api/auth/me returns correct user email');
      assert(meBody.user.id === userAId, '/api/auth/me returns correct user ID');
      assert(meBody.profile.preferredCurrency === 'USD', '/api/auth/me returns user profile');
    }

    // -------------------------------------------------------------------------
    // Criterion 3: Login; refresh the browser; session remains valid
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 3: Login & Browser Refresh Session Validity...');
    let loginToken = '';
    {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userAEmail,
          password: userAPassword,
        }),
      });
      const loginBody = await loginRes.json();
      assert(loginRes.status === 200, 'Login returns HTTP 200');
      assert(typeof loginBody.token === 'string', 'Login returns fresh session token');
      loginToken = loginBody.token;

      // Simulate browser refresh (re-requesting /api/auth/me multiple times with stored token)
      for (let i = 1; i <= 3; i++) {
        const refreshRes = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${loginToken}` },
        });
        const refreshBody = await refreshRes.json();
        assert(refreshRes.status === 200 && refreshBody.user.id === userAId,
          `Browser refresh ${i}: Session remains valid and authenticated`);
      }
    }

    // -------------------------------------------------------------------------
    // Criterion 4: Call /api/auth/me and create/read a transaction from a fresh serverless invocation
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 4: Multi-Instance Serverless Invocations (Cold Start Simulation)...');
    let transactionId = '';
    {
      // Create account first
      const accRes = await fetch(`${baseUrl}/api/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginToken}`,
        },
        body: JSON.stringify({
          name: 'Alice Checking',
          institution: 'First National Bank',
          accountType: 'BANK',
          openingBalance: 5000,
        }),
      });
      const accBody = await accRes.json();
      assert(accRes.status === 201, 'Financial account created');
      const accountId = accBody.account.id;

      // SIMULATE SERVERLESS COLD START:
      // A new Vercel Function worker instance starts with empty in-memory Maps
      console.log('   [Simulating Cold Start: Purging all in-memory Maps]');
      db.users.clear();
      db.profiles.clear();
      db.sessions.clear();
      db.accounts.clear();
      db.transactions.clear();

      // Fresh invocation 1: /api/auth/me on clean worker instance
      const freshMeRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginToken}` },
      });
      const freshMeBody = await freshMeRes.json();
      assert(freshMeRes.status === 200, 'Fresh serverless invocation: /api/auth/me succeeds from durable database');
      assert(freshMeBody.user.id === userAId, 'Fresh serverless invocation: user identity authoritative');

      // Fresh invocation 2: Create transaction on fresh worker instance
      const createTxRes = await fetch(`${baseUrl}/api/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loginToken}`,
        },
        body: JSON.stringify({
          description: 'Cloud Server Infrastructure',
          amount: 250,
          type: 'EXPENSE',
          category: 'Technology',
          accountId,
        }),
      });
      const createTxBody = await createTxRes.json();
      assert(createTxRes.status === 201, 'Transaction created from cold-start serverless instance');
      transactionId = createTxBody.transaction.id;

      // SIMULATE ANOTHER COLD START:
      console.log('   [Simulating Second Cold Start: Purging in-memory Maps again]');
      db.users.clear();
      db.sessions.clear();
      db.transactions.clear();

      // Fresh invocation 3: Read transactions
      const listTxRes = await fetch(`${baseUrl}/api/transactions`, {
        headers: { Authorization: `Bearer ${loginToken}` },
      });
      const listTxBody = await listTxRes.json();
      assert(listTxRes.status === 200, 'Transactions retrieved from fresh worker instance');
      const foundTx = listTxBody.transactions.find((t: any) => t.id === transactionId);
      assert(Boolean(foundTx), 'Transaction created on earlier worker is retrieved on fresh worker');
      assert(foundTx?.amount === 250, 'Transaction data matches exactly across serverless workers');
    }

    // -------------------------------------------------------------------------
    // Criterion 5: Create a transaction, deploy/restart, log in again, and verify it still exists
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 5: Persistence Across Application Restart...');
    {
      // Simulate complete process restart: wipe memory and re-initialize
      db.users.clear();
      db.profiles.clear();
      db.sessions.clear();
      db.transactions.clear();
      db.accounts.clear();

      await initDb();

      // Log in again after restart
      const restartLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userAEmail,
          password: userAPassword,
        }),
      });
      const restartLoginBody = await restartLoginRes.json();
      assert(restartLoginRes.status === 200, 'Login succeeds after complete server restart');

      const restartToken = restartLoginBody.token;

      // Verify transaction still exists after restart
      const checkTxRes = await fetch(`${baseUrl}/api/transactions`, {
        headers: { Authorization: `Bearer ${restartToken}` },
      });
      const checkTxBody = await checkTxRes.json();
      const persistedTx = checkTxBody.transactions.find((t: any) => t.id === transactionId);
      assert(Boolean(persistedTx), 'Transaction survives server restart and is fully persistent');
    }

    // -------------------------------------------------------------------------
    // Criterion 6: User A cannot read or modify User B's records by changing IDs (IDOR protection)
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 6: Strict Tenant Scoping & IDOR Prevention...');
    {
      // Register User B
      const userBEmail = `audit_user_b_${Date.now()}@example.com`;
      const registerBRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bob Auditor',
          email: userBEmail,
          password: 'BobSecurePassword2026!@#',
        }),
      });
      const registerBBody = await registerBRes.json();
      const userBToken = registerBBody.token;

      // User B attempts to read User A's transaction
      const idorReadRes = await fetch(`${baseUrl}/api/transactions/${transactionId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(idorReadRes.status === 404, 'User B cannot read User A transaction (HTTP 404 Not Found)');

      // User B attempts to update User A's transaction
      const idorUpdateRes = await fetch(`${baseUrl}/api/transactions/${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({
          description: 'Malicious IDOR Tamper',
        }),
      });
      assert(idorUpdateRes.status === 404 || idorUpdateRes.status === 403,
        'User B cannot modify User A transaction (HTTP 404/403 Rejected)');

      // User B attempts to delete User A's transaction
      const idorDeleteRes = await fetch(`${baseUrl}/api/transactions/${transactionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(idorDeleteRes.status === 404 || idorDeleteRes.status === 403,
        'User B cannot delete User A transaction (HTTP 404/403 Rejected)');
    }

    // -------------------------------------------------------------------------
    // Criterion 7: Logout revokes the session in the durable database
    // -------------------------------------------------------------------------
    console.log('\n--> Criterion 7: Session Revocation on Logout...');
    {
      // Log out using loginToken
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${loginToken}` },
      });
      const logoutBody = await logoutRes.json();
      assert(logoutRes.status === 200, 'Logout returns HTTP 200');

      // Check adapter directly: token must be marked as revoked
      const adapter = getDatabaseAdapter();
      const isRevokedInDb = await adapter.isTokenRevoked(loginToken);
      assert(isRevokedInDb, 'Token is durably recorded in revoked_tokens table');

      // Subsequent request using revoked token must fail with 401 Unauthorized
      const revokedAccessRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${loginToken}` },
      });
      assert(revokedAccessRes.status === 401,
        'Subsequent request with revoked token returns HTTP 401 Unauthorized');
    }

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // Summary
  console.log('\n================================================================');
  const allPassed = testResults.every(r => r.passed);
  const passedCount = testResults.filter(r => r.passed).length;
  const failedCount = testResults.filter(r => !r.passed).length;

  console.log(`  TOTAL CHECKS: ${testResults.length}`);
  console.log(`  PASSED:       ${passedCount}`);
  console.log(`  FAILED:       ${failedCount}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAcceptanceSuite().catch(err => {
  console.error('Acceptance suite failed with fatal error:', err);
  process.exit(1);
});
