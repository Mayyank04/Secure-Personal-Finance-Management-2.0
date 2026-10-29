/**
 * Financial Accounts REST API Routes
 * 
 * Endpoints for:
 * - GET /api/accounts (List with Total Assets, Liabilities, Net Liquid Balance, and pagination)
 * - POST /api/accounts (Create account)
 * - GET /api/accounts/:id
 * - PUT /api/accounts/:id (Update account)
 * - PATCH /api/accounts/:id (Partial update)
 * - PATCH /api/accounts/:id/status (Change status: ACTIVE, INACTIVE, CLOSED)
 * - DELETE /api/accounts/:id (Safeguarded deletion with dependency checks)
 * - GET /api/accounts/:id/transactions (Filtered transactions for this account)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { sendSuccess, sendError, parseNonNegativeAmount, parsePositiveAmount } from '../apiResponse.js';
import { FinancialAccount, AccountType, AccountStatus } from '../types.js';

export const accountsRouter = Router();

// GET /api/accounts - List all accounts with summary metrics
accountsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let accounts: FinancialAccount[] = [];
    try {
      const rows = await adapter.query(`SELECT * FROM accounts WHERE user_id = $1 ORDER BY created_at ASC;`, [userId]);
      accounts = rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        institution: r.institution,
        accountType: r.account_type,
        maskedIdentifier: r.masked_identifier,
        currency: r.currency || 'INR',
        openingBalance: Number(r.opening_balance),
        currentBalance: Number(r.current_balance),
        availableBalance: Number(r.available_balance),
        creditLimit: r.credit_limit !== null ? Number(r.credit_limit) : undefined,
        status: r.status,
        isDemo: Boolean(r.is_demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      accounts = db.getUserAccounts(userId);
    }

    if (accounts.length === 0) {
      accounts = db.getUserAccounts(userId);
    }

    const totalAssets = accounts
      .filter(a => a.accountType !== 'CREDIT_CARD')
      .reduce((sum, a) => sum + (a.currentBalance > 0 ? a.currentBalance : 0), 0);

    const totalLiabilities = accounts
      .filter(a => a.accountType === 'CREDIT_CARD')
      .reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);

    const netLiquidBalance = totalAssets - totalLiabilities;

    return sendSuccess(res, 200, {
      accounts,
      totalAssets,
      totalLiabilities,
      netLiquidBalance,
      accountCount: accounts.length,
    });
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNTS_FETCH_ERROR', 'Failed to retrieve accounts summary: ' + err.message);
  }
});

// POST /api/accounts - Create new account
accountsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      institution,
      accountType = 'BANK',
      maskedIdentifier,
      currency = 'INR',
      openingBalance = 0,
      creditLimit,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Account name is required.');
    }
    if (!institution || typeof institution !== 'string' || institution.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Financial institution is required.');
    }

    const validTypes: AccountType[] = ['BANK', 'CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'CASH', 'INVESTMENT'];
    const finalType = validTypes.includes(accountType) ? accountType : 'BANK';

    const parsedOpening = parseNonNegativeAmount(openingBalance, 'Opening balance');
    if (parsedOpening.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedOpening.error);
    }

    const accountId = 'acc-' + crypto.randomBytes(6).toString('hex');
    const balance = parsedOpening.value;

    let available = balance;
    let numCreditLimit: number | undefined;
    if (finalType === 'CREDIT_CARD' && creditLimit !== undefined) {
      const parsedLimit = parsePositiveAmount(creditLimit, 'Credit limit');
      if (parsedLimit.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedLimit.error);
      numCreditLimit = parsedLimit.value;
      available = numCreditLimit + balance;
    }

    const now = new Date().toISOString();
    const newAccount: FinancialAccount = {
      id: accountId,
      userId,
      name: name.trim(),
      institution: institution.trim(),
      accountType: finalType as AccountType,
      maskedIdentifier: maskedIdentifier || `•••• ${Math.floor(1000 + Math.random() * 9000)}`,
      currency,
      openingBalance: balance,
      currentBalance: balance,
      availableBalance: available,
      creditLimit: numCreditLimit,
      status: 'ACTIVE',
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    };

    // Save to persistent database
    const adapter = getDatabaseAdapter();
    await adapter.saveAccount(newAccount);

    // Keep memory cache updated
    db.accounts.set(accountId, newAccount);

    db.recordAuditEvent({
      userId,
      eventType: 'ACCOUNT_CREATED',
      description: `Created new ${finalType} account "${newAccount.name}" at ${newAccount.institution}.`,
    });

    return sendSuccess(res, 201, { account: newAccount }, 'Financial account created successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNT_CREATE_ERROR', 'Failed to create financial account: ' + err.message);
  }
});

// GET /api/accounts/:id - Get single account details
accountsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const accountId = req.params.id;
    const adapter = getDatabaseAdapter();

    let acc = await adapter.getAccountForUser(accountId, userId);
    if (!acc) {
      const memAcc = db.accounts.get(accountId);
      if (memAcc && memAcc.userId === userId) {
        acc = memAcc;
      }
    }

    if (!acc) {
      return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Financial account not found or inaccessible.');
    }

    return sendSuccess(res, 200, { account: acc });
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNT_FETCH_ERROR', 'Failed to retrieve account: ' + err.message);
  }
});

// PUT & PATCH /api/accounts/:id - Update account
async function handleUpdateAccount(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const accountId = req.params.id;
    const adapter = getDatabaseAdapter();

    let acc = await adapter.getAccountForUser(accountId, userId);
    if (!acc) {
      const memAcc = db.accounts.get(accountId);
      if (memAcc && memAcc.userId === userId) {
        acc = memAcc;
      }
    }

    if (!acc) {
      return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Financial account not found or inaccessible.');
    }

    const { name, institution, maskedIdentifier, creditLimit, currentBalance, status, currency } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Account name cannot be empty.');
      }
      acc.name = name.trim();
    }

    if (institution !== undefined) {
      if (typeof institution !== 'string' || institution.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Institution cannot be empty.');
      }
      acc.institution = institution.trim();
    }

    if (maskedIdentifier !== undefined) acc.maskedIdentifier = String(maskedIdentifier).trim();

    if (creditLimit !== undefined) {
      const parsedLimit = parsePositiveAmount(creditLimit, 'Credit limit');
      if (parsedLimit.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedLimit.error);
      acc.creditLimit = parsedLimit.value;
    }

    if (currentBalance !== undefined) {
      const numBal = Number(currentBalance);
      if (isNaN(numBal)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Current balance must be a number.');
      }
      acc.currentBalance = numBal;
      if (acc.accountType === 'CREDIT_CARD' && acc.creditLimit) {
        acc.availableBalance = Math.max(0, acc.creditLimit + acc.currentBalance);
      } else {
        acc.availableBalance = acc.currentBalance;
      }
    }

    if (status !== undefined) {
      if (!['ACTIVE', 'INACTIVE', 'CLOSED'].includes(status)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Status must be ACTIVE, INACTIVE, or CLOSED.');
      }
      acc.status = status as AccountStatus;
    }

    if (currency !== undefined) {
      const upperCurr = String(currency).toUpperCase();
      if (!['INR', 'USD', 'EUR', 'GBP'].includes(upperCurr)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Supported currencies are INR, USD, EUR, GBP.');
      }
      acc.currency = upperCurr as 'INR' | 'USD' | 'EUR' | 'GBP';
    }

    acc.updatedAt = new Date().toISOString();

    // Persist to database
    await adapter.saveAccount(acc);

    // Keep memory cache updated
    db.accounts.set(acc.id, acc);

    db.recordAuditEvent({
      userId,
      eventType: 'ACCOUNT_UPDATED',
      description: `Updated details for account "${acc.name}".`,
    });

    return sendSuccess(res, 200, { account: acc }, 'Account updated successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNT_UPDATE_ERROR', 'Failed to update financial account: ' + err.message);
  }
}

accountsRouter.put('/:id', handleUpdateAccount);
accountsRouter.patch('/:id', handleUpdateAccount);

// PATCH /api/accounts/:id/status - Status change
accountsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const accountId = req.params.id;
    const adapter = getDatabaseAdapter();

    let acc = await adapter.getAccountForUser(accountId, userId);
    if (!acc) {
      const memAcc = db.accounts.get(accountId);
      if (memAcc && memAcc.userId === userId) {
        acc = memAcc;
      }
    }

    if (!acc) {
      return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Financial account not found or inaccessible.');
    }

    const { status } = req.body;
    if (!status || !['ACTIVE', 'INACTIVE', 'CLOSED'].includes(status)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status value. Must be ACTIVE, INACTIVE, or CLOSED.');
    }

    acc.status = status as AccountStatus;
    acc.updatedAt = new Date().toISOString();

    await adapter.saveAccount(acc);
    db.accounts.set(acc.id, acc);

    db.recordAuditEvent({
      userId,
      eventType: 'ACCOUNT_STATUS_CHANGED',
      description: `Account "${acc.name}" status changed to ${status}.`,
    });

    return sendSuccess(res, 200, { account: acc }, `Account status updated to ${status}.`);
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNT_STATUS_ERROR', 'Failed to update account status: ' + err.message);
  }
});

// DELETE /api/accounts/:id - Safe deletion with dependent record safeguards
accountsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const accountId = req.params.id;
    const adapter = getDatabaseAdapter();

    let acc = await adapter.getAccountForUser(accountId, userId);
    if (!acc) {
      const memAcc = db.accounts.get(accountId);
      if (memAcc && memAcc.userId === userId) {
        acc = memAcc;
      }
    }

    if (!acc) {
      return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Financial account not found or inaccessible.');
    }

    // Safeguard: Check for dependent records unless forced
    const txCount = await adapter.getAccountTransactionsCount(accountId, userId);
    const force = req.query.force === 'true' || req.body?.force === true;

    if (txCount > 0 && !force) {
      return sendError(
        res,
        409,
        'ACCOUNT_HAS_DEPENDENT_RECORDS',
        `Cannot delete account "${acc.name}". It is associated with ${txCount} transaction(s). Please reassign or delete dependent transactions first, or pass ?force=true to proceed with deletion.`
      );
    }

    // Delete dependent transactions if force requested
    if (force && txCount > 0) {
      await adapter.execute(`DELETE FROM transactions WHERE account_id = $1 AND user_id = $2;`, [accountId, userId]);
      for (const [id, tx] of db.transactions.entries()) {
        if (tx.accountId === accountId && tx.userId === userId) {
          db.transactions.delete(id);
        }
      }
    }

    await adapter.deleteAccount(accountId);
    db.accounts.delete(accountId);

    db.recordAuditEvent({
      userId,
      eventType: 'ACCOUNT_DELETED',
      description: `Deleted financial account "${acc.name}" (Associated transactions: ${txCount}, Forced: ${force}).`,
    });

    return sendSuccess(res, 200, { id: accountId }, 'Financial account removed successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNT_DELETE_ERROR', 'Failed to delete account: ' + err.message);
  }
});

// GET /api/accounts/:id/transactions - Get transactions for specific account
accountsRouter.get('/:id/transactions', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const accountId = req.params.id;
    const adapter = getDatabaseAdapter();

    let acc = await adapter.getAccountForUser(accountId, userId);
    if (!acc) {
      const memAcc = db.accounts.get(accountId);
      if (memAcc && memAcc.userId === userId) {
        acc = memAcc;
      }
    }

    if (!acc) {
      return sendError(res, 404, 'ACCOUNT_NOT_FOUND', 'Financial account not found or inaccessible.');
    }

    const txs = db.getUserTransactions(userId).filter(t => t.accountId === accountId);
    return sendSuccess(res, 200, { transactions: txs, count: txs.length });
  } catch (err: any) {
    return sendError(res, 500, 'ACCOUNT_TX_FETCH_ERROR', 'Failed to retrieve account transactions: ' + err.message);
  }
});
