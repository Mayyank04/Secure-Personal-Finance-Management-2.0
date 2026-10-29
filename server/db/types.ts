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
  KycRecord,
  BlockchainBlock,
  BlockchainRecord,
} from '../types.js';

export interface IDatabaseAdapter {
  readonly provider: 'postgresql' | 'sqlite';
  init(): Promise<void>;
  close(): Promise<void>;
  isInitialized(): boolean;
  healthCheck(): Promise<{
    status: 'ok' | 'error';
    provider: 'postgresql' | 'sqlite';
    connected: boolean;
    migrationVersion?: string;
    error?: string;
  }>;

  // Generic query execution
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<number>;

  // Transaction support
  withTransaction<T>(callback: (client: IDatabaseAdapter) => Promise<T>): Promise<T>;

  // IDOR & Centralized Authorization Helpers
  getAccountForUser(accountId: string, userId: string): Promise<FinancialAccount | null>;
  getTransactionForUser(transactionId: string, userId: string): Promise<Transaction | null>;
  getBudgetForUser(budgetId: string, userId: string): Promise<Budget | null>;
  getBillForUser(billId: string, userId: string): Promise<Bill | null>;
  getGoalForUser(goalId: string, userId: string): Promise<SavingsGoal | null>;
  getLoanForUser(loanId: string, userId: string): Promise<Loan | null>;
  getSubscriptionForUser(subscriptionId: string, userId: string): Promise<Subscription | null>;
  getReceiptForUser(receiptId: string, userId: string): Promise<ReceiptRecord | null>;
  getKycRecordForUser(userId: string): Promise<KycRecord | null>;

  // Direct Resource Persistence Methods
  saveAccount(account: FinancialAccount): Promise<void>;
  updateAccount(account: Partial<FinancialAccount> & { id: string; userId: string }): Promise<void>;
  getAccountTransactionsCount(accountId: string, userId: string): Promise<number>;

  saveBudget(budget: Budget): Promise<void>;
  updateBudget(budget: Partial<Budget> & { id: string; userId: string }): Promise<void>;

  saveGoal(goal: SavingsGoal): Promise<void>;
  updateGoal(goal: Partial<SavingsGoal> & { id: string; userId: string }): Promise<void>;

  saveBill(bill: Bill): Promise<void>;
  updateBill(bill: Partial<Bill> & { id: string; userId: string }): Promise<void>;

  saveSubscription(subscription: Subscription): Promise<void>;
  updateSubscription(subscription: Partial<Subscription> & { id: string; userId: string }): Promise<void>;

  saveLoan(loan: Loan): Promise<void>;
  updateLoan(loan: Partial<Loan> & { id: string; userId: string }): Promise<void>;

  saveKycRecord(kyc: KycRecord): Promise<void>;
  updateKycRecord(kyc: Partial<KycRecord> & { id: string; userId: string }): Promise<void>;

  // Financial Atomic Transactions
  createTransactionAtomic(data: {
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean; transaction: Transaction }>;

  updateTransactionAtomic(data: {
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean; transaction: Transaction }>;

  deleteTransactionAtomic(data: {
    transactionId: string;
    userId: string;
    account?: FinancialAccount;
    revertedBalance?: number;
    auditEvent?: AuditEvent;
  }): Promise<{ success: boolean }>;

  payBillAtomic(data: {
    bill: Bill;
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean }>;

  payLoanEmiAtomic(data: {
    loan: Loan;
    transaction: Transaction;
    account: FinancialAccount;
    newBalance: number;
    auditEvent?: AuditEvent;
    ledgerRecord?: BlockchainRecord;
  }): Promise<{ success: boolean }>;

  // Deletion Helpers
  deleteTransaction(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteSessionByToken(token: string): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  deleteBill(id: string): Promise<void>;
  deleteSubscription(id: string): Promise<void>;
  deleteLoan(id: string): Promise<void>;
  deleteGoal(id: string): Promise<void>;
  deleteBudget(id: string): Promise<void>;
  deleteReceipt(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteUserAccountPermanently(userId: string): Promise<{ success: boolean; deletedEntitiesCount: number }>;

  // Repository Layer: Users, Profiles, Sessions & Token Revocation
  getUserById(userId: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(user: User): Promise<void>;
  updateUser(user: Partial<User> & { id: string }): Promise<void>;
  getProfileForUser(userId: string): Promise<UserProfile | null>;
  createProfile(profile: UserProfile): Promise<void>;
  updateProfile(profile: Partial<UserProfile> & { userId: string }): Promise<void>;
  getSessionByToken(token: string): Promise<UserSession | null>;
  createSession(session: UserSession): Promise<void>;
  updateSessionActivity(sessionId: string, lastActiveAt: string): Promise<void>;
  isTokenRevoked(token: string): Promise<boolean>;
  revokeToken(token: string, userId?: string, reason?: string): Promise<void>;

  // Security Token Persistence (Email, Password Reset, MFA Tickets, Rate Limits)
  saveEmailVerificationToken(token: string, userId: string, expiresAt: number): Promise<void>;
  getEmailVerificationToken(token: string): Promise<{ token: string; userId: string; expiresAt: number; used: boolean } | null>;
  consumeEmailVerificationToken(token: string): Promise<void>;

  savePasswordResetToken(token: string, userId: string, expiresAt: number): Promise<void>;
  getPasswordResetToken(token: string): Promise<{ token: string; userId: string; expiresAt: number; used: boolean } | null>;
  consumePasswordResetToken(token: string): Promise<void>;

  saveMfaChallengeTicket(ticket: string, userId: string, expiresAt: number): Promise<void>;
  getMfaChallengeTicket(ticket: string): Promise<{ ticket: string; userId: string; expiresAt: number } | null>;
  consumeMfaChallengeTicket(ticket: string): Promise<void>;

  checkRateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;

  // Tenant Hydration & Memory Sync
  hydrateUserTenantData(userId: string, dbInstance: any): Promise<void>;
  syncFromMemoryDb(dbInstance: any): Promise<void>;
  hydrateMemoryDb(dbInstance: any): Promise<void>;
  hasExistingData(): Promise<boolean>;

  // Blockchain Ledger Persistence
  saveBlockchainBlock(block: BlockchainBlock): Promise<void>;
  saveBlockchainRecord(record: BlockchainRecord): Promise<void>;
  loadBlockchainState(): Promise<{ blocks: BlockchainBlock[]; records: BlockchainRecord[] }>;
}
