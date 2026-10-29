
import crypto from 'crypto';
import {
  User,
  UserProfile,
  Transaction,
  Budget,
  SavingsGoal,
  RecurringPayment,
  AIInsight,
  NotificationItem,
  AuditEvent,
  UserSession,
  FinancialAccount,
  Bill,
  Subscription,
  Loan,
  ReceiptRecord,
  DebtSummary,
  KycRecord,
} from './types.js';
import { blockchainAdapter } from './blockchain.js';
import { hashPassword, generateBase32Secret, generateRecoveryCodes } from './security.js';
import { detectAnomalies, generateSpendingForecast, calculateFinancialHealthScore } from './ai_ml.js';
import { getDatabaseAdapter } from './db/index.js';

export interface DatabaseState {
  users: Map<string, User>;
  profiles: Map<string, UserProfile>;
  accounts: Map<string, FinancialAccount>;
  transactions: Map<string, Transaction>;
  budgets: Map<string, Budget>;
  goals: Map<string, SavingsGoal>;
  recurring: Map<string, RecurringPayment>;
  bills: Map<string, Bill>;
  subscriptions: Map<string, Subscription>;
  loans: Map<string, Loan>;
  receipts: Map<string, ReceiptRecord>;
  insights: Map<string, AIInsight>;
  notifications: Map<string, NotificationItem>;
  auditEvents: Map<string, AuditEvent>;
  sessions: Map<string, UserSession>;
  kycRecords: Map<string, KycRecord>;
}

class Database {
  public users: Map<string, User> = new Map();
  public profiles: Map<string, UserProfile> = new Map();
  public accounts: Map<string, FinancialAccount> = new Map();
  public transactions: Map<string, Transaction> = new Map();
  public budgets: Map<string, Budget> = new Map();
  public goals: Map<string, SavingsGoal> = new Map();
  public recurring: Map<string, RecurringPayment> = new Map();
  public bills: Map<string, Bill> = new Map();
  public subscriptions: Map<string, Subscription> = new Map();
  public loans: Map<string, Loan> = new Map();
  public receipts: Map<string, ReceiptRecord> = new Map();
  public insights: Map<string, AIInsight> = new Map();
  public notifications: Map<string, NotificationItem> = new Map();
  public auditEvents: Map<string, AuditEvent> = new Map();
  public sessions: Map<string, UserSession> = new Map();
  public kycRecords: Map<string, KycRecord> = new Map();

  constructor() {
    const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
    const demoMode = process.env.DEMO_MODE === 'true';
    if (!isProd || demoMode) {
      this.seedDemoAccount();
    }
  }

