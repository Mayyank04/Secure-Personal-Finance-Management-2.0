import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { blockchainAdapter } from '../blockchain.js';
import { sendSuccess, sendError, parsePositiveAmount, isValidIsoDate } from '../apiResponse.js';
import { Bill, BillStatus, BillFrequency, TransactionCategory, Transaction } from '../types.js';

export const billsRouter = Router();

function computeBillStatus(dueDate: string, currentStatus: BillStatus): BillStatus {
  if (currentStatus === 'PAID' || currentStatus === 'CANCELLED') return currentStatus;
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(dueDate).getTime();
  const now = new Date(today).getTime();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 3) return 'DUE_SOON';
  return 'UPCOMING';
}

billsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let rawBills: Bill[] = [];
    try {
      const rows = await adapter.query(`SELECT * FROM bills WHERE user_id = $1 ORDER BY due_date ASC;`, [userId]);
      rawBills = rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        accountId: r.account_id || undefined,
        name: r.name,
        merchant: r.merchant,
        amount: Number(r.amount),
        category: r.category,
        dueDate: r.due_date,
        frequency: r.frequency,
        autoPaid: Boolean(r.auto_paid),
        status: r.status,
        linkedTransactionId: r.linked_transaction_id || undefined,
        notes: r.notes || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      rawBills = db.getUserBills(userId);
    }

    if (rawBills.length === 0) {
      rawBills = db.getUserBills(userId);
    }

    const { status, category } = req.query as Record<string, string>;
    if (status && status !== 'ALL') {
      rawBills = rawBills.filter(b => b.status === status);
    }
    if (category && category !== 'ALL') {
      rawBills = rawBills.filter(b => b.category.toLowerCase() === category.toLowerCase());
    }

    const bills = rawBills.map(b => {
      const updatedStatus = computeBillStatus(b.dueDate, b.status);
      b.status = updatedStatus;
      const linkedAccount = b.accountId ? db.accounts.get(b.accountId) : undefined;
      return {
        ...b,
        accountName: linkedAccount?.name,
      };
    });

    const upcomingAmount = bills
      .filter(b => b.status === 'UPCOMING' || b.status === 'DUE_SOON' || b.status === 'OVERDUE')
      .reduce((s, b) => s + b.amount, 0);

    const overdueCount = bills.filter(b => b.status === 'OVERDUE').length;
    const dueSoonCount = bills.filter(b => b.status === 'DUE_SOON').length;

    return sendSuccess(res, 200, {
      bills,
      summary: {
        totalBills: bills.length,
        upcomingAmount,
        overdueCount,
        dueSoonCount,
        paidCount: bills.filter(b => b.status === 'PAID').length,
      },
    });
  } catch (err: any) {
    return sendError(res, 500, 'BILLS_FETCH_ERROR', 'Failed to retrieve bills: ' + err.message);
  }
});

billsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const billId = req.params.id;
    const adapter = getDatabaseAdapter();

    let bill = await adapter.getBillForUser(billId, userId);
    if (!bill) {
      const memBill = db.bills.get(billId);
      if (memBill && memBill.userId === userId) {
        bill = memBill;
      }
    }

    if (!bill) {
      return sendError(res, 404, 'BILL_NOT_FOUND', 'Bill not found or inaccessible.');
    }

    bill.status = computeBillStatus(bill.dueDate, bill.status);
    return sendSuccess(res, 200, { bill });
  } catch (err: any) {
    return sendError(res, 500, 'BILL_FETCH_ERROR', 'Failed to retrieve bill: ' + err.message);
  }
});

billsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      merchant,
      amount,
      category = 'Utilities',
      dueDate,
      frequency = 'MONTHLY',
      accountId,
      notes,
      autoPaid = false,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Bill name is required.');
    }

    const parsedAmount = parsePositiveAmount(amount, 'Bill amount');
    if (parsedAmount.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
    }

    if (!dueDate || !isValidIsoDate(dueDate)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Valid due date in YYYY-MM-DD format is required.');
    }

    const billId = 'bill-' + crypto.randomBytes(6).toString('hex');
    const status = computeBillStatus(dueDate, 'UPCOMING');
    const now = new Date().toISOString();

    const newBill: Bill = {
      id: billId,
      userId,
      name: name.trim(),
      merchant: merchant ? merchant.trim() : name.trim(),
      amount: parsedAmount.value,
      category: category as TransactionCategory,
      dueDate,
      frequency: frequency as BillFrequency,
      accountId: accountId || undefined,
      status,
      notes: notes || undefined,
      autoPaid: Boolean(autoPaid),
      createdAt: now,
      updatedAt: now,
    };

    const adapter = getDatabaseAdapter();
    await adapter.saveBill(newBill);
    db.bills.set(billId, newBill);

    db.recordAuditEvent({
      userId,
      eventType: 'BILL_CREATED',
      description: `Created new bill "${newBill.name}" for ₹${newBill.amount} due on ${newBill.dueDate}.`,
    });

    return sendSuccess(res, 201, { bill: newBill }, 'Bill created successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'BILL_CREATE_ERROR', 'Failed to create bill: ' + err.message);
  }
});

