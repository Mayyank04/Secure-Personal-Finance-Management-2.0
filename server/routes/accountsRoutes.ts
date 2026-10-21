/**
 * Financial Accounts REST API Routes
 * 
 * Endpoints for:
 * - GET /api/accounts (List with Total Assets, Liabilities, Net Liquid Balance)
 * - POST /api/accounts (Create account)
 * - GET /api/accounts/:id
 * - PUT /api/accounts/:id (Update account)
 * - PATCH /api/accounts/:id/status (Change status: ACTIVE, INACTIVE, CLOSED)
 * - DELETE /api/accounts/:id (Soft/hard delete)
 * - GET /api/accounts/:id/transactions (Filtered transactions for this account)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { getDatabaseAdapter } from '../db/index.js';
import { FinancialAccount, AccountType, AccountStatus } from '../types.js';

export const accountsRouter = Router();

// GET /api/accounts - List all accounts with summary metrics
accountsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const summary = db.getAccountSummary(userId);
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve accounts summary.' });
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

    if (!name || !institution) {
      return res.status(400).json({ error: 'Account name and institution are required.' });
    }

    const accountId = 'acc-' + crypto.randomBytes(6).toString('hex');
    const balance = Number(openingBalance) || 0;

    let available = balance;
    if (accountType === 'CREDIT_CARD' && creditLimit) {
      available = Number(creditLimit) + balance;
    }

    const newAccount: FinancialAccount = {
      id: accountId,
      userId,
      name: name.trim(),
      institution: institution.trim(),
      accountType: accountType as AccountType,
      maskedIdentifier: maskedIdentifier || `•••• ${Math.floor(1000 + Math.random() * 9000)}`,
      currency,
      openingBalance: balance,
      currentBalance: balance,
      availableBalance: available,
      creditLimit: creditLimit ? Number(creditLimit) : undefined,
      status: 'ACTIVE',
      isDemo: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.accounts.set(accountId, newAccount);
    await getDatabaseAdapter().execute(
      `INSERT INTO accounts (id, user_id, name, institution, account_type, masked_identifier, currency, opening_balance, current_balance, available_balance, credit_limit, status, is_demo, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, institution = EXCLUDED.institution, account_type = EXCLUDED.account_type,
         masked_identifier = EXCLUDED.masked_identifier, currency = EXCLUDED.currency,
         current_balance = EXCLUDED.current_balance, available_balance = EXCLUDED.available_balance,
         credit_limit = EXCLUDED.credit_limit, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;`,
      [
        newAccount.id,
        newAccount.userId,
        newAccount.name,
        newAccount.institution,
        newAccount.accountType,
        newAccount.maskedIdentifier,
        newAccount.currency,
        newAccount.openingBalance,
        newAccount.currentBalance,
        newAccount.availableBalance,
        newAccount.creditLimit || null,
        newAccount.status,
        newAccount.isDemo ? 1 : 0,
        newAccount.createdAt,
        newAccount.updatedAt,
      ]
    ).catch(() => {});
    await getDatabaseAdapter().syncFromMemoryDb(db);
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'ACCOUNT_CREATED',
      description: `Created new ${accountType} account "${newAccount.name}" at ${newAccount.institution}.`,
    });

    return res.status(201).json({
      message: 'Financial account created successfully.',
      account: newAccount,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create financial account.' });
  }
});

// GET /api/accounts/:id - Get single account details
accountsRouter.get('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const acc = db.accounts.get(req.params.id);

  if (!acc || acc.userId !== userId) {
    return res.status(404).json({ error: 'Financial account not found.' });
  }

  return res.json({ account: acc });
});

// PUT /api/accounts/:id - Update account
accountsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const acc = db.accounts.get(req.params.id);

    if (!acc || acc.userId !== userId) {
      return res.status(404).json({ error: 'Financial account not found.' });
    }

    const { name, institution, maskedIdentifier, creditLimit, currentBalance } = req.body;

    if (name) acc.name = name.trim();
    if (institution) acc.institution = institution.trim();
    if (maskedIdentifier) acc.maskedIdentifier = maskedIdentifier.trim();
    if (creditLimit !== undefined) acc.creditLimit = Number(creditLimit);
    if (currentBalance !== undefined) {
      acc.currentBalance = Number(currentBalance);
      if (acc.accountType === 'CREDIT_CARD' && acc.creditLimit) {
        acc.availableBalance = Math.max(0, acc.creditLimit + acc.currentBalance);
      } else {
        acc.availableBalance = acc.currentBalance;
      }
    }
    acc.updatedAt = new Date().toISOString();

    await getDatabaseAdapter().execute(
      `UPDATE accounts SET name = $1, institution = $2, masked_identifier = $3, credit_limit = $4, current_balance = $5, available_balance = $6, updated_at = $7 WHERE id = $8 AND user_id = $9;`,
      [acc.name, acc.institution, acc.maskedIdentifier, acc.creditLimit || null, acc.currentBalance, acc.availableBalance, acc.updatedAt, acc.id, userId]
    ).catch(() => {});

    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'ACCOUNT_UPDATED',
      description: `Updated details for account "${acc.name}".`,
    });

    return res.json({ message: 'Account updated successfully.', account: acc });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update financial account.' });
  }
});

// PATCH /api/accounts/:id/status - Change status
accountsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const acc = db.accounts.get(req.params.id);

  if (!acc || acc.userId !== userId) {
    return res.status(404).json({ error: 'Financial account not found.' });
  }

  const { status } = req.body;
  if (!status || !['ACTIVE', 'INACTIVE', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be ACTIVE, INACTIVE, or CLOSED.' });
  }

  acc.status = status as AccountStatus;
  acc.updatedAt = new Date().toISOString();

  await getDatabaseAdapter().execute(
    `UPDATE accounts SET status = $1, updated_at = $2 WHERE id = $3 AND user_id = $4;`,
    [acc.status, acc.updatedAt, acc.id, userId]
  ).catch(() => {});

  persistentSqlite.syncFromMemoryDb(db);

  db.recordAuditEvent({
    userId,
    eventType: 'ACCOUNT_STATUS_CHANGED',
    description: `Account "${acc.name}" status changed to ${status}.`,
  });

  return res.json({ message: `Account status updated to ${status}.`, account: acc });
});

// DELETE /api/accounts/:id - Delete account
accountsRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const acc = db.accounts.get(req.params.id);

  if (!acc || acc.userId !== userId) {
    return res.status(404).json({ error: 'Financial account not found.' });
  }

  db.accounts.delete(req.params.id);
  await getDatabaseAdapter().deleteAccount(req.params.id).catch(() => {});
  persistentSqlite.deleteAccount(req.params.id);
  persistentSqlite.syncFromMemoryDb(db);

  db.recordAuditEvent({
    userId,
    eventType: 'ACCOUNT_DELETED',
    description: `Deleted financial account "${acc.name}".`,
  });

  return res.json({ message: 'Financial account removed successfully.' });
});

// GET /api/accounts/:id/transactions - Get transactions for specific account
accountsRouter.get('/:id/transactions', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const accountId = req.params.id;
  const txs = db.getUserTransactions(userId).filter(t => t.accountId === accountId);
  return res.json({ transactions: txs, count: txs.length });
});
