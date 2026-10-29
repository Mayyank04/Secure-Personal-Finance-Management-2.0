import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User,
  UserProfile,
  Transaction,
  Category,
  Budget,
  BudgetAllocation,
  SavingsGoal,
  GoalContribution,
  RecurringPayment,
  NotificationItem,
  SecurityLog,
  AuditEvent,
  UserSession,
  ReceiptRecord,
  AICategorizationDecision,
  AIAnomalyResult,
  BlockchainBlock,
  BlockchainRecord,
  UserPreferences,
} from './types.js';

export interface DatabaseSchema {
  version: number;
  users: Record<string, User>;
  profiles: Record<string, UserProfile>;
  preferences: Record<string, UserPreferences>;
  transactions: Record<string, Transaction>;
  categories: Record<string, Category>;
  budgets: Record<string, Budget>;
  budgetAllocations: Record<string, BudgetAllocation>;
  goals: Record<string, SavingsGoal>;
  goalContributions: Record<string, GoalContribution>;
  recurringPayments: Record<string, RecurringPayment>;
  notifications: Record<string, NotificationItem>;
  securityLogs: Record<string, SecurityLog>;
  auditEvents: Record<string, AuditEvent>;
  sessions: Record<string, UserSession>;
  receipts: Record<string, ReceiptRecord>;
  aiCategorizations: Record<string, AICategorizationDecision>;
  aiAnomalies: Record<string, AIAnomalyResult>;
  blockchainBlocks: Record<string, BlockchainBlock>;
  blockchainRecords: Record<string, BlockchainRecord>;
}

export class IndexStore {
  public userTransactionsIndex: Map<string, Set<string>> = new Map();
  public transactionDateIndex: Map<string, Set<string>> = new Map();
  public transactionCategoryIndex: Map<string, Set<string>> = new Map();
  public transactionMerchantIndex: Map<string, Set<string>> = new Map();

  public userBudgetsIndex: Map<string, Set<string>> = new Map();
  public budgetPeriodIndex: Map<string, Set<string>> = new Map();

  public userGoalsIndex: Map<string, Set<string>> = new Map();
  public userRecurringIndex: Map<string, Set<string>> = new Map();
  public userNotificationsIndex: Map<string, Set<string>> = new Map();
  public userAuditEventsIndex: Map<string, Set<string>> = new Map();
  public userSessionsIndex: Map<string, Set<string>> = new Map();

  public clear() {
    this.userTransactionsIndex.clear();
    this.transactionDateIndex.clear();
    this.transactionCategoryIndex.clear();
    this.transactionMerchantIndex.clear();
    this.userBudgetsIndex.clear();
    this.budgetPeriodIndex.clear();
    this.userGoalsIndex.clear();
    this.userRecurringIndex.clear();
    this.userNotificationsIndex.clear();
    this.userAuditEventsIndex.clear();
    this.userSessionsIndex.clear();
  }

  private addIndexEntry(map: Map<string, Set<string>>, key: string, id: string) {
    if (!key) return;
    const normalizedKey = String(key).trim().toLowerCase();
    let set = map.get(normalizedKey);
    if (!set) {
      set = new Set();
      map.set(normalizedKey, set);
    }
    set.add(id);
  }

  private removeIndexEntry(map: Map<string, Set<string>>, key: string, id: string) {
    if (!key) return;
    const normalizedKey = String(key).trim().toLowerCase();
    const set = map.get(normalizedKey);
    if (set) {
      set.delete(id);
      if (set.size === 0) {
        map.delete(normalizedKey);
      }
    }
  }

  public indexTransaction(tx: Transaction) {
    this.addIndexEntry(this.userTransactionsIndex, tx.userId, tx.id);
    if (tx.date) this.addIndexEntry(this.transactionDateIndex, tx.date, tx.id);
    if (tx.category) this.addIndexEntry(this.transactionCategoryIndex, tx.category, tx.id);
    if (tx.merchant) this.addIndexEntry(this.transactionMerchantIndex, tx.merchant, tx.id);
  }

  public unindexTransaction(tx: Transaction) {
    this.removeIndexEntry(this.userTransactionsIndex, tx.userId, tx.id);
    if (tx.date) this.removeIndexEntry(this.transactionDateIndex, tx.date, tx.id);
    if (tx.category) this.removeIndexEntry(this.transactionCategoryIndex, tx.category, tx.id);
    if (tx.merchant) this.removeIndexEntry(this.transactionMerchantIndex, tx.merchant, tx.id);
  }

  public indexBudget(budget: Budget) {
    this.addIndexEntry(this.userBudgetsIndex, budget.userId, budget.id);
    const period = budget.monthYear || budget.month;
    if (period) this.addIndexEntry(this.budgetPeriodIndex, period, budget.id);
  }

  public unindexBudget(budget: Budget) {
    this.removeIndexEntry(this.userBudgetsIndex, budget.userId, budget.id);
    const period = budget.monthYear || budget.month;
    if (period) this.removeIndexEntry(this.budgetPeriodIndex, period, budget.id);
  }

  public indexGoal(goal: SavingsGoal) {
    this.addIndexEntry(this.userGoalsIndex, goal.userId, goal.id);
  }

  public unindexGoal(goal: SavingsGoal) {
    this.removeIndexEntry(this.userGoalsIndex, goal.userId, goal.id);
  }

