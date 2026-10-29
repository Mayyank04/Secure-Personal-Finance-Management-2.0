import { Router, Request, Response } from 'express';

export const openapiRouter = Router();

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'AegisFinance / CipherLedger AI - Secure Personal Finance API',
    version: '2.0.0',
    description: `
**Secure Personal Finance Management System using Blockchain and AI**

Production-grade, database-backed REST API deployed on Vercel with managed PostgreSQL (Supabase / Neon),
HMAC-SHA256 signed session tokens, RFC 6238 TOTP multi-factor authentication, cryptographic Merkle ledger anchoring,
and AI-driven transaction categorization and anomaly detection.

### Authentication
Include the Bearer token in the \`Authorization\` header:
\`\`\`http
Authorization: Bearer <your_session_token>
\`\`\`
Or via the \`x-session-token\` custom header.
`,
    contact: {
      name: 'AegisFinance Engineering Team',
      url: 'https://github.com/Mayyank04/Secure-Personal-Finance-Management-2.0',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment (Local / Vercel Serverless)',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'HMAC-SHA256 Token (tok.<userId>.<expiresAt>.<sig>)',
      },
      SessionTokenHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-session-token',
      },
    },
    schemas: {
      StandardError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid or missing request fields.' },
              details: { type: 'object' },
            },
            required: ['code', 'message'],
          },
          message: { type: 'string', example: 'Invalid or missing request fields.' },
        },
        required: ['success', 'error', 'message'],
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'tx-a1b2c3d4' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          accountId: { type: 'string', example: 'acc-123456' },
          accountName: { type: 'string', example: 'Primary Checking' },
          amount: { type: 'number', example: 4500.50 },
          type: { type: 'string', enum: ['INCOME', 'EXPENSE'], example: 'EXPENSE' },
          category: { type: 'string', example: 'Groceries' },
          date: { type: 'string', format: 'date', example: '2026-10-28' },
          description: { type: 'string', example: 'Whole Foods Market' },
          merchant: { type: 'string', example: 'Whole Foods' },
          paymentMethod: { type: 'string', example: 'Credit Card' },
          blockchainHash: { type: 'string', example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
          blockNumber: { type: 'integer', example: 42 },
          blockchainVerified: { type: 'boolean', example: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'userId', 'amount', 'type', 'category', 'date', 'description'],
      },
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'acc-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          name: { type: 'string', example: 'HDFC Salary Account' },
          institution: { type: 'string', example: 'HDFC Bank' },
          accountType: { type: 'string', enum: ['BANK', 'CREDIT_CARD', 'INVESTMENT', 'WALLET', 'LOAN'], example: 'BANK' },
          maskedIdentifier: { type: 'string', example: '•••• 4821' },
          currency: { type: 'string', example: 'INR' },
          openingBalance: { type: 'number', example: 50000 },
          currentBalance: { type: 'number', example: 64250.75 },
          availableBalance: { type: 'number', example: 64250.75 },
          creditLimit: { type: 'number', example: 100000 },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'CLOSED'], example: 'ACTIVE' },
        },
        required: ['id', 'userId', 'name', 'institution', 'accountType', 'currentBalance'],
      },
      Budget: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'bgt-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          month: { type: 'string', example: '2026-10' },
          totalBudget: { type: 'number', example: 85000 },
          spentAmount: { type: 'number', example: 42000 },
          remainingAmount: { type: 'number', example: 43000 },
          progressPercent: { type: 'number', example: 49 },
          rolloverEnabled: { type: 'boolean', example: true },
          categoryBudgets: { type: 'object', example: { Rent: 25000, Food: 15000, Utilities: 8000 } },
        },
        required: ['id', 'userId', 'month', 'totalBudget'],
      },
      SavingsGoal: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'goal-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          title: { type: 'string', example: 'Emergency Reserve Fund' },
          targetAmount: { type: 'number', example: 300000 },
          currentAmount: { type: 'number', example: 120000 },
          remainingAmount: { type: 'number', example: 180000 },
          progressPercent: { type: 'number', example: 40 },
          monthlyContribution: { type: 'number', example: 15000 },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'HIGH' },
          targetDate: { type: 'string', format: 'date', example: '2027-06-30' },
        },
        required: ['id', 'userId', 'title', 'targetAmount'],
      },
      Bill: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'bill-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          name: { type: 'string', example: 'Airtel Broadband Fiber' },
          merchant: { type: 'string', example: 'Airtel' },
          amount: { type: 'number', example: 1199 },
          category: { type: 'string', example: 'Utilities' },
          dueDate: { type: 'string', format: 'date', example: '2026-11-05' },
          frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'], example: 'MONTHLY' },
          status: { type: 'string', enum: ['UPCOMING', 'DUE_SOON', 'OVERDUE', 'PAID', 'CANCELLED'], example: 'UPCOMING' },
          autoPaid: { type: 'boolean', example: false },
        },
        required: ['id', 'userId', 'name', 'amount', 'dueDate'],
      },
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'sub-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          name: { type: 'string', example: 'GitHub Copilot Enterprise' },
          merchant: { type: 'string', example: 'GitHub' },
          amount: { type: 'number', example: 1600 },
          frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'], example: 'MONTHLY' },
          monthlyCost: { type: 'number', example: 1600 },
          annualCost: { type: 'number', example: 19200 },
          status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'CANCELLED'], example: 'ACTIVE' },
          priceChangeDetected: { type: 'boolean', example: false },
        },
        required: ['id', 'userId', 'name', 'amount'],
      },
      Loan: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'loan-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          loanName: { type: 'string', example: 'SBI Home Loan' },
          lender: { type: 'string', example: 'State Bank of India' },
          principal: { type: 'number', example: 4500000 },
          outstandingBalance: { type: 'number', example: 3850000 },
          interestRate: { type: 'number', example: 8.5 },
          emi: { type: 'number', example: 39050 },
          dueDate: { type: 'string', example: '10th of every month' },
          status: { type: 'string', enum: ['ACTIVE', 'PAID_OFF', 'CLOSED', 'DEFAULTED'], example: 'ACTIVE' },
        },
        required: ['id', 'userId', 'loanName', 'lender', 'principal', 'outstandingBalance'],
      },
      KycRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'kyc-123456' },
          userId: { type: 'string', example: 'usr-e5f6g7h8' },
          fullName: { type: 'string', example: 'Mayank Gautam' },
          documentType: { type: 'string', enum: ['PASSPORT', 'DRIVING_LICENSE', 'NATIONAL_ID', 'VOTER_ID'], example: 'PASSPORT' },
          maskedDocumentNumber: { type: 'string', example: '•••• •••• 9182' },
          country: { type: 'string', example: 'India' },
          status: { type: 'string', enum: ['NOT_STARTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'], example: 'UNDER_REVIEW' },
          reviewerNotes: { type: 'string' },
          submittedAt: { type: 'string', format: 'date-time' },
          verifiedAt: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'userId', 'fullName', 'documentType', 'status'],
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Application Liveness & Health Probe',
        tags: ['Diagnostics'],
        responses: {
          200: { description: 'Application operational' },
        },
      },
    },
    '/api/ready': {
      get: {
        summary: 'Database Readiness & Migration Probe',
        tags: ['Diagnostics'],
        responses: {
          200: { description: 'Database connected and fully migrated' },
          503: { description: 'Database unreachable or uninitialized' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Register New User Account',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Sarah Connor' },
                  email: { type: 'string', format: 'email', example: 'sarah@example.com' },
                  password: { type: 'string', format: 'password', example: 'ComplexPass#2026' },
                  currency: { type: 'string', example: 'INR' },
                },
                required: ['name', 'email', 'password'],
              },
            },
          },
        },
        responses: {
          201: { description: 'User registered and session token issued' },
          400: { description: 'Validation failed or weak password' },
          409: { description: 'Email address already exists' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Authenticate User Credentials',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'sarah@example.com' },
                  password: { type: 'string', format: 'password', example: 'ComplexPass#2026' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Authenticated successfully' },
          401: { description: 'Invalid email or password' },
          429: { description: 'Rate limit exceeded' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Get Authenticated User Profile & Identity',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: {
          200: { description: 'Authenticated user and profile returned' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/transactions': {
      get: {
        summary: 'List User Transactions with Filters & Pagination',
        tags: ['Transactions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search term' },
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['INCOME', 'EXPENSE'] } },
          { name: 'accountId', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 15 } },
        ],
        responses: {
          200: { description: 'Paginated transactions list' },
          401: { description: 'Unauthorized' },
        },
      },
      post: {
        summary: 'Create Transaction with Atomic Balance Cascade & Blockchain Anchor',
        tags: ['Transactions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  description: { type: 'string', example: 'Supermarket Grocery Run' },
                  amount: { type: 'number', example: 3250 },
                  type: { type: 'string', enum: ['INCOME', 'EXPENSE'], default: 'EXPENSE' },
                  category: { type: 'string', example: 'Groceries' },
                  paymentMethod: { type: 'string', example: 'Credit Card' },
                  merchant: { type: 'string', example: 'Nature Basket' },
                  date: { type: 'string', format: 'date', example: '2026-10-28' },
                  accountId: { type: 'string' },
                },
                required: ['description', 'amount'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Transaction created and anchored' },
          400: { description: 'Validation error' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/transactions/{id}': {
      get: {
        summary: 'Get Transaction by ID',
        tags: ['Transactions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transaction details' },
          404: { description: 'Transaction not found or inaccessible' },
        },
      },
      patch: {
        summary: 'Update Transaction with Balance Reversion & Ledger Re-anchor',
        tags: ['Transactions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transaction updated' },
          404: { description: 'Not found' },
        },
      },
      delete: {
        summary: 'Delete Transaction with Atomic Balance Reversion',
        tags: ['Transactions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Transaction removed and balance reverted' },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/accounts': {
      get: {
        summary: 'List Financial Accounts with Total Assets & Liabilities',
        tags: ['Accounts'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Accounts summary' } },
      },
      post: {
        summary: 'Create Financial Account',
        tags: ['Accounts'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'Account created' } },
      },
    },
    '/api/accounts/{id}': {
      get: {
        summary: 'Get Account Details',
        tags: ['Accounts'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Account details' } },
      },
      patch: {
        summary: 'Update Account Information',
        tags: ['Accounts'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Account updated' } },
      },
      delete: {
        summary: 'Delete Account with Dependent Record Safeguards',
        tags: ['Accounts'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'force', in: 'query', schema: { type: 'boolean', default: false } },
        ],
        responses: {
          200: { description: 'Account deleted' },
          409: { description: 'Account has dependent records (pass ?force=true to override)' },
        },
      },
    },
    '/api/budgets': {
      get: {
        summary: 'List Budgets with Dynamic Derived Spending Progress',
        tags: ['Budgets'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Budgets with progress metrics' } },
      },
      post: {
        summary: 'Configure New Monthly Budget',
        tags: ['Budgets'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'Budget configured' } },
      },
    },
    '/api/budgets/{id}': {
      get: {
        summary: 'Get Budget Details with Progress',
        tags: ['Budgets'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Budget details' } },
      },
      patch: {
        summary: 'Update Budget Targets',
        tags: ['Budgets'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Budget updated' } },
      },
      delete: {
        summary: 'Delete Budget',
        tags: ['Budgets'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Budget removed' } },
      },
    },
    '/api/goals': {
      get: {
        summary: 'List Savings Goals with Progress Tracking',
        tags: ['Savings Goals'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Goals with progress metrics' } },
      },
      post: {
        summary: 'Create New Savings Goal',
        tags: ['Savings Goals'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'Savings goal created' } },
      },
    },
    '/api/goals/{id}': {
      get: {
        summary: 'Get Savings Goal Details',
        tags: ['Savings Goals'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Goal details' } },
      },
      patch: {
        summary: 'Update Savings Goal',
        tags: ['Savings Goals'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Goal updated' } },
      },
      delete: {
        summary: 'Delete Savings Goal',
        tags: ['Savings Goals'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Goal deleted' } },
      },
    },
    '/api/goals/{id}/contribute': {
      post: {
        summary: 'Contribute Funds to Savings Goal',
        tags: ['Savings Goals'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Contribution recorded' } },
      },
    },
    '/api/bills': {
      get: {
        summary: 'List Upcoming and Paid Bills',
        tags: ['Bills'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Bills list' } },
      },
      post: {
        summary: 'Schedule New Bill',
        tags: ['Bills'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'Bill created' } },
      },
    },
    '/api/bills/{id}': {
      get: {
        summary: 'Get Bill Details',
        tags: ['Bills'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bill details' } },
      },
      patch: {
        summary: 'Update Bill Details',
        tags: ['Bills'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bill updated' } },
      },
      delete: {
        summary: 'Delete Scheduled Bill',
        tags: ['Bills'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bill deleted' } },
      },
    },
    '/api/bills/{id}/pay': {
      post: {
        summary: 'Settle Bill & Cascade Transaction',
        tags: ['Bills'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Bill marked paid and ledger transaction created' } },
      },
    },
    '/api/subscriptions': {
      get: {
        summary: 'List Subscriptions with Monthly/Annual Burn Rates',
        tags: ['Subscriptions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Subscriptions list' } },
      },
      post: {
        summary: 'Register Recurring Subscription',
        tags: ['Subscriptions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'Subscription created' } },
      },
    },
    '/api/subscriptions/{id}': {
      get: {
        summary: 'Get Subscription Details',
        tags: ['Subscriptions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Subscription details' } },
      },
      patch: {
        summary: 'Update Subscription',
        tags: ['Subscriptions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Subscription updated' } },
      },
      delete: {
        summary: 'Remove Subscription',
        tags: ['Subscriptions'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Subscription deleted' } },
      },
    },
    '/api/loans': {
      get: {
        summary: 'List Loan Portfolio with Debt Analytics',
        tags: ['Loans & Debt'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Loans portfolio and DTI metrics' } },
      },
      post: {
        summary: 'Register Loan Record',
        tags: ['Loans & Debt'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'Loan registered' } },
      },
    },
    '/api/loans/{id}': {
      get: {
        summary: 'Get Loan Details & Amortization Data',
        tags: ['Loans & Debt'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Loan details' } },
      },
      patch: {
        summary: 'Update Loan Record',
        tags: ['Loans & Debt'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Loan updated' } },
      },
      delete: {
        summary: 'Delete Loan Record',
        tags: ['Loans & Debt'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Loan deleted' } },
      },
    },
    '/api/loans/{id}/payment': {
      post: {
        summary: 'Record Loan EMI Payment & Deduct Balance',
        tags: ['Loans & Debt'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Payment recorded' } },
      },
    },
    '/api/kyc/status': {
      get: {
        summary: 'Get User KYC Verification Status',
        tags: ['KYC Verification'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'KYC status overview' } },
      },
    },
    '/api/kyc': {
      get: {
        summary: 'Get Sanitized User KYC Record',
        tags: ['KYC Verification'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Sanitized KYC record' } },
      },
      patch: {
        summary: 'Update Permitted KYC Profile Fields (No Self-Approval)',
        tags: ['KYC Verification'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: {
          200: { description: 'Profile updated' },
          403: { description: 'Forbidden: status fields cannot be altered by users' },
        },
      },
    },
    '/api/kyc/submit': {
      post: {
        summary: 'Submit Documents for Identity Verification',
        tags: ['KYC Verification'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 201: { description: 'KYC submitted and anchored to blockchain' } },
      },
    },
    '/api/kyc/review': {
      post: {
        summary: 'Administrator Verification Action (Approve or Reject)',
        tags: ['KYC Verification'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: {
          200: { description: 'Verification decision recorded' },
          403: { description: 'Forbidden: Requires administrator role' },
        },
      },
    },
    '/api/blockchain/audit': {
      get: {
        summary: 'Read-Only Cryptographic Ledger Status & Blocks',
        tags: ['Cryptographic Audit Ledger'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Ledger blocks and anchoring records' } },
      },
    },
    '/api/blockchain/verify-chain': {
      post: {
        summary: 'Verify Merkle Root & Block Integrity of Entire Audit Ledger',
        tags: ['Cryptographic Audit Ledger'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Ledger cryptographic integrity verified' } },
      },
    },
    '/api/security/logs': {
      get: {
        summary: 'Read-Only User Security & Audit Events',
        tags: ['Audit Records'],
        security: [{ BearerAuth: [] }, { SessionTokenHeader: [] }],
        responses: { 200: { description: 'Audit events log' } },
      },
    },
  },
};

openapiRouter.get('/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  return res.json(openApiSpec);
});

openapiRouter.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AegisFinance API Documentation — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
  <link rel="icon" type="image/png" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234f46e5'><path d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/></svg>" />
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafafa; }
    .topbar { display: none; }
    .swagger-ui .info .title { font-size: 26px; color: #1e293b; }
    .swagger-ui .info { margin: 24px 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`);
});
