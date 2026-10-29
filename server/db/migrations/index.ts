export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
}

export const EMBEDDED_MIGRATIONS: MigrationFile[] = [
  {
    version: '001',
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'USER',
        mfa_enabled INTEGER NOT NULL DEFAULT 0,
        mfa_secret TEXT,
        mfa_recovery_codes_json TEXT,
        is_email_verified INTEGER NOT NULL DEFAULT 0,
        session_timeout_minutes INTEGER NOT NULL DEFAULT 30,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        last_login_at VARCHAR(64),
        last_login_ip VARCHAR(64)
      );

      CREATE TABLE IF NOT EXISTS profiles (
        user_id VARCHAR(64) PRIMARY KEY,
        preferred_currency VARCHAR(16) NOT NULL DEFAULT 'INR',
        monthly_income_range VARCHAR(64),
        major_categories_json TEXT,
        budget_thresholds_json TEXT,
        privacy_settings_json TEXT,
        onboarding_completed INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        token VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        device VARCHAR(128),
        browser VARCHAR(128),
        ip VARCHAR(64),
        location VARCHAR(128),
        created_at VARCHAR(64) NOT NULL,
        last_active_at VARCHAR(64) NOT NULL,
        expires_at BIGINT NOT NULL,
        is_current INTEGER NOT NULL DEFAULT 1,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        institution VARCHAR(128) NOT NULL,
        account_type VARCHAR(64) NOT NULL,
        masked_identifier VARCHAR(64) NOT NULL,
        currency VARCHAR(16) NOT NULL DEFAULT 'INR',
        opening_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        current_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        available_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
        credit_limit DOUBLE PRECISION,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        is_demo INTEGER NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        account_id VARCHAR(64),
        receipt_id VARCHAR(64),
        bill_id VARCHAR(64),
        source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
        date VARCHAR(32) NOT NULL,
        description TEXT NOT NULL,
        clean_description TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        type VARCHAR(32) NOT NULL,
        category VARCHAR(64) NOT NULL,
        payment_method VARCHAR(64) NOT NULL,
        merchant VARCHAR(128) NOT NULL,
        notes TEXT,
        is_recurring INTEGER NOT NULL DEFAULT 0,
        recurring_frequency VARCHAR(32),
        ai_confidence DOUBLE PRECISION,
        ai_predicted_category VARCHAR(64),
        user_corrected INTEGER NOT NULL DEFAULT 0,
        blockchain_hash VARCHAR(128) NOT NULL,
        block_number INTEGER NOT NULL,
        blockchain_verified INTEGER NOT NULL DEFAULT 1,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        month VARCHAR(32) NOT NULL,
        total_budget DOUBLE PRECISION NOT NULL,
        category_budgets_json TEXT NOT NULL,
        rollover_enabled INTEGER NOT NULL DEFAULT 1,
        alert_thresholds_json TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS goals (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        title VARCHAR(128) NOT NULL,
        target_amount DOUBLE PRECISION NOT NULL,
        current_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        target_date VARCHAR(32),
        monthly_contribution DOUBLE PRECISION NOT NULL DEFAULT 0,
        priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
        category VARCHAR(64),
        estimated_completion_date VARCHAR(32),
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_goals_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS goal_contributions (
        id VARCHAR(64) PRIMARY KEY,
        goal_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        transaction_id VARCHAR(64),
        amount DOUBLE PRECISION NOT NULL,
        date VARCHAR(32) NOT NULL,
        notes TEXT,
        created_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_goal_contributions_goal FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
        CONSTRAINT fk_goal_contributions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bills (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        account_id VARCHAR(64),
        name VARCHAR(128) NOT NULL,
        merchant VARCHAR(128) NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        category VARCHAR(64) NOT NULL,
        due_date VARCHAR(32) NOT NULL,
        frequency VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
        auto_paid INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'UPCOMING',
        linked_transaction_id VARCHAR(64),
        notes TEXT,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_bills_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        account_id VARCHAR(64),
        name VARCHAR(128) NOT NULL,
        merchant VARCHAR(128) NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        frequency VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
        category VARCHAR(64) NOT NULL DEFAULT 'Subscriptions',
        next_renewal_date VARCHAR(32) NOT NULL,
        previous_amount DOUBLE PRECISION,
        price_change_detected INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        linked_transaction_id VARCHAR(64),
        notes TEXT,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS loans (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        lender VARCHAR(128) NOT NULL,
        principal DOUBLE PRECISION NOT NULL,
        outstanding_balance DOUBLE PRECISION NOT NULL,
        interest_rate DOUBLE PRECISION NOT NULL,
        emi_amount DOUBLE PRECISION NOT NULL,
        due_date VARCHAR(32) NOT NULL,
        tenure_months INTEGER NOT NULL,
        remaining_tenure_months INTEGER NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        merchant VARCHAR(128) NOT NULL,
        date VARCHAR(32) NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        tax_amount DOUBLE PRECISION DEFAULT 0,
        currency VARCHAR(16) NOT NULL DEFAULT 'INR',
        category VARCHAR(64) NOT NULL,
        payment_method VARCHAR(64),
        ocr_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
        raw_text TEXT,
        line_items_json TEXT,
        image_url TEXT,
        processing_status VARCHAR(32) NOT NULL DEFAULT 'UNLINKED',
        linked_transaction_id VARCHAR(64),
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_receipts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        type VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(32) NOT NULL DEFAULT 'INFO',
        is_read INTEGER NOT NULL DEFAULT 0,
        related_record_id VARCHAR(64),
        action_url TEXT,
        timestamp VARCHAR(64) NOT NULL,
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        description TEXT NOT NULL,
        ip_address VARCHAR(64),
        sha256_hash VARCHAR(128),
        metadata_json TEXT,
        timestamp VARCHAR(64) NOT NULL,
        CONSTRAINT fk_audit_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_category_feedback (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        description TEXT NOT NULL,
        original_prediction VARCHAR(64),
        user_category VARCHAR(64) NOT NULL,
        timestamp VARCHAR(64) NOT NULL,
        CONSTRAINT fk_ai_category_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_anomaly_feedback (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        anomaly_id VARCHAR(64) NOT NULL,
        transaction_id VARCHAR(64) NOT NULL,
        decision VARCHAR(64) NOT NULL,
        notes TEXT,
        timestamp VARCHAR(64) NOT NULL,
        CONSTRAINT fk_ai_anomaly_feedback_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_recommendation_history (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        recommendation_type VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        details_json TEXT NOT NULL,
        user_action VARCHAR(64) NOT NULL,
        timestamp VARCHAR(64) NOT NULL,
        CONSTRAINT fk_ai_rec_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        expires_at BIGINT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_email_verif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        expires_at BIGINT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_pwd_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS kyc_records (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        date_of_birth VARCHAR(32),
        address TEXT,
        country VARCHAR(64),
        document_type VARCHAR(64) NOT NULL,
        document_number VARCHAR(128) NOT NULL,
        masked_document_number VARCHAR(64) NOT NULL,
        status VARCHAR(32) NOT NULL,
        document_image_uri TEXT,
        ocr_extracted_json TEXT,
        reviewer_notes TEXT,
        submitted_at VARCHAR(64),
        verified_at VARCHAR(64),
        rejection_reason TEXT,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_kyc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

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
      CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `,
  },
  {
    version: '002',
    name: '002_blockchain_ledger',
    sql: `
      CREATE TABLE IF NOT EXISTS blockchain_blocks (
        block_number INTEGER PRIMARY KEY,
        channel_id VARCHAR(64) NOT NULL,
        previous_hash VARCHAR(128) NOT NULL,
        merkle_root VARCHAR(128) NOT NULL,
        timestamp VARCHAR(64) NOT NULL,
        transaction_count INTEGER NOT NULL DEFAULT 0,
        endorsements_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS blockchain_records (
        id VARCHAR(64) PRIMARY KEY,
        block_number INTEGER NOT NULL,
        channel_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(64) NOT NULL,
        record_id VARCHAR(64) NOT NULL,
        sha256_hash VARCHAR(128) NOT NULL,
        msp_id VARCHAR(64) NOT NULL,
        timestamp VARCHAR(64) NOT NULL,
        verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
        tx_id VARCHAR(128) NOT NULL,
        CONSTRAINT fk_record_block FOREIGN KEY (block_number) REFERENCES blockchain_blocks(block_number) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_blockchain_records_record_id ON blockchain_records(record_id);
      CREATE INDEX IF NOT EXISTS idx_blockchain_records_block ON blockchain_records(block_number);
      CREATE INDEX IF NOT EXISTS idx_blockchain_records_tx_id ON blockchain_records(tx_id);
    `,
  },
  {
    version: '003',
    name: '003_revoked_tokens',
    sql: `
      CREATE TABLE IF NOT EXISTS revoked_tokens (
        token VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(64),
        revoked_at VARCHAR(64) NOT NULL,
        reason VARCHAR(255)
      );

      CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON revoked_tokens(user_id);
    `,
  },
  {
    version: '004',
    name: '004_auth_security_hardening',
    sql: `
      CREATE TABLE IF NOT EXISTS mfa_challenge_tickets (
        ticket VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        CONSTRAINT fk_mfa_ticket_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_mfa_tickets_user ON mfa_challenge_tickets(user_id);

      CREATE TABLE IF NOT EXISTS rate_limits (
        key VARCHAR(255) PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at BIGINT NOT NULL
      );
    `,
  },
  {
    version: '005',
    name: '005_production_constraints_and_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC);
      CREATE INDEX IF NOT EXISTS idx_tx_user_category ON transactions(user_id, category);
      CREATE INDEX IF NOT EXISTS idx_tx_user_type ON transactions(user_id, type);
      CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
      CREATE INDEX IF NOT EXISTS idx_bills_user_due ON bills(user_id, due_date);
      CREATE INDEX IF NOT EXISTS idx_subs_user_renewal ON subscriptions(user_id, next_renewal_date);
      CREATE INDEX IF NOT EXISTS idx_loans_user_due ON loans(user_id, due_date);
      CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
      CREATE INDEX IF NOT EXISTS idx_goals_user_priority ON goals(user_id, priority);
      CREATE INDEX IF NOT EXISTS idx_kyc_user_id ON kyc_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_events_user_time ON audit_events(user_id, timestamp DESC);
    `,
  },
];

export async function runPostgresMigrations(poolOrClient: any): Promise<{ applied: string[]; currentVersion: string }> {
  await poolOrClient.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRes = await poolOrClient.query(`SELECT version FROM schema_migrations ORDER BY version ASC;`);
  const appliedSet = new Set<string>(appliedRes.rows.map((r: any) => r.version));

  const newlyApplied: string[] = [];

  for (const mig of EMBEDDED_MIGRATIONS) {
    if (!appliedSet.has(mig.version)) {
      console.log(`[Migrations] Applying PostgreSQL migration: ${mig.name}...`);
      await poolOrClient.query('BEGIN');
      try {
        await poolOrClient.query(mig.sql);
        await poolOrClient.query(
          `INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP);`,
          [mig.version, mig.name]
        );
        await poolOrClient.query('COMMIT');
        newlyApplied.push(mig.version);
      } catch (err) {
        await poolOrClient.query('ROLLBACK');
        console.error(`[Migrations] Migration ${mig.name} failed:`, err);
        throw err;
      }
    }
  }

  const latestRes = await poolOrClient.query(`SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;`);
  const currentVersion = latestRes.rows[0]?.version || '000';

  return { applied: newlyApplied, currentVersion };
}