  public indexRecurring(rec: RecurringPayment) {
    this.addIndexEntry(this.userRecurringIndex, rec.userId, rec.id);
  }

  public unindexRecurring(rec: RecurringPayment) {
    this.removeIndexEntry(this.userRecurringIndex, rec.userId, rec.id);
  }

  public indexNotification(notif: NotificationItem) {
    this.addIndexEntry(this.userNotificationsIndex, notif.userId, notif.id);
  }

  public unindexNotification(notif: NotificationItem) {
    this.removeIndexEntry(this.userNotificationsIndex, notif.userId, notif.id);
  }

  public indexAuditEvent(evt: AuditEvent) {
    this.addIndexEntry(this.userAuditEventsIndex, evt.userId, evt.id);
  }

  public indexSession(sess: UserSession) {
    this.addIndexEntry(this.userSessionsIndex, sess.userId, sess.id);
  }

  public unindexSession(sess: UserSession) {
    this.removeIndexEntry(this.userSessionsIndex, sess.userId, sess.id);
  }
}

export class PersistentStorageEngine {
  private dataFilePath: string;
  private walFilePath: string;
  private isFlushing: boolean = false;
  private pendingFlushTimeout: NodeJS.Timeout | null = null;
  public indexes: IndexStore = new IndexStore();

  public data: DatabaseSchema = {
    version: 2,
    users: {},
    profiles: {},
    preferences: {},
    transactions: {},
    categories: {},
    budgets: {},
    budgetAllocations: {},
    goals: {},
    goalContributions: {},
    recurringPayments: {},
    notifications: {},
    securityLogs: {},
    auditEvents: {},
    sessions: {},
    receipts: {},
    aiCategorizations: {},
    aiAnomalies: {},
    blockchainBlocks: {},
    blockchainRecords: {},
  };

  constructor(storageDir?: string) {
    const rootDir = storageDir || path.join(process.cwd(), 'data');
    if (!fs.existsSync(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
    }
    this.dataFilePath = path.join(rootDir, 'aegis_finance.db.json');
    this.walFilePath = path.join(rootDir, 'aegis_finance.wal');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          version: parsed.version || 2,
          users: parsed.users || {},
          profiles: parsed.profiles || {},
          preferences: parsed.preferences || {},
          transactions: parsed.transactions || {},
          categories: parsed.categories || {},
          budgets: parsed.budgets || {},
          budgetAllocations: parsed.budgetAllocations || {},
          goals: parsed.goals || {},
          goalContributions: parsed.goalContributions || {},
          recurringPayments: parsed.recurringPayments || {},
          notifications: parsed.notifications || {},
          securityLogs: parsed.securityLogs || {},
          auditEvents: parsed.auditEvents || {},
          sessions: parsed.sessions || {},
          receipts: parsed.receipts || {},
          aiCategorizations: parsed.aiCategorizations || {},
          aiAnomalies: parsed.aiAnomalies || {},
          blockchainBlocks: parsed.blockchainBlocks || {},
          blockchainRecords: parsed.blockchainRecords || {},
        };
        this.rebuildAllIndexes();
        return;
      }
    } catch (err) {
      console.error('[PersistentStorageEngine] Error loading database file:', err);
    }

    this.rebuildAllIndexes();
  }

  public rebuildAllIndexes() {
    this.indexes.clear();
    for (const tx of Object.values(this.data.transactions)) {
      this.indexes.indexTransaction(tx);
    }
    for (const b of Object.values(this.data.budgets)) {
      this.indexes.indexBudget(b);
    }
    for (const g of Object.values(this.data.goals)) {
      this.indexes.indexGoal(g);
    }
    for (const r of Object.values(this.data.recurringPayments)) {
      this.indexes.indexRecurring(r);
    }
    for (const n of Object.values(this.data.notifications)) {
      this.indexes.indexNotification(n);
    }
    for (const a of Object.values(this.data.auditEvents)) {
      this.indexes.indexAuditEvent(a);
    }
    for (const s of Object.values(this.data.sessions)) {
      this.indexes.indexSession(s);
    }
  }

  public schedulePersist() {
    if (this.pendingFlushTimeout) {
      clearTimeout(this.pendingFlushTimeout);
    }
    this.pendingFlushTimeout = setTimeout(() => {
      this.flushToDisk();
    }, 150);
  }

  public flushToDisk(): boolean {
    try {
      this.isFlushing = true;
      const tmpPath = `${this.dataFilePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      const serialized = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tmpPath, serialized, 'utf-8');
      fs.renameSync(tmpPath, this.dataFilePath);
      this.isFlushing = false;
      return true;
    } catch (err) {
      console.error('[PersistentStorageEngine] Critical error flushing database to disk:', err);
      this.isFlushing = false;
      return false;
    }
  }

  public wipeDatabase() {
    this.data = {
      version: 2,
      users: {},
      profiles: {},
      preferences: {},
      transactions: {},
      categories: {},
      budgets: {},
      budgetAllocations: {},
      goals: {},
      goalContributions: {},
      recurringPayments: {},
      notifications: {},
      securityLogs: {},
      auditEvents: {},
      sessions: {},
      receipts: {},
      aiCategorizations: {},
      aiAnomalies: {},
      blockchainBlocks: {},
      blockchainRecords: {},
    };
    this.indexes.clear();
    this.flushToDisk();
  }
}