  public hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 32, 'sha256').toString('hex');
  }

  public clearAll() {
    this.users.clear();
    this.profiles.clear();
    this.accounts.clear();
    this.transactions.clear();
    this.budgets.clear();
    this.goals.clear();
    this.recurring.clear();
    this.bills.clear();
    this.subscriptions.clear();
    this.loans.clear();
    this.receipts.clear();
    this.insights.clear();
    this.notifications.clear();
    this.auditEvents.clear();
    this.sessions.clear();
    this.kycRecords.clear();
  }

  public seedDemoAccount() {
    this.clearAll();

    const demoUserId = 'usr-demo-fintech-01';
    const { hash: passwordHash, salt } = hashPassword('DemoPassword@2026');
    const { hashedCodes: demoRecoveryCodes } = generateRecoveryCodes(8);
    const demoMfaSecret = generateBase32Secret(16);

    const demoUser: User = {
      id: demoUserId,
      email: 'alex.morgan@fintech-demo.com',
      name: 'Alex Morgan',
      passwordHash,
      salt,
      role: 'USER',
      mfaEnabled: true,
      mfaSecret: demoMfaSecret,
      mfaRecoveryCodes: demoRecoveryCodes,
      createdAt: '2026-06-01T08:00:00Z',
      updatedAt: '2026-08-28T09:30:00Z',
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: '192.168.1.42 (Encrypted TLS Session)',
    };

    const demoProfile: UserProfile = {
      userId: demoUserId,
      preferredCurrency: 'INR',
      monthlyIncomeRange: '₹80,000 - ₹120,000',
      majorCategories: ['Food', 'Groceries', 'Transport', 'Rent', 'Subscriptions', 'Utilities', 'Entertainment'],
      budgetThresholds: {
        normalWarning: 70,
        highWarning: 90,
        critical: 100,
      },
      privacySettings: {
        aiPersonalizationConsent: true,
        dataSharingConsent: false,
        analyticsPermission: true,
        blockchainAuditConsent: true,
      },
      onboardingCompleted: true,
    };

    const demoKyc: KycRecord = {
      id: 'kyc-demo-01',
      userId: demoUserId,
      fullName: 'Alex Morgan',
      dateOfBirth: '1992-08-14',
      address: '42 FinTech Boulevard, Bangalore, KA 560001',
      country: 'India',
      documentType: 'PASSPORT',
      documentNumber: 'Z8920194',
      maskedDocumentNumber: '•••• •••• 0194',
      status: 'VERIFIED',
      reviewerNotes: 'Identity verified against simulated biometric registry on onboarding.',
      submittedAt: '2026-06-01T08:05:00Z',
      verifiedAt: '2026-06-01T08:10:00Z',
      createdAt: '2026-06-01T08:05:00Z',
      updatedAt: '2026-06-01T08:10:00Z',
    };

    this.users.set(demoUserId, demoUser);
    this.profiles.set(demoUserId, demoProfile);
    this.kycRecords.set(demoUserId, demoKyc);

    blockchainAdapter.registerUserIdentity(demoUserId);

    const acc1: FinancialAccount = {
      id: 'acc-hdfc-salary',
      userId: demoUserId,
      name: 'HDFC Corporate Salary Account',
      institution: 'HDFC Bank Ltd.',
      accountType: 'BANK',
      maskedIdentifier: '•••• 9402',
      currency: 'INR',
      openingBalance: 120000,
      currentBalance: 145200,
      availableBalance: 145200,
      status: 'ACTIVE',
      isDemo: true,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    const acc2: FinancialAccount = {
      id: 'acc-icici-savings',
      userId: demoUserId,
      name: 'ICICI Emergency Reserve',
      institution: 'ICICI Bank Ltd.',
      accountType: 'BANK',
      maskedIdentifier: '•••• 5118',
      currency: 'INR',
      openingBalance: 60000,
      currentBalance: 85400,
      availableBalance: 85400,
      status: 'ACTIVE',
      isDemo: true,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    const acc3: FinancialAccount = {
      id: 'acc-hdfc-regalia',
      userId: demoUserId,
      name: 'HDFC Regalia Gold Credit Card',
      institution: 'HDFC Card Services',
      accountType: 'CREDIT_CARD',
      maskedIdentifier: '•••• 7382',
      currency: 'INR',
      openingBalance: 0,
      currentBalance: -24850,
      availableBalance: 175150,
      creditLimit: 200000,
      status: 'ACTIVE',
      isDemo: true,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    const acc4: FinancialAccount = {
      id: 'acc-gpay-upi',
      userId: demoUserId,
      name: 'Google Pay UPI Instant Transfer',
      institution: 'NPCI / Axis Bank VPA',
      accountType: 'UPI',
      maskedIdentifier: 'alex.morgan@okaxis',
      currency: 'INR',
      openingBalance: 10000,
      currentBalance: 12500,
      availableBalance: 12500,
      status: 'ACTIVE',
      isDemo: true,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    const acc5: FinancialAccount = {
      id: 'acc-zerodha-invest',
      userId: demoUserId,
      name: 'Zerodha Kite Index & Equity Portfolio',
      institution: 'Zerodha Broking Ltd.',
      accountType: 'INVESTMENT',
      maskedIdentifier: 'DMAT-••••-993',
      currency: 'INR',
      openingBalance: 250000,
      currentBalance: 350000,
      availableBalance: 350000,
      status: 'ACTIVE',
      isDemo: true,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    const acc6: FinancialAccount = {
      id: 'acc-cash-wallet',
      userId: demoUserId,
      name: 'Physical Cash & Petty Cash',
      institution: 'Self Custody',
      accountType: 'CASH',
      maskedIdentifier: 'Cash Wallet',
      currency: 'INR',
      openingBalance: 5000,
      currentBalance: 4200,
      availableBalance: 4200,
      status: 'ACTIVE',
      isDemo: true,
      createdAt: '2026-03-01T08:00:00Z',
      updatedAt: '2026-08-28T10:00:00Z',
    };

    this.accounts.set(acc1.id, acc1);
    this.accounts.set(acc2.id, acc2);
    this.accounts.set(acc3.id, acc3);
    this.accounts.set(acc4.id, acc4);
    this.accounts.set(acc5.id, acc5);
    this.accounts.set(acc6.id, acc6);

    const bill1: Bill = {
      id: 'bill-bescom',
      userId: demoUserId,
      name: 'BESCOM Electricity Bill',
      merchant: 'State Electricity Board',
      amount: 2850,
      category: 'Utilities',
      dueDate: '2026-09-11',
      frequency: 'MONTHLY',
      accountId: acc1.id,
      status: 'UPCOMING',
      notes: 'Monthly domestic power bill for apartment',
      autoPaid: false,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const bill2: Bill = {
      id: 'bill-airtel',
      userId: demoUserId,
      name: 'Airtel Xstream Fiber Gigabit',
      merchant: 'Airtel Broadband',
      amount: 1199,
      category: 'Bills',
      dueDate: '2026-09-12',
      frequency: 'MONTHLY',
      accountId: acc4.id,
      status: 'DUE_SOON',
      notes: 'Home work-from-home high speed connection',
      autoPaid: true,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const bill3: Bill = {
      id: 'bill-rent',
      userId: demoUserId,
      name: 'Skyline Heights Monthly Lease',
      merchant: 'Skyline Heights',
      amount: 24000,
      category: 'Rent',
      dueDate: '2026-09-02',
      frequency: 'MONTHLY',
      accountId: acc1.id,
      status: 'UPCOMING',
      notes: 'Apartment rent due on 2nd of month',
      autoPaid: true,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const bill4: Bill = {
      id: 'bill-health-ins',
      userId: demoUserId,
      name: 'Niva Bupa Family Health Shield',
      merchant: 'Niva Bupa Health Insurance',
      amount: 4500,
      category: 'Insurance',
      dueDate: '2026-09-28',
      frequency: 'QUARTERLY',
      accountId: acc2.id,
      status: 'UPCOMING',
      notes: '₹15 Lakh comprehensive health coverage quarterly premium',
      autoPaid: false,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const bill5: Bill = {
      id: 'bill-water-utility',
      userId: demoUserId,
      name: 'Municipal Water & Sewage Utility',
      merchant: 'Bangalore Water Board',
      amount: 680,
      category: 'Utilities',
      dueDate: '2026-09-15',
      frequency: 'MONTHLY',
      accountId: acc4.id,
      status: 'UPCOMING',
      notes: 'Monthly residential water connection charge',
      autoPaid: false,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const bill6: Bill = {
      id: 'bill-piped-gas',
      userId: demoUserId,
      name: 'GAIL Piped Cooking Gas',
      merchant: 'GAIL Gas Ltd.',
      amount: 920,
      category: 'Utilities',
      dueDate: '2026-08-27',
      frequency: 'MONTHLY',
      accountId: acc4.id,
      status: 'PAID',
      notes: 'Piped natural gas bi-monthly billing',
      autoPaid: true,
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-27T00:00:00Z',
    };

    this.bills.set(bill1.id, bill1);
    this.bills.set(bill2.id, bill2);
    this.bills.set(bill3.id, bill3);
    this.bills.set(bill4.id, bill4);
    this.bills.set(bill5.id, bill5);
    this.bills.set(bill6.id, bill6);

    const sub1: Subscription = {
      id: 'sub-netflix',
      userId: demoUserId,
      merchant: 'Netflix',
      name: 'Netflix 4K UHD Premium',
      category: 'Subscriptions',
      amount: 649,
      frequency: 'MONTHLY',
      nextBillingDate: '2026-09-08',
      monthlyCost: 649,
      annualCost: 7788,
      accountId: acc3.id,
      status: 'ACTIVE',
      previousAmount: 649,
      priceChangeDetected: false,
      notes: '4-Screen streaming family account',
      createdAt: '2026-03-08T00:00:00Z',
      updatedAt: '2026-08-08T00:00:00Z',
    };

    const sub2: Subscription = {
      id: 'sub-spotify',
      userId: demoUserId,
      merchant: 'Spotify',
      name: 'Spotify Family Audio Plan',
      category: 'Subscriptions',
      amount: 179,
      frequency: 'MONTHLY',
      nextBillingDate: '2026-09-09',
      monthlyCost: 179,
      annualCost: 2148,
      accountId: acc3.id,
      status: 'ACTIVE',
      previousAmount: 179,
      priceChangeDetected: false,
      notes: '6-member lossless music subscription',
      createdAt: '2026-03-09T00:00:00Z',
      updatedAt: '2026-08-09T00:00:00Z',
    };

    const sub3: Subscription = {
      id: 'sub-cult',
      userId: demoUserId,
      merchant: 'Cult.Fit',
      name: 'Cult Elite Gym & Fitness Pass',
      category: 'Subscriptions',
      amount: 2200,
      frequency: 'MONTHLY',
      nextBillingDate: '2026-09-16',
      monthlyCost: 2200,
      annualCost: 26400,
      accountId: acc3.id,
      status: 'ACTIVE',
      previousAmount: 2200,
      priceChangeDetected: false,
      notes: 'Unlimited gym & yoga group classes',
      createdAt: '2026-03-16T00:00:00Z',
      updatedAt: '2026-08-16T00:00:00Z',
    };

    const sub4: Subscription = {
      id: 'sub-aws',
      userId: demoUserId,
      merchant: 'Amazon Web Services',
      name: 'AWS Cloud Developer Tier',
      category: 'Utilities',
      amount: 1850,
      frequency: 'MONTHLY',
      nextBillingDate: '2026-09-01',
      monthlyCost: 1850,
      annualCost: 22200,
      accountId: acc1.id,
      status: 'ACTIVE',
      previousAmount: 1450,
      priceChangeDetected: true,
      notes: 'EC2 & S3 hosting infrastructure',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };

    const sub5: Subscription = {
      id: 'sub-github-copilot',
      userId: demoUserId,
      merchant: 'GitHub Inc.',
      name: 'GitHub Copilot Individual',
      category: 'Subscriptions',
      amount: 850,
      frequency: 'MONTHLY',
      nextBillingDate: '2026-09-12',
      monthlyCost: 850,
      annualCost: 10200,
      accountId: acc3.id,
      status: 'ACTIVE',
      previousAmount: 850,
      priceChangeDetected: false,
      notes: 'AI pair programming tool subscription',
      createdAt: '2026-03-12T00:00:00Z',
      updatedAt: '2026-08-12T00:00:00Z',
    };

    this.subscriptions.set(sub1.id, sub1);
    this.subscriptions.set(sub2.id, sub2);
    this.subscriptions.set(sub3.id, sub3);
    this.subscriptions.set(sub4.id, sub4);
    this.subscriptions.set(sub5.id, sub5);

    const rec1: RecurringPayment = {
      id: sub1.id,
      userId: demoUserId,
      merchant: sub1.merchant,
      description: sub1.name,
      amount: sub1.amount,
      frequency: 'MONTHLY',
      category: sub1.category,
      nextDueDate: sub1.nextBillingDate,
      status: 'ACTIVE',
      previousAmount: 649,
      priceChanged: false,
    };
    const rec2: RecurringPayment = {
      id: sub2.id,
      userId: demoUserId,
      merchant: sub2.merchant,
      description: sub2.name,
      amount: sub2.amount,
      frequency: 'MONTHLY',
      category: sub2.category,
      nextDueDate: sub2.nextBillingDate,
      status: 'ACTIVE',
      previousAmount: 179,
      priceChanged: false,
    };
    const rec3: RecurringPayment = {
      id: 'rec-rent',
      userId: demoUserId,
      merchant: 'Skyline Heights',
      description: 'Monthly Apartment Lease',
      amount: 24000,
      frequency: 'MONTHLY',
      category: 'Rent',
      nextDueDate: '2026-09-02',
      status: 'ACTIVE',
    };
    const rec4: RecurringPayment = {
      id: sub3.id,
      userId: demoUserId,
      merchant: sub3.merchant,
      description: sub3.name,
      amount: sub3.amount,
      frequency: 'MONTHLY',
      category: sub3.category,
      nextDueDate: sub3.nextBillingDate,
      status: 'ACTIVE',
    };
    this.recurring.set(rec1.id, rec1);
    this.recurring.set(rec2.id, rec2);
    this.recurring.set(rec3.id, rec3);
    this.recurring.set(rec4.id, rec4);

    const loan1: Loan = {
      id: 'loan-hdfc-home',
      userId: demoUserId,
      lender: 'HDFC Bank Home Finance',
      loanName: 'Bangalore Apartment Primary Mortgage',
      loanType: 'HOME_LOAN',
      principal: 3500000,
      outstandingBalance: 2840000,
      interestRate: 8.4,
      emi: 32500,
      dueDate: '5th of every month',
      startDate: '2023-04-10',
      maturityDate: '2038-04-10',
      status: 'ACTIVE',
      notes: 'Floating rate housing mortgage with automated auto-debit',
      createdAt: '2023-04-10T00:00:00Z',
      updatedAt: '2026-08-05T00:00:00Z',
    };

    const loan2: Loan = {
      id: 'loan-sbi-vehicle',
      userId: demoUserId,
      lender: 'State Bank of India',
      loanName: 'EV Vehicle Auto Loan',
      loanType: 'VEHICLE_LOAN',
      principal: 800000,
      outstandingBalance: 320000,
      interestRate: 7.85,
      emi: 16200,
      dueDate: '10th of every month',
      startDate: '2024-06-15',
      maturityDate: '2028-06-15',
      status: 'ACTIVE',
      notes: 'Fixed interest electric vehicle financing',
      createdAt: '2024-06-15T00:00:00Z',
      updatedAt: '2026-08-10T00:00:00Z',
    };

    this.loans.set(loan1.id, loan1);
    this.loans.set(loan2.id, loan2);

    const rcpt1: ReceiptRecord = {
      id: 'rcpt-croma-001',
      userId: demoUserId,
      merchant: 'Croma Electronics',
      date: '2026-08-22',
      amount: 42500,
      tax: 6483,
      items: [
        { name: 'LG 34" UltraWide Curved 4K Monitor', qty: 1, price: 39999 },
        { name: 'Belkin Thunderbolt 4 Dock Cable', qty: 1, price: 2501 },
      ],
      ocrText: 'CROMA ELECTRONICS BANGALORE\nTAX INVOICE #CR-2026-98124\nDATE: 2026-08-22\nLG 34-INCH ULTRAWIDE MONITOR: 39,999.00\nBELKIN THUNDERBOLT CABLE: 2,501.00\nSUBTOTAL: 36,017.00\nCGST 9%: 3,241.50\nSGST 9%: 3,241.50\nTOTAL AMOUNT PAID: ₹42,500.00\nPAYMENT: HDFC CREDIT CARD ENDING 7382',
      ocrConfidence: 96,
      category: 'Shopping',
      linkedTransactionId: 'tx-demo-0014',
      processingStatus: 'LINKED',
      notes: 'Verified electronics hardware workstation receipt with full itemization',
      createdAt: '2026-08-22T14:35:00Z',
      updatedAt: '2026-08-22T14:35:00Z',
    };

    const rcpt2: ReceiptRecord = {
      id: 'rcpt-bukhara-002',
      userId: demoUserId,
      merchant: 'ITC Maurya Bukhara',
      date: '2026-08-24',
      amount: 9800,
      tax: 1494,
      items: [
        { name: 'Signature Dal Bukhara', qty: 2, price: 3400 },
        { name: 'Sikandari Raan Charcoal Roast', qty: 1, price: 4200 },
        { name: 'Bukhara Naan & Beverages', qty: 1, price: 2200 },
      ],
      ocrText: 'ITC MAURYA - BUKHARA FINE DINING\nBILL NO: BUK-89210\nDATE: 24/08/2026 21:15\nDAL BUKHARA (2): 3400.00\nSIKANDARI RAAN (1): 4200.00\nNAAN & BEVERAGES: 2200.00\nTOTAL: 9800.00 INCL 18% GST\nCARD: REGALIA GOLD •••• 7382',
      ocrConfidence: 94,
      category: 'Food',
      linkedTransactionId: 'tx-demo-0015',
      processingStatus: 'LINKED',
      notes: 'Anniversary celebration dinner itemized bill',
      createdAt: '2026-08-24T22:00:00Z',
      updatedAt: '2026-08-24T22:00:00Z',
    };

    const rcpt3: ReceiptRecord = {
      id: 'rcpt-nature-003',
      userId: demoUserId,
      merchant: 'Nature Basket',
      date: '2026-08-03',
      amount: 3450,
      tax: 172,
      items: [
        { name: 'Organic Cold Pressed Oil 2L', qty: 1, price: 950 },
        { name: 'Hass Avocados (Pack of 4)', qty: 1, price: 680 },
        { name: 'Artisan Sourdough & Greek Yogurt', qty: 2, price: 820 },
        { name: 'Imported Berry Medley', qty: 1, price: 1000 },
      ],
      ocrText: 'NATURE BASKET ORGANIC SUPERMARKET\nCASHIER: COUNTER-3\nDATE: 2026-08-03 11:20\nORGANIC OIL: 950\nAVOCADOS 4PK: 680\nSOURDOUGH/YOGURT: 820\nBERRY MEDLEY: 1000\nTOTAL: 3,450.00 PAID VIA UPI',
      ocrConfidence: 91,
      category: 'Groceries',
      linkedTransactionId: 'tx-demo-0003',
      processingStatus: 'LINKED',
      notes: 'Weekly organic groceries invoice',
      createdAt: '2026-08-03T11:45:00Z',
      updatedAt: '2026-08-03T11:45:00Z',
    };

    const rcpt4: ReceiptRecord = {
      id: 'rcpt-shell-004',
      userId: demoUserId,
      merchant: 'Shell Gas Station',
      date: '2026-08-18',
      amount: 3100,
      tax: 472,
      items: [
        { name: 'Shell V-Power Premium Fuel 28.5L', qty: 28.5, price: 3100 },
      ],
      ocrText: 'SHELL INDIA FUEL STATION #09\nPUMP: 04 NOZZLE: 02\nPRODUCT: V-POWER PETROL\nVOLUME: 28.50 L\nRATE: 108.77 / L\nTOTAL AMOUNT: Rs. 3100.00\nCARD AUTH: 881920',
      ocrConfidence: 89,
      category: 'Transport',
      linkedTransactionId: 'tx-demo-0012',
      processingStatus: 'LINKED',
      notes: 'Vehicle highway fuel fill-up slip',
      createdAt: '2026-08-18T18:10:00Z',
      updatedAt: '2026-08-18T18:10:00Z',
    };

    const rcpt5: ReceiptRecord = {
      id: 'rcpt-apollo-005',
      userId: demoUserId,
      merchant: 'Apollo Pharmacy',
      date: '2026-08-20',
      amount: 890,
      tax: 76,
      items: [
        { name: 'Multivitamin Mineral Complex (60 Caps)', qty: 1, price: 540 },
        { name: 'Antiseptic Solution & First Aid', qty: 1, price: 350 },
      ],
      ocrText: 'APOLLO PHARMACY INDIRANAGAR\nTAX MEMO: AP-99214\nDATE: 20-08-2026\nVITAMIN COMPLEX 60C: 540.00\nFIRST AID SUPPLIES: 350.00\nTOTAL: ₹890.00\nPAID BY DEBIT CARD',
      ocrConfidence: 93,
      category: 'Healthcare',
      linkedTransactionId: 'tx-demo-0013',
      processingStatus: 'LINKED',
      notes: 'Pharmacy health essentials receipt',
      createdAt: '2026-08-20T19:30:00Z',
      updatedAt: '2026-08-20T19:30:00Z',
    };

    this.receipts.set(rcpt1.id, rcpt1);
    this.receipts.set(rcpt2.id, rcpt2);
    this.receipts.set(rcpt3.id, rcpt3);
    this.receipts.set(rcpt4.id, rcpt4);
    this.receipts.set(rcpt5.id, rcpt5);

    const rawSeedList = [
      { date: '2026-08-01', desc: 'Apex Technologies Monthly Salary', amount: 95000, type: 'INCOME', cat: 'Salary', method: 'Bank Transfer', merchant: 'Apex Technologies', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 99 },
      { date: '2026-08-02', desc: 'Skyline Heights Apartment Rent', amount: 24000, type: 'EXPENSE', cat: 'Rent', method: 'Net Banking', merchant: 'Skyline Heights', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', billId: 'bill-rent', source: 'MANUAL', conf: 98 },
      { date: '2026-08-03', desc: 'Nature Basket Organic Groceries', amount: 3450, type: 'EXPENSE', cat: 'Groceries', method: 'UPI / Instant Transfer', merchant: 'Nature Basket', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', rcptId: 'rcpt-nature-003', source: 'SANDBOX_UPI', conf: 94 },
      { date: '2026-08-05', desc: 'Uber Premier Office Commute', amount: 480, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Uber', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 96 },
      { date: '2026-08-06', desc: 'Starbucks Artisan Roast Coffee', amount: 620, type: 'EXPENSE', cat: 'Food', method: 'Credit Card', merchant: 'Starbucks', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 95 },
      { date: '2026-08-08', desc: 'Netflix 4K UHD Monthly Subscription', amount: 649, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Netflix', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, subId: 'sub-netflix', source: 'MANUAL', conf: 97 },
      { date: '2026-08-09', desc: 'Spotify Family Music Plan', amount: 179, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Spotify', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, subId: 'sub-spotify', source: 'MANUAL', conf: 96 },
      { date: '2026-08-11', desc: 'Electricity Board Online Bill', amount: 2850, type: 'EXPENSE', cat: 'Utilities', method: 'UPI / Instant Transfer', merchant: 'State Electricity Board', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', billId: 'bill-bescom', source: 'SANDBOX_UPI', conf: 94 },
      { date: '2026-08-13', desc: 'Blinkit 10-Min Groceries Delivery', amount: 1240, type: 'EXPENSE', cat: 'Groceries', method: 'UPI / Instant Transfer', merchant: 'Blinkit', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 93 },
      { date: '2026-08-15', desc: 'Freelance UI/UX Advisory Retainer', amount: 22000, type: 'INCOME', cat: 'Freelance', method: 'Bank Transfer', merchant: 'FinVanguard Inc', accId: 'acc-icici-savings', accName: 'ICICI Emergency Reserve', source: 'MANUAL', conf: 92 },
      { date: '2026-08-16', desc: 'Cult.Fit Gym Monthly Membership', amount: 2200, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Cult.Fit', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, subId: 'sub-cult', source: 'MANUAL', conf: 95 },
      { date: '2026-08-18', desc: 'Shell V-Power Premium Petrol', amount: 3100, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Shell Gas', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', rcptId: 'rcpt-shell-004', source: 'MANUAL', conf: 92 },
      { date: '2026-08-20', desc: 'Apollo Pharmacy Health & Vitamins', amount: 890, type: 'EXPENSE', cat: 'Healthcare', method: 'Debit Card', merchant: 'Apollo Pharmacy', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', rcptId: 'rcpt-apollo-005', source: 'MANUAL', conf: 91 },
      
      { date: '2026-08-22', desc: 'Croma Electronics - Ultra-Wide 4K Dual Setup', amount: 42500, type: 'EXPENSE', cat: 'Shopping', method: 'Credit Card', merchant: 'Croma Electronics', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', rcptId: 'rcpt-croma-001', source: 'RECEIPT_SCAN', conf: 94, notes: 'Workstation upgrade hardware purchase' },
      
      { date: '2026-08-24', desc: 'Bukhara Luxury Fine Dining Dinner', amount: 9800, type: 'EXPENSE', cat: 'Food', method: 'Credit Card', merchant: 'ITC Maurya Bukhara', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', rcptId: 'rcpt-bukhara-002', source: 'RECEIPT_SCAN', conf: 93, notes: 'Anniversary celebration dinner' },
      
      { date: '2026-08-26', desc: 'Amazon Prime Essentials & Books', amount: 1650, type: 'EXPENSE', cat: 'Shopping', method: 'Credit Card', merchant: 'Amazon', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 90 },
      { date: '2026-08-27', desc: 'Swiggy Gourmet Family Dinner', amount: 1420, type: 'EXPENSE', cat: 'Food', method: 'UPI / Instant Transfer', merchant: 'Swiggy', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
      { date: '2026-08-28', desc: 'Vanguard Index Fund SIP Contribution', amount: 15000, type: 'EXPENSE', cat: 'Investment', method: 'Bank Transfer', merchant: 'Vanguard Mutual Funds', accId: 'acc-zerodha-invest', accName: 'Zerodha Kite Index & Equity Portfolio', source: 'MANUAL', conf: 97 },

      { date: '2026-07-01', desc: 'Apex Technologies Monthly Salary', amount: 95000, type: 'INCOME', cat: 'Salary', method: 'Bank Transfer', merchant: 'Apex Technologies', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 99 },
      { date: '2026-07-02', desc: 'Skyline Heights Apartment Rent', amount: 24000, type: 'EXPENSE', cat: 'Rent', method: 'Net Banking', merchant: 'Skyline Heights', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 98 },
      { date: '2026-07-04', desc: 'Whole Foods Market Weekly Essentials', amount: 4100, type: 'EXPENSE', cat: 'Groceries', method: 'Credit Card', merchant: 'Whole Foods', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 95 },
      { date: '2026-07-08', desc: 'Netflix 4K UHD Monthly Subscription', amount: 649, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Netflix', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 97 },
      { date: '2026-07-09', desc: 'Spotify Family Music Plan', amount: 179, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Spotify', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 96 },
      { date: '2026-07-12', desc: 'Broadband Fiber High-Speed Internet', amount: 1199, type: 'EXPENSE', cat: 'Bills', method: 'UPI / Instant Transfer', merchant: 'Airtel Broadband', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 96 },
      { date: '2026-07-15', desc: 'Shell V-Power Premium Petrol', amount: 2900, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Shell Gas', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 93 },
      { date: '2026-07-16', desc: 'Cult.Fit Gym Monthly Membership', amount: 2200, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Cult.Fit', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 95 },
      { date: '2026-07-18', desc: 'Zomato Bistro Dinner & Beverages', amount: 1850, type: 'EXPENSE', cat: 'Food', method: 'UPI / Instant Transfer', merchant: 'Zomato', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
      { date: '2026-07-22', desc: 'H&M Summer Casual Apparel', amount: 4800, type: 'EXPENSE', cat: 'Shopping', method: 'Credit Card', merchant: 'H&M Retail', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 91 },
      
      { date: '2026-07-25', desc: 'Taj Palace Luxury Heritage Weekend Stay', amount: 28000, type: 'EXPENSE', cat: 'Travel', method: 'Credit Card', merchant: 'Taj Palace Resorts', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 94, notes: 'Weekend monsoon getaway reservation' },
      
      { date: '2026-07-28', desc: 'Zepto Quick Groceries & Fruits', amount: 890, type: 'EXPENSE', cat: 'Groceries', method: 'UPI / Instant Transfer', merchant: 'Zepto', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 93 },
      { date: '2026-07-29', desc: 'Vanguard Index Fund SIP Contribution', amount: 15000, type: 'EXPENSE', cat: 'Investment', method: 'Bank Transfer', merchant: 'Vanguard Mutual Funds', accId: 'acc-zerodha-invest', accName: 'Zerodha Kite Index & Equity Portfolio', source: 'MANUAL', conf: 97 },

      { date: '2026-06-01', desc: 'Apex Technologies Monthly Salary', amount: 95000, type: 'INCOME', cat: 'Salary', method: 'Bank Transfer', merchant: 'Apex Technologies', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 99 },
      { date: '2026-06-02', desc: 'Skyline Heights Apartment Rent', amount: 24000, type: 'EXPENSE', cat: 'Rent', method: 'Net Banking', merchant: 'Skyline Heights', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 98 },
      { date: '2026-06-05', desc: 'Costco Wholesale Bulk Provisions', amount: 5600, type: 'EXPENSE', cat: 'Groceries', method: 'Credit Card', merchant: 'Costco', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 96 },
      { date: '2026-06-08', desc: 'Netflix 4K UHD Monthly Subscription', amount: 649, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Netflix', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 97 },
      { date: '2026-06-09', desc: 'Spotify Family Music Plan', amount: 179, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Spotify', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 96 },
      { date: '2026-06-14', desc: 'Uber Intercity Travel', amount: 1650, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Uber', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 94 },
      { date: '2026-06-16', desc: 'Cult.Fit Gym Monthly Membership', amount: 2200, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Cult.Fit', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 95 },
      { date: '2026-06-18', desc: 'Chipotle Mexican Grill Lunch', amount: 720, type: 'EXPENSE', cat: 'Food', method: 'Credit Card', merchant: 'Chipotle', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 95 },
      { date: '2026-06-22', desc: 'Electricity & Municipal Water Utility', amount: 2600, type: 'EXPENSE', cat: 'Utilities', method: 'Net Banking', merchant: 'City Utilities', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 95 },
      { date: '2026-06-25', desc: 'Vanguard Index Fund SIP Contribution', amount: 15000, type: 'EXPENSE', cat: 'Investment', method: 'Bank Transfer', merchant: 'Vanguard Mutual Funds', accId: 'acc-zerodha-invest', accName: 'Zerodha Kite Index & Equity Portfolio', source: 'MANUAL', conf: 97 },
      { date: '2026-06-28', desc: 'Zara Casual Summer Shirt', amount: 3490, type: 'EXPENSE', cat: 'Shopping', method: 'Credit Card', merchant: 'Zara', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 92 },

      { date: '2026-05-01', desc: 'Apex Technologies Monthly Salary', amount: 95000, type: 'INCOME', cat: 'Salary', method: 'Bank Transfer', merchant: 'Apex Technologies', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 99 },
      { date: '2026-05-02', desc: 'Skyline Heights Apartment Rent', amount: 24000, type: 'EXPENSE', cat: 'Rent', method: 'Net Banking', merchant: 'Skyline Heights', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 98 },
      { date: '2026-05-05', desc: 'Supermart Family Grocery Cart', amount: 4600, type: 'EXPENSE', cat: 'Groceries', method: 'Debit Card', merchant: 'Supermart', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 95 },
      { date: '2026-05-08', desc: 'Netflix 4K UHD Monthly Subscription', amount: 649, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Netflix', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 97 },
      { date: '2026-05-09', desc: 'Spotify Family Music Plan', amount: 179, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Spotify', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 96 },
      { date: '2026-05-12', desc: 'Shell V-Power Premium Petrol', amount: 3000, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Shell Gas', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 93 },
      { date: '2026-05-16', desc: 'Cult.Fit Gym Monthly Membership', amount: 2200, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Cult.Fit', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 95 },
      { date: '2026-05-18', desc: 'Swiggy Weekend Dining with Friends', amount: 1450, type: 'EXPENSE', cat: 'Food', method: 'UPI / Instant Transfer', merchant: 'Swiggy', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
      { date: '2026-05-20', desc: 'Electricity Board Online Bill', amount: 2900, type: 'EXPENSE', cat: 'Utilities', method: 'Net Banking', merchant: 'State Electricity Board', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 94 },
      
      { date: '2026-05-22', desc: 'Apollo Hospitals Preventive Full MRI & Health Panel', amount: 18500, type: 'EXPENSE', cat: 'Healthcare', method: 'Credit Card', merchant: 'Apollo Hospitals', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 95, notes: 'Annual executive comprehensive preventive health evaluation' },
      
      { date: '2026-05-25', desc: 'Vanguard Index Fund SIP Contribution', amount: 15000, type: 'EXPENSE', cat: 'Investment', method: 'Bank Transfer', merchant: 'Vanguard Mutual Funds', accId: 'acc-zerodha-invest', accName: 'Zerodha Kite Index & Equity Portfolio', source: 'MANUAL', conf: 97 },
      { date: '2026-05-29', desc: 'Blinkit Instant Fruit Basket', amount: 920, type: 'EXPENSE', cat: 'Groceries', method: 'UPI / Instant Transfer', merchant: 'Blinkit', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 93 },

      { date: '2026-04-01', desc: 'Apex Technologies Monthly Salary', amount: 95000, type: 'INCOME', cat: 'Salary', method: 'Bank Transfer', merchant: 'Apex Technologies', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 99 },
      { date: '2026-04-02', desc: 'Skyline Heights Apartment Rent', amount: 24000, type: 'EXPENSE', cat: 'Rent', method: 'Net Banking', merchant: 'Skyline Heights', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 98 },
      { date: '2026-04-05', desc: 'Nature Basket Organic Groceries', amount: 4800, type: 'EXPENSE', cat: 'Groceries', method: 'Credit Card', merchant: 'Nature Basket', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 94 },
      { date: '2026-04-08', desc: 'Netflix 4K UHD Monthly Subscription', amount: 649, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Netflix', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 97 },
      { date: '2026-04-09', desc: 'Spotify Family Music Plan', amount: 179, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Spotify', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 96 },
      { date: '2026-04-12', desc: 'Airtel Broadband Fiber 1Gbps', amount: 1199, type: 'EXPENSE', cat: 'Bills', method: 'UPI / Instant Transfer', merchant: 'Airtel Broadband', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 96 },
      { date: '2026-04-16', desc: 'Cult.Fit Gym Monthly Membership', amount: 2200, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Cult.Fit', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 95 },
      { date: '2026-04-19', desc: 'Shell V-Power Premium Petrol', amount: 3200, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Shell Gas', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 93 },
      { date: '2026-04-22', desc: 'Zomato Family Gourmet Dinner', amount: 1950, type: 'EXPENSE', cat: 'Food', method: 'UPI / Instant Transfer', merchant: 'Zomato', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
      { date: '2026-04-25', desc: 'Vanguard Index Fund SIP Contribution', amount: 15000, type: 'EXPENSE', cat: 'Investment', method: 'Bank Transfer', merchant: 'Vanguard Mutual Funds', accId: 'acc-zerodha-invest', accName: 'Zerodha Kite Index & Equity Portfolio', source: 'MANUAL', conf: 97 },
      { date: '2026-04-27', desc: 'Amazon Prime Books & Home Essentials', amount: 2800, type: 'EXPENSE', cat: 'Shopping', method: 'Credit Card', merchant: 'Amazon', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 91 },

      { date: '2026-03-01', desc: 'Apex Technologies Monthly Salary', amount: 95000, type: 'INCOME', cat: 'Salary', method: 'Bank Transfer', merchant: 'Apex Technologies', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 99 },
      { date: '2026-03-02', desc: 'Skyline Heights Apartment Rent', amount: 24000, type: 'EXPENSE', cat: 'Rent', method: 'Net Banking', merchant: 'Skyline Heights', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 98 },
      { date: '2026-03-04', desc: 'BigBasket Monthly Pantry Staples', amount: 5200, type: 'EXPENSE', cat: 'Groceries', method: 'UPI / Instant Transfer', merchant: 'BigBasket', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 94 },
      { date: '2026-03-08', desc: 'Netflix 4K UHD Monthly Subscription', amount: 649, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Netflix', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 97 },
      { date: '2026-03-09', desc: 'Spotify Family Music Plan', amount: 179, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Spotify', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 96 },
      { date: '2026-03-14', desc: 'Uber City Commute', amount: 680, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Uber', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 94 },
      { date: '2026-03-16', desc: 'Cult.Fit Gym Monthly Membership', amount: 2200, type: 'EXPENSE', cat: 'Subscriptions', method: 'Credit Card', merchant: 'Cult.Fit', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', isRec: true, source: 'MANUAL', conf: 95 },
      { date: '2026-03-18', desc: 'Pharmacy & Health Supplements', amount: 1450, type: 'EXPENSE', cat: 'Healthcare', method: 'Credit Card', merchant: 'Apollo Pharmacy', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 93 },
      { date: '2026-03-20', desc: 'Electricity & Municipal Power Bill', amount: 2640, type: 'EXPENSE', cat: 'Utilities', method: 'Net Banking', merchant: 'State Electricity Board', accId: 'acc-hdfc-salary', accName: 'HDFC Corporate Salary Account', source: 'MANUAL', conf: 94 },
      { date: '2026-03-22', desc: 'Weekend Cinema Tickets', amount: 950, type: 'EXPENSE', cat: 'Entertainment', method: 'Credit Card', merchant: 'PVR Cinemas', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 94 },
      { date: '2026-03-25', desc: 'Vanguard Index Fund SIP Contribution', amount: 15000, type: 'EXPENSE', cat: 'Investment', method: 'Bank Transfer', merchant: 'Vanguard Mutual Funds', accId: 'acc-zerodha-invest', accName: 'Zerodha Kite Index & Equity Portfolio', source: 'MANUAL', conf: 97 },
      { date: '2026-03-28', desc: 'Blue Tokai Artisan Coffee & Breakfast', amount: 850, type: 'EXPENSE', cat: 'Food', method: 'Credit Card', merchant: 'Blue Tokai', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 95 },
      { date: '2026-03-30', desc: 'Local Transit & Metro Card Topup', amount: 500, type: 'EXPENSE', cat: 'Transport', method: 'UPI / Instant Transfer', merchant: 'Namma Metro', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
      { date: '2026-04-14', desc: 'Apollo Pharmacy First Aid & Medicines', amount: 890, type: 'EXPENSE', cat: 'Healthcare', method: 'UPI / Instant Transfer', merchant: 'Apollo Pharmacy', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 94 },
      { date: '2026-05-18', desc: 'Swiggy Gourmet Dinner Delivery', amount: 1240, type: 'EXPENSE', cat: 'Food', method: 'UPI / Instant Transfer', merchant: 'Swiggy', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
      { date: '2026-06-19', desc: 'Shell Gasoline Fuel Fill', amount: 2900, type: 'EXPENSE', cat: 'Transport', method: 'Credit Card', merchant: 'Shell Gas', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 93 },
      { date: '2026-07-11', desc: 'BookMyShow Weekend IMAX Movie', amount: 1100, type: 'EXPENSE', cat: 'Entertainment', method: 'Credit Card', merchant: 'BookMyShow', accId: 'acc-hdfc-regalia', accName: 'HDFC Regalia Gold Credit Card', source: 'MANUAL', conf: 94 },
      { date: '2026-08-14', desc: 'FreshToHome Organic Poultry & Fish', amount: 1850, type: 'EXPENSE', cat: 'Groceries', method: 'UPI / Instant Transfer', merchant: 'FreshToHome', accId: 'acc-gpay-upi', accName: 'Google Pay UPI Instant Transfer', source: 'SANDBOX_UPI', conf: 95 },
    ];

    rawSeedList.forEach((raw: any, idx) => {
      const txId = `tx-demo-${(idx + 1).toString().padStart(4, '0')}`;
      const canonicalData = {
        id: txId,
        userId: demoUserId,
        date: raw.date,
        amount: raw.amount,
        type: raw.type as 'INCOME' | 'EXPENSE',
        category: raw.cat as any,
        merchant: raw.merchant,
      };

      const hash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
      const onChainRecord = blockchainAdapter.recordTransactionHash(txId, hash);

      const tx: Transaction = {
        id: txId,
        userId: demoUserId,
        accountId: raw.accId,
        accountName: raw.accName,
        date: raw.date,
        description: raw.desc,
        cleanDescription: raw.desc,
        amount: raw.amount,
        type: raw.type as 'INCOME' | 'EXPENSE',
        category: raw.cat as any,
        paymentMethod: raw.method as any,
        merchant: raw.merchant,
        notes: raw.notes,
        isRecurring: raw.isRec || false,
        recurringFrequency: raw.isRec ? 'MONTHLY' : undefined,
        receiptId: raw.rcptId,
        billId: raw.billId,
        source: raw.source || 'MANUAL',
        aiConfidence: raw.conf,
        aiPredictedCategory: raw.cat as any,
        userCorrected: false,
        blockchainHash: hash,
        blockNumber: onChainRecord.blockNumber,
        blockchainVerified: true,
        createdAt: `${raw.date}T10:00:00Z`,
        updatedAt: `${raw.date}T10:00:00Z`,
      };

      this.transactions.set(txId, tx);
    });

    const demoBudget: Budget = {
      id: 'bgt-demo-2026-08',
      userId: demoUserId,
      month: '2026-08',
      totalBudget: 85000,
      categoryBudgets: [
        { category: 'Rent', allocatedAmount: 25000 },
        { category: 'Food', allocatedAmount: 10000 },
        { category: 'Groceries', allocatedAmount: 8000 },
        { category: 'Shopping', allocatedAmount: 15000 },
        { category: 'Transport', allocatedAmount: 6000 },
        { category: 'Utilities', allocatedAmount: 5000 },
        { category: 'Subscriptions', allocatedAmount: 3500 },
        { category: 'Healthcare', allocatedAmount: 3000 },
        { category: 'Entertainment', allocatedAmount: 4500 },
        { category: 'Travel', allocatedAmount: 5000 },
      ],
      rolloverEnabled: true,
      alertThresholds: {
        normal: 70,
        high: 90,
        exceeded: 100,
      },
      createdAt: '2026-08-01T00:00:00Z',
      updatedAt: '2026-08-01T00:00:00Z',
    };
    this.budgets.set(demoBudget.id, demoBudget);

    const goal1: SavingsGoal = {
      id: 'goal-emergency-fund',
      userId: demoUserId,
      title: 'Emergency Fund (6 Months Reserve)',
      targetAmount: 250000,
      currentAmount: 168000,
      targetDate: '2026-12-31',
      monthlyContribution: 20000,
      priority: 'HIGH',
      category: 'Safety Net',
      estimatedCompletionDate: '2026-12-15',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-08-28T00:00:00Z',
    };

    const goal2: SavingsGoal = {
      id: 'goal-tokyo-trip',
      userId: demoUserId,
      title: 'Japan Autumn Vacation',
      targetAmount: 120000,
      currentAmount: 78000,
      targetDate: '2026-11-15',
      monthlyContribution: 15000,
      priority: 'MEDIUM',
      category: 'Travel & Leisure',
      estimatedCompletionDate: '2026-11-20',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-08-28T00:00:00Z',
    };

    const goal3: SavingsGoal = {
      id: 'goal-tech-hardware',
      userId: demoUserId,
      title: 'Home Lab Server Cluster',
      targetAmount: 60000,
      currentAmount: 48000,
      targetDate: '2026-09-30',
      monthlyContribution: 10000,
      priority: 'LOW',
      category: 'Technology',
      estimatedCompletionDate: '2026-10-05',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-08-28T00:00:00Z',
    };

    this.goals.set(goal1.id, goal1);
    this.goals.set(goal2.id, goal2);
    this.goals.set(goal3.id, goal3);

    const ins1: AIInsight = {
      id: 'ins-01',
      userId: demoUserId,
      type: 'UNUSUAL_TRANSACTION',
      title: 'Unusual Spending Detected in Shopping',
      message: 'Based on your recorded transactions, the ₹42,500 expense at Croma Electronics is 3.8× your usual category baseline.',
      severity: 'WARNING',
      signalsUsed: ['Historical Category Mean (₹11,200)', 'Z-Score (3.42)', 'Merchant Cadence'],
      explanation: 'Our statistical anomaly model identified a high variance from your 90-day moving average in Shopping. Verified against receipt in Vault.',
      suggestedAction: 'Review itemized receipt in Receipt Vault or mark as verified business/personal equipment expense.',
      createdAt: '2026-08-22T14:30:00Z',
    };

    const ins2: AIInsight = {
      id: 'ins-02',
      userId: demoUserId,
      type: 'BUDGET_SUGGESTION',
      title: 'Food & Dining Exceeded Category Limit',
      message: 'Based on your recorded transactions, you spent approximately 18% more on Food this month than your recent average.',
      severity: 'ALERT',
      signalsUsed: ['Monthly Budget Limit (₹10,000)', 'Current Food Spend (₹11,840)', 'Bukhara Dining Outlier'],
      explanation: 'Dining out expenditure peaked during mid-August. You are currently 18.4% above your allocated ₹10,000 threshold.',
      suggestedAction: 'Consider adjusting next month’s category allocation or moderating weekend dining.',
      createdAt: '2026-08-25T11:00:00Z',
    };

    const ins3: AIInsight = {
      id: 'ins-03',
      userId: demoUserId,
      type: 'SAVINGS_SUGGESTION',
      title: 'Emergency Fund Milestone On Track',
      message: 'Based on your steady monthly contributions of ₹20,000, your Emergency Reserve will reach 100% capacity ahead of schedule.',
      severity: 'SUCCESS',
      signalsUsed: ['Current Balance (₹168,000)', 'Target (₹250,000)', 'Savings Velocity (21% net income)'],
      explanation: 'Your consistent automated transfers are outpacing inflation projections and indicate strong financial health.',
      suggestedAction: 'Maintain current contribution pace through December.',
      createdAt: '2026-08-28T09:00:00Z',
    };

    this.insights.set(ins1.id, ins1);
    this.insights.set(ins2.id, ins2);
    this.insights.set(ins3.id, ins3);

    const notif1: NotificationItem = {
      id: 'notif-01',
      userId: demoUserId,
      type: 'UNUSUAL_SPENDING',
      title: 'Unusual Transaction Detected',
      message: '₹42,500 at Croma Electronics exceeds your regular category spending range. Receipt attached.',
      timestamp: '2026-08-22T14:31:00Z',
      isRead: false,
      actionUrl: '/receipts',
    };
    const notif2: NotificationItem = {
      id: 'notif-02',
      userId: demoUserId,
      type: 'BLOCKCHAIN_VERIFICATION',
      title: 'Ledger Audit Milestone Verified',
      message: 'Block #42 successfully validated with 2 Hyperledger peer signatures.',
      timestamp: '2026-08-26T18:00:00Z',
      isRead: true,
      actionUrl: '/blockchain',
    };
    const notif3: NotificationItem = {
      id: 'notif-03',
      userId: demoUserId,
      type: 'RECURRING_PAYMENT',
      title: 'AWS Subscription Price Increase',
      message: 'AWS Cloud monthly charge increased from ₹1,450 to ₹1,850 (+27.5%).',
      timestamp: '2026-08-25T08:00:00Z',
      isRead: false,
      actionUrl: '/bills',
    };

    this.notifications.set(notif1.id, notif1);
    this.notifications.set(notif2.id, notif2);
    this.notifications.set(notif3.id, notif3);

    const aud1: AuditEvent = {
      id: 'aud-01',
      userId: demoUserId,
      eventType: 'USER_LOGIN_SUCCESS',
      description: 'Authenticated from trusted browser session with valid token',
      ipAddress: '192.168.1.42',
      userAgent: 'Mozilla/5.0 Chrome/128.0 (Encrypted Channel)',
      timestamp: '2026-08-28T09:15:00Z',
      blockchainTxId: 'fab-tx-098273410a',
    };
    const aud2: AuditEvent = {
      id: 'aud-02',
      userId: demoUserId,
      eventType: 'CONSENT_POLICY_VERIFIED',
      description: 'AI Personalization consent recorded to permissioned audit ledger',
      ipAddress: '192.168.1.42',
      userAgent: 'Mozilla/5.0 Chrome/128.0',
      timestamp: '2026-08-20T10:00:00Z',
      blockchainTxId: 'fab-tx-88192039ab',
    };

    this.auditEvents.set(aud1.id, aud1);
    this.auditEvents.set(aud2.id, aud2);

    const sess1: UserSession = {
      id: 'sess-active-01',
      token: 'tok-tls-live-current',
      userId: demoUserId,
      device: 'MacBook Pro 16" (macOS 15.1)',
      browser: 'Chrome 128.0 (Encrypted Channel)',
      ip: '192.168.1.42',
      location: 'Bangalore, India',
      createdAt: '2026-08-28T09:00:00Z',
      lastActiveAt: new Date().toISOString(),
      isCurrent: true,
    };
    this.sessions.set(sess1.id, sess1);
  }

  public getUserTransactions(userId: string): Transaction[] {
    const list: Transaction[] = [];
    for (const tx of this.transactions.values()) {
      if (tx.userId === userId) list.push(tx);
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getUserAccounts(userId: string): FinancialAccount[] {
    return Array.from(this.accounts.values()).filter(a => a.userId === userId);
  }

  public getAccountSummary(userId: string) {
    const accs = this.getUserAccounts(userId);
    
    let totalAssets = 0;
    let totalLiabilities = 0;

    for (const acc of accs) {
      if (acc.status === 'CLOSED') continue;

      if (acc.accountType === 'CREDIT_CARD') {
        const debt = Math.abs(acc.currentBalance < 0 ? acc.currentBalance : 0);
        totalLiabilities += debt;
      } else {
        if (acc.currentBalance > 0) {
          totalAssets += acc.currentBalance;
        } else {
          totalLiabilities += Math.abs(acc.currentBalance);
        }
      }
    }

    const netLiquidBalance = totalAssets - totalLiabilities;
    const netWorth = totalAssets - totalLiabilities;

    return {
      accounts: accs,
      totalAssets,
      totalLiabilities,
      netLiquidBalance,
      netWorth,
      accountsCount: accs.length,
      activeAccountsCount: accs.filter(a => a.status === 'ACTIVE').length,
    };
  }

  public getUserBills(userId: string): Bill[] {
    return Array.from(this.bills.values())
      .filter(b => b.userId === userId)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  public getUserSubscriptions(userId: string): Subscription[] {
    return Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());
  }

  public getUserLoans(userId: string): Loan[] {
    return Array.from(this.loans.values())
      .filter(l => l.userId === userId)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  }

  public getDebtSummary(userId: string): DebtSummary {
    const userLoans = this.getUserLoans(userId);
    const totalOutstandingDebt = userLoans
      .filter(l => l.status === 'ACTIVE')
      .reduce((s, l) => s + l.outstandingBalance, 0);

    const totalMonthlyObligation = userLoans
      .filter(l => l.status === 'ACTIVE')
      .reduce((s, l) => s + l.emi, 0);

    let totalEstimatedInterest = 0;
    for (const l of userLoans.filter(x => x.status === 'ACTIVE')) {
      const monthlyRate = l.interestRate / 100 / 12;
      const approxMonthsRemaining = l.emi > 0 ? Math.ceil(l.outstandingBalance / (l.emi * 0.8)) : 60;
      const estimatedInterest = Math.max(0, (l.emi * approxMonthsRemaining) - l.outstandingBalance);
      totalEstimatedInterest += Math.round(estimatedInterest);
    }

    const monthlyIncome = 95000;
    const debtToIncomeRatio = monthlyIncome > 0
      ? Math.min(100, Math.round((totalMonthlyObligation / monthlyIncome) * 100))
      : 0;

    const avgRate = userLoans.length > 0
      ? Number((userLoans.reduce((sum, l) => sum + l.interestRate, 0) / userLoans.length).toFixed(1))
      : 0;

    return {
      totalDebt: totalOutstandingDebt,
      totalMonthlyEmi: totalMonthlyObligation,
      averageInterestRate: avgRate,
      activeLoanCount: userLoans.length,
      totalOutstandingDebt,
      totalMonthlyObligation,
      totalEstimatedInterest,
      debtToIncomeRatio,
      loans: userLoans,
    };
  }

  public getUserReceipts(userId: string): ReceiptRecord[] {
    return Array.from(this.receipts.values())
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getDashboardSummary(userId: string) {
    const txs = this.getUserTransactions(userId);
    const profile = this.profiles.get(userId);
    const currency = profile?.preferredCurrency || 'INR';

    const currentMonth = '2026-08';
    const monthTx = txs.filter(t => t.date.startsWith(currentMonth));

    const monthlyIncome = monthTx
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const monthlyExpenses = monthTx
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    const accountSummary = this.getAccountSummary(userId);
    const totalBalance = accountSummary.netLiquidBalance;

    const userBudget = Array.from(this.budgets.values()).find(b => b.userId === userId && b.month === currentMonth);
    const totalBudget = userBudget?.totalBudget || 85000;
    const budgetRemaining = Math.max(0, totalBudget - monthlyExpenses);

    const userGoals = Array.from(this.goals.values()).filter(g => g.userId === userId);
    const totalSavings = userGoals.reduce((sum, g) => sum + g.currentAmount, 0);

    const categoryMap: Record<string, number> = {};
    for (const t of monthTx.filter(x => x.type === 'EXPENSE')) {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount;
    }
    const categoryDistribution = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: monthlyExpenses > 0 ? Math.round((amount / monthlyExpenses) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    const monthKeys = [
      { key: '2026-03', label: 'Mar 2026' },
      { key: '2026-04', label: 'Apr 2026' },
      { key: '2026-05', label: 'May 2026' },
      { key: '2026-06', label: 'Jun 2026' },
      { key: '2026-07', label: 'Jul 2026' },
      { key: '2026-08', label: 'Aug 2026' },
    ];

    const monthlyComparison = monthKeys.map(m => {
      const inc = txs.filter(t => t.date.startsWith(m.key) && t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const exp = txs.filter(t => t.date.startsWith(m.key) && t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      return {
        month: m.label,
        income: inc,
        expenses: exp,
        savings: Math.max(0, inc - exp),
      };
    });

    const dailySpendingMap: Record<string, number> = {};
    for (let i = 1; i <= 28; i++) {
      const dStr = `2026-08-${i.toString().padStart(2, '0')}`;
      dailySpendingMap[dStr] = 0;
    }
    for (const t of monthTx.filter(x => x.type === 'EXPENSE')) {
      if (dailySpendingMap[t.date] !== undefined) {
        dailySpendingMap[t.date] += t.amount;
      }
    }
    const spendingTrend = Object.entries(dailySpendingMap).map(([date, amount]) => ({
      date: date.slice(5),
      amount,
    }));

    const budgetAdherenceRatio = totalBudget > 0 ? monthlyExpenses / totalBudget : 0.8;
    const health = calculateFinancialHealthScore(monthlyIncome, monthlyExpenses, totalSavings, budgetAdherenceRatio);

    const anomalies = detectAnomalies(txs, userId);

    const debtSummary = this.getDebtSummary(userId);

    const upcomingBills = this.getUserBills(userId).filter(b => b.status !== 'PAID').slice(0, 4);

    return {
      currency,
      totalBalance,
      totalAssets: accountSummary.totalAssets,
      totalLiabilities: accountSummary.totalLiabilities,
      netLiquidBalance: accountSummary.netLiquidBalance,
      monthlyIncome,
      monthlyExpenses,
      netSavings: monthlyIncome - monthlyExpenses,
      totalSavings,
      totalBudget,
      budgetRemaining,
      budgetAdherenceRatio,
      financialHealth: health,
      categoryDistribution,
      monthlyComparison,
      spendingTrend,
      anomaliesCount: anomalies.length,
      recentTransactions: txs.slice(0, 8),
      upcomingRecurring: Array.from(this.recurring.values()).filter(r => r.userId === userId && r.status === 'ACTIVE').slice(0, 4),
      activeSubscriptions: this.getUserSubscriptions(userId).filter(s => s.status === 'ACTIVE').slice(0, 4),
      upcomingBills,
      savingsGoals: userGoals,
      accounts: accountSummary.accounts,
      debtSummary,
    };
  }

  public updateAccountBalance(accountId: string, amountChange: number, isCredit: boolean) {
    const acc = this.accounts.get(accountId);
    if (!acc) return;

    if (acc.accountType === 'CREDIT_CARD') {
      if (isCredit) {
        acc.currentBalance += amountChange;
      } else {
        acc.currentBalance -= amountChange;
      }
      if (acc.creditLimit) {
        acc.availableBalance = Math.max(0, acc.creditLimit + acc.currentBalance);
      }
    } else {
      if (isCredit) {
        acc.currentBalance += amountChange;
        acc.availableBalance += amountChange;
      } else {
        acc.currentBalance -= amountChange;
        acc.availableBalance -= amountChange;
      }
    }
    acc.updatedAt = new Date().toISOString();

    try {
      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized()) {
        adapter.execute(
          `UPDATE accounts SET current_balance = $1, available_balance = $2, updated_at = $3 WHERE id = $4;`,
          [acc.currentBalance, acc.availableBalance, acc.updatedAt, acc.id]
        ).catch(() => {});
      }
    } catch {}
  }

  public tamperTransactionForDemo(transactionId: string, tamperedAmount: number): boolean {
    const tx = this.transactions.get(transactionId);
    if (!tx) return false;

    tx.amount = tamperedAmount;
    tx.notes = (tx.notes ? tx.notes + ' ' : '') + '[SIMULATED DATABASE TAMPERING INJECTION]';
    tx.blockchainVerified = false;
    return true;
  }

  public recordAuditEvent(data: {
    userId: string;
    eventType: string;
    description: string;
    ipAddress?: string;
    userAgent?: string;
  }): AuditEvent {
    const id = 'aud-' + crypto.randomBytes(6).toString('hex');
    const timestamp = new Date().toISOString();
    const eventHash = crypto
      .createHash('sha256')
      .update(`${id}:${data.userId}:${data.eventType}:${timestamp}`)
      .digest('hex');

    const blockchainRecord = blockchainAdapter.recordAuditEvent(id, eventHash);

    const event: AuditEvent = {
      id,
      userId: data.userId,
      eventType: data.eventType,
      description: data.description,
      ipAddress: data.ipAddress || '127.0.0.1 (Protected Ingress)',
      userAgent: data.userAgent || 'Aegis Client Engine',
      timestamp,
      blockchainTxId: blockchainRecord.txId,
    };

    this.auditEvents.set(id, event);

    try {
      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized()) {
        adapter.execute(
          `INSERT INTO audit_events (id, user_id, event_type, description, ip_address, sha256_hash, metadata_json, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [event.id, event.userId, event.eventType, event.description, event.ipAddress, event.blockchainTxId || null, null, event.timestamp]
        ).catch(() => {});
      }
    } catch {}

    return event;
  }

  public getUserSessions(userId: string): UserSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }

  public revokeSession(sessionId: string): boolean {
    try {
      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized()) {
        adapter.deleteSession(sessionId).catch(() => {});
      }
    } catch {}
    return this.sessions.delete(sessionId);
  }

  public getUserKyc(userId: string): KycRecord | undefined {
    return this.kycRecords.get(userId) || Array.from(this.kycRecords.values()).find(k => k.userId === userId);
  }

  public saveUserKyc(kyc: KycRecord): void {
    this.kycRecords.set(kyc.userId, kyc);
    try {
      const adapter = getDatabaseAdapter();
      if (adapter && adapter.isInitialized()) {
        adapter.execute(
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
            kyc.id, kyc.userId, kyc.fullName, kyc.dateOfBirth || null, kyc.address || null,
            kyc.country || 'India', kyc.documentType, kyc.documentNumber, kyc.maskedDocumentNumber,
            kyc.status, kyc.documentImageUri || null, kyc.ocrExtractedData ? JSON.stringify(kyc.ocrExtractedData) : null,
            kyc.reviewerNotes || null, kyc.submittedAt || null, kyc.verifiedAt || null,
            kyc.rejectionReason || null, kyc.createdAt, kyc.updatedAt
          ]
        ).catch(() => {});
      }
    } catch {}
  }

  public deleteUserKyc(userId: string): boolean {
    const kyc = this.getUserKyc(userId);
    if (kyc) {
      this.kycRecords.delete(kyc.userId);
      this.kycRecords.delete(kyc.id);
      try {
        const adapter = getDatabaseAdapter();
        if (adapter && adapter.isInitialized()) {
          adapter.execute(`DELETE FROM kyc_records WHERE user_id = $1;`, [userId]).catch(() => {});
        }
      } catch {}
      return true;
    }
    return false;
  }
}

export const db = new Database();
