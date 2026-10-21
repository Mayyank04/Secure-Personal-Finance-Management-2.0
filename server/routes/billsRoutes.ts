/**
 * Bill Management REST API Routes
 * 
 * Provides:
 * - Bill scheduling & status lifecycle (Upcoming, Due Soon, Paid, Overdue, Cancelled)
 * - Calendar integration & Due date alerts
 * - One-click bill settlement with ledger transaction recording & account balance deductions
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { Bill, BillStatus, BillFrequency, TransactionCategory, Transaction } from '../types.js';
import { blockchainAdapter } from '../blockchain.js';

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

// GET /api/bills - List bills with status breakdown
billsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const rawBills = db.getUserBills(userId);

    // Update dynamic status
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

    return res.json({
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
    return res.status(500).json({ error: 'Failed to retrieve bills.' });
  }
});

// POST /api/bills - Create new bill
billsRouter.post('/', (req: Request, res: Response) => {
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

    if (!name || !amount || !dueDate) {
      return res.status(400).json({ error: 'Bill name, amount, and due date are required.' });
    }

    const billId = 'bill-' + crypto.randomBytes(6).toString('hex');
    const status = computeBillStatus(dueDate, 'UPCOMING');

    const newBill: Bill = {
      id: billId,
      userId,
      name: name.trim(),
      merchant: merchant ? merchant.trim() : name.trim(),
      amount: Number(amount),
      category: category as TransactionCategory,
      dueDate,
      frequency: frequency as BillFrequency,
      accountId,
      status,
      notes,
      autoPaid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.bills.set(billId, newBill);
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'BILL_CREATED',
      description: `Created new bill "${newBill.name}" for ₹${newBill.amount} due on ${newBill.dueDate}.`,
    });

    return res.status(201).json({ message: 'Bill created successfully.', bill: newBill });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create bill.' });
  }
});

// PUT /api/bills/:id - Update bill
billsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const bill = db.bills.get(req.params.id);

    if (!bill || bill.userId !== userId) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    const { name, merchant, amount, category, dueDate, frequency, accountId, status, notes, autoPaid } = req.body;

    if (name) bill.name = name.trim();
    if (merchant) bill.merchant = merchant.trim();
    if (amount !== undefined) bill.amount = Number(amount);
    if (category) bill.category = category;
    if (dueDate) bill.dueDate = dueDate;
    if (frequency) bill.frequency = frequency;
    if (accountId !== undefined) bill.accountId = accountId;
    if (status) bill.status = status;
    if (notes !== undefined) bill.notes = notes;
    if (autoPaid !== undefined) bill.autoPaid = autoPaid;

    bill.updatedAt = new Date().toISOString();
    persistentSqlite.syncFromMemoryDb(db);

    return res.json({ message: 'Bill updated successfully.', bill });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update bill.' });
  }
});

// POST /api/bills/:id/pay - Mark bill as paid & optionally record transaction
billsRouter.post('/:id/pay', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const bill = db.bills.get(req.params.id);

    if (!bill || bill.userId !== userId) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    const { recordTransaction = true, accountId, paymentMethod = 'Bank Transfer' } = req.body;
    const targetAccountId = accountId || bill.accountId;
    const targetAccount = targetAccountId ? db.accounts.get(targetAccountId) : db.getUserAccounts(userId)[0];

    bill.status = 'PAID';
    bill.updatedAt = new Date().toISOString();

    let createdTx: Transaction | undefined;

    if (recordTransaction) {
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
        accountId: targetAccount?.id,
        accountName: targetAccount?.name,
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

      db.transactions.set(txId, createdTx);
      bill.linkedTransactionId = txId;

      if (targetAccount) {
        db.updateAccountBalance(targetAccount.id, bill.amount, false);
      }
    }
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'BILL_PAID',
      description: `Settled bill "${bill.name}" for ₹${bill.amount}.`,
    });

    return res.json({
      message: `Bill "${bill.name}" marked as paid.`,
      bill,
      transaction: createdTx,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to settle bill.' });
  }
});

// DELETE /api/bills/:id - Delete bill
billsRouter.delete('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const bill = db.bills.get(req.params.id);

  if (!bill || bill.userId !== userId) {
    return res.status(404).json({ error: 'Bill not found.' });
  }

  db.bills.delete(req.params.id);
  persistentSqlite.deleteBill(req.params.id);
  persistentSqlite.syncFromMemoryDb(db);
  return res.json({ message: 'Bill removed successfully.' });
});
