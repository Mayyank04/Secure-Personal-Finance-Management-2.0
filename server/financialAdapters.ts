/**
 * Financial Source Adapters & Synthetic Sandbox Connector
 * 
 * Provides:
 * - FinancialSourceAdapter extensible base architecture
 * - DemoBankAdapter (HDFC, Chase, SBI synthetic sandbox feeds)
 * - DemoUPIAdapter (Google Pay, PhonePe, Paytm synthetic sandbox feeds)
 * - FutureRealProviderAdapter (Plaid / Setu / Account Aggregator specification)
 * - Duplicate detection engine
 * - AI categorizer integration
 * 
 * ALL DATA PRODUCED IS CLEARLY LABELED: SYNTHETIC / DEMO
 */

import crypto from 'crypto';
import { TransactionCategory, PaymentMethod, AccountType } from './types.js';
import { cleanTransactionDescription, predictTransactionCategory } from './ai_ml.js';

export interface SandboxProviderConfig {
  id: string;
  name: string;
  category: 'BANK' | 'UPI' | 'AGGREGATOR';
  logoUrl?: string;
  institution: string;
  description: string;
  supportedAccountTypes: AccountType[];
  isSynthetic: boolean;
  status: 'ONLINE' | 'SANDBOX_READY' | 'BETA_STAGING';
}

export interface SyntheticRawTransaction {
  externalId: string;
  date: string;
  rawDescription: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  suggestedCategory?: TransactionCategory;
  paymentMethod: PaymentMethod;
  merchant: string;
  referenceNo: string;
  isSyntheticDemo: true;
}

export interface SyncPreviewItem {
  id: string;
  externalId: string;
  date: string;
  rawDescription: string;
  cleanDescription: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  predictedCategory: TransactionCategory;
  aiConfidence: number;
  paymentMethod: PaymentMethod;
  merchant: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  status: 'READY' | 'DUPLICATE' | 'NEEDS_REVIEW';
  isSyntheticDemo: true;
}

export interface SyncSessionResult {
  connectionId: string;
  providerId: string;
  providerName: string;
  institution: string;
  accountType: AccountType;
  maskedIdentifier: string;
  syncedAt: string;
  totalFetched: number;
  newTransactionsCount: number;
  duplicatesCount: number;
  needsReviewCount: number;
  transactions: SyncPreviewItem[];
  isSyntheticDemo: true;
}

/**
 * Base Abstract Financial Source Adapter
 */
export abstract class FinancialSourceAdapter {
  public abstract readonly providerId: string;
  public abstract readonly institutionName: string;
  public abstract readonly adapterType: 'BANK' | 'UPI' | 'AGGREGATOR';

  /**
   * Generates or fetches synthetic transactions
   */
  public abstract fetchTransactions(
    startDate: string,
    endDate: string,
    existingTxs: { date: string; amount: number; merchant: string; description: string }[]
  ): Promise<SyncSessionResult>;
}

/**
 * Demo Bank Adapter (HDFC / Chase / SBI Synthetic Feed)
 */
export class DemoBankAdapter extends FinancialSourceAdapter {
  public readonly providerId: string;
  public readonly institutionName: string;
  public readonly adapterType: 'BANK' = 'BANK';
  public readonly maskedIdentifier: string;

  constructor(providerId = 'demo-bank-hdfc', institutionName = 'HDFC Bank (Sandbox)', maskedIdentifier = '•••• 9402') {
    super();
    this.providerId = providerId;
    this.institutionName = institutionName;
    this.maskedIdentifier = maskedIdentifier;
  }