async function handleUpdateBill(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const billId = req.params.id;
    const adapter = getDatabaseAdapter();

    let bill = await adapter.getBillForUser(billId, userId);
    if (!bill) {
      const memBill = db.bills.get(billId);
      if (memBill && memBill.userId === userId) {
        bill = memBill;
      }
    }

    if (!bill) {
      return sendError(res, 404, 'BILL_NOT_FOUND', 'Bill not found or inaccessible.');
    }

    const { name, merchant, amount, category, dueDate, frequency, accountId, status, notes, autoPaid } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Bill name cannot be empty.');
      }
      bill.name = name.trim();
    }

    if (merchant !== undefined) bill.merchant = String(merchant).trim();

    if (amount !== undefined) {
      const parsedAmount = parsePositiveAmount(amount, 'Bill amount');
      if (parsedAmount.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
      bill.amount = parsedAmount.value;
    }

    if (category !== undefined) bill.category = category as TransactionCategory;

    if (dueDate !== undefined) {
      if (!isValidIsoDate(dueDate)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid due date format. Must be YYYY-MM-DD.');
      }
      bill.dueDate = dueDate;
      bill.status = computeBillStatus(dueDate, bill.status);
    }

    if (frequency !== undefined) bill.frequency = frequency as BillFrequency;
    if (accountId !== undefined) bill.accountId = accountId || undefined;
    if (status !== undefined) bill.status = status as BillStatus;
    if (notes !== undefined) bill.notes = notes;
    if (autoPaid !== undefined) bill.autoPaid = Boolean(autoPaid);

    bill.updatedAt = new Date().toISOString();

    // Persist to database
    await adapter.saveBill(bill);
    db.bills.set(billId, bill);

    db.recordAuditEvent({
      userId,
      eventType: 'BILL_UPDATED',
      description: `Updated details for bill "${bill.name}".`,
    });

    return sendSuccess(res, 200, { bill }, 'Bill updated successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'BILL_UPDATE_ERROR', 'Failed to update bill: ' + err.message);
  }
}

billsRouter.put('/:id', handleUpdateBill);
billsRouter.patch('/:id', handleUpdateBill);

billsRouter.post('/:id/pay', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const billId = req.params.id;
    const adapter = getDatabaseAdapter();

    let bill = await adapter.getBillForUser(billId, userId);
    if (!bill) {
      const memBill = db.bills.get(billId);
      if (memBill && memBill.userId === userId) {
        bill = memBill;
      }
    }

    if (!bill) {
      return sendError(res, 404, 'BILL_NOT_FOUND', 'Bill not found or inaccessible.');
    }

    const { recordTransaction = true, accountId, paymentMethod = 'Bank Transfer' } = req.body;
    const targetAccountId = accountId || bill.accountId;
    let targetAccount = targetAccountId ? await adapter.getAccountForUser(targetAccountId, userId) : null;
    if (!targetAccount) {
      const accounts = await adapter.query(`SELECT * FROM accounts WHERE user_id = $1 LIMIT 1;`, [userId]);
      if (accounts.length > 0) targetAccount = accounts[0];
      else targetAccount = db.getUserAccounts(userId)[0] || null;
    }

    bill.status = 'PAID';
    bill.updatedAt = new Date().toISOString();

    let createdTx: Transaction | undefined;

    if (recordTransaction && targetAccount) {
      const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
      const canonicalData = {
        id: txId,
        userId,
        date: new Date().toISOString().split('T')[0],
        amount: bill.amount,
        type: 'EXPENSE' as const,
        category: bill.category,
        merchant: bill.merchant,
      };

      const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
      const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

      createdTx = {
        id: txId,
        userId,
        accountId: targetAccount.id,
        accountName: targetAccount.name,
        date: new Date().toISOString().split('T')[0],
        description: `Bill Payment: ${bill.name}`,
        cleanDescription: bill.name,
        amount: bill.amount,
        type: 'EXPENSE',
        category: bill.category,
        paymentMethod,
        merchant: bill.merchant,
        billId: bill.id,
        source: 'MANUAL',
        aiConfidence: 100,
        aiPredictedCategory: bill.category,
        userCorrected: false,
        blockchainHash,
        blockNumber: onChainRecord.blockNumber,
        blockchainVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adapter.payBillAtomic({
        bill,
        transaction: createdTx,
        account: targetAccount,
        newBalance: targetAccount.currentBalance - bill.amount,
        auditEvent: {
          id: 'aud-' + crypto.randomBytes(6).toString('hex'),
          userId,
          eventType: 'BILL_PAID',
          description: `Settled bill "${bill.name}" for ₹${bill.amount}.`,
          timestamp: new Date().toISOString(),
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.headers['user-agent'] as string) || 'Modern Web Client',
          blockchainTxId: blockchainHash,
        },
        ledgerRecord: onChainRecord,
      }).catch(err => {
        console.error('[Bill Pay] Atomic persistence warning:', err);
      });

      bill.linkedTransactionId = txId;
      db.transactions.set(txId, createdTx);
      db.updateAccountBalance(targetAccount.id, bill.amount, false);
    } else {
      await adapter.saveBill(bill);
    }

    db.bills.set(bill.id, bill);

    return sendSuccess(
      res,
      200,
      { bill, transaction: createdTx, transactionId: createdTx?.id },
      `Bill "${bill.name}" marked as paid.`
    );
  } catch (err: any) {
    return sendError(res, 500, 'BILL_PAY_ERROR', 'Failed to settle bill: ' + err.message);
  }
});

billsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const billId = req.params.id;
    const adapter = getDatabaseAdapter();

    let bill = await adapter.getBillForUser(billId, userId);
    if (!bill) {
      const memBill = db.bills.get(billId);
      if (memBill && memBill.userId === userId) {
        bill = memBill;
      }
    }

    if (!bill) {
      return sendError(res, 404, 'BILL_NOT_FOUND', 'Bill not found or inaccessible.');
    }

    await adapter.deleteBill(billId);
    db.bills.delete(billId);

    db.recordAuditEvent({
      userId,
      eventType: 'BILL_DELETED',
      description: `Removed bill "${bill.name}".`,
    });

    return sendSuccess(res, 200, { id: billId }, 'Bill removed successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'BILL_DELETE_ERROR', 'Failed to delete bill: ' + err.message);
  }
});
