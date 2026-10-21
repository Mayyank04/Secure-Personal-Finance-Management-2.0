import pg from 'pg';
import { IDatabaseAdapter } from './types.js';
import { runPostgresMigrations } from './migrations/index.js';
import {
  User,
  UserProfile,
  FinancialAccount,
  Transaction,
  Budget,
  SavingsGoal,
  Bill,
  Subscription,
  Loan,
  ReceiptRecord,
  NotificationItem,
  AuditEvent,
  UserSession,
  KycRecord,
  BlockchainBlock,
  BlockchainRecord,
} from '../types.js';

const { Pool } = pg;

export class PostgresAdapter implements IDatabaseAdapter {
  public readonly provider = 'postgresql' as const;
  private pool: pg.Pool | null = null;
  private client: pg.PoolClient | null = null; // Used when wrapped in withTransaction
  private connectionString: string;
  private initialized: boolean = false;
  private latestMigrationVersion: string = '000';

  constructor(connectionString?: string, client?: pg.PoolClient) {
    this.connectionString = connectionString || process.env.DATABASE_URL || '';
    if (client) {
      this.client = client;
      this.initialized = true;
    }
  }

  public isInitialized(): boolean {
    return this.initialized && (this.pool !== null || this.client !== null);
  }

  public async init(): Promise<void> {
    if (this.initialized) return;

    if (!this.connectionString) {
      throw new Error('[PostgresAdapter] DATABASE_URL is not set.');
    }

    const isLocalhost =
      this.connectionString.includes('localhost') ||
      this.connectionString.includes('127.0.0.1') ||
      this.connectionString.includes('::1');

    const cleanConnectionString = this.connectionString
      .replace(/[?&]sslmode=[^&]+/g, '')
      .replace(/\?$/, '');

    const useSsl =
      this.connectionString.includes('sslmode=require') ||
      !isLocalhost;

    this.pool = new Pool({
      connectionString: cleanConnectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: process.env.VERCEL ? 5 : 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1');
      // Run migrations
      const { currentVersion } = await runPostgresMigrations(client);
      this.latestMigrationVersion = currentVersion;
      this.initialized = true;
      console.log(`[PostgresAdapter] Connected to PostgreSQL (Migration version: ${currentVersion})`);
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.initialized = false;
  }

  public async healthCheck(): Promise<{
    status: 'ok' | 'error';
    provider: 'postgresql';
    connected: boolean;
    migrationVersion?: string;
    error?: string;
  }> {
    try {
      const res = await this.query('SELECT 1 as ok');
      return {
        status: res[0]?.ok === 1 ? 'ok' : 'error',
        provider: 'postgresql',
        connected: true,
        migrationVersion: this.latestMigrationVersion,
      };
    } catch (err: any) {
      return {
        status: 'error',
        provider: 'postgresql',
        connected: false,
        error: err.message,
      };
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const executor = this.client || this.pool;
    if (!executor) throw new Error('[PostgresAdapter] Database not initialized');
    const result = await executor.query(sql, params);
    return result.rows as T[];
  }

  public async execute(sql: string, params: any[] = []): Promise<number> {
    const executor = this.client || this.pool;
    if (!executor) throw new Error('[PostgresAdapter] Database not initialized');
    const result = await executor.query(sql, params);
    return result.rowCount || 0;
  }

  public async withTransaction<T>(callback: (client: IDatabaseAdapter) => Promise<T>): Promise<T> {
    if (this.client) {
      // Already inside a transaction
      return callback(this);
    }
    if (!this.pool) throw new Error('[PostgresAdapter] Database not initialized');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const transactionalAdapter = new PostgresAdapter(this.connectionString, client);
      const result = await callback(transactionalAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ==========================================================================
     IDOR & Centralized Authorization Helpers
     ========================================================================== */

  public async getAccountForUser(accountId: string, userId: string): Promise<FinancialAccount | null> {
    const rows = await this.query(`SELECT * FROM accounts WHERE id = $1 AND user_id = $2`, [accountId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      name: r.name,
      institution: r.institution,
      accountType: r.account_type,
      maskedIdentifier: r.masked_identifier,
      currency: r.currency,
      openingBalance: Number(r.opening_balance),
      currentBalance: Number(r.current_balance),
      availableBalance: Number(r.available_balance),
      creditLimit: r.credit_limit !== null ? Number(r.credit_limit) : undefined,
      status: r.status,
      isDemo: Boolean(r.is_demo),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getTransactionForUser(transactionId: string, userId: string): Promise<Transaction | null> {
    const rows = await this.query(`SELECT * FROM transactions WHERE id = $1 AND user_id = $2`, [transactionId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      accountId: r.account_id || undefined,
      receiptId: r.receipt_id || undefined,
      billId: r.bill_id || undefined,
      source: r.source,
      date: r.date,
      description: r.description,
      cleanDescription: r.clean_description,
      amount: Number(r.amount),
      type: r.type,
      category: r.category,
      paymentMethod: r.payment_method,
      merchant: r.merchant,
      notes: r.notes || undefined,
      isRecurring: Boolean(r.is_recurring),
      recurringFrequency: r.recurring_frequency || undefined,
      aiConfidence: r.ai_confidence !== null ? Number(r.ai_confidence) : undefined,
      aiPredictedCategory: r.ai_predicted_category || undefined,
      userCorrected: Boolean(r.user_corrected),
      blockchainHash: r.blockchain_hash,
      blockNumber: Number(r.block_number),
      blockchainVerified: Boolean(r.blockchain_verified),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getBillForUser(billId: string, userId: string): Promise<Bill | null> {
    const rows = await this.query(`SELECT * FROM bills WHERE id = $1 AND user_id = $2`, [billId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      accountId: r.account_id || undefined,
      name: r.name,
      merchant: r.merchant,
      amount: Number(r.amount),
      category: r.category,
      dueDate: r.due_date,
      frequency: r.frequency,
      autoPaid: Boolean(r.auto_paid),
      status: r.status,
      linkedTransactionId: r.linked_transaction_id || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getGoalForUser(goalId: string, userId: string): Promise<SavingsGoal | null> {
    const rows = await this.query(`SELECT * FROM goals WHERE id = $1 AND user_id = $2`, [goalId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      targetAmount: Number(r.target_amount),
      currentAmount: Number(r.current_amount),
      targetDate: r.target_date || undefined,
      monthlyContribution: Number(r.monthly_contribution || 0),
      priority: r.priority,
      category: r.category || undefined,
      estimatedCompletionDate: r.estimated_completion_date || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getLoanForUser(loanId: string, userId: string): Promise<Loan | null> {
    const rows = await this.query(`SELECT * FROM loans WHERE id = $1 AND user_id = $2`, [loanId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      loanName: r.name,
      lender: r.lender,
      loanType: 'PERSONAL_LOAN',
      principal: Number(r.principal),
      outstandingBalance: Number(r.outstanding_balance),
      interestRate: Number(r.interest_rate),
      emi: Number(r.emi_amount),
      dueDate: r.due_date,
      startDate: new Date().toISOString().split('T')[0],
      maturityDate: new Date().toISOString().split('T')[0],
      tenureMonths: Number(r.tenure_months || 60),
      remainingMonths: Number(r.remaining_tenure_months || 48),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getSubscriptionForUser(subscriptionId: string, userId: string): Promise<Subscription | null> {
    const rows = await this.query(`SELECT * FROM subscriptions WHERE id = $1 AND user_id = $2`, [subscriptionId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      accountId: r.account_id || undefined,
      name: r.name,
      merchant: r.merchant,
      amount: Number(r.amount),
      frequency: r.frequency,
      category: r.category,
      nextBillingDate: r.next_renewal_date,
      nextRenewalDate: r.next_renewal_date,
      monthlyCost: Number(r.amount),
      annualCost: r.frequency === 'ANNUAL' ? Number(r.amount) : Number(r.amount) * 12,
      previousAmount: r.previous_amount !== null ? Number(r.previous_amount) : undefined,
      priceChangeDetected: Boolean(r.price_change_detected),
      status: r.status,
      linkedTransactionId: r.linked_transaction_id || undefined,
      notes: r.notes || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getReceiptForUser(receiptId: string, userId: string): Promise<ReceiptRecord | null> {
    const rows = await this.query(`SELECT * FROM receipts WHERE id = $1 AND user_id = $2`, [receiptId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      merchant: r.merchant,
      date: r.date,
      amount: Number(r.amount),
      tax: Number(r.tax_amount || 0),
      currency: r.currency,
      category: r.category,
      paymentMethod: r.payment_method || undefined,
      ocrConfidence: Number(r.ocr_confidence || 0),
      rawText: r.raw_text || undefined,
      items: r.line_items_json ? JSON.parse(r.line_items_json) : [],
      processingStatus: r.processing_status,
      linkedTransactionId: r.linked_transaction_id || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  /* ==========================================================================
     Atomic Financial Mutations with Rollback Support
     ========================================================================== */

  public async createTransactionAtomic(data: {
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean; transaction: Transaction }> {
    return this.withTransaction(async tx => {
      const t = data.transaction;
      // 1. Insert transaction
      await tx.execute(
        `INSERT INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
        [
          t.id,
          t.userId,
          t.accountId || null,
          t.receiptId || null,
          t.billId || null,
          t.source || 'MANUAL',
          t.date,
          t.description,
          t.cleanDescription || t.description,
          t.amount,
          t.type,
          t.category,
          t.paymentMethod,
          t.merchant,
          t.notes || null,
          t.isRecurring ? 1 : 0,
          t.recurringFrequency || null,
          t.aiConfidence || 95,
          t.aiPredictedCategory || t.category,
          t.userCorrected ? 1 : 0,
          t.blockchainHash,
          t.blockNumber || 0,
          t.blockchainVerified ? 1 : 0,
          t.createdAt,
          t.updatedAt,
        ]
      );

      // 2. Update account balance
      await tx.execute(
        `UPDATE accounts SET current_balance = $1, available_balance = $2, updated_at = $3 WHERE id = $4 AND user_id = $5;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      // 3. Create audit event if provided
      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [a.id, a.userId, a.eventType, a.description, a.ipAddress, a.blockchainTxId || null, null, a.timestamp]
        );
      }

      // 4. Create ledger record anchor if provided
      if (data.ledgerRecord) {
        await tx.saveBlockchainRecord(data.ledgerRecord);
      }

      return { success: true, transaction: data.transaction };
    });
  }

  public async updateTransactionAtomic(data: {
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean; transaction: Transaction }> {
    return this.withTransaction(async tx => {
      const t = data.transaction;
      await tx.execute(
        `UPDATE transactions SET date = $1, description = $2, clean_description = $3, amount = $4, type = $5, category = $6, payment_method = $7, merchant = $8, notes = $9, is_recurring = $10, recurring_frequency = $11, ai_confidence = $12, ai_predicted_category = $13, user_corrected = $14, blockchain_hash = $15, block_number = $16, blockchain_verified = $17, updated_at = $18
         WHERE id = $19 AND user_id = $20;`,
        [
          t.date,
          t.description,
          t.cleanDescription || t.description,
          t.amount,
          t.type,
          t.category,
          t.paymentMethod,
          t.merchant,
          t.notes || null,
          t.isRecurring ? 1 : 0,
          t.recurringFrequency || null,
          t.aiConfidence || 95,
          t.aiPredictedCategory || t.category,
          t.userCorrected ? 1 : 0,
          t.blockchainHash,
          t.blockNumber || 0,
          t.blockchainVerified ? 1 : 0,
          t.updatedAt,
          t.id,
          t.userId,
        ]
      );

      await tx.execute(
        `UPDATE accounts SET current_balance = $1, available_balance = $2, updated_at = $3 WHERE id = $4 AND user_id = $5;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [a.id, a.userId, a.eventType, a.description, a.ipAddress, a.blockchainTxId || null, null, a.timestamp]
        );
      }

      if (data.ledgerRecord) {
        await tx.saveBlockchainRecord(data.ledgerRecord);
      }

      return { success: true, transaction: data.transaction };
    });
  }

  public async deleteTransactionAtomic(data: {
    transactionId: string;
    userId: string;
    account?: FinancialAccount;
    revertedBalance?: number;
    auditEvent?: AuditEvent;
  }): Promise<{ success: boolean }> {
    return this.withTransaction(async tx => {
      await tx.execute(`DELETE FROM transactions WHERE id = $1 AND user_id = $2;`, [data.transactionId, data.userId]);

      if (data.account && data.revertedBalance !== undefined) {
        await tx.execute(
          `UPDATE accounts SET current_balance = $1, available_balance = $2, updated_at = $3 WHERE id = $4 AND user_id = $5;`,
          [data.revertedBalance, data.revertedBalance, new Date().toISOString(), data.account.id, data.account.userId]
        );
      }

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [a.id, a.userId, a.eventType, a.description, a.ipAddress, a.blockchainTxId || null, null, a.timestamp]
        );
      }

      return { success: true };
    });
  }

  public async payBillAtomic(data: {
    bill: Bill;
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean }> {
    return this.withTransaction(async tx => {
      // 1. Insert transaction
      const t = data.transaction;
      await tx.execute(
        `INSERT INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
        [
          t.id,
          t.userId,
          t.accountId || null,
          t.receiptId || null,
          data.bill.id,
          t.source || 'BILL_PAYMENT',
          t.date,
          t.description,
          t.cleanDescription || t.description,
          t.amount,
          t.type,
          t.category,
          t.paymentMethod,
          t.merchant,
          t.notes || null,
          1,
          data.bill.frequency || 'MONTHLY',
          99,
          t.category,
          0,
          t.blockchainHash,
          t.blockNumber || 0,
          1,
          t.createdAt,
          t.updatedAt,
        ]
      );

      // 2. Update Bill status
      await tx.execute(
        `UPDATE bills SET status = 'PAID', linked_transaction_id = $1, updated_at = $2 WHERE id = $3 AND user_id = $4;`,
        [t.id, new Date().toISOString(), data.bill.id, data.bill.userId]
      );

      // 3. Update account balance
      await tx.execute(
        `UPDATE accounts SET current_balance = $1, available_balance = $2, updated_at = $3 WHERE id = $4 AND user_id = $5;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [a.id, a.userId, a.eventType, a.description, a.ipAddress, a.blockchainTxId || null, null, a.timestamp]
        );
      }

      if (data.ledgerRecord) {
        await tx.saveBlockchainRecord(data.ledgerRecord);
      }

      return { success: true };
    });
  }

  public async payLoanEmiAtomic(data: {
    loan: Loan;
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean }> {
    return this.withTransaction(async tx => {
      const t = data.transaction;
      // 1. Insert transaction
      await tx.execute(
        `INSERT INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
        [
          t.id,
          t.userId,
          t.accountId || null,
          null,
          null,
          'LOAN_PAYMENT',
          t.date,
          t.description,
          t.cleanDescription || t.description,
          t.amount,
          t.type,
          t.category,
          t.paymentMethod,
          t.merchant,
          t.notes || null,
          1,
          'MONTHLY',
          99,
          'Debt / Loan Payment',
          0,
          t.blockchainHash,
          t.blockNumber || 0,
          1,
          t.createdAt,
          t.updatedAt,
        ]
      );

      // 2. Update loan
      await tx.execute(
        `UPDATE loans SET outstanding_balance = $1, remaining_tenure_months = $2, updated_at = $3 WHERE id = $4 AND user_id = $5;`,
        [data.loan.outstandingBalance, data.loan.remainingMonths, new Date().toISOString(), data.loan.id, data.loan.userId]
      );

      // 3. Update account balance
      await tx.execute(
        `UPDATE accounts SET current_balance = $1, available_balance = $2, updated_at = $3 WHERE id = $4 AND user_id = $5;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [a.id, a.userId, a.eventType, a.description, a.ipAddress, a.blockchainTxId || null, null, a.timestamp]
        );
      }

      if (data.ledgerRecord) {
        await tx.saveBlockchainRecord(data.ledgerRecord);
      }

      return { success: true };
    });
  }

  /* ==========================================================================
     Deletion Helpers
     ========================================================================== */

  public async deleteTransaction(id: string): Promise<void> {
    await this.execute(`DELETE FROM transactions WHERE id = $1;`, [id]);
  }

  public async deleteSession(id: string): Promise<void> {
    await this.execute(`DELETE FROM sessions WHERE id = $1;`, [id]);
  }

  public async deleteSessionByToken(token: string): Promise<void> {
    await this.execute(`DELETE FROM sessions WHERE token = $1;`, [token]);
  }

  public async isTokenRevoked(token: string): Promise<boolean> {
    if (!token) return true;
    try {
      const rows = await this.query(`SELECT token FROM revoked_tokens WHERE token = $1 LIMIT 1;`, [token]);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  public async revokeToken(token: string, userId?: string, reason?: string): Promise<void> {
    if (!token) return;
    try {
      await this.execute(
        `INSERT INTO revoked_tokens (token, user_id, revoked_at, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (token) DO UPDATE SET revoked_at = EXCLUDED.revoked_at, reason = EXCLUDED.reason;`,
        [token, userId || null, new Date().toISOString(), reason || 'MANUAL_REVOCATION']
      );
    } catch (err) {
      console.error('[PostgresAdapter] Failed to record revoked token:', err);
    }
  }

  // Security Token Persistence (Email, Password Reset, MFA Tickets, Rate Limits)
  public async saveEmailVerificationToken(token: string, userId: string, expiresAt: number): Promise<void> {
    await this.execute(
      `INSERT INTO email_verification_tokens (token, user_id, expires_at, used, created_at)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at, used = 0;`,
      [token, userId, expiresAt, new Date().toISOString()]
    );
  }

  public async getEmailVerificationToken(token: string): Promise<{ token: string; userId: string; expiresAt: number; used: boolean } | null> {
    const rows = await this.query(`SELECT token, user_id, expires_at, used FROM email_verification_tokens WHERE token = $1 LIMIT 1;`, [token]);
    if (rows.length === 0) return null;
    return {
      token: rows[0].token,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
      used: Boolean(rows[0].used),
    };
  }

  public async consumeEmailVerificationToken(token: string): Promise<void> {
    await this.execute(`UPDATE email_verification_tokens SET used = 1 WHERE token = $1;`, [token]);
  }

  public async savePasswordResetToken(token: string, userId: string, expiresAt: number): Promise<void> {
    await this.execute(
      `INSERT INTO password_reset_tokens (token, user_id, expires_at, used, created_at)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at, used = 0;`,
      [token, userId, expiresAt, new Date().toISOString()]
    );
  }

  public async getPasswordResetToken(token: string): Promise<{ token: string; userId: string; expiresAt: number; used: boolean } | null> {
    const rows = await this.query(`SELECT token, user_id, expires_at, used FROM password_reset_tokens WHERE token = $1 LIMIT 1;`, [token]);
    if (rows.length === 0) return null;
    return {
      token: rows[0].token,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
      used: Boolean(rows[0].used),
    };
  }

  public async consumePasswordResetToken(token: string): Promise<void> {
    await this.execute(`UPDATE password_reset_tokens SET used = 1 WHERE token = $1;`, [token]);
  }

  public async saveMfaChallengeTicket(ticket: string, userId: string, expiresAt: number): Promise<void> {
    await this.execute(
      `INSERT INTO mfa_challenge_tickets (ticket, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ticket) DO UPDATE SET user_id = EXCLUDED.user_id, expires_at = EXCLUDED.expires_at;`,
      [ticket, userId, expiresAt, new Date().toISOString()]
    );
  }

  public async getMfaChallengeTicket(ticket: string): Promise<{ ticket: string; userId: string; expiresAt: number } | null> {
    const rows = await this.query(`SELECT ticket, user_id, expires_at FROM mfa_challenge_tickets WHERE ticket = $1 LIMIT 1;`, [ticket]);
    if (rows.length === 0) return null;
    return {
      ticket: rows[0].ticket,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
    };
  }

  public async consumeMfaChallengeTicket(ticket: string): Promise<void> {
    await this.execute(`DELETE FROM mfa_challenge_tickets WHERE ticket = $1;`, [ticket]);
  }

  public async checkRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    try {
      const rows = await this.query(`SELECT count, reset_at FROM rate_limits WHERE key = $1 LIMIT 1;`, [key]);
      if (rows.length > 0) {
        const record = rows[0];
        const resetAt = Number(record.reset_at);
        const count = Number(record.count);

        if (now < resetAt) {
          if (count >= limit) {
            const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);
            return { allowed: false, retryAfterSeconds };
          }
          await this.execute(`UPDATE rate_limits SET count = count + 1 WHERE key = $1;`, [key]);
          return { allowed: true };
        }
      }

      const resetAt = now + windowMs;
      await this.execute(
        `INSERT INTO rate_limits (key, count, reset_at) VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE SET count = 1, reset_at = EXCLUDED.reset_at;`,
        [key, resetAt]
      );
      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    if (!userId) return null;
    const rows = await this.query(`SELECT * FROM users WHERE id = $1 LIMIT 1;`, [userId]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      salt: row.salt,
      role: row.role || 'USER',
      mfaEnabled: Boolean(row.mfa_enabled),
      mfaSecret: row.mfa_secret || undefined,
      mfaRecoveryCodes: row.mfa_recovery_codes_json ? JSON.parse(row.mfa_recovery_codes_json) : undefined,
      isEmailVerified: Boolean(row.is_email_verified),
      sessionTimeoutMinutes: row.session_timeout_minutes || 30,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at || undefined,
      lastLoginIp: row.last_login_ip || undefined,
    };
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    if (!email) return null;
    const rows = await this.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`, [email.trim()]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      passwordHash: row.password_hash,
      salt: row.salt,
      role: row.role || 'USER',
      mfaEnabled: Boolean(row.mfa_enabled),
      mfaSecret: row.mfa_secret || undefined,
      mfaRecoveryCodes: row.mfa_recovery_codes_json ? JSON.parse(row.mfa_recovery_codes_json) : undefined,
      isEmailVerified: Boolean(row.is_email_verified),
      sessionTimeoutMinutes: row.session_timeout_minutes || 30,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at || undefined,
      lastLoginIp: row.last_login_ip || undefined,
    };
  }

  public async createUser(user: User): Promise<void> {
    await this.execute(
      `INSERT INTO users (id, email, name, password_hash, salt, role, mfa_enabled, mfa_secret, mfa_recovery_codes_json, is_email_verified, session_timeout_minutes, created_at, updated_at, last_login_at, last_login_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email, name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
         salt = EXCLUDED.salt, role = EXCLUDED.role, mfa_enabled = EXCLUDED.mfa_enabled,
         mfa_secret = EXCLUDED.mfa_secret, mfa_recovery_codes_json = EXCLUDED.mfa_recovery_codes_json,
         is_email_verified = EXCLUDED.is_email_verified, session_timeout_minutes = EXCLUDED.session_timeout_minutes,
         updated_at = EXCLUDED.updated_at, last_login_at = EXCLUDED.last_login_at, last_login_ip = EXCLUDED.last_login_ip;`,
      [
        user.id,
        user.email,
        user.name,
        user.passwordHash,
        user.salt,
        user.role || 'USER',
        user.mfaEnabled ? 1 : 0,
        user.mfaSecret || null,
        user.mfaRecoveryCodes ? JSON.stringify(user.mfaRecoveryCodes) : null,
        user.isEmailVerified ? 1 : 0,
        user.sessionTimeoutMinutes || 30,
        user.createdAt,
        user.updatedAt,
        user.lastLoginAt || new Date().toISOString(),
        user.lastLoginIp || null,
      ]
    );
  }

  public async updateUser(user: Partial<User> & { id: string }): Promise<void> {
    const existing = await this.getUserById(user.id);
    if (!existing) return;
    const merged = { ...existing, ...user, updatedAt: new Date().toISOString() };
    await this.createUser(merged);
  }

  public async getProfileForUser(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    const rows = await this.query(`SELECT * FROM profiles WHERE user_id = $1 LIMIT 1;`, [userId]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      userId: row.user_id,
      preferredCurrency: row.preferred_currency || 'INR',
      monthlyIncomeRange: row.monthly_income_range || undefined,
      majorCategories: row.major_categories_json ? JSON.parse(row.major_categories_json) : [],
      budgetThresholds: row.budget_thresholds_json
        ? JSON.parse(row.budget_thresholds_json)
        : { normalWarning: 70, highWarning: 90, critical: 100 },
      privacySettings: row.privacy_settings_json ? JSON.parse(row.privacy_settings_json) : undefined,
      onboardingCompleted: Boolean(row.onboarding_completed),
    };
  }

  public async createProfile(profile: UserProfile): Promise<void> {
    await this.execute(
      `INSERT INTO profiles (user_id, preferred_currency, monthly_income_range, major_categories_json, budget_thresholds_json, privacy_settings_json, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         preferred_currency = EXCLUDED.preferred_currency, monthly_income_range = EXCLUDED.monthly_income_range,
         major_categories_json = EXCLUDED.major_categories_json, budget_thresholds_json = EXCLUDED.budget_thresholds_json,
         privacy_settings_json = EXCLUDED.privacy_settings_json, onboarding_completed = EXCLUDED.onboarding_completed;`,
      [
        profile.userId,
        profile.preferredCurrency || 'INR',
        profile.monthlyIncomeRange || null,
        JSON.stringify(profile.majorCategories || []),
        JSON.stringify(profile.budgetThresholds || { normalWarning: 70, highWarning: 90, critical: 100 }),
        profile.privacySettings ? JSON.stringify(profile.privacySettings) : null,
        profile.onboardingCompleted ? 1 : 0,
      ]
    );
  }

  public async updateProfile(profile: Partial<UserProfile> & { userId: string }): Promise<void> {
    const existing = await this.getProfileForUser(profile.userId);
    const merged: UserProfile = {
      userId: profile.userId,
      preferredCurrency: profile.preferredCurrency || existing?.preferredCurrency || 'INR',
      monthlyIncomeRange: profile.monthlyIncomeRange !== undefined ? profile.monthlyIncomeRange : existing?.monthlyIncomeRange,
      majorCategories: profile.majorCategories || existing?.majorCategories || [],
      budgetThresholds: profile.budgetThresholds || existing?.budgetThresholds || { normalWarning: 70, highWarning: 90, critical: 100 },
      privacySettings: profile.privacySettings || existing?.privacySettings,
      onboardingCompleted: profile.onboardingCompleted !== undefined ? profile.onboardingCompleted : (existing?.onboardingCompleted ?? false),
    };
    await this.createProfile(merged);
  }

  public async getSessionByToken(token: string): Promise<UserSession | null> {
    if (!token) return null;
    const rows = await this.query(`SELECT * FROM sessions WHERE token = $1 LIMIT 1;`, [token]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      token: row.token,
      userId: row.user_id,
      device: row.device || 'Web Client',
      browser: row.browser || 'Modern Browser',
      ip: row.ip || '127.0.0.1',
      location: row.location || 'Secured Session',
      createdAt: row.created_at,
      lastActiveAt: row.last_active_at,
      expiresAt: Number(row.expires_at),
      isCurrent: Boolean(row.is_current),
    };
  }

  public async createSession(session: UserSession): Promise<void> {
    await this.execute(
      `INSERT INTO sessions (id, token, user_id, device, browser, ip, location, created_at, last_active_at, expires_at, is_current)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         token = EXCLUDED.token, last_active_at = EXCLUDED.last_active_at, expires_at = EXCLUDED.expires_at, is_current = EXCLUDED.is_current;`,
      [
        session.id,
        session.token,
        session.userId,
        session.device || 'Web Client',
        session.browser || 'Modern Browser',
        session.ip || '127.0.0.1',
        session.location || 'Secured Session',
        session.createdAt,
        session.lastActiveAt,
        session.expiresAt || (Date.now() + 24 * 3600 * 1000),
        session.isCurrent ? 1 : 0,
      ]
    );
  }

  public async updateSessionActivity(sessionId: string, lastActiveAt: string): Promise<void> {
    await this.execute(`UPDATE sessions SET last_active_at = $1 WHERE id = $2;`, [lastActiveAt, sessionId]);
  }

  public async deleteAccount(id: string): Promise<void> {
    await this.execute(`DELETE FROM accounts WHERE id = $1;`, [id]);
  }

  public async deleteBill(id: string): Promise<void> {
    await this.execute(`DELETE FROM bills WHERE id = $1;`, [id]);
  }

  public async deleteSubscription(id: string): Promise<void> {
    await this.execute(`DELETE FROM subscriptions WHERE id = $1;`, [id]);
  }

  public async deleteLoan(id: string): Promise<void> {
    await this.execute(`DELETE FROM loans WHERE id = $1;`, [id]);
  }

  public async deleteGoal(id: string): Promise<void> {
    await this.execute(`DELETE FROM goals WHERE id = $1;`, [id]);
  }

  public async deleteBudget(id: string): Promise<void> {
    await this.execute(`DELETE FROM budgets WHERE id = $1;`, [id]);
  }

  public async deleteReceipt(id: string): Promise<void> {
    await this.execute(`DELETE FROM receipts WHERE id = $1;`, [id]);
  }

  public async deleteNotification(id: string): Promise<void> {
    await this.execute(`DELETE FROM notifications WHERE id = $1;`, [id]);
  }

  public async deleteUserAccountPermanently(userId: string): Promise<{ success: boolean; deletedEntitiesCount: number }> {
    return this.withTransaction(async tx => {
      let deleted = 0;
      deleted += await tx.execute(`DELETE FROM accounts WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM transactions WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM budgets WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM goals WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM bills WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM subscriptions WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM loans WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM receipts WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM notifications WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM sessions WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM profiles WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM kyc_records WHERE user_id = $1;`, [userId]);
      deleted += await tx.execute(`DELETE FROM users WHERE id = $1;`, [userId]);
      return { success: true, deletedEntitiesCount: deleted };
    });
  }

  /* ==========================================================================
     Memory Cache Sync & Hydration
     ========================================================================== */

  public async hasExistingData(): Promise<boolean> {
    try {
      const rows = await this.query(`SELECT COUNT(*) as cnt FROM users;`);
      return Number(rows[0]?.cnt || 0) > 0;
    } catch {
      return false;
    }
  }

  public async syncFromMemoryDb(dbInstance: any): Promise<void> {
    if (!dbInstance) return;

    await this.withTransaction(async tx => {
      // Users
      for (const [, user] of dbInstance.users || []) {
        await tx.execute(
          `INSERT INTO users (id, email, name, password_hash, salt, role, mfa_enabled, mfa_secret, mfa_recovery_codes_json, is_email_verified, session_timeout_minutes, created_at, updated_at, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email, name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
             salt = EXCLUDED.salt, role = EXCLUDED.role, mfa_enabled = EXCLUDED.mfa_enabled,
             mfa_secret = EXCLUDED.mfa_secret, mfa_recovery_codes_json = EXCLUDED.mfa_recovery_codes_json,
             is_email_verified = EXCLUDED.is_email_verified, session_timeout_minutes = EXCLUDED.session_timeout_minutes,
             updated_at = EXCLUDED.updated_at, last_login_at = EXCLUDED.last_login_at;`,
          [
            user.id,
            user.email,
            user.name,
            user.passwordHash,
            user.salt,
            user.role || 'USER',
            user.mfaEnabled ? 1 : 0,
            user.mfaSecret || null,
            user.mfaRecoveryCodes ? JSON.stringify(user.mfaRecoveryCodes) : null,
            user.isEmailVerified ? 1 : 0,
            user.sessionTimeoutMinutes || 30,
            user.createdAt,
            user.updatedAt,
            user.lastLoginAt || new Date().toISOString(),
          ]
        );
      }

      // Profiles
      for (const [, prof] of dbInstance.profiles || []) {
        await tx.execute(
          `INSERT INTO profiles (user_id, preferred_currency, monthly_income_range, major_categories_json, budget_thresholds_json, privacy_settings_json, onboarding_completed)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id) DO UPDATE SET
             preferred_currency = EXCLUDED.preferred_currency, monthly_income_range = EXCLUDED.monthly_income_range,
             major_categories_json = EXCLUDED.major_categories_json, budget_thresholds_json = EXCLUDED.budget_thresholds_json,
             privacy_settings_json = EXCLUDED.privacy_settings_json, onboarding_completed = EXCLUDED.onboarding_completed;`,
          [
            prof.userId,
            prof.preferredCurrency || 'INR',
            prof.monthlyIncomeRange || null,
            JSON.stringify(prof.majorCategories || []),
            JSON.stringify(prof.budgetThresholds || { normalWarning: 70, highWarning: 90, criticalLimit: 100 }),
            prof.privacySettings ? JSON.stringify(prof.privacySettings) : null,
            prof.onboardingCompleted ? 1 : 0,
          ]
        );
      }

      // Sessions
      for (const [, sess] of dbInstance.sessions || []) {
        await tx.execute(
          `INSERT INTO sessions (id, token, user_id, device, browser, ip, location, created_at, last_active_at, expires_at, is_current)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             token = EXCLUDED.token, last_active_at = EXCLUDED.last_active_at, expires_at = EXCLUDED.expires_at, is_current = EXCLUDED.is_current;`,
          [
            sess.id,
            sess.token,
            sess.userId,
            sess.device || 'Web Browser',
            sess.browser || 'Chrome Engine',
            sess.ip || '127.0.0.1',
            sess.location || 'Local Secure Session',
            sess.createdAt,
            sess.lastActiveAt || sess.createdAt || new Date().toISOString(),
            sess.expiresAt || Date.now() + 30 * 24 * 60 * 60 * 1000,
            sess.isCurrent ? 1 : 0,
          ]
        );
      }

      // Accounts
      for (const [, acc] of dbInstance.accounts || []) {
        await tx.execute(
          `INSERT INTO accounts (id, user_id, name, institution, account_type, masked_identifier, currency, opening_balance, current_balance, available_balance, credit_limit, status, is_demo, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, institution = EXCLUDED.institution, account_type = EXCLUDED.account_type,
             masked_identifier = EXCLUDED.masked_identifier, currency = EXCLUDED.currency,
             current_balance = EXCLUDED.current_balance, available_balance = EXCLUDED.available_balance,
             credit_limit = EXCLUDED.credit_limit, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`,
          [
            acc.id,
            acc.userId,
            acc.name,
            acc.institution,
            acc.accountType,
            acc.maskedIdentifier,
            acc.currency,
            acc.openingBalance,
            acc.currentBalance,
            acc.availableBalance,
            acc.creditLimit || null,
            acc.status,
            acc.isDemo ? 1 : 0,
            acc.createdAt,
            acc.updatedAt,
          ]
        );
      }

      // Transactions
      for (const [, txData] of dbInstance.transactions || []) {
        await tx.execute(
          `INSERT INTO transactions (id, user_id, account_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
           ON CONFLICT (id) DO UPDATE SET
             account_id = EXCLUDED.account_id, date = EXCLUDED.date, description = EXCLUDED.description,
             clean_description = EXCLUDED.clean_description, amount = EXCLUDED.amount, type = EXCLUDED.type,
             category = EXCLUDED.category, payment_method = EXCLUDED.payment_method, merchant = EXCLUDED.merchant,
             notes = EXCLUDED.notes, is_recurring = EXCLUDED.is_recurring, recurring_frequency = EXCLUDED.recurring_frequency,
             ai_confidence = EXCLUDED.ai_confidence, ai_predicted_category = EXCLUDED.ai_predicted_category,
             user_corrected = EXCLUDED.user_corrected, blockchain_hash = EXCLUDED.blockchain_hash,
             block_number = EXCLUDED.block_number, blockchain_verified = EXCLUDED.blockchain_verified,
             updated_at = EXCLUDED.updated_at;`,
          [
            txData.id,
            txData.userId,
            txData.accountId || null,
            txData.source || 'MANUAL',
            txData.date,
            txData.description,
            txData.cleanDescription || txData.description || '',
            txData.amount,
            txData.type,
            txData.category,
            txData.paymentMethod,
            txData.merchant,
            txData.notes || null,
            txData.isRecurring ? 1 : 0,
            txData.recurringFrequency || null,
            txData.aiConfidence || 95,
            txData.aiPredictedCategory || txData.category || 'Other',
            txData.userCorrected ? 1 : 0,
            txData.blockchainHash,
            txData.blockNumber || 0,
            txData.blockchainVerified ? 1 : 0,
            txData.createdAt,
            txData.updatedAt,
          ]
        );
      }

      // Bills
      for (const [, bill] of dbInstance.bills || []) {
        await tx.execute(
          `INSERT INTO bills (id, user_id, account_id, name, merchant, amount, category, due_date, frequency, auto_paid, status, linked_transaction_id, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             account_id = EXCLUDED.account_id, name = EXCLUDED.name, merchant = EXCLUDED.merchant,
             amount = EXCLUDED.amount, category = EXCLUDED.category, due_date = EXCLUDED.due_date,
             frequency = EXCLUDED.frequency, auto_paid = EXCLUDED.auto_paid, status = EXCLUDED.status,
             linked_transaction_id = EXCLUDED.linked_transaction_id, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at;`,
          [
            bill.id,
            bill.userId,
            bill.accountId || null,
            bill.name,
            bill.merchant,
            bill.amount,
            bill.category,
            bill.dueDate,
            bill.frequency || 'MONTHLY',
            bill.autoPaid ? 1 : 0,
            bill.status,
            bill.linkedTransactionId || null,
            bill.notes || null,
            bill.createdAt,
            bill.updatedAt,
          ]
        );
      }

      // Subscriptions
      for (const [, sub] of dbInstance.subscriptions || []) {
        await tx.execute(
          `INSERT INTO subscriptions (id, user_id, account_id, name, merchant, amount, frequency, category, next_renewal_date, previous_amount, price_change_detected, status, notes, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET
             account_id = EXCLUDED.account_id, name = EXCLUDED.name, merchant = EXCLUDED.merchant,
             amount = EXCLUDED.amount, frequency = EXCLUDED.frequency, category = EXCLUDED.category,
             next_renewal_date = EXCLUDED.next_renewal_date, previous_amount = EXCLUDED.previous_amount,
             price_change_detected = EXCLUDED.price_change_detected, status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at;`,
          [
            sub.id,
            sub.userId,
            sub.accountId || null,
            sub.name,
            sub.merchant,
            sub.amount,
            sub.frequency || 'MONTHLY',
            sub.category || 'Subscriptions',
            sub.nextRenewalDate || sub.nextBillingDate || null,
            sub.previousAmount || null,
            sub.priceChangeDetected ? 1 : 0,
            sub.status,
            sub.notes || null,
            sub.createdAt,
            sub.updatedAt,
          ]
        );
      }

      // Loans
      for (const [, loan] of dbInstance.loans || []) {
        await tx.execute(
          `INSERT INTO loans (id, user_id, name, lender, principal, outstanding_balance, interest_rate, emi_amount, due_date, tenure_months, remaining_tenure_months, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, lender = EXCLUDED.lender, principal = EXCLUDED.principal,
             outstanding_balance = EXCLUDED.outstanding_balance, interest_rate = EXCLUDED.interest_rate,
             emi_amount = EXCLUDED.emi_amount, due_date = EXCLUDED.due_date, tenure_months = EXCLUDED.tenure_months,
             remaining_tenure_months = EXCLUDED.remaining_tenure_months, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`,
          [
            loan.id,
            loan.userId,
            loan.loanName,
            loan.lender,
            loan.principal,
            loan.outstandingBalance,
            loan.interestRate,
            loan.emi,
            loan.dueDate,
            loan.tenureMonths || 60,
            loan.remainingMonths || 48,
            loan.status,
            loan.createdAt,
            loan.updatedAt,
          ]
        );
      }

      // Budgets
      for (const [, bud] of dbInstance.budgets || []) {
        await tx.execute(
          `INSERT INTO budgets (id, user_id, month, total_budget, category_budgets_json, rollover_enabled, alert_thresholds_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             month = EXCLUDED.month, total_budget = EXCLUDED.total_budget, category_budgets_json = EXCLUDED.category_budgets_json,
             rollover_enabled = EXCLUDED.rollover_enabled, alert_thresholds_json = EXCLUDED.alert_thresholds_json, updated_at = EXCLUDED.updated_at;`,
          [
            bud.id,
            bud.userId,
            bud.month,
            bud.totalBudget,
            JSON.stringify(bud.categoryBudgets || {}),
            bud.rolloverEnabled ? 1 : 0,
            JSON.stringify(bud.alertThresholds || { warning: 70, critical: 90 }),
            bud.createdAt,
            bud.updatedAt,
          ]
        );
      }

      // Goals
      for (const [, goal] of dbInstance.goals || []) {
        await tx.execute(
          `INSERT INTO goals (id, user_id, title, target_amount, current_amount, target_date, monthly_contribution, priority, category, estimated_completion_date, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title, target_amount = EXCLUDED.target_amount, current_amount = EXCLUDED.current_amount,
             target_date = EXCLUDED.target_date, monthly_contribution = EXCLUDED.monthly_contribution,
             priority = EXCLUDED.priority, category = EXCLUDED.category, estimated_completion_date = EXCLUDED.estimated_completion_date,
             updated_at = EXCLUDED.updated_at;`,
          [
            goal.id,
            goal.userId,
            goal.title,
            goal.targetAmount,
            goal.currentAmount,
            goal.targetDate || null,
            goal.monthlyContribution || 0,
            goal.priority || 'MEDIUM',
            goal.category || null,
            goal.estimatedCompletionDate || null,
            goal.createdAt,
            goal.updatedAt,
          ]
        );
      }

      // Receipts
      for (const [, rcpt] of dbInstance.receipts || []) {
        await tx.execute(
          `INSERT INTO receipts (id, user_id, merchant, date, amount, tax_amount, currency, category, payment_method, ocr_confidence, raw_text, line_items_json, processing_status, linked_transaction_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (id) DO UPDATE SET
             merchant = EXCLUDED.merchant, date = EXCLUDED.date, amount = EXCLUDED.amount, tax_amount = EXCLUDED.tax_amount,
             currency = EXCLUDED.currency, category = EXCLUDED.category, payment_method = EXCLUDED.payment_method,
             ocr_confidence = EXCLUDED.ocr_confidence, raw_text = EXCLUDED.raw_text, line_items_json = EXCLUDED.line_items_json,
             processing_status = EXCLUDED.processing_status, linked_transaction_id = EXCLUDED.linked_transaction_id, updated_at = EXCLUDED.updated_at;`,
          [
            rcpt.id,
            rcpt.userId,
            rcpt.merchant,
            rcpt.date,
            rcpt.amount,
            rcpt.tax || 0,
            rcpt.currency || 'INR',
            rcpt.category,
            rcpt.paymentMethod || null,
            rcpt.ocrConfidence || 0,
            rcpt.rawText || null,
            JSON.stringify(rcpt.items || []),
            rcpt.processingStatus || 'UNLINKED',
            rcpt.linkedTransactionId || null,
            rcpt.createdAt,
            rcpt.updatedAt,
          ]
        );
      }

      // Notifications
      for (const [, notif] of dbInstance.notifications || []) {
        await tx.execute(
          `INSERT INTO notifications (id, user_id, type, title, message, severity, is_read, related_record_id, action_url, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             type = EXCLUDED.type, title = EXCLUDED.title, message = EXCLUDED.message, severity = EXCLUDED.severity,
             is_read = EXCLUDED.is_read, related_record_id = EXCLUDED.related_record_id, action_url = EXCLUDED.action_url;`,
          [
            notif.id,
            notif.userId,
            notif.type,
            notif.title,
            notif.message,
            notif.severity || 'INFO',
            notif.isRead ? 1 : 0,
            notif.relatedRecordId || null,
            notif.actionUrl || null,
            notif.timestamp,
          ]
        );
      }

      // KYC Records
      for (const [, kyc] of dbInstance.kycRecords || []) {
        await tx.execute(
          `INSERT INTO kyc_records (id, user_id, full_name, date_of_birth, address, country, document_type, document_number, masked_document_number, status, document_image_uri, ocr_extracted_json, reviewer_notes, submitted_at, verified_at, rejection_reason, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
           ON CONFLICT (user_id) DO UPDATE SET
             full_name = EXCLUDED.full_name, date_of_birth = EXCLUDED.date_of_birth, address = EXCLUDED.address,
             country = EXCLUDED.country, document_type = EXCLUDED.document_type, document_number = EXCLUDED.document_number,
             masked_document_number = EXCLUDED.masked_document_number, status = EXCLUDED.status,
             document_image_uri = EXCLUDED.document_image_uri, ocr_extracted_json = EXCLUDED.ocr_extracted_json,
             reviewer_notes = EXCLUDED.reviewer_notes, submitted_at = EXCLUDED.submitted_at,
             verified_at = EXCLUDED.verified_at, rejection_reason = EXCLUDED.rejection_reason, updated_at = EXCLUDED.updated_at;`,
          [
            kyc.id,
            kyc.userId,
            kyc.fullName,
            kyc.dateOfBirth || null,
            kyc.address || null,
            kyc.country || 'India',
            kyc.documentType,
            kyc.documentNumber,
            kyc.maskedDocumentNumber,
            kyc.status,
            kyc.documentImageUri || null,
            kyc.ocrExtractedData ? JSON.stringify(kyc.ocrExtractedData) : null,
            kyc.reviewerNotes || null,
            kyc.submittedAt || null,
            kyc.verifiedAt || null,
            kyc.rejectionReason || null,
            kyc.createdAt,
            kyc.updatedAt,
          ]
        );
      }
    });
  }

  public async hydrateUserTenantData(userId: string, dbInstance: any): Promise<void> {
    if (!dbInstance || !userId) return;

    try {
      // 1. User
      const user = await this.getUserById(userId);
      if (user) {
        dbInstance.users.set(user.id, user);
      }

      // 2. Profile
      const profile = await this.getProfileForUser(userId);
      if (profile) {
        dbInstance.profiles.set(profile.userId, profile);
      }

      // 3. Accounts for User
      const accRows = await this.query(`SELECT * FROM accounts WHERE user_id = $1;`, [userId]);
      for (const row of accRows) {
        dbInstance.accounts.set(row.id, {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          institution: row.institution,
          accountType: row.account_type,
          maskedIdentifier: row.masked_identifier,
          currency: row.currency || 'INR',
          openingBalance: Number(row.opening_balance),
          currentBalance: Number(row.current_balance),
          availableBalance: Number(row.available_balance),
          creditLimit: row.credit_limit !== null ? Number(row.credit_limit) : undefined,
          status: row.status,
          isDemo: Boolean(row.is_demo),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 4. Transactions for User
      const txRows = await this.query(`SELECT * FROM transactions WHERE user_id = $1;`, [userId]);
      for (const row of txRows) {
        dbInstance.transactions.set(row.id, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id || undefined,
          receiptId: row.receipt_id || undefined,
          billId: row.bill_id || undefined,
          source: row.source || 'MANUAL',
          date: row.date,
          description: row.description,
          cleanDescription: row.clean_description || row.description,
          amount: Number(row.amount),
          type: row.type,
          category: row.category,
          paymentMethod: row.payment_method,
          merchant: row.merchant,
          notes: row.notes || undefined,
          isRecurring: Boolean(row.is_recurring),
          recurringFrequency: row.recurring_frequency || undefined,
          aiConfidence: row.ai_confidence !== null ? Number(row.ai_confidence) : 95,
          aiPredictedCategory: row.ai_predicted_category || row.category,
          userCorrected: Boolean(row.user_corrected),
          blockchainHash: row.blockchain_hash,
          blockNumber: Number(row.block_number),
          blockchainVerified: Boolean(row.blockchain_verified),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 5. Budgets for User
      const budRows = await this.query(`SELECT * FROM budgets WHERE user_id = $1;`, [userId]);
      for (const row of budRows) {
        dbInstance.budgets.set(row.id, {
          id: row.id,
          userId: row.user_id,
          month: row.month,
          totalBudget: Number(row.total_budget),
          categoryBudgets: row.category_budgets_json ? JSON.parse(row.category_budgets_json) : {},
          rolloverEnabled: Boolean(row.rollover_enabled),
          alertThresholds: row.alert_thresholds_json
            ? JSON.parse(row.alert_thresholds_json)
            : { warning: 70, critical: 90 },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 6. Goals for User
      const goalRows = await this.query(`SELECT * FROM goals WHERE user_id = $1;`, [userId]);
      for (const row of goalRows) {
        dbInstance.goals.set(row.id, {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          targetAmount: Number(row.target_amount),
          currentAmount: Number(row.current_amount),
          targetDate: row.target_date || undefined,
          monthlyContribution: Number(row.monthly_contribution || 0),
          priority: row.priority || 'MEDIUM',
          category: row.category || undefined,
          estimatedCompletionDate: row.estimated_completion_date || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 7. Bills for User
      const billRows = await this.query(`SELECT * FROM bills WHERE user_id = $1;`, [userId]);
      for (const row of billRows) {
        dbInstance.bills.set(row.id, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id || undefined,
          name: row.name,
          merchant: row.merchant,
          amount: Number(row.amount),
          category: row.category,
          dueDate: row.due_date,
          frequency: row.frequency || 'MONTHLY',
          autoPaid: Boolean(row.auto_paid),
          status: row.status,
          linkedTransactionId: row.linked_transaction_id || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 8. Subscriptions for User
      const subRows = await this.query(`SELECT * FROM subscriptions WHERE user_id = $1;`, [userId]);
      for (const row of subRows) {
        dbInstance.subscriptions.set(row.id, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id || undefined,
          name: row.name,
          merchant: row.merchant,
          amount: Number(row.amount),
          frequency: row.frequency || 'MONTHLY',
          category: row.category || 'Subscriptions',
          nextBillingDate: row.next_renewal_date,
          nextRenewalDate: row.next_renewal_date,
          monthlyCost: Number(row.amount),
          annualCost: row.frequency === 'ANNUAL' ? Number(row.amount) : Number(row.amount) * 12,
          previousAmount: row.previous_amount !== null ? Number(row.previous_amount) : undefined,
          priceChangeDetected: Boolean(row.price_change_detected),
          status: row.status,
          linkedTransactionId: row.linked_transaction_id || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 9. Loans for User
      const loanRows = await this.query(`SELECT * FROM loans WHERE user_id = $1;`, [userId]);
      for (const row of loanRows) {
        dbInstance.loans.set(row.id, {
          id: row.id,
          userId: row.user_id,
          loanName: row.name,
          lender: row.lender,
          loanType: 'PERSONAL_LOAN',
          principal: Number(row.principal),
          outstandingBalance: Number(row.outstanding_balance),
          interestRate: Number(row.interest_rate),
          emi: Number(row.emi_amount),
          dueDate: row.due_date,
          startDate: new Date().toISOString().split('T')[0],
          maturityDate: new Date().toISOString().split('T')[0],
          tenureMonths: Number(row.tenure_months || 60),
          remainingMonths: Number(row.remaining_tenure_months || 48),
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 10. Receipts for User
      const rcptRows = await this.query(`SELECT * FROM receipts WHERE user_id = $1;`, [userId]);
      for (const row of rcptRows) {
        dbInstance.receipts.set(row.id, {
          id: row.id,
          userId: row.user_id,
          merchant: row.merchant,
          date: row.date,
          amount: Number(row.amount),
          tax: Number(row.tax_amount || 0),
          currency: row.currency || 'INR',
          category: row.category,
          paymentMethod: row.payment_method || undefined,
          ocrConfidence: Number(row.ocr_confidence || 0),
          rawText: row.raw_text || undefined,
          lineItems: row.line_items_json ? JSON.parse(row.line_items_json) : [],
          imageUrl: row.image_url || undefined,
          processingStatus: row.processing_status || 'UNLINKED',
          linkedTransactionId: row.linked_transaction_id || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 11. Notifications for User
      const notifRows = await this.query(`SELECT * FROM notifications WHERE user_id = $1;`, [userId]);
      for (const row of notifRows) {
        dbInstance.notifications.set(row.id, {
          id: row.id,
          userId: row.user_id,
          type: row.type,
          title: row.title,
          message: row.message,
          severity: row.severity,
          isRead: Boolean(row.is_read),
          relatedRecordId: row.related_record_id || undefined,
          actionUrl: row.action_url || undefined,
          timestamp: row.timestamp,
        });
      }

      // 12. KYC for User
      const kycRows = await this.query(`SELECT * FROM kyc_records WHERE user_id = $1;`, [userId]);
      if (kycRows.length > 0) {
        const row = kycRows[0];
        dbInstance.kycRecords.set(row.user_id, {
          id: row.id,
          userId: row.user_id,
          fullName: row.full_name,
          dateOfBirth: row.date_of_birth,
          address: row.address,
          country: row.country,
          documentType: row.document_type,
          documentNumber: row.document_number,
          maskedDocumentNumber: row.masked_document_number,
          status: row.status,
          documentImageUri: row.document_image_uri || undefined,
          ocrExtractedData: row.ocr_extracted_json ? JSON.parse(row.ocr_extracted_json) : undefined,
          reviewerNotes: row.reviewer_notes || undefined,
          submittedAt: row.submitted_at || undefined,
          verifiedAt: row.verified_at || undefined,
          rejectionReason: row.rejection_reason || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    } catch (err) {
      console.error(`[PostgresAdapter] Error hydrating tenant data for user ${userId}:`, err);
    }
  }

  public async hydrateMemoryDb(dbInstance: any): Promise<void> {
    if (!dbInstance) return;

    try {
      // 1. Users
      const userRows = await this.query(`SELECT * FROM users;`);
      for (const row of userRows) {
        dbInstance.users.set(row.id, {
          id: row.id,
          email: row.email,
          name: row.name,
          passwordHash: row.password_hash,
          salt: row.salt,
          role: row.role || 'USER',
          mfaEnabled: Boolean(row.mfa_enabled),
          mfaSecret: row.mfa_secret || undefined,
          mfaRecoveryCodes: row.mfa_recovery_codes_json ? JSON.parse(row.mfa_recovery_codes_json) : undefined,
          isEmailVerified: Boolean(row.is_email_verified),
          sessionTimeoutMinutes: row.session_timeout_minutes || 30,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          lastLoginAt: row.last_login_at || undefined,
          lastLoginIp: row.last_login_ip || undefined,
        });
      }

      // 2. Profiles
      const profRows = await this.query(`SELECT * FROM profiles;`);
      for (const row of profRows) {
        dbInstance.profiles.set(row.user_id, {
          userId: row.user_id,
          preferredCurrency: row.preferred_currency || 'INR',
          monthlyIncomeRange: row.monthly_income_range || undefined,
          majorCategories: row.major_categories_json ? JSON.parse(row.major_categories_json) : [],
          budgetThresholds: row.budget_thresholds_json
            ? JSON.parse(row.budget_thresholds_json)
            : { normalWarning: 70, highWarning: 90, criticalLimit: 100 },
          privacySettings: row.privacy_settings_json ? JSON.parse(row.privacy_settings_json) : undefined,
          onboardingCompleted: Boolean(row.onboarding_completed),
        });
      }

      // 3. Sessions
      const sessRows = await this.query(`SELECT * FROM sessions;`);
      for (const row of sessRows) {
        dbInstance.sessions.set(row.id, {
          id: row.id,
          token: row.token,
          userId: row.user_id,
          device: row.device || 'Web Browser',
          browser: row.browser || 'Chrome Engine',
          ip: row.ip || '127.0.0.1',
          location: row.location || 'Local Secure Session',
          createdAt: row.created_at,
          lastActiveAt: row.last_active_at,
          expiresAt: Number(row.expires_at),
          isCurrent: Boolean(row.is_current),
        });
      }

      // 4. Accounts
      const accRows = await this.query(`SELECT * FROM accounts;`);
      for (const row of accRows) {
        dbInstance.accounts.set(row.id, {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          institution: row.institution,
          accountType: row.account_type,
          maskedIdentifier: row.masked_identifier,
          currency: row.currency || 'INR',
          openingBalance: Number(row.opening_balance),
          currentBalance: Number(row.current_balance),
          availableBalance: Number(row.available_balance),
          creditLimit: row.credit_limit !== null ? Number(row.credit_limit) : undefined,
          status: row.status,
          isDemo: Boolean(row.is_demo),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 5. Transactions
      const txRows = await this.query(`SELECT * FROM transactions;`);
      for (const row of txRows) {
        dbInstance.transactions.set(row.id, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id || undefined,
          receiptId: row.receipt_id || undefined,
          billId: row.bill_id || undefined,
          source: row.source || 'MANUAL',
          date: row.date,
          description: row.description,
          cleanDescription: row.clean_description || row.description,
          amount: Number(row.amount),
          type: row.type,
          category: row.category,
          paymentMethod: row.payment_method,
          merchant: row.merchant,
          notes: row.notes || undefined,
          isRecurring: Boolean(row.is_recurring),
          recurringFrequency: row.recurring_frequency || undefined,
          aiConfidence: row.ai_confidence !== null ? Number(row.ai_confidence) : 95,
          aiPredictedCategory: row.ai_predicted_category || row.category,
          userCorrected: Boolean(row.user_corrected),
          blockchainHash: row.blockchain_hash,
          blockNumber: Number(row.block_number),
          blockchainVerified: Boolean(row.blockchain_verified),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 6. Budgets
      const budRows = await this.query(`SELECT * FROM budgets;`);
      for (const row of budRows) {
        dbInstance.budgets.set(row.id, {
          id: row.id,
          userId: row.user_id,
          month: row.month,
          totalBudget: Number(row.total_budget),
          categoryBudgets: row.category_budgets_json ? JSON.parse(row.category_budgets_json) : {},
          rolloverEnabled: Boolean(row.rollover_enabled),
          alertThresholds: row.alert_thresholds_json
            ? JSON.parse(row.alert_thresholds_json)
            : { warning: 70, critical: 90 },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 7. Goals
      const goalRows = await this.query(`SELECT * FROM goals;`);
      for (const row of goalRows) {
        dbInstance.goals.set(row.id, {
          id: row.id,
          userId: row.user_id,
          title: row.title,
          targetAmount: Number(row.target_amount),
          currentAmount: Number(row.current_amount),
          targetDate: row.target_date || undefined,
          monthlyContribution: Number(row.monthly_contribution || 0),
          priority: row.priority || 'MEDIUM',
          category: row.category || undefined,
          estimatedCompletionDate: row.estimated_completion_date || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 8. Bills
      const billRows = await this.query(`SELECT * FROM bills;`);
      for (const row of billRows) {
        dbInstance.bills.set(row.id, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id || undefined,
          name: row.name,
          merchant: row.merchant,
          amount: Number(row.amount),
          category: row.category,
          dueDate: row.due_date,
          frequency: row.frequency || 'MONTHLY',
          autoPaid: Boolean(row.auto_paid),
          status: row.status,
          linkedTransactionId: row.linked_transaction_id || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 9. Subscriptions
      const subRows = await this.query(`SELECT * FROM subscriptions;`);
      for (const row of subRows) {
        dbInstance.subscriptions.set(row.id, {
          id: row.id,
          userId: row.user_id,
          accountId: row.account_id || undefined,
          name: row.name,
          merchant: row.merchant,
          amount: Number(row.amount),
          frequency: row.frequency || 'MONTHLY',
          category: row.category || 'Subscriptions',
          nextBillingDate: row.next_renewal_date,
          nextRenewalDate: row.next_renewal_date,
          monthlyCost: Number(row.amount),
          annualCost: row.frequency === 'ANNUAL' ? Number(row.amount) : Number(row.amount) * 12,
          previousAmount: row.previous_amount !== null ? Number(row.previous_amount) : undefined,
          priceChangeDetected: Boolean(row.price_change_detected),
          status: row.status,
          linkedTransactionId: row.linked_transaction_id || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 10. Loans
      const loanRows = await this.query(`SELECT * FROM loans;`);
      for (const row of loanRows) {
        dbInstance.loans.set(row.id, {
          id: row.id,
          userId: row.user_id,
          loanName: row.name,
          lender: row.lender,
          loanType: 'PERSONAL_LOAN',
          principal: Number(row.principal),
          outstandingBalance: Number(row.outstanding_balance),
          interestRate: Number(row.interest_rate),
          emi: Number(row.emi_amount),
          dueDate: row.due_date,
          startDate: new Date().toISOString().split('T')[0],
          maturityDate: new Date().toISOString().split('T')[0],
          tenureMonths: Number(row.tenure_months || 60),
          remainingMonths: Number(row.remaining_tenure_months || 48),
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 11. Receipts
      const rcptRows = await this.query(`SELECT * FROM receipts;`);
      for (const row of rcptRows) {
        dbInstance.receipts.set(row.id, {
          id: row.id,
          userId: row.user_id,
          merchant: row.merchant,
          date: row.date,
          amount: Number(row.amount),
          tax: Number(row.tax_amount || 0),
          currency: row.currency || 'INR',
          category: row.category,
          paymentMethod: row.payment_method || undefined,
          ocrConfidence: Number(row.ocr_confidence || 0),
          rawText: row.raw_text || undefined,
          items: row.line_items_json ? JSON.parse(row.line_items_json) : [],
          processingStatus: row.processing_status || 'UNLINKED',
          linkedTransactionId: row.linked_transaction_id || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      // 12. Notifications
      const notifRows = await this.query(`SELECT * FROM notifications;`);
      for (const row of notifRows) {
        dbInstance.notifications.set(row.id, {
          id: row.id,
          userId: row.user_id,
          type: row.type,
          title: row.title,
          message: row.message,
          severity: row.severity || 'INFO',
          isRead: Boolean(row.is_read),
          relatedRecordId: row.related_record_id || undefined,
          actionUrl: row.action_url || undefined,
          timestamp: row.timestamp,
        });
      }

      // 13. Audit Events
      const audRows = await this.query(`SELECT * FROM audit_events;`);
      for (const row of audRows) {
        dbInstance.auditEvents.set(row.id, {
          id: row.id,
          userId: row.user_id,
          eventType: row.event_type,
          description: row.description,
          ipAddress: row.ip_address || '127.0.0.1',
          userAgent: 'Aegis Client Engine',
          timestamp: row.timestamp,
          blockchainTxId: row.sha256_hash || undefined,
        });
      }

      // 14. KYC Records
      const kycRows = await this.query(`SELECT * FROM kyc_records;`);
      for (const row of kycRows) {
        dbInstance.kycRecords.set(row.user_id, {
          id: row.id,
          userId: row.user_id,
          fullName: row.full_name,
          dateOfBirth: row.date_of_birth || '',
          address: row.address || '',
          country: row.country || 'India',
          documentType: row.document_type,
          documentNumber: row.document_number,
          maskedDocumentNumber: row.masked_document_number,
          status: row.status,
          documentImageUri: row.document_image_uri || undefined,
          ocrExtractedData: row.ocr_extracted_json ? JSON.parse(row.ocr_extracted_json) : undefined,
          reviewerNotes: row.reviewer_notes || undefined,
          submittedAt: row.submitted_at || undefined,
          verifiedAt: row.verified_at || undefined,
          rejectionReason: row.rejection_reason || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }

      console.log(
        `[PostgresAdapter] Successfully hydrated memory cache from PostgreSQL (${dbInstance.users.size} users, ${dbInstance.accounts.size} accounts, ${dbInstance.transactions.size} transactions).`
      );
    } catch (err) {
      console.error('[PostgresAdapter] Hydration from PostgreSQL failed:', err);
    }
  }

  /* ==========================================================================
     Blockchain Ledger Persistence
     ========================================================================== */

  public async saveBlockchainBlock(block: BlockchainBlock): Promise<void> {
    await this.execute(
      `INSERT INTO blockchain_blocks (block_number, channel_id, previous_hash, merkle_root, timestamp, transaction_count, endorsements_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (block_number) DO UPDATE SET
         previous_hash = EXCLUDED.previous_hash, merkle_root = EXCLUDED.merkle_root,
         timestamp = EXCLUDED.timestamp, transaction_count = EXCLUDED.transaction_count,
         endorsements_json = EXCLUDED.endorsements_json;`,
      [
        block.blockNumber,
        block.channelId,
        block.previousHash,
        block.merkleRoot,
        block.timestamp,
        block.transactionCount,
        JSON.stringify(block.endorsements || []),
      ]
    );
  }

  public async saveBlockchainRecord(record: BlockchainRecord): Promise<void> {
    await this.execute(
      `INSERT INTO blockchain_records (id, block_number, channel_id, event_type, record_id, sha256_hash, msp_id, timestamp, verification_status, tx_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         block_number = EXCLUDED.block_number, sha256_hash = EXCLUDED.sha256_hash,
         verification_status = EXCLUDED.verification_status, tx_id = EXCLUDED.tx_id;`,
      [
        record.id,
        record.blockNumber,
        record.channelId,
        record.eventType,
        record.recordId,
        record.sha256Hash,
        record.mspId,
        record.timestamp,
        record.verificationStatus,
        record.txId,
      ]
    );
  }

  public async loadBlockchainState(): Promise<{ blocks: BlockchainBlock[]; records: BlockchainRecord[] }> {
    try {
      const blockRows = await this.query(`SELECT * FROM blockchain_blocks ORDER BY block_number ASC;`);
      const recordRows = await this.query(`SELECT * FROM blockchain_records ORDER BY block_number ASC;`);

      const records: BlockchainRecord[] = recordRows.map(r => ({
        id: r.id,
        blockNumber: Number(r.block_number),
        channelId: r.channel_id,
        eventType: r.event_type as any,
        recordId: r.record_id,
        sha256Hash: r.sha256_hash,
        mspId: r.msp_id,
        timestamp: r.timestamp,
        verificationStatus: r.verification_status as any,
        txId: r.tx_id,
      }));

      const recordMap = new Map<number, BlockchainRecord[]>();
      for (const rec of records) {
        if (!recordMap.has(rec.blockNumber)) {
          recordMap.set(rec.blockNumber, []);
        }
        recordMap.get(rec.blockNumber)!.push(rec);
      }

      const blocks: BlockchainBlock[] = blockRows.map(b => ({
        blockNumber: Number(b.block_number),
        channelId: b.channel_id,
        previousHash: b.previous_hash,
        merkleRoot: b.merkle_root,
        timestamp: b.timestamp,
        transactionCount: Number(b.transaction_count),
        endorsements: JSON.parse(b.endorsements_json || '[]'),
        records: recordMap.get(Number(b.block_number)) || [],
      }));

      return { blocks, records };
    } catch {
      return { blocks: [], records: [] };
    }
  }
}
