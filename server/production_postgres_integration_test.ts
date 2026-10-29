/**
 * Production PostgreSQL Integration & Restart Verification Suite
 * 
 * Verifies live PostgreSQL connectivity, migrations, atomic transactions,
 * rollback integrity, full auth lifecycle, MFA, IDOR security, and
 * full persistence across simulated server restarts.
 */

import 'dotenv/config';
import crypto from 'crypto';
import { db } from './db.js';
import { persistentSqlite, getDatabaseAdapter, resolveDatabaseProvider } from './database.js';
import { blockchainAdapter } from './blockchain.js';
import { initDb } from '../server.js';
import {
  hashPassword,
  verifyPassword,
  generateBase32Secret,
  generateTOTPCode,
  verifyTOTP,
  generateRecoveryCodes,
} from './security.js';
import { PostgresAdapter } from './db/postgres.js';
import { runPostgresMigrations } from './db/migrations/index.js';

process.env.NODE_ENV = 'production';
process.env.IS_INTEGRATION_TEST = 'true';

async function runProductionPostgresVerification() {
  console.log('\n================================================================');
  console.log('  AEGISFINANCE PRODUCTION POSTGRESQL INTEGRATION TEST SUITE');
  console.log(`  Database URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@')}`);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // --------------------------------------------------------------------------
  // Phase 14: Health & Provider Connectivity
  // --------------------------------------------------------------------------
  console.log('--> Section 1: PostgreSQL Connection & Health Check...');
  const adapter = getDatabaseAdapter();
  await adapter.init();
  await adapter.execute('TRUNCATE TABLE blockchain_records, blockchain_blocks CASCADE;');
  await blockchainAdapter.persistAllBlocks();

  assert(adapter.provider === 'postgresql', 'Active database provider is PostgreSQL');
  assert(adapter.isInitialized(), 'PostgreSQL adapter is successfully initialized');

  const health = await adapter.healthCheck();
  assert(health.status === 'ok' && health.connected, 'Database health check reports connected');
  assert(health.provider === 'postgresql', 'Health check reports provider as postgresql');
  assert(health.migrationVersion === '005', `Migration version is up-to-date (${health.migrationVersion})`);

  // --------------------------------------------------------------------------
  // Phase 8: Authentication & Session Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n--> Section 2: User Registration, Salted PBKDF2 & Session Creation...');
  const userAId = 'usr-pg-test-' + crypto.randomBytes(4).toString('hex');
  const userAEmail = `user.a.${crypto.randomBytes(4).toString('hex')}@aegis-pg.test`;
  const { hash: passwordHash, salt } = hashPassword('SecurePass@2026');

  // Insert User A into PostgreSQL
  await adapter.execute(
    `INSERT INTO users (id, email, name, password_hash, salt, role, mfa_enabled, is_email_verified, session_timeout_minutes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
    [
      userAId,
      userAEmail,
      'Alice PostgreSQL',
      passwordHash,
      salt,
      'USER',
      0,
      1,
      30,
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  );

  const userARows = await adapter.query(`SELECT * FROM users WHERE id = $1;`, [userAId]);
  assert(userARows.length === 1, 'User A record persisted in PostgreSQL');
  assert(verifyPassword('SecurePass@2026', userARows[0].password_hash, userARows[0].salt), 'PBKDF2 password verification succeeds in constant-time');

  // Create Session in PostgreSQL
  const sessionToken = 'tok-' + crypto.randomBytes(24).toString('hex');
  const sessionId = 'sess-' + crypto.randomBytes(8).toString('hex');
  const sessionExpires = Date.now() + 24 * 3600 * 1000;

  await adapter.execute(
    `INSERT INTO sessions (id, token, user_id, device, browser, ip, location, created_at, last_active_at, expires_at, is_current)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
    [
      sessionId,
      sessionToken,
      userAId,
      'Integration Test Runner',
      'Node Client',
      '127.0.0.1',
      'Local Secure',
      new Date().toISOString(),
      new Date().toISOString(),
      sessionExpires,
      1,
    ]
  );

  const sessionRows = await adapter.query(`SELECT * FROM sessions WHERE token = $1;`, [sessionToken]);
  assert(sessionRows.length === 1 && sessionRows[0].user_id === userAId, 'Session token persisted in PostgreSQL');

  // MFA Setup
  const mfaSecret = generateBase32Secret(16);
  const totpCode = generateTOTPCode(mfaSecret);
  assert(verifyTOTP(totpCode, mfaSecret), 'RFC 6238 TOTP generated and verified successfully');

  await adapter.execute(
    `UPDATE users SET mfa_enabled = 1, mfa_secret = $1 WHERE id = $2;`,
    [mfaSecret, userAId]
  );
  const updatedUser = await adapter.query(`SELECT mfa_enabled FROM users WHERE id = $1;`, [userAId]);
  assert(updatedUser[0]?.mfa_enabled === 1, 'MFA enabled status updated and persisted in PostgreSQL');

  // --------------------------------------------------------------------------
  // Phase 7: Financial Mutations & Transaction Integrity
  // --------------------------------------------------------------------------
  console.log('\n--> Section 3: Accounts & Atomic Transaction Cascade...');
  const accountId = 'acc-pg-' + crypto.randomBytes(4).toString('hex');
  const openingBalance = 100000;

  await adapter.execute(
    `INSERT INTO accounts (id, user_id, name, institution, account_type, masked_identifier, currency, opening_balance, current_balance, available_balance, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
    [
      accountId,
      userAId,
      'HDFC Primary Checking',
      'HDFC Bank',
      'CHECKING',
      '•••• 4421',
      'INR',
      openingBalance,
      openingBalance,
      openingBalance,
      'ACTIVE',
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  );

  const acc = await adapter.getAccountForUser(accountId, userAId);
  assert(acc !== null && acc.currentBalance === 100000, 'Checking account created with ₹100,000 opening balance');

  // Atomic Transaction Creation: ₹12,000 Expense
  const txId = 'tx-pg-' + crypto.randomBytes(6).toString('hex');
  const txAmount = 12000;
  const newBalance = openingBalance - txAmount; // 88000
  const canonicalData = {
    id: txId,
    userId: userAId,
    date: '2026-08-15',
    amount: txAmount,
    type: 'EXPENSE' as const,
    category: 'Shopping' as const,
    merchant: 'Apple Store',
  };
  const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
  const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

  const txData = {
    id: txId,
    userId: userAId,
    accountId,
    source: 'MANUAL' as const,
    date: '2026-08-15',
    description: 'Apple Store Purchase',
    cleanDescription: 'Apple Store',
    amount: txAmount,
    type: 'EXPENSE' as const,
    category: 'Shopping' as const,
    paymentMethod: 'Credit Card' as const,
    merchant: 'Apple Store',
    isRecurring: false,
    aiConfidence: 95,
    blockchainHash,
    blockNumber: onChainRecord.blockNumber,
    blockchainVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const auditEventData = {
    id: 'aud-' + crypto.randomBytes(6).toString('hex'),
    userId: userAId,
    eventType: 'TRANSACTION_RECORDED',
    description: `Recorded expense of ₹${txAmount} at Apple Store.`,
    ipAddress: '127.0.0.1',
    userAgent: 'Node Integration Test',
    blockchainTxId: onChainRecord.txId,
    timestamp: new Date().toISOString(),
  };

  // Execute Atomic Transaction Mutation
  await adapter.createTransactionAtomic({
    transaction: txData,
    account: acc!,
    newBalance,
    auditEvent: auditEventData,
    ledgerRecord: onChainRecord,
  });

  const persistedTx = await adapter.getTransactionForUser(txId, userAId);
  const updatedAcc = await adapter.getAccountForUser(accountId, userAId);
  const auditRows = await adapter.query(`SELECT * FROM audit_events WHERE id = $1;`, [auditEventData.id]);
  const ledgerRows = await adapter.query(`SELECT * FROM blockchain_records WHERE record_id = $1;`, [txId]);

  assert(persistedTx !== null && persistedTx.amount === 12000, 'Transaction inserted in PostgreSQL');
  assert(updatedAcc !== null && updatedAcc.currentBalance === 88000, 'Account balance atomically updated to ₹88,000');
  assert(auditRows.length === 1, 'Audit event atomically recorded in PostgreSQL');
  assert(ledgerRows.length === 1 && ledgerRows[0].sha256_hash === blockchainHash, 'Blockchain record anchored and persisted in PostgreSQL');

  // Edit Transaction Atomically: Change ₹12,000 -> ₹10,000 (Balance becomes ₹90,000)
  const editedTxAmount = 10000;
  const editedBalance = 90000;
  txData.amount = editedTxAmount;
  const newCanonical = { ...canonicalData, amount: editedTxAmount };
  const updatedHash = blockchainAdapter.computeCanonicalTransactionHash(newCanonical);
  const updatedOnChain = blockchainAdapter.recordTransactionHash(txId, updatedHash);
  txData.blockchainHash = updatedHash;
  txData.blockNumber = updatedOnChain.blockNumber;

  await adapter.updateTransactionAtomic({
    transaction: txData,
    account: updatedAcc!,
    newBalance: editedBalance,
    ledgerRecord: updatedOnChain,
  });

  const checkEditedTx = await adapter.getTransactionForUser(txId, userAId);
  const checkEditedAcc = await adapter.getAccountForUser(accountId, userAId);
  assert(checkEditedTx?.amount === 10000, 'Transaction updated to ₹10,000');
  assert(checkEditedAcc?.currentBalance === 90000, 'Account balance adjusted to ₹90,000 atomically');

  // --------------------------------------------------------------------------
  // Phase 7: Atomic Rollback Verification
  // --------------------------------------------------------------------------
  console.log('\n--> Section 4: ACID Transaction Rollback on Failure...');
  const balanceBeforeAttempt = checkEditedAcc!.currentBalance;

  let rollbackHappened = false;
  try {
    await adapter.withTransaction(async tx => {
      // Step 1: Update account balance
      await tx.execute(`UPDATE accounts SET current_balance = 0 WHERE id = $1;`, [accountId]);
      // Step 2: Intentionally fail with invalid SQL/constraint violation
      await tx.execute(`INSERT INTO transactions (id, user_id, amount) VALUES ('tx-fail-1', 'non-existent-user-id', -999);`);
    });
  } catch (err) {
    rollbackHappened = true;
  }

  const accountAfterFailedAttempt = await adapter.getAccountForUser(accountId, userAId);
  assert(rollbackHappened, 'Intentional mid-flight transaction error caught');
  assert(
    accountAfterFailedAttempt?.currentBalance === balanceBeforeAttempt,
    `ACID Rollback confirmed: Account balance remains ₹${balanceBeforeAttempt} (not 0)`
  );

  // --------------------------------------------------------------------------
  // Phase 10: KYC Simulation Verification
  // --------------------------------------------------------------------------
  console.log('\n--> Section 5: KYC Verification Simulation Workflow...');
  const kycId = 'kyc-pg-' + crypto.randomBytes(4).toString('hex');
  await adapter.execute(
    `INSERT INTO kyc_records (id, user_id, full_name, date_of_birth, address, country, document_type, document_number, masked_document_number, status, reviewer_notes, submitted_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
    [
      kycId,
      userAId,
      'Alice PostgreSQL',
      '1992-05-14',
      '123 FinTech Blvd, Bengaluru',
      'India',
      'PASSPORT',
      'K98765432',
      '•••• •••• 5432',
      'UNDER_REVIEW',
      'Document uploaded via simulation vault',
      new Date().toISOString(),
      new Date().toISOString(),
      new Date().toISOString(),
    ]
  );

  const kycRows = await adapter.query(`SELECT * FROM kyc_records WHERE user_id = $1;`, [userAId]);
  assert(kycRows.length === 1 && kycRows[0].status === 'UNDER_REVIEW', 'KYC record submitted with status UNDER_REVIEW');
  assert(kycRows[0].masked_document_number === '•••• •••• 5432', 'Sensitive document masked format verified');

  // Approve KYC
  await adapter.execute(
    `UPDATE kyc_records SET status = 'VERIFIED', verified_at = $1 WHERE user_id = $2;`,
    [new Date().toISOString(), userAId]
  );
  const approvedKyc = await adapter.query(`SELECT * FROM kyc_records WHERE user_id = $1;`, [userAId]);
  assert(approvedKyc[0]?.status === 'VERIFIED' && approvedKyc[0]?.verified_at !== null, 'KYC status transitioned to VERIFIED in PostgreSQL');

  // --------------------------------------------------------------------------
  // Phase 9: IDOR Protection Verification
  // --------------------------------------------------------------------------
  console.log('\n--> Section 6: Multi-Tenant Isolation & IDOR Protection...');
  const userBId = 'usr-pg-bob-' + crypto.randomBytes(4).toString('hex');
  await adapter.execute(
    `INSERT INTO users (id, email, name, password_hash, salt, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [userBId, `bob.${crypto.randomBytes(3).toString('hex')}@aegis.test`, 'Bob Unauthorized', 'hash', 'salt', 'USER', new Date().toISOString(), new Date().toISOString()]
  );

  // Bob attempts to query Alice's account, transaction, KYC
  const bobAccountAccess = await adapter.getAccountForUser(accountId, userBId);
  const bobTxAccess = await adapter.getTransactionForUser(txId, userBId);
  const bobKycAccess = await adapter.query(`SELECT * FROM kyc_records WHERE id = $1 AND user_id = $2;`, [kycId, userBId]);

  assert(bobAccountAccess === null, 'IDOR Guard: User B cannot access User A account');
  assert(bobTxAccess === null, 'IDOR Guard: User B cannot access User A transaction');
  assert(bobKycAccess.length === 0, 'IDOR Guard: User B cannot access User A KYC document');

  // --------------------------------------------------------------------------
  // Phase 8: Logout & Session Revocation
  // --------------------------------------------------------------------------
  console.log('\n--> Section 7: Session Invalidation & Re-Login...');
  await adapter.deleteSession(sessionId);
  const revokedCheck = await adapter.query(`SELECT * FROM sessions WHERE token = $1;`, [sessionToken]);
  assert(revokedCheck.length === 0, 'Logged-out session revoked from PostgreSQL sessions table');

  // Login again
  const newSessionToken = 'tok-new-' + crypto.randomBytes(24).toString('hex');
  const newSessionId = 'sess-new-' + crypto.randomBytes(8).toString('hex');
  await adapter.execute(
    `INSERT INTO sessions (id, token, user_id, device, browser, ip, location, created_at, last_active_at, expires_at, is_current)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
    [newSessionId, newSessionToken, userAId, 'Mobile App', 'Safari', '127.0.0.1', 'Bengaluru', new Date().toISOString(), new Date().toISOString(), Date.now() + 86400000, 1]
  );
  const reLoginRows = await adapter.query(`SELECT * FROM sessions WHERE token = $1;`, [newSessionToken]);
  assert(reLoginRows.length === 1 && reLoginRows[0].user_id === userAId, 'Re-login successful; new session persisted');

  // --------------------------------------------------------------------------
  // Phase 16: Restart & Persistence Verification
  // --------------------------------------------------------------------------
  console.log('\n--> Section 8: Simulated Reboot & Full Persistence Verification...');
  // Clear in-memory state
  db.users.clear();
  db.accounts.clear();
  db.transactions.clear();
  db.sessions.clear();
  db.kycRecords.clear();
  blockchainAdapter.resetLedger();

  assert(db.users.size === 0, 'Memory cache cleared (simulating server shutdown)');

  // Re-hydrate from PostgreSQL via initDb
  await initDb();

  assert(db.users.has(userAId), 'User A rehydrated into memory from PostgreSQL');
  assert(db.accounts.has(accountId), 'Account rehydrated into memory from PostgreSQL');
  assert(db.accounts.get(accountId)?.currentBalance === 90000, 'Account balance ₹90,000 preserved after restart');
  assert(db.transactions.has(txId), 'Transaction rehydrated into memory from PostgreSQL');
  assert(db.kycRecords.has(userAId), 'KYC record rehydrated into memory from PostgreSQL');
  assert(db.kycRecords.get(userAId)?.status === 'VERIFIED', 'KYC status VERIFIED preserved after restart');

  // Verify Ledger State Persistence
  const chainAudit = blockchainAdapter.verifyChainIntegrity();
  assert(chainAudit.isValid, 'Blockchain ledger integrity 100% valid after restart rehydration');
  assert(chainAudit.auditedBlockCount > 1, `Ledger blocks successfully persisted and verified (${chainAudit.auditedBlockCount} blocks)`);

  console.log('\n================================================================');
  console.log(`  POSTGRESQL INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED (${passed + failed} total)`);
  console.log('================================================================\n');

  await adapter.close();
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runProductionPostgresVerification().catch(err => {
  console.error('[Production PostgreSQL Test] Fatal Error:', err);
  process.exit(1);
});
