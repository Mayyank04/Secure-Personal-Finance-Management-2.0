import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { IDatabaseAdapter } from './types.js';
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

export class SqliteAdapter implements IDatabaseAdapter {
  public readonly provider = 'sqlite' as const;
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;
  private syncTimeout: NodeJS.Timeout | null = null;
  private transactionDepth: number = 0;

  constructor(storageDir?: string) {
    const defaultDir = process.env.VERCEL ? '/tmp/data' : path.join(process.cwd(), 'data');
    const dir = storageDir || defaultDir;
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // ignore
    }
    this.dbPath = path.join(dir, 'aegis_finance.sqlite');
  }

  public isInitialized(): boolean {
    return this.initialized && this.db !== null;
  }

  public async init(): Promise<void> {
    if (this.initialized && this.db) return;
    const SQL = await initSqlJs();

    let initialBuffer: Buffer | null = null;
    if (fs.existsSync(this.dbPath)) {
      try {
        initialBuffer = fs.readFileSync(this.dbPath);
      } catch {
        // ignore
      }
    } else {
      const bundlePath = path.join(process.cwd(), 'data', 'aegis_finance.sqlite');
      if (fs.existsSync(bundlePath)) {
        try {
          initialBuffer = fs.readFileSync(bundlePath);
        } catch {
          // ignore
        }
      }
    }

    if (initialBuffer) {
      this.db = new SQL.Database(initialBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.initTables();
    this.initialized = true;
  }

  public async close(): Promise<void> {
    this.saveToDisk();
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  public async healthCheck(): Promise<{
    status: 'ok' | 'error';
    provider: 'sqlite';
    connected: boolean;
    migrationVersion?: string;
    error?: string;
  }> {
    if (!this.db) {
      return { status: 'error', provider: 'sqlite', connected: false, error: 'SQLite not initialized' };
    }
    return { status: 'ok', provider: 'sqlite', connected: true, migrationVersion: '002' };
  }

  private initTables() {
    if (!this.db) return;

    this.db.run(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'USER',
        mfa_enabled INTEGER NOT NULL DEFAULT 0,
        mfa_secret TEXT,
        mfa_recovery_codes_json TEXT,
        is_email_verified INTEGER NOT NULL DEFAULT 0,
        session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT,
        last_login_ip TEXT
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY,
        preferred_currency TEXT NOT NULL DEFAULT 'INR',
        monthly_income_range TEXT,
        major_categories_json TEXT,
        budget_thresholds_json TEXT,
        privacy_settings_json TEXT,
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        device TEXT,
        browser TEXT,
        ip TEXT,
        location TEXT,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        is_current INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        institution TEXT NOT NULL,
        account_type TEXT NOT NULL,
        masked_identifier TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'INR',
        opening_balance REAL NOT NULL DEFAULT 0,
        current_balance REAL NOT NULL DEFAULT 0,
        available_balance REAL NOT NULL DEFAULT 0,
        credit_limit REAL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT,
        receipt_id TEXT,
        bill_id TEXT,
        source TEXT NOT NULL DEFAULT 'MANUAL',
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        clean_description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        merchant TEXT NOT NULL,
        notes TEXT,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurring_frequency TEXT,
        ai_confidence REAL,
        ai_predicted_category TEXT,
        user_corrected INTEGER NOT NULL DEFAULT 0,
        blockchain_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        blockchain_verified INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        total_budget REAL NOT NULL,
        category_budgets_json TEXT NOT NULL,
        rollover_enabled INTEGER NOT NULL DEFAULT 1,
        alert_thresholds_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL NOT NULL DEFAULT 0,
        target_date TEXT,
        monthly_contribution REAL NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'MEDIUM',
        category TEXT,
        estimated_completion_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS goal_contributions (
        id TEXT PRIMARY KEY,
        goal_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        transaction_id TEXT,
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT,
        name TEXT NOT NULL,
        merchant TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        due_date TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'MONTHLY',
        auto_paid INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'UPCOMING',
        linked_transaction_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        account_id TEXT,
        name TEXT NOT NULL,
        merchant TEXT NOT NULL,
        amount REAL NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'MONTHLY',
        category TEXT NOT NULL DEFAULT 'Subscriptions',
        next_renewal_date TEXT NOT NULL,
        previous_amount REAL,
        price_change_detected INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        linked_transaction_id TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        lender TEXT NOT NULL,
        principal REAL NOT NULL,
        outstanding_balance REAL NOT NULL,
        interest_rate REAL NOT NULL,
        emi_amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        tenure_months INTEGER NOT NULL,
        remaining_tenure_months INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        merchant TEXT NOT NULL,
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        tax_amount REAL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'INR',
        category TEXT NOT NULL,
        payment_method TEXT,
        ocr_confidence REAL NOT NULL DEFAULT 0,
        raw_text TEXT,
        line_items_json TEXT,
        image_url TEXT,
        processing_status TEXT NOT NULL DEFAULT 'UNLINKED',
        linked_transaction_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'INFO',
        is_read INTEGER NOT NULL DEFAULT 0,
        related_record_id TEXT,
        action_url TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        ip_address TEXT,
        sha256_hash TEXT,
        metadata_json TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_category_feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        description TEXT NOT NULL,
        original_prediction TEXT,
        user_category TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_anomaly_feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        anomaly_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        notes TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_recommendation_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        recommendation_type TEXT NOT NULL,
        title TEXT NOT NULL,
        details_json TEXT NOT NULL,
        user_action TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kyc_records (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        date_of_birth TEXT,
        address TEXT,
        country TEXT,
        document_type TEXT NOT NULL,
        document_number TEXT NOT NULL,
        masked_document_number TEXT NOT NULL,
        status TEXT NOT NULL,
        document_image_uri TEXT,
        ocr_extracted_json TEXT,
        reviewer_notes TEXT,
        submitted_at TEXT,
        verified_at TEXT,
        rejection_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS blockchain_blocks (
        block_number INTEGER PRIMARY KEY,
        channel_id TEXT NOT NULL,
        previous_hash TEXT NOT NULL,
        merkle_root TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        transaction_count INTEGER NOT NULL DEFAULT 0,
        endorsements_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blockchain_records (
        id TEXT PRIMARY KEY,
        block_number INTEGER NOT NULL,
        channel_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        record_id TEXT NOT NULL,
        sha256_hash TEXT NOT NULL,
        msp_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        verification_status TEXT NOT NULL DEFAULT 'VERIFIED',
        tx_id TEXT NOT NULL,
        FOREIGN KEY (block_number) REFERENCES blockchain_blocks(block_number) ON DELETE CASCADE
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
      CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);
      CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
      CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
      CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
      CREATE INDEX IF NOT EXISTS idx_receipts_user ON receipts(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        revoked_at TEXT NOT NULL,
        reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON revoked_tokens(user_id);

      CREATE TABLE IF NOT EXISTS mfa_challenge_tickets (
        ticket TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_mfa_tickets_user ON mfa_challenge_tickets(user_id);

      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at INTEGER NOT NULL
      );
    `);
    this.scheduleSave();
  }

  public scheduleSave() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.saveToDisk();
    }, 100);
  }

  public saveToDisk(): void {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const tmpPath = `${this.dbPath}.tmp`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, this.dbPath);
    } catch (err) {
      console.error('[SqliteAdapter] Failed to write database to disk:', err);
    }
  }

  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) throw new Error('[SqliteAdapter] Database not initialized');
    const cleanParams = params.map(p => (p === undefined ? null : p));
    const stmt = this.db.prepare(sql);
    stmt.bind(cleanParams);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  public async execute(sql: string, params: any[] = []): Promise<number> {
    if (!this.db) throw new Error('[SqliteAdapter] Database not initialized');
    const cleanParams = params.map(p => (p === undefined ? null : p));
    this.db.run(sql, cleanParams);
    this.scheduleSave();
    return 1;
  }

  public async withTransaction<T>(callback: (client: IDatabaseAdapter) => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('[SqliteAdapter] Database not initialized');
    if (this.transactionDepth > 0) {
      // Already within an active transaction; execute callback within current transaction
      return await callback(this);
    }

    this.transactionDepth++;
    this.db.run('BEGIN TRANSACTION;');

    try {
      const result = await callback(this);
      this.db.run('COMMIT;');
      this.scheduleSave();
      return result;
    } catch (err) {
      try {
        this.db.run('ROLLBACK;');
      } catch {}
      throw err;
    } finally {
      this.transactionDepth--;
    }
  }

  /* ==========================================================================
     IDOR & Centralized Authorization Helpers
     ========================================================================== */

  public async getAccountForUser(accountId: string, userId: string): Promise<FinancialAccount | null> {
    const rows = await this.query(`SELECT * FROM accounts WHERE id = ? AND user_id = ?`, [accountId, userId]);
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
    const rows = await this.query(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`, [transactionId, userId]);
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
    const rows = await this.query(`SELECT * FROM bills WHERE id = ? AND user_id = ?`, [billId, userId]);
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
    const rows = await this.query(`SELECT * FROM goals WHERE id = ? AND user_id = ?`, [goalId, userId]);
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
    const rows = await this.query(`SELECT * FROM loans WHERE id = ? AND user_id = ?`, [loanId, userId]);
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
    const rows = await this.query(`SELECT * FROM subscriptions WHERE id = ? AND user_id = ?`, [subscriptionId, userId]);
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
    const rows = await this.query(`SELECT * FROM receipts WHERE id = ? AND user_id = ?`, [receiptId, userId]);
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

  public async getBudgetForUser(budgetId: string, userId: string): Promise<Budget | null> {
    const rows = await this.query(`SELECT * FROM budgets WHERE id = ? AND user_id = ?;`, [budgetId, userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      month: r.month,
      totalBudget: Number(r.total_budget),
      categoryBudgets: r.category_budgets_json ? JSON.parse(r.category_budgets_json) : {},
      rolloverEnabled: Boolean(r.rollover_enabled),
      alertThresholds: r.alert_thresholds_json ? JSON.parse(r.alert_thresholds_json) : { normal: 70, high: 90, exceeded: 100 },
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async getKycRecordForUser(userId: string): Promise<KycRecord | null> {
    const rows = await this.query(`SELECT * FROM kyc_records WHERE user_id = ?;`, [userId]);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      userId: r.user_id,
      fullName: r.full_name,
      dateOfBirth: r.date_of_birth || '',
      address: r.address || '',
      country: r.country || 'India',
      documentType: r.document_type,
      documentNumber: r.document_number,
      maskedDocumentNumber: r.masked_document_number,
      status: r.status,
      documentImageUri: r.document_image_uri || undefined,
      ocrExtractedData: r.ocr_extracted_json ? JSON.parse(r.ocr_extracted_json) : undefined,
      reviewerNotes: r.reviewer_notes || undefined,
      submittedAt: r.submitted_at || undefined,
      verifiedAt: r.verified_at || undefined,
      rejectionReason: r.rejection_reason || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  public async saveAccount(acc: FinancialAccount): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO accounts (id, user_id, name, institution, account_type, masked_identifier, currency, opening_balance, current_balance, available_balance, credit_limit, status, is_demo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        acc.id,
        acc.userId,
        acc.name,
        acc.institution,
        acc.accountType,
        acc.maskedIdentifier,
        acc.currency || 'INR',
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

  public async updateAccount(acc: Partial<FinancialAccount> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getAccountForUser(acc.id, acc.userId);
    if (!existing) throw new Error('Account not found');
    const merged = { ...existing, ...acc, updatedAt: new Date().toISOString() };
    await this.saveAccount(merged);
  }

  public async getAccountTransactionsCount(accountId: string, userId: string): Promise<number> {
    const rows = await this.query(`SELECT COUNT(*) as count FROM transactions WHERE account_id = ? AND user_id = ?;`, [accountId, userId]);
    return Number(rows[0]?.count || 0);
  }

  public async saveBudget(b: Budget): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO budgets (id, user_id, month, total_budget, category_budgets_json, rollover_enabled, alert_thresholds_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        b.id,
        b.userId,
        b.month,
        b.totalBudget,
        JSON.stringify(b.categoryBudgets || {}),
        b.rolloverEnabled ? 1 : 0,
        JSON.stringify(b.alertThresholds || { normal: 70, high: 90, exceeded: 100 }),
        b.createdAt,
        b.updatedAt,
      ]
    );
  }

  public async updateBudget(b: Partial<Budget> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getBudgetForUser(b.id, b.userId);
    if (!existing) throw new Error('Budget not found');
    const merged = { ...existing, ...b, updatedAt: new Date().toISOString() };
    await this.saveBudget(merged);
  }

  public async saveGoal(g: SavingsGoal): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO goals (id, user_id, title, target_amount, current_amount, target_date, monthly_contribution, priority, category, estimated_completion_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        g.id,
        g.userId,
        g.title,
        g.targetAmount,
        g.currentAmount,
        g.targetDate || null,
        g.monthlyContribution || 0,
        g.priority || 'MEDIUM',
        g.category || null,
        g.estimatedCompletionDate || null,
        g.createdAt,
        g.updatedAt,
      ]
    );
  }

  public async updateGoal(g: Partial<SavingsGoal> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getGoalForUser(g.id, g.userId);
    if (!existing) throw new Error('Goal not found');
    const merged = { ...existing, ...g, updatedAt: new Date().toISOString() };
    await this.saveGoal(merged);
  }

  public async saveBill(b: Bill): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO bills (id, user_id, account_id, name, merchant, amount, category, due_date, frequency, auto_paid, status, linked_transaction_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        b.id,
        b.userId,
        b.accountId || null,
        b.name,
        b.merchant,
        b.amount,
        b.category,
        b.dueDate,
        b.frequency || 'MONTHLY',
        b.autoPaid ? 1 : 0,
        b.status,
        b.linkedTransactionId || null,
        b.notes || null,
        b.createdAt,
        b.updatedAt,
      ]
    );
  }

  public async updateBill(b: Partial<Bill> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getBillForUser(b.id, b.userId);
    if (!existing) throw new Error('Bill not found');
    const merged = { ...existing, ...b, updatedAt: new Date().toISOString() };
    await this.saveBill(merged);
  }

  public async saveSubscription(s: Subscription): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO subscriptions (id, user_id, account_id, name, merchant, amount, frequency, category, next_renewal_date, previous_amount, price_change_detected, status, linked_transaction_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        s.id,
        s.userId,
        s.accountId || null,
        s.name,
        s.merchant,
        s.amount,
        s.frequency || 'MONTHLY',
        s.category || 'Subscriptions',
        s.nextBillingDate || s.nextRenewalDate || '',
        s.previousAmount || null,
        s.priceChangeDetected ? 1 : 0,
        s.status,
        s.linkedTransactionId || null,
        s.notes || null,
        s.createdAt,
        s.updatedAt,
      ]
    );
  }

  public async updateSubscription(s: Partial<Subscription> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getSubscriptionForUser(s.id, s.userId);
    if (!existing) throw new Error('Subscription not found');
    const merged = { ...existing, ...s, updatedAt: new Date().toISOString() };
    await this.saveSubscription(merged);
  }

  public async saveLoan(l: Loan): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO loans (id, user_id, name, lender, principal, outstanding_balance, interest_rate, emi_amount, due_date, tenure_months, remaining_tenure_months, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        l.id,
        l.userId,
        l.loanName,
        l.lender,
        l.principal,
        l.outstandingBalance,
        l.interestRate,
        l.emi,
        l.dueDate,
        l.tenureMonths || 60,
        l.remainingMonths || 48,
        l.status,
        l.createdAt,
        l.updatedAt,
      ]
    );
  }

  public async updateLoan(l: Partial<Loan> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getLoanForUser(l.id, l.userId);
    if (!existing) throw new Error('Loan not found');
    const merged = { ...existing, ...l, updatedAt: new Date().toISOString() };
    await this.saveLoan(merged);
  }

  public async saveKycRecord(k: KycRecord): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO kyc_records (id, user_id, full_name, date_of_birth, address, country, document_type, document_number, masked_document_number, status, document_image_uri, ocr_extracted_json, reviewer_notes, submitted_at, verified_at, rejection_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        k.id,
        k.userId,
        k.fullName,
        k.dateOfBirth || null,
        k.address || null,
        k.country || 'India',
        k.documentType,
        k.documentNumber,
        k.maskedDocumentNumber,
        k.status,
        k.documentImageUri || null,
        k.ocrExtractedData ? JSON.stringify(k.ocrExtractedData) : null,
        k.reviewerNotes || null,
        k.submittedAt || null,
        k.verifiedAt || null,
        k.rejectionReason || null,
        k.createdAt,
        k.updatedAt,
      ]
    );
  }

  public async updateKycRecord(k: Partial<KycRecord> & { id: string; userId: string }): Promise<void> {
    const existing = await this.getKycRecordForUser(k.userId);
    if (!existing) throw new Error('KYC record not found');
    const merged = { ...existing, ...k, updatedAt: new Date().toISOString() };
    await this.saveKycRecord(merged);
  }

  /* ==========================================================================
     Atomic Financial Operations
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
      await tx.execute(
        `INSERT OR REPLACE INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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

      await tx.execute(
        `UPDATE accounts SET current_balance = ?, available_balance = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT OR REPLACE INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [a.id, a.userId, a.eventType, a.description, a.ipAddress, a.blockchainTxId || null, null, a.timestamp]
        );
      }

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
        `UPDATE transactions SET date = ?, description = ?, clean_description = ?, amount = ?, type = ?, category = ?, payment_method = ?, merchant = ?, notes = ?, is_recurring = ?, recurring_frequency = ?, ai_confidence = ?, ai_predicted_category = ?, user_corrected = ?, blockchain_hash = ?, block_number = ?, blockchain_verified = ?, updated_at = ?
         WHERE id = ? AND user_id = ?;`,
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
        `UPDATE accounts SET current_balance = ?, available_balance = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT OR REPLACE INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
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
      await tx.execute(`DELETE FROM transactions WHERE id = ? AND user_id = ?;`, [data.transactionId, data.userId]);

      if (data.account && data.revertedBalance !== undefined) {
        await tx.execute(
          `UPDATE accounts SET current_balance = ?, available_balance = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
          [data.revertedBalance, data.revertedBalance, new Date().toISOString(), data.account.id, data.account.userId]
        );
      }

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT OR REPLACE INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
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
      const t = data.transaction;
      await tx.execute(
        `INSERT OR REPLACE INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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

      await tx.execute(
        `UPDATE bills SET status = 'PAID', linked_transaction_id = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
        [t.id, new Date().toISOString(), data.bill.id, data.bill.userId]
      );

      await tx.execute(
        `UPDATE accounts SET current_balance = ?, available_balance = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT OR REPLACE INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
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
      await tx.execute(
        `INSERT OR REPLACE INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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

      await tx.execute(
        `UPDATE loans SET outstanding_balance = ?, remaining_tenure_months = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
        [data.loan.outstandingBalance, data.loan.remainingMonths, new Date().toISOString(), data.loan.id, data.loan.userId]
      );

      await tx.execute(
        `UPDATE accounts SET current_balance = ?, available_balance = ?, updated_at = ? WHERE id = ? AND user_id = ?;`,
        [data.newBalance, data.newBalance, new Date().toISOString(), data.account.id, data.account.userId]
      );

      if (data.auditEvent) {
        const a = data.auditEvent;
        await tx.execute(
          `INSERT OR REPLACE INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
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
    await this.execute(`DELETE FROM transactions WHERE id = ?;`, [id]);
  }

  public async deleteSession(id: string): Promise<void> {
    await this.execute(`DELETE FROM sessions WHERE id = ?;`, [id]);
  }

  public async deleteSessionByToken(token: string): Promise<void> {
    await this.execute(`DELETE FROM sessions WHERE token = ?;`, [token]);
  }

  public async isTokenRevoked(token: string): Promise<boolean> {
    if (!token) return true;
    try {
      const rows = await this.query(`SELECT token FROM revoked_tokens WHERE token = ? LIMIT 1;`, [token]);
      return rows.length > 0;
    } catch {
      return false;
    }
  }

  public async revokeToken(token: string, userId?: string, reason?: string): Promise<void> {
    if (!token) return;
    try {
      await this.execute(
        `INSERT OR REPLACE INTO revoked_tokens (token, user_id, revoked_at, reason)
         VALUES (?, ?, ?, ?);`,
        [token, userId || null, new Date().toISOString(), reason || 'MANUAL_REVOCATION']
      );
    } catch (err) {
      console.error('[SqliteAdapter] Failed to record revoked token:', err);
    }
  }

  // Security Token Persistence (Email, Password Reset, MFA Tickets, Rate Limits)
  public async saveEmailVerificationToken(token: string, userId: string, expiresAt: number): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO email_verification_tokens (token, user_id, expires_at, used, created_at)
       VALUES (?, ?, ?, 0, ?);`,
      [token, userId, expiresAt, new Date().toISOString()]
    );
  }

  public async getEmailVerificationToken(token: string): Promise<{ token: string; userId: string; expiresAt: number; used: boolean } | null> {
    const rows = await this.query(`SELECT token, user_id, expires_at, used FROM email_verification_tokens WHERE token = ? LIMIT 1;`, [token]);
    if (rows.length === 0) return null;
    return {
      token: rows[0].token,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
      used: Boolean(rows[0].used),
    };
  }

  public async consumeEmailVerificationToken(token: string): Promise<void> {
    await this.execute(`UPDATE email_verification_tokens SET used = 1 WHERE token = ?;`, [token]);
  }

  public async savePasswordResetToken(token: string, userId: string, expiresAt: number): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO password_reset_tokens (token, user_id, expires_at, used, created_at)
       VALUES (?, ?, ?, 0, ?);`,
      [token, userId, expiresAt, new Date().toISOString()]
    );
  }

  public async getPasswordResetToken(token: string): Promise<{ token: string; userId: string; expiresAt: number; used: boolean } | null> {
    const rows = await this.query(`SELECT token, user_id, expires_at, used FROM password_reset_tokens WHERE token = ? LIMIT 1;`, [token]);
    if (rows.length === 0) return null;
    return {
      token: rows[0].token,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
      used: Boolean(rows[0].used),
    };
  }

  public async consumePasswordResetToken(token: string): Promise<void> {
    await this.execute(`UPDATE password_reset_tokens SET used = 1 WHERE token = ?;`, [token]);
  }

  public async saveMfaChallengeTicket(ticket: string, userId: string, expiresAt: number): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO mfa_challenge_tickets (ticket, user_id, expires_at, created_at)
       VALUES (?, ?, ?, ?);`,
      [ticket, userId, expiresAt, new Date().toISOString()]
    );
  }

  public async getMfaChallengeTicket(ticket: string): Promise<{ ticket: string; userId: string; expiresAt: number } | null> {
    const rows = await this.query(`SELECT ticket, user_id, expires_at FROM mfa_challenge_tickets WHERE ticket = ? LIMIT 1;`, [ticket]);
    if (rows.length === 0) return null;
    return {
      ticket: rows[0].ticket,
      userId: rows[0].user_id,
      expiresAt: Number(rows[0].expires_at),
    };
  }

  public async consumeMfaChallengeTicket(ticket: string): Promise<void> {
    await this.execute(`DELETE FROM mfa_challenge_tickets WHERE ticket = ?;`, [ticket]);
  }

  public async checkRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    const now = Date.now();
    try {
      const rows = await this.query(`SELECT count, reset_at FROM rate_limits WHERE key = ? LIMIT 1;`, [key]);
      if (rows.length > 0) {
        const record = rows[0];
        const resetAt = Number(record.reset_at);
        const count = Number(record.count);

        if (now < resetAt) {
          if (count >= limit) {
            const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);
            return { allowed: false, retryAfterSeconds };
          }
          await this.execute(`UPDATE rate_limits SET count = count + 1 WHERE key = ?;`, [key]);
          return { allowed: true };
        }
      }

      const resetAt = now + windowMs;
      await this.execute(
        `INSERT OR REPLACE INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?);`,
        [key, resetAt]
      );
      return { allowed: true };
    } catch {
      return { allowed: true };
    }
  }

  public async getUserById(userId: string): Promise<User | null> {
    if (!userId) return null;
    const rows = await this.query(`SELECT * FROM users WHERE id = ? LIMIT 1;`, [userId]);
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
    const rows = await this.query(`SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1;`, [email.trim()]);
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
      `INSERT OR REPLACE INTO users (id, email, name, password_hash, salt, role, mfa_enabled, mfa_secret, mfa_recovery_codes_json, is_email_verified, session_timeout_minutes, created_at, updated_at, last_login_at, last_login_ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
    const rows = await this.query(`SELECT * FROM profiles WHERE user_id = ? LIMIT 1;`, [userId]);
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
      `INSERT OR REPLACE INTO profiles (user_id, preferred_currency, monthly_income_range, major_categories_json, budget_thresholds_json, privacy_settings_json, onboarding_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
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
    const rows = await this.query(`SELECT * FROM sessions WHERE token = ? LIMIT 1;`, [token]);
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
      `INSERT OR REPLACE INTO sessions (id, token, user_id, device, browser, ip, location, created_at, last_active_at, expires_at, is_current)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
    await this.execute(`UPDATE sessions SET last_active_at = ? WHERE id = ?;`, [lastActiveAt, sessionId]);
  }

  public async deleteAccount(id: string): Promise<void> {
    await this.execute(`DELETE FROM accounts WHERE id = ?;`, [id]);
  }

  public async deleteBill(id: string): Promise<void> {
    await this.execute(`DELETE FROM bills WHERE id = ?;`, [id]);
  }

  public async deleteSubscription(id: string): Promise<void> {
    await this.execute(`DELETE FROM subscriptions WHERE id = ?;`, [id]);
  }

  public async deleteLoan(id: string): Promise<void> {
    await this.execute(`DELETE FROM loans WHERE id = ?;`, [id]);
  }

  public async deleteGoal(id: string): Promise<void> {
    await this.execute(`DELETE FROM goals WHERE id = ?;`, [id]);
  }

  public async deleteBudget(id: string): Promise<void> {
    await this.execute(`DELETE FROM budgets WHERE id = ?;`, [id]);
  }

  public async deleteReceipt(id: string): Promise<void> {
    await this.execute(`DELETE FROM receipts WHERE id = ?;`, [id]);
  }

  public async deleteNotification(id: string): Promise<void> {
    await this.execute(`DELETE FROM notifications WHERE id = ?;`, [id]);
  }

  public async deleteUserAccountPermanently(userId: string): Promise<{ success: boolean; deletedEntitiesCount: number }> {
    return this.withTransaction(async tx => {
      let deleted = 0;
      deleted += await tx.execute(`DELETE FROM accounts WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM transactions WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM budgets WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM goals WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM bills WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM subscriptions WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM loans WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM receipts WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM notifications WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM sessions WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM profiles WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM kyc_records WHERE user_id = ?;`, [userId]);
      deleted += await tx.execute(`DELETE FROM users WHERE id = ?;`, [userId]);
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
    if (!this.db || !dbInstance) return;

    const cleanRow = (params: any[]): any[] => params.map(v => (v === undefined ? null : v));

    try {
      await this.withTransaction(async () => {
        // Sync Users
      for (const [, user] of dbInstance.users || []) {
        this.db.run(
          `INSERT OR REPLACE INTO users (id, email, name, password_hash, salt, role, mfa_enabled, mfa_secret, mfa_recovery_codes_json, is_email_verified, session_timeout_minutes, created_at, updated_at, last_login_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Accounts
      for (const [, acc] of dbInstance.accounts || []) {
        this.db.run(
          `INSERT OR REPLACE INTO accounts (id, user_id, name, institution, account_type, masked_identifier, currency, opening_balance, current_balance, available_balance, credit_limit, status, is_demo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Transactions
      for (const [, tx] of dbInstance.transactions || []) {
        this.db.run(
          `INSERT OR REPLACE INTO transactions (id, user_id, account_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
            tx.id,
            tx.userId,
            tx.accountId || null,
            tx.source || 'MANUAL',
            tx.date,
            tx.description,
            tx.cleanDescription || tx.description || '',
            tx.amount,
            tx.type,
            tx.category,
            tx.paymentMethod,
            tx.merchant,
            tx.notes || null,
            tx.isRecurring ? 1 : 0,
            tx.recurringFrequency || null,
            tx.aiConfidence || 95,
            tx.aiPredictedCategory || tx.category || 'Other',
            tx.userCorrected ? 1 : 0,
            tx.blockchainHash,
            tx.blockNumber || 0,
            tx.blockchainVerified ? 1 : 0,
            tx.createdAt,
            tx.updatedAt,
          ])
        );
      }

      // Sync Bills
      for (const [, bill] of dbInstance.bills || []) {
        this.db.run(
          `INSERT OR REPLACE INTO bills (id, user_id, account_id, name, merchant, amount, category, due_date, frequency, auto_paid, status, linked_transaction_id, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Subscriptions
      for (const [, sub] of dbInstance.subscriptions || []) {
        this.db.run(
          `INSERT OR REPLACE INTO subscriptions (id, user_id, account_id, name, merchant, amount, frequency, category, next_renewal_date, previous_amount, price_change_detected, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Loans
      for (const [, loan] of dbInstance.loans || []) {
        this.db.run(
          `INSERT OR REPLACE INTO loans (id, user_id, name, lender, principal, outstanding_balance, interest_rate, emi_amount, due_date, tenure_months, remaining_tenure_months, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Sessions
      for (const [, sess] of dbInstance.sessions || []) {
        this.db.run(
          `INSERT OR REPLACE INTO sessions (id, token, user_id, device, browser, ip, location, created_at, last_active_at, expires_at, is_current)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Profiles
      for (const [, prof] of dbInstance.profiles || []) {
        this.db.run(
          `INSERT OR REPLACE INTO profiles (user_id, preferred_currency, monthly_income_range, major_categories_json, budget_thresholds_json, privacy_settings_json, onboarding_completed)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
            prof.userId,
            prof.preferredCurrency || 'INR',
            prof.monthlyIncomeRange || null,
            JSON.stringify(prof.majorCategories || []),
            JSON.stringify(prof.budgetThresholds || { normalWarning: 70, highWarning: 90, criticalLimit: 100 }),
            prof.privacySettings ? JSON.stringify(prof.privacySettings) : null,
            prof.onboardingCompleted ? 1 : 0,
          ])
        );
      }

      // Sync Budgets
      for (const [, bud] of dbInstance.budgets || []) {
        this.db.run(
          `INSERT OR REPLACE INTO budgets (id, user_id, month, total_budget, category_budgets_json, rollover_enabled, alert_thresholds_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
            bud.id,
            bud.userId,
            bud.month,
            bud.totalBudget,
            JSON.stringify(bud.categoryBudgets || {}),
            bud.rolloverEnabled ? 1 : 0,
            JSON.stringify(bud.alertThresholds || { warning: 70, critical: 90 }),
            bud.createdAt,
            bud.updatedAt,
          ])
        );
      }

      // Sync Goals
      for (const [, goal] of dbInstance.goals || []) {
        this.db.run(
          `INSERT OR REPLACE INTO goals (id, user_id, title, target_amount, current_amount, target_date, monthly_contribution, priority, category, estimated_completion_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Receipts
      for (const [, rcpt] of dbInstance.receipts || []) {
        this.db.run(
          `INSERT OR REPLACE INTO receipts (id, user_id, merchant, date, amount, tax_amount, currency, category, payment_method, ocr_confidence, raw_text, line_items_json, processing_status, linked_transaction_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync Notifications
      for (const [, notif] of dbInstance.notifications || []) {
        this.db.run(
          `INSERT OR REPLACE INTO notifications (id, user_id, type, title, message, severity, is_read, related_record_id, action_url, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }

      // Sync KYC Records
      for (const [, kyc] of dbInstance.kycRecords || []) {
        this.db.run(
          `INSERT OR REPLACE INTO kyc_records (id, user_id, full_name, date_of_birth, address, country, document_type, document_number, masked_document_number, status, document_image_uri, ocr_extracted_json, reviewer_notes, submitted_at, verified_at, rejection_reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          cleanRow([
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
          ])
        );
      }
      });
      this.saveToDisk();
    } catch (err) {
      console.error('[SqliteAdapter] syncFromMemoryDb failed:', err);
    }
  }

  public async hydrateUserTenantData(userId: string, dbInstance: any): Promise<void> {
    if (!this.db || !dbInstance || !userId) return;

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
      const accRows = await this.query(`SELECT * FROM accounts WHERE user_id = ?;`, [userId]);
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
      const txRows = await this.query(`SELECT * FROM transactions WHERE user_id = ?;`, [userId]);
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
      const budRows = await this.query(`SELECT * FROM budgets WHERE user_id = ?;`, [userId]);
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
      const goalRows = await this.query(`SELECT * FROM goals WHERE user_id = ?;`, [userId]);
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
      const billRows = await this.query(`SELECT * FROM bills WHERE user_id = ?;`, [userId]);
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
      const subRows = await this.query(`SELECT * FROM subscriptions WHERE user_id = ?;`, [userId]);
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
      const loanRows = await this.query(`SELECT * FROM loans WHERE user_id = ?;`, [userId]);
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
      const rcptRows = await this.query(`SELECT * FROM receipts WHERE user_id = ?;`, [userId]);
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
      const notifRows = await this.query(`SELECT * FROM notifications WHERE user_id = ?;`, [userId]);
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
      const kycRows = await this.query(`SELECT * FROM kyc_records WHERE user_id = ?;`, [userId]);
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
      console.error(`[SqliteAdapter] Error hydrating tenant data for user ${userId}:`, err);
    }
  }

  public async hydrateMemoryDb(dbInstance: any): Promise<void> {
    if (!this.db || !dbInstance) return;

    try {
      // 1. Users
      const userStmt = this.db.prepare('SELECT * FROM users');
      while (userStmt.step()) {
        const row = userStmt.getAsObject() as any;
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
      userStmt.free();

      // 2. Profiles
      const profStmt = this.db.prepare('SELECT * FROM profiles');
      while (profStmt.step()) {
        const row = profStmt.getAsObject() as any;
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
      profStmt.free();

      // 3. Sessions
      const sessStmt = this.db.prepare('SELECT * FROM sessions');
      while (sessStmt.step()) {
        const row = sessStmt.getAsObject() as any;
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
      sessStmt.free();

      // 4. Accounts
      const accStmt = this.db.prepare('SELECT * FROM accounts');
      while (accStmt.step()) {
        const row = accStmt.getAsObject() as any;
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
          creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
          status: row.status,
          isDemo: Boolean(row.is_demo),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
      accStmt.free();

      // 5. Transactions
      const txStmt = this.db.prepare('SELECT * FROM transactions');
      while (txStmt.step()) {
        const row = txStmt.getAsObject() as any;
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
          aiConfidence: row.ai_confidence ? Number(row.ai_confidence) : 95,
          aiPredictedCategory: row.ai_predicted_category || row.category,
          userCorrected: Boolean(row.user_corrected),
          blockchainHash: row.blockchain_hash,
          blockNumber: Number(row.block_number),
          blockchainVerified: Boolean(row.blockchain_verified),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
      txStmt.free();

      // 6. Budgets
      const budStmt = this.db.prepare('SELECT * FROM budgets');
      while (budStmt.step()) {
        const row = budStmt.getAsObject() as any;
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
      budStmt.free();

      // 7. Goals
      const goalStmt = this.db.prepare('SELECT * FROM goals');
      while (goalStmt.step()) {
        const row = goalStmt.getAsObject() as any;
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
      goalStmt.free();

      // 8. Bills
      const billStmt = this.db.prepare('SELECT * FROM bills');
      while (billStmt.step()) {
        const row = billStmt.getAsObject() as any;
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
      billStmt.free();

      // 9. Subscriptions
      const subStmt = this.db.prepare('SELECT * FROM subscriptions');
      while (subStmt.step()) {
        const row = subStmt.getAsObject() as any;
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
          previousAmount: row.previous_amount ? Number(row.previous_amount) : undefined,
          priceChangeDetected: Boolean(row.price_change_detected),
          status: row.status,
          linkedTransactionId: row.linked_transaction_id || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
      subStmt.free();

      // 10. Loans
      const loanStmt = this.db.prepare('SELECT * FROM loans');
      while (loanStmt.step()) {
        const row = loanStmt.getAsObject() as any;
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
      loanStmt.free();

      // 11. Receipts
      const rcptStmt = this.db.prepare('SELECT * FROM receipts');
      while (rcptStmt.step()) {
        const row = rcptStmt.getAsObject() as any;
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
      rcptStmt.free();

      // 12. Notifications
      const notifStmt = this.db.prepare('SELECT * FROM notifications');
      while (notifStmt.step()) {
        const row = notifStmt.getAsObject() as any;
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
      notifStmt.free();

      // 13. Audit Events
      const audStmt = this.db.prepare('SELECT * FROM audit_events');
      while (audStmt.step()) {
        const row = audStmt.getAsObject() as any;
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
      audStmt.free();

      // 14. KYC Records
      const kycStmt = this.db.prepare('SELECT * FROM kyc_records');
      while (kycStmt.step()) {
        const row = kycStmt.getAsObject() as any;
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
      kycStmt.free();

      console.log(
        `[SqliteAdapter] Successfully hydrated memory cache from SQLite disk tables (${dbInstance.users.size} users, ${dbInstance.accounts.size} accounts, ${dbInstance.transactions.size} transactions).`
      );
    } catch (err) {
      console.error('[SqliteAdapter] Hydration from SQLite failed:', err);
    }
  }

  /* ==========================================================================
     Blockchain Ledger Persistence
     ========================================================================== */

  public async saveBlockchainBlock(block: BlockchainBlock): Promise<void> {
    await this.execute(
      `INSERT OR REPLACE INTO blockchain_blocks (block_number, channel_id, previous_hash, merkle_root, timestamp, transaction_count, endorsements_json)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
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
      `INSERT OR REPLACE INTO blockchain_records (id, block_number, channel_id, event_type, record_id, sha256_hash, msp_id, timestamp, verification_status, tx_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
