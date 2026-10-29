/**
 * Server-side Types and Interfaces for Secure Personal Finance System
 */

export type TransactionType = 'INCOME' | 'EXPENSE';

export type TransactionCategory =
  | 'Food'
  | 'Groceries'
  | 'Transport'
  | 'Shopping'
  | 'Entertainment'
  | 'Bills'
  | 'Utilities'
  | 'Healthcare'
  | 'Education'
  | 'Travel'
  | 'Subscriptions'
  | 'Rent'
  | 'Insurance'
  | 'Investment'
  | 'Salary'
  | 'Freelance'
  | 'Other';

export type PaymentMethod =
  | 'Credit Card'
  | 'Debit Card'
  | 'UPI / Instant Transfer'
  | 'Bank Transfer'
  | 'Cash'
  | 'Net Banking';

export type AccountType = 'BANK' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'CASH' | 'INVESTMENT';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'CLOSED';

export interface FinancialAccount {
  id: string;
  userId: string;
  name: string;
  institution: string;
  accountType: AccountType;
  maskedIdentifier: string; // e.g. "•••• 4829" or "user@okaxis"
  currency: 'INR' | 'USD' | 'EUR' | 'GBP';
  openingBalance: number;
  currentBalance: number;
  availableBalance: number;
  creditLimit?: number;
  status: AccountStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BillStatus = 'UPCOMING' | 'DUE_SOON' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type BillFrequency = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface Bill {
  id: string;
  userId: string;
  name: string;
  merchant: string;
  amount: number;
  category: TransactionCategory;
  dueDate: string; // YYYY-MM-DD
  frequency: BillFrequency;
  accountId?: string;
  status: BillStatus;
  notes?: string;
  autoPaid?: boolean;
  linkedTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';
export type SubscriptionFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'WEEKLY';

export interface Subscription {
  id: string;
  userId: string;
  merchant: string;
  name: string;
  category: TransactionCategory;
  amount: number;
  frequency: SubscriptionFrequency;
  nextBillingDate: string;
  nextRenewalDate?: string;
  annualCost: number;
  monthlyCost: number;
  accountId?: string;
  status: SubscriptionStatus;
  linkedTransactionId?: string;
  previousAmount?: number;
  priceChangeDetected?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type LoanType = 'PERSONAL_LOAN' | 'EDUCATION_LOAN' | 'HOME_LOAN' | 'VEHICLE_LOAN' | 'CREDIT_CARD_DEBT' | 'OTHER_DEBT';
export type LoanStatus = 'ACTIVE' | 'CLOSED' | 'DEFAULTED';

export interface Loan {
  id: string;
  userId: string;
  lender: string;
  loanName: string;
  loanType: LoanType;
  principal: number;
  outstandingBalance: number;
  interestRate: number; // percentage p.a.
  emi: number; // monthly installment
  dueDate: string; // e.g. "5th of month" or YYYY-MM-DD
  startDate: string;
  maturityDate: string;
  status: LoanStatus;
  tenureMonths?: number;
  remainingMonths?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptRecord {
  id: string;
  userId: string;
  merchant: string;
  date: string;
  amount: number;
  tax?: number;
  currency?: string;
  items: ReceiptItem[];
  ocrText?: string;
  rawText?: string;
  ocrConfidence: number;
  category: TransactionCategory;
  paymentMethod?: PaymentMethod;
  linkedTransactionId?: string;
  processingStatus: 'PROCESSED' | 'NEEDS_REVIEW' | 'LINKED' | 'UNLINKED';
  imageData?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: 'USER' | 'ADMIN' | 'AUDITOR';
  mfaEnabled: boolean;
  mfaSecret?: string;
  mfaRecoveryCodes?: string[];
  isEmailVerified?: boolean;
  sessionTimeoutMinutes?: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  lastLoginIp?: string;
}

export interface UserProfile {
  userId: string;
  preferredCurrency: 'INR' | 'USD' | 'EUR' | 'GBP';
  monthlyIncomeRange: string;
  majorCategories: TransactionCategory[];
  budgetThresholds: {
    normalWarning: number; // e.g. 70
    highWarning: number;   // e.g. 90
    critical: number;      // e.g. 100
  };
  privacySettings: {
    aiPersonalizationConsent: boolean;
    dataSharingConsent: boolean;
    analyticsPermission: boolean;
    blockchainAuditConsent: boolean;
  };
  onboardingCompleted: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId?: string;
  accountName?: string;
  date: string;
  description: string;
  cleanDescription?: string;
  amount: number;
  type: TransactionType;
  category: TransactionCategory;
  paymentMethod: PaymentMethod;
  merchant: string;
  notes?: string;
  isRecurring?: boolean;
  recurringFrequency?: 'MONTHLY' | 'WEEKLY' | 'ANNUAL';
  receiptId?: string;
  billId?: string;
  source?: 'MANUAL' | 'CSV_IMPORT' | 'SANDBOX_BANK' | 'SANDBOX_UPI' | 'RECEIPT_SCAN' | 'VOICE_ENTRY' | 'VOICE_ASSISTANT';
  aiConfidence: number; // 0 - 100
  aiPredictedCategory?: TransactionCategory;
  userCorrected?: boolean;
  blockchainHash: string;
  blockNumber: number;
  blockchainVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  month: string; // YYYY-MM
  monthYear?: string;
  totalBudget: number;
  categoryBudgets: {
    category: TransactionCategory;
    allocatedAmount: number;
  }[];
  rolloverEnabled: boolean;
  alertThresholds: {
    normal: number;
    high: number;
    exceeded: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type GoalPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  monthlyContribution: number;
  priority: GoalPriority;
  category?: string;
  estimatedCompletionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringPayment {
  id: string;
  userId: string;
  merchant: string;
  description: string;
  amount: number;
  frequency: 'MONTHLY' | 'WEEKLY' | 'ANNUAL';
  category: TransactionCategory;
  nextDueDate: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  previousAmount?: number;
  priceChanged?: boolean;
}

export interface Anomaly {
  id: string;
  userId: string;
  transactionId: string;
  transactionDescription: string;
  transactionAmount: number;
  transactionDate: string;
  category: TransactionCategory;
  deviationMultiplier: number; // e.g. 2.4x
  categoryHistoricalAverage: number;
  zScore: number;
  confidenceScore: number; // 0 - 100
  status: 'PENDING_REVIEW' | 'CONFIRMED_NORMAL' | 'REPORTED';
  flaggedReasons: string[];
  shapAttributions: {
    feature: string;
    impact: string;
    weight: number;
  }[];
  createdAt: string;
}

export interface AIInsight {
  id: string;
  userId: string;
  type: 'SPENDING_PATTERN' | 'UNUSUAL_TRANSACTION' | 'FORECAST' | 'BUDGET_SUGGESTION' | 'SAVINGS_SUGGESTION' | 'RECURRING_ALERT' | 'BEHAVIOUR_TREND';
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  signalsUsed: string[];
  explanation: string;
  suggestedAction?: string;
  createdAt: string;
}

export interface SpendingForecast {
  userId: string;
  generatedAt: string;
  forecast7Days: {
    date: string;
    expectedSpending: number;
    lowerBound: number;
    upperBound: number;
  }[];
  forecast30DaysTotal: number;
  forecast30DaysRange: {
    min: number;
    max: number;
  };
  historicalMonthlyAverage: number;
  modelMetrics: {
    algorithm: string;
    meanAbsoluteError: number;
    rmse: number;
    rSquared: number;
    sampleSize: number;
  };
}

export interface BlockchainBlock {
  blockNumber: number;
  channelId: string;
  previousHash: string;
  merkleRoot: string;
  timestamp: string;
  transactionCount: number;
  endorsements: string[];
  records: BlockchainRecord[];
}

export interface BlockchainRecord {
  id: string;
  blockNumber: number;
  channelId: string;
  eventType: 'TRANSACTION_RECORDED' | 'USER_IDENTITY_REGISTERED' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED' | 'BUDGET_COMMITTED' | 'SECURITY_EVENT';
  recordId: string; // ID of off-chain record
  sha256Hash: string; // Hash of private canonical payload
  mspId: string; // Hyperledger Org MSP ID
  timestamp: string;
  verificationStatus: 'VERIFIED' | 'REVOKED' | 'PENDING';
  txId: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  eventType: string;
  description: string;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  blockchainTxId?: string;
}

export type NotificationType =
  | 'BUDGET_WARNING'
  | 'BUDGET_EXCEEDED'
  | 'BILL_REMINDER'
  | 'ANOMALY_ALERT'
  | 'SUBSCRIPTION_RENEWAL'
  | 'UNUSUAL_SPENDING'
  | 'GOAL_PROGRESS'
  | 'RECURRING_PAYMENT'
  | 'SECURITY_ALERT'
  | 'BLOCKCHAIN_VERIFICATION'
  | 'SYSTEM_NOTIFICATION';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
}

export interface ReceiptItem {
  name: string;
  qty?: number;
  price: number;
}

export interface ReceiptScanResult {
  merchant: string;
  date: string;
  totalAmount: number;
  taxAmount?: number;
  category: TransactionCategory;
  subcategory?: string;
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
  confidence: number;
  notes?: string;
  rawText?: string;
}

export interface VoiceParseResult {
  amount: number;
  category: TransactionCategory;
  subcategory?: string;
  merchant: string;
  type: TransactionType;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string;
  confidence: number;
  transcript: string;
  reasons?: string[];
}

export interface CategoryPredictionResult {
  cleanDescription: string;
  extractedMerchant: string;
  predictedCategory: TransactionCategory;
  subcategory: string;
  confidence: number;
  isUncertain: boolean;
  reasons: string[];
  explanation: string;
}

export interface MultiHorizonSpendingForecast {
  userId: string;
  generatedAt: string;
  horizon: '7D' | '30D' | '90D';
  expectedSpending: number;
  expectedIncome: number;
  projectedBalance: number;
  projectedSavings: number;
  budgetRisk: {
    isAtRisk: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    projectedOverspend: number;
    message: string;
  };
  dailyPoints: {
    date: string;
    expectedSpending: number;
    lowerBound: number;
    upperBound: number;
  }[];
  forecast7Days: {
    date: string;
    expectedSpending: number;
    lowerBound: number;
    upperBound: number;
  }[];
  forecast30DaysTotal: number;
  forecast30DaysRange: {
    min: number;
    max: number;
  };
  forecast90DaysTotal: number;
  historicalMonthlyAverage: number;
  insufficientData: boolean;
  insufficientDataReason?: string;
  modelMetrics: {
    algorithm: string;
    meanAbsoluteError: number;
    rmse: number;
    rSquared: number;
    sampleSize: number;
  };
}

export interface BudgetRecommendation {
  category: TransactionCategory;
  currentBudget: number;
  historicalAverage: number;
  recommendedBudget: number;
  reason: string;
  difference: number;
  percentChange: number;
  riskStatus: 'OVER_LIMIT' | 'UNDER_UTILIZED' | 'STABLE';
}

export interface GoalRecommendation {
  goalId: string;
  title: string;
  currentAmount: number;
  targetAmount: number;
  remaining: number;
  currentMonthlyContribution: number;
  requiredMonthlyContribution: number;
  projectedCompletionDate: string;
  targetDate: string;
  isAtRisk: boolean;
  riskReason?: string;
  actionableAdvice: string;
}

export interface RecurringDetectionFlag {
  id: string;
  type: 'PRICE_INCREASE' | 'UNUSUAL_CHARGE' | 'DUPLICATE_SUBSCRIPTION' | 'INACTIVE_SUBSCRIPTION';
  merchant: string;
  message: string;
  details: string;
  severity: 'ALERT' | 'WARNING' | 'INFO';
}

export interface RecurringTelemetry {
  subscriptions: RecurringPayment[];
  flags: RecurringDetectionFlag[];
  totalMonthlyBurn: number;
  totalAnnualBurn: number;
}

export interface WhatIfSimulationResult {
  scenarioName: string;
  currentBalance: number;
  purchaseAmount: number;
  newBalance: number;
  monthlySavingsBefore: number;
  monthlySavingsAfter: number;
  budgetImpact: {
    category: string;
    currentSpent: number;
    limit: number;
    afterAmount: number;
    exceeds: boolean;
  }[];
  goalImpact: {
    goalTitle: string;
    originalDate: string;
    delayedDate: string;
    delayMonths: number;
    impactSummary: string;
  }[];
  healthScoreBefore: number;
  healthScoreAfter: number;
  feasibility: 'HIGH_SAFETY' | 'MODERATE_TIGHT' | 'HIGH_RISK';
  verdict: string;
}

export interface AiTestCaseItem {
  id: string;
  name: string;
  category: string;
  inputDescription: string;
  expectedBehavior: string;
  status: 'PASSED' | 'FAILED' | 'PENDING';
  executionTimeMs: number;
  actualOutput: any;
  groundedSignal: string;
}

export interface CashFlowEvent {
  date: string;
  label: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'BILL' | 'SUBSCRIPTION';
  category: string;
  status: 'ACTUAL' | 'ESTIMATED' | 'FORECAST';
  runningBalance: number;
}

export interface CashFlowTimeline {
  startingBalance: number;
  projectedEndingBalance: number;
  totalExpectedInflow: number;
  totalExpectedOutflow: number;
  events: CashFlowEvent[];
}

export interface ModelEvaluationMetrics {
  categorization: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    totalEvaluated: number;
    userCorrectionsLogged: number;
  };
  anomalyDetection: {
    detectionRate: number;
    falsePositiveRate: number;
    zScoreThreshold: number;
    madThreshold: number;
    anomaliesFlagged: number;
  };
  forecasting: {
    algorithm: string;
    meanAbsoluteError: number;
    rmse: number;
    rSquared: number;
    evaluationWindow: string;
  };
}

export interface DebtSummary {
  totalDebt: number;
  totalMonthlyEmi: number;
  averageInterestRate: number;
  activeLoanCount: number;
  totalOutstandingDebt?: number;
  totalMonthlyObligation?: number;
  totalEstimatedInterest?: number;
  debtToIncomeRatio?: number;
  loans: Loan[];
}

export interface Category {
  id: string;
  name: TransactionCategory;
  type: TransactionType;
  icon?: string;
  color?: string;
  isSystem?: boolean;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  category: TransactionCategory;
  allocatedAmount: number;
  spentAmount?: number;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  userId: string;
  amount: number;
  date: string;
  notes?: string;
  transactionId?: string;
}

export interface SecurityLog {
  id: string;
  userId: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  details?: any;
  timestamp: string;
}

export interface AICategorizationDecision {
  id: string;
  transactionId: string;
  predictedCategory: TransactionCategory;
  actualCategory?: TransactionCategory;
  confidence: number;
  wasCorrect?: boolean;
  timestamp: string;
}

export interface AIAnomalyResult {
  id: string;
  transactionId: string;
  isAnomaly: boolean;
  score: number;
  reason?: string;
  timestamp: string;
}

export interface UserPreferences {
  userId: string;
  theme?: 'light' | 'dark' | 'system';
  currency?: 'INR' | 'USD' | 'EUR' | 'GBP';
  notificationsEnabled?: boolean;
  emailAlerts?: boolean;
  twoFactorEnabled?: boolean;
}

export interface UserSession {
  id: string;
  token: string;
  userId: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt?: number;
  isCurrent: boolean;
}

export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
export type KycDocumentType = 'PASSPORT' | 'DRIVING_LICENSE' | 'NATIONAL_ID' | 'VOTER_ID' | 'PAN' | 'AADHAAR';

export interface KycRecord {
  id: string;
  userId: string;
  fullName: string;
  dateOfBirth: string;
  address: string;
  country: string;
  documentType: KycDocumentType;
  documentNumber: string;
  maskedDocumentNumber: string;
  status: KycStatus;
  documentImageUri?: string;
  ocrExtractedData?: {
    name?: string;
    dob?: string;
    docNumber?: string;
    confidence?: number;
  };
  reviewerNotes?: string;
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

