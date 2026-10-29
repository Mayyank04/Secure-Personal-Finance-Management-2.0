
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import {
  User,
  UserProfile,
  FinancialAccount,
  Transaction,
  Budget,
  SavingsGoal,
  GoalContribution,
  Bill,
  Subscription,
  Loan,
  ReceiptRecord,
  NotificationItem,
  AuditEvent,
  UserSession,
  BlockchainRecord,
  DebtSummary,
  KycRecord,
} from './types.js';
import { blockchainAdapter } from './blockchain.js';
import { getDatabaseAdapter, resolveDatabaseProvider, IDatabaseAdapter } from './db/index.js';

export class SQLiteDatabase {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private initialized: boolean = false;
  private syncTimeout: NodeJS.Timeout | null = null;

  public isInitialized(): boolean {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      return getDatabaseAdapter().isInitialized();
    }
    return this.initialized && this.db !== null;
  }

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

  public async init(): Promise<void> {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      try {
        const pgAdapter = getDatabaseAdapter();
        if (!pgAdapter.isInitialized()) {
          await pgAdapter.init();
        }
      } catch (err) {
        console.error('[SQLiteDatabase] PostgreSQL init error in persistentSqlite:', err);
      }
    }

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
      console.error('[SQLiteDatabase] Failed to write database to disk:', err);
    }
  }

  public getRawDb(): SqlJsDatabase {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  public getAccountForUser(accountId: string, userId: string): FinancialAccount | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM accounts WHERE id = ? AND user_id = ?`);
    stmt.bind([accountId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        institution: row.institution,
        accountType: row.account_type,
        maskedIdentifier: row.masked_identifier,
        currency: row.currency,
        openingBalance: row.opening_balance,
        currentBalance: row.current_balance,
        availableBalance: row.available_balance,
        creditLimit: row.credit_limit,
        status: row.status,
        isDemo: Boolean(row.is_demo),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public getTransactionForUser(transactionId: string, userId: string): Transaction | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM transactions WHERE id = ? AND user_id = ?`);
    stmt.bind([transactionId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        receiptId: row.receipt_id,
        billId: row.bill_id,
        source: row.source,
        date: row.date,
        description: row.description,
        cleanDescription: row.clean_description,
        amount: row.amount,
        type: row.type,
        category: row.category,
        paymentMethod: row.payment_method,
        merchant: row.merchant,
        notes: row.notes,
        isRecurring: Boolean(row.is_recurring),
        recurringFrequency: row.recurring_frequency,
        aiConfidence: row.ai_confidence,
        aiPredictedCategory: row.ai_predicted_category,
        userCorrected: Boolean(row.user_corrected),
        blockchainHash: row.blockchain_hash,
        blockNumber: row.block_number,
        blockchainVerified: Boolean(row.blockchain_verified),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public getBillForUser(billId: string, userId: string): Bill | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM bills WHERE id = ? AND user_id = ?`);
    stmt.bind([billId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        name: row.name,
        merchant: row.merchant,
        amount: row.amount,
        category: row.category,
        dueDate: row.due_date,
        frequency: row.frequency,
        autoPaid: Boolean(row.auto_paid),
        status: row.status,
        linkedTransactionId: row.linked_transaction_id,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public getGoalForUser(goalId: string, userId: string): SavingsGoal | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM goals WHERE id = ? AND user_id = ?`);
    stmt.bind([goalId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        targetAmount: row.target_amount,
        currentAmount: row.current_amount,
        targetDate: row.target_date,
        monthlyContribution: row.monthly_contribution,
        priority: row.priority,
        category: row.category,
        estimatedCompletionDate: row.estimated_completion_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public getLoanForUser(loanId: string, userId: string): Loan | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM loans WHERE id = ? AND user_id = ?`);
    stmt.bind([loanId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        loanName: row.name,
        lender: row.lender,
        loanType: 'PERSONAL_LOAN',
        principal: row.principal,
        outstandingBalance: row.outstanding_balance,
        interestRate: row.interest_rate,
        emi: row.emi_amount,
        dueDate: row.due_date,
        startDate: row.start_date || new Date().toISOString().split('T')[0],
        maturityDate: row.maturity_date || new Date().toISOString().split('T')[0],
        tenureMonths: row.tenure_months,
        remainingMonths: row.remaining_tenure_months,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public getSubscriptionForUser(subscriptionId: string, userId: string): Subscription | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM subscriptions WHERE id = ? AND user_id = ?`);
    stmt.bind([subscriptionId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        name: row.name,
        merchant: row.merchant,
        amount: row.amount,
        frequency: row.frequency,
        category: row.category,
        nextBillingDate: row.next_renewal_date,
        nextRenewalDate: row.next_renewal_date,
        monthlyCost: row.amount,
        annualCost: row.frequency === 'ANNUAL' ? row.amount : row.amount * 12,
        previousAmount: row.previous_amount,
        priceChangeDetected: Boolean(row.price_change_detected),
        status: row.status,
        linkedTransactionId: row.linked_transaction_id,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public getReceiptForUser(receiptId: string, userId: string): ReceiptRecord | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`SELECT * FROM receipts WHERE id = ? AND user_id = ?`);
    stmt.bind([receiptId, userId]);
    if (stmt.step()) {
      const row = stmt.getAsObject() as any;
      stmt.free();
      return {
        id: row.id,
        userId: row.user_id,
        merchant: row.merchant,
        date: row.date,
        amount: row.amount,
        tax: row.tax_amount,
        currency: row.currency,
        category: row.category,
        paymentMethod: row.payment_method,
        ocrConfidence: row.ocr_confidence,
        rawText: row.raw_text,
        items: row.line_items_json ? JSON.parse(row.line_items_json) : [],
        processingStatus: row.processing_status,
        linkedTransactionId: row.linked_transaction_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
    stmt.free();
    return null;
  }

  public syncFromMemoryDb(dbInstance: any): void {
    if (!this.db || !dbInstance) return;

    const cleanRow = (params: any[]): any[] => params.map(v => (v === undefined ? null : v));

    try {
      this.db.run('BEGIN TRANSACTION;');

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
            sess.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000),
            sess.isCurrent ? 1 : 0,
          ])
        );
      }

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

      this.db.run('COMMIT;');
      this.saveToDisk();

      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized()) {
        adapter.syncFromMemoryDb(dbInstance).catch(err => {
          console.error('[SQLiteDatabase] Failed to sync to active database adapter:', err);
        });
      }
    } catch (err) {
      try {
        this.db.run('ROLLBACK;');
      } catch { }
      console.error('[SQLiteDatabase] Failed to sync entities into SQLite:', err);
    }
  }

  public hasExistingData(): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) AS cnt FROM users');
      if (stmt.step()) {
        const row = stmt.getAsObject() as any;
        stmt.free();
        return Number(row.cnt) > 0;
      }
      stmt.free();
    } catch { }
    return false;
  }

  public hydrateMemoryDb(dbInstance: any): void {
    if (!this.db || !dbInstance) return;

    try {
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

      const profStmt = this.db.prepare('SELECT * FROM profiles');
      while (profStmt.step()) {
        const row = profStmt.getAsObject() as any;
        dbInstance.profiles.set(row.user_id, {
          userId: row.user_id,
          preferredCurrency: row.preferred_currency || 'INR',
          monthlyIncomeRange: row.monthly_income_range || undefined,
          majorCategories: row.major_categories_json ? JSON.parse(row.major_categories_json) : [],
          budgetThresholds: row.budget_thresholds_json ? JSON.parse(row.budget_thresholds_json) : { normalWarning: 70, highWarning: 90, criticalLimit: 100 },
          privacySettings: row.privacy_settings_json ? JSON.parse(row.privacy_settings_json) : undefined,
          onboardingCompleted: Boolean(row.onboarding_completed),
        });
      }
      profStmt.free();

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
          expiresAt: row.expires_at,
          isCurrent: Boolean(row.is_current),
        });
      }
      sessStmt.free();

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
          alertThresholds: row.alert_thresholds_json ? JSON.parse(row.alert_thresholds_json) : { warning: 70, critical: 90 },
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
      budStmt.free();

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

      console.log(`[SQLiteDatabase] Successfully hydrated memory cache from SQLite disk tables (${dbInstance.users.size} users, ${dbInstance.accounts.size} accounts, ${dbInstance.transactions.size} transactions).`);
    } catch (err) {
      console.error('[SQLiteDatabase] Hydration from SQLite failed:', err);
    }
  }

  public deleteTransaction(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteTransaction(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM transactions WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete transaction:', err);
    }
  }

  public deleteSession(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteSession(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM sessions WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete session:', err);
    }
  }

  public deleteSessionByToken(token: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteSessionByToken(token).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM sessions WHERE token = ?;', [token]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete session by token:', err);
    }
  }

  public async isTokenRevoked(token: string): Promise<boolean> {
    return getDatabaseAdapter().isTokenRevoked(token);
  }

  public async revokeToken(token: string, userId?: string, reason?: string): Promise<void> {
    return getDatabaseAdapter().revokeToken(token, userId, reason);
  }

  public async getUserById(userId: string): Promise<User | null> {
    return getDatabaseAdapter().getUserById(userId);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    return getDatabaseAdapter().getUserByEmail(email);
  }

  public async createUser(user: User): Promise<void> {
    return getDatabaseAdapter().createUser(user);
  }

  public async updateUser(user: Partial<User> & { id: string }): Promise<void> {
    return getDatabaseAdapter().updateUser(user);
  }

  public async getProfileForUser(userId: string): Promise<UserProfile | null> {
    return getDatabaseAdapter().getProfileForUser(userId);
  }

  public async createProfile(profile: UserProfile): Promise<void> {
    return getDatabaseAdapter().createProfile(profile);
  }

  public async updateProfile(profile: Partial<UserProfile> & { userId: string }): Promise<void> {
    return getDatabaseAdapter().updateProfile(profile);
  }

  public async getSessionByToken(token: string): Promise<UserSession | null> {
    return getDatabaseAdapter().getSessionByToken(token);
  }

  public async createSession(session: UserSession): Promise<void> {
    return getDatabaseAdapter().createSession(session);
  }

  public async updateSessionActivity(sessionId: string, lastActiveAt: string): Promise<void> {
    return getDatabaseAdapter().updateSessionActivity(sessionId, lastActiveAt);
  }

  public async hydrateUserTenantData(userId: string, dbInstance: any): Promise<void> {
    return getDatabaseAdapter().hydrateUserTenantData(userId, dbInstance);
  }

  public deleteAccount(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteAccount(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM accounts WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete account:', err);
    }
  }

  public deleteBill(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteBill(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM bills WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete bill:', err);
    }
  }

  public deleteSubscription(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteSubscription(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM subscriptions WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete subscription:', err);
    }
  }

  public deleteLoan(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteLoan(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM loans WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete loan:', err);
    }
  }

  public deleteGoal(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteGoal(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM goals WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete goal:', err);
    }
  }

  public deleteBudget(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteBudget(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM budgets WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete budget:', err);
    }
  }

  public deleteReceipt(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteReceipt(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM receipts WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete receipt:', err);
    }
  }

  public deleteNotification(id: string): void {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteNotification(id).catch(() => {});
    }
    if (!this.db) return;
    try {
      this.db.run('DELETE FROM notifications WHERE id = ?;', [id]);
      this.scheduleSave();
    } catch (err) {
      console.error('[SQLiteDatabase] Failed to delete notification:', err);
    }
  }

  public deleteUserAccountPermanently(userId: string): { success: boolean; deletedEntitiesCount: number } {
    const provider = resolveDatabaseProvider();
    if (provider === 'postgresql') {
      getDatabaseAdapter().deleteUserAccountPermanently(userId).catch(() => {});
    }

    if (!this.db) return { success: false, deletedEntitiesCount: 0 };

    this.db.run('BEGIN TRANSACTION;');
    try {
      this.db.run(`DELETE FROM users WHERE id = ?;`, [userId]);
      this.db.run('COMMIT;');
      this.saveToDisk();

      blockchainAdapter.recordAuditEvent(
        `user-purge-${userId}`,
        crypto.createHash('sha256').update(`USER_OFFCHAIN_DATA_PERMANENTLY_PURGED:${userId}:${new Date().toISOString()}`).digest('hex')
      );

      return { success: true, deletedEntitiesCount: 1 };
    } catch (err) {
      this.db.run('ROLLBACK;');
      console.error('[SQLiteDatabase] Account deletion failed:', err);
      throw err;
    }
  }
}

export const persistentSqlite = new SQLiteDatabase();
export { getDatabaseAdapter, dbAdapter, resolveDatabaseProvider } from './db/index.js';
export type { IDatabaseAdapter } from './db/types.js';