  public async fetchTransactions(
    startDate: string,
    endDate: string,
    existingTxs: { date: string; amount: number; merchant: string; description: string }[]
  ): Promise<SyncSessionResult> {
    const connectionId = `conn-bank-${crypto.randomBytes(4).toString('hex')}`;
    const todayStr = new Date().toISOString().split('T')[0];

    // Realistic Synthetic banking statements feed
    const rawBankFeed: SyntheticRawTransaction[] = [
      {
        externalId: `BNK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-28',
        rawDescription: 'POS DEBIT W-MART HYPERMARKET BANGALORE 560103',
        amount: 3240,
        type: 'EXPENSE',
        paymentMethod: 'Debit Card',
        merchant: 'Walmart Hypermarket',
        referenceNo: 'REF-HDFC-991823',
        isSyntheticDemo: true,
      },
      {
        externalId: `BNK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-27',
        rawDescription: 'ACH CREDIT CORPORATE SALARY ADVISORY APEX TECH',
        amount: 95000,
        type: 'INCOME',
        paymentMethod: 'Bank Transfer',
        merchant: 'Apex Technologies',
        referenceNo: 'REF-HDFC-102938',
        isSyntheticDemo: true,
      },
      {
        externalId: `BNK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-26',
        rawDescription: 'ATM WDL CASH DISPENSE HDFC ATM INDIRANAGAR',
        amount: 5000,
        type: 'EXPENSE',
        paymentMethod: 'Cash',
        merchant: 'HDFC Cash ATM',
        referenceNo: 'REF-HDFC-882711',
        isSyntheticDemo: true,
      },
      {
        externalId: `BNK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-25',
        rawDescription: 'NEFT OUTWARD SKYLINE HEIGHTS LEASE PAYMENT',
        amount: 24000,
        type: 'EXPENSE',
        paymentMethod: 'Net Banking',
        merchant: 'Skyline Heights',
        referenceNo: 'REF-HDFC-771625',
        isSyntheticDemo: true,
      },
      {
        externalId: `BNK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-24',
        rawDescription: 'BILLPAY AUTO-DEBIT TATA POWER ELECTRICITY',
        amount: 2850,
        type: 'EXPENSE',
        paymentMethod: 'Bank Transfer',
        merchant: 'Tata Power',
        referenceNo: 'REF-HDFC-554109',
        isSyntheticDemo: true,
      },
      {
        externalId: `BNK-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-22',
        rawDescription: 'POS RETAIL CROMA ELECTRONICS WORKSTATION',
        amount: 42500,
        type: 'EXPENSE',
        paymentMethod: 'Debit Card',
        merchant: 'Croma Electronics',
        referenceNo: 'REF-HDFC-332901',
        isSyntheticDemo: true,
      },
    ];

    const previewItems: SyncPreviewItem[] = [];
    let duplicates = 0;
    let needsReview = 0;

    for (const raw of rawBankFeed) {
      const { cleaned: cleanDesc, extractedMerchant: extMerchant } = cleanTransactionDescription(raw.rawDescription);
      const prediction = predictTransactionCategory(cleanDesc, raw.amount, raw.type as 'INCOME' | 'EXPENSE');

      // Duplicate check
      const isDuplicate = existingTxs.some(
        tx =>
          tx.date === raw.date &&
          Math.abs(tx.amount - raw.amount) < 0.01 &&
          (tx.merchant.toLowerCase().includes(raw.merchant.toLowerCase()) ||
            raw.merchant.toLowerCase().includes(tx.merchant.toLowerCase()))
      );

      let status: 'READY' | 'DUPLICATE' | 'NEEDS_REVIEW' = 'READY';
      let duplicateReason: string | undefined;

      if (isDuplicate) {
        status = 'DUPLICATE';
        duplicateReason = `Matches existing ledger record on ${raw.date} for ₹${raw.amount.toLocaleString('en-IN')}`;
        duplicates++;
      } else if (prediction.confidence < 70) {
        status = 'NEEDS_REVIEW';
        needsReview++;
      }

      previewItems.push({
        id: `prev-${crypto.randomBytes(6).toString('hex')}`,
        externalId: raw.externalId,
        date: raw.date,
        rawDescription: raw.rawDescription,
        cleanDescription: cleanDesc,
        amount: raw.amount,
        type: raw.type,
        predictedCategory: prediction.predictedCategory,
        aiConfidence: prediction.confidence,
        paymentMethod: raw.paymentMethod,
        merchant: prediction.extractedMerchant || raw.merchant,
        isDuplicate,
        duplicateReason,
        status,
        isSyntheticDemo: true,
      });
    }

    return {
      connectionId,
      providerId: this.providerId,
      providerName: 'HDFC Corporate / Salary Sandbox',
      institution: this.institutionName,
      accountType: 'BANK',
      maskedIdentifier: this.maskedIdentifier,
      syncedAt: new Date().toISOString(),
      totalFetched: rawBankFeed.length,
      newTransactionsCount: rawBankFeed.length - duplicates,
      duplicatesCount: duplicates,
      needsReviewCount: needsReview,
      transactions: previewItems,
      isSyntheticDemo: true,
    };
  }
}

/**
 * Demo UPI Adapter (Google Pay / PhonePe Synthetic Sandbox Feed)
 */
