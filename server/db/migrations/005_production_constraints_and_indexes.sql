-- Migration 005: Production Performance Indexes & Query Optimization
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