export class DemoUPIAdapter extends FinancialSourceAdapter {
  public readonly providerId: string;
  public readonly institutionName: string;
  public readonly adapterType: 'UPI' = 'UPI';
  public readonly maskedIdentifier: string;

  constructor(providerId = 'demo-upi-gpay', institutionName = 'Google Pay / NPCI UPI (Sandbox)', maskedIdentifier = 'alex.fintech@okaxis') {
    super();
    this.providerId = providerId;
    this.institutionName = institutionName;
    this.maskedIdentifier = maskedIdentifier;
  }

  public async fetchTransactions(
    startDate: string,
    endDate: string,
    existingTxs: { date: string; amount: number; merchant: string; description: string }[]
  ): Promise<SyncSessionResult> {
    const connectionId = `conn-upi-${crypto.randomBytes(4).toString('hex')}`;

    const rawUpiFeed: SyntheticRawTransaction[] = [
      {
        externalId: `UPI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-28',
        rawDescription: 'UPI/20260828/SWIGGY_BANGALORE/PAYMENT_ORDER_8921',
        amount: 680,
        type: 'EXPENSE',
        paymentMethod: 'UPI / Instant Transfer',
        merchant: 'Swiggy',
        referenceNo: 'UPI-NPCI-88192039',
        isSyntheticDemo: true,
      },
      {
        externalId: `UPI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-27',
        rawDescription: 'UPI/20260827/ZEPTO_QUICK_GROCERY/ESSENTIALS_CART',
        amount: 890,
        type: 'EXPENSE',
        paymentMethod: 'UPI / Instant Transfer',
        merchant: 'Zepto',
        referenceNo: 'UPI-NPCI-77192841',
        isSyntheticDemo: true,
      },
      {
        externalId: `UPI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-27',
        rawDescription: 'UPI/20260827/BLUE_TOKAI_COFFEE_ROASTERS/ORDER_99',
        amount: 420,
        type: 'EXPENSE',
        paymentMethod: 'UPI / Instant Transfer',
        merchant: 'Blue Tokai Coffee',
        referenceNo: 'UPI-NPCI-66182930',
        isSyntheticDemo: true,
      },
      {
        externalId: `UPI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-26',
        rawDescription: 'UPI/20260826/UBER_INDIA_RIDE_TRANSPORT/FARE_7718',
        amount: 340,
        type: 'EXPENSE',
        paymentMethod: 'UPI / Instant Transfer',
        merchant: 'Uber',
        referenceNo: 'UPI-NPCI-55172819',
        isSyntheticDemo: true,
      },
      {
        externalId: `UPI-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        date: '2026-08-25',
        rawDescription: 'UPI/20260825/P2P_TRANSFER_FROM_RAHUL/REIMBURSEMENT',
        amount: 1500,
        type: 'INCOME',
        paymentMethod: 'UPI / Instant Transfer',
        merchant: 'Rahul Sharma (UPI P2P)',
        referenceNo: 'UPI-NPCI-44162718',
        isSyntheticDemo: true,
      },
    ];

    const previewItems: SyncPreviewItem[] = [];
    let duplicates = 0;
    let needsReview = 0;

    for (const raw of rawUpiFeed) {
      const { cleaned: cleanDesc, extractedMerchant: extMerchant } = cleanTransactionDescription(raw.rawDescription);
      const prediction = predictTransactionCategory(cleanDesc, raw.amount, raw.type as 'INCOME' | 'EXPENSE');

      const isDuplicate = existingTxs.some(
        tx =>
          tx.date === raw.date &&
          Math.abs(tx.amount - raw.amount) < 0.01 &&
          (tx.merchant.toLowerCase().includes(raw.merchant.toLowerCase()) ||
            raw.merchant.toLowerCase().includes(tx.merchant.toLowerCase()))
      );

      let status: 'READY' | 'DUPLICATE' | 'NEEDS_REVIEW' = 'READY';
      let duplicateReason: string | undefined;

      if (isDuplicate) {
        status = 'DUPLICATE';
        duplicateReason = `Matches existing ledger record on ${raw.date} for ₹${raw.amount.toLocaleString('en-IN')}`;
        duplicates++;
      } else if (prediction.confidence < 70) {
        status = 'NEEDS_REVIEW';
        needsReview++;
      }

      previewItems.push({
        id: `prev-${crypto.randomBytes(6).toString('hex')}`,
        externalId: raw.externalId,
        date: raw.date,
        rawDescription: raw.rawDescription,
        cleanDescription: cleanDesc,
        amount: raw.amount,
        type: raw.type,
        predictedCategory: prediction.predictedCategory,
        aiConfidence: prediction.confidence,
        paymentMethod: raw.paymentMethod,
        merchant: prediction.extractedMerchant || raw.merchant,
        isDuplicate,
        duplicateReason,
        status,
        isSyntheticDemo: true,
      });
    }

    return {
      connectionId,
      providerId: this.providerId,
      providerName: 'Google Pay UPI Sandbox',
      institution: this.institutionName,
      accountType: 'UPI',
      maskedIdentifier: this.maskedIdentifier,
      syncedAt: new Date().toISOString(),
      totalFetched: rawUpiFeed.length,
      newTransactionsCount: rawUpiFeed.length - duplicates,
      duplicatesCount: duplicates,
      needsReviewCount: needsReview,
      transactions: previewItems,
      isSyntheticDemo: true,
    };
  }
}

/**
 * Future Real Provider Adapter Architecture Placeholder
 * (Ready for Plaid, Setu, Salt Edge, Open Banking APIs)
 */
export class FutureRealProviderAdapter extends FinancialSourceAdapter {
  public readonly providerId: string;
  public readonly institutionName: string;
  public readonly adapterType: 'AGGREGATOR' = 'AGGREGATOR';

  constructor(providerId = 'future-plaid-live', institutionName = 'Open Banking / Account Aggregator') {
    super();
    this.providerId = providerId;
    this.institutionName = institutionName;
  }

  public async fetchTransactions(
    startDate: string,
    endDate: string,
    existingTxs: any[]
  ): Promise<SyncSessionResult> {
    throw new Error(
      'FutureRealProviderAdapter is a production specification connector. For security and test environments, use DemoBankAdapter or DemoUPIAdapter.'
    );
  }
}

/**
 * Available Sandbox Providers Registry
 */
export const AVAILABLE_SANDBOX_PROVIDERS: SandboxProviderConfig[] = [
  {
    id: 'demo-bank-hdfc',
    name: 'HDFC Bank Corporate & Savings',
    category: 'BANK',
    institution: 'HDFC Bank Ltd.',
    description: 'Simulates direct net-banking statement feeds with salaries, rents, and debit POS transactions.',
    supportedAccountTypes: ['BANK', 'DEBIT_CARD'],
    isSynthetic: true,
    status: 'SANDBOX_READY',
  },
  {
    id: 'demo-bank-icici',
    name: 'ICICI Bank Wealth Management',
    category: 'BANK',
    institution: 'ICICI Bank Ltd.',
    description: 'Simulates multi-currency checking and savings accounts with investments.',
    supportedAccountTypes: ['BANK', 'INVESTMENT'],
    isSynthetic: true,
    status: 'SANDBOX_READY',
  },
  {
    id: 'demo-card-hdfc-regalia',
    name: 'Regalia Gold Credit Card',
    category: 'BANK',
    institution: 'HDFC Credit Services',
    description: 'Simulates credit card transactions with dining, international travel, and milestone points.',
    supportedAccountTypes: ['CREDIT_CARD'],
    isSynthetic: true,
    status: 'SANDBOX_READY',
  },
  {
    id: 'demo-upi-gpay',
    name: 'Google Pay UPI Gateway',
    category: 'UPI',
    institution: 'NPCI UPI Network',
    description: 'Simulates micro-payments, QR code merchant purchases, and P2P instant transfers.',
    supportedAccountTypes: ['UPI'],
    isSynthetic: true,
    status: 'SANDBOX_READY',
  },
  {
    id: 'demo-upi-phonepe',
    name: 'PhonePe Merchant & Fastag',
    category: 'UPI',
    institution: 'PhonePe / Yes Bank UPI',
    description: 'Simulates utility billers, quick commerce, and Fastag tolls.',
    supportedAccountTypes: ['UPI'],
    isSynthetic: true,
    status: 'SANDBOX_READY',
  },
  {
    id: 'future-open-banking-spec',
    name: 'Open Banking / Plaid Connector (Specification)',
    category: 'AGGREGATOR',
    institution: 'Production API Specification',
    description: 'Production plug-in interface ready for live OAuth Account Aggregator integration.',
    supportedAccountTypes: ['BANK', 'CREDIT_CARD', 'INVESTMENT'],
    isSynthetic: false,
    status: 'BETA_STAGING',
  },
];
