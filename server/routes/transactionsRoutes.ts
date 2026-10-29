/**
 * Transactions REST API Routes
 * 
 * Provides:
 * - Full CRUD endpoints: GET /, POST /, GET /:id, PATCH /:id, PUT /:id, DELETE /:id
 * - Filtering (date range, category, type, account, amount range)
 * - Sorting & pagination
 * - Atomic account balance cascading & blockchain ledger anchoring
 * - AI categorization preview & bulk transaction import
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { blockchainAdapter } from '../blockchain.js';
import { cleanTransactionDescription, predictTransactionCategory, recordCategoryFeedback } from '../ai_ml.js';
import { uploadRateLimiter } from '../security.js';
import { sendSuccess, sendError, parsePositiveAmount, isValidIsoDate, parsePaginationParams } from '../apiResponse.js';
import { Transaction, TransactionCategory, FinancialAccount } from '../types.js';

export const transactionsRouter = Router();

// POST /api/transactions/categorize-preview - AI categorization preview
transactionsRouter.post('/categorize-preview', (req: Request, res: Response) => {
  const { description = '', amount = 0, type = 'EXPENSE' } = req.body;
  const { cleaned, extractedMerchant } = cleanTransactionDescription(description);
  const prediction = predictTransactionCategory(cleaned, Number(amount), type);

  return res.json({
    cleanDescription: cleaned,
    extractedMerchant,
    predictedCategory: prediction.predictedCategory,
    subcategory: prediction.subcategory,
    confidence: prediction.confidence,
    isUncertain: prediction.isUncertain,
    reasons: prediction.reasons,
    explanation: prediction.explanation,
  });
});

// GET /api/transactions - List transactions with filters, pagination, and sorting
transactionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    const {
      search,
      category,
      type,
      paymentMethod,
      accountId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query as Record<string, string>;

    const { page, limit } = parsePaginationParams(req.query, 15, 100);

    // Read from persistent database or hydrated cache
    let list: Transaction[] = [];
    try {
      const rows = await adapter.query(
        `SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC;`,
        [userId]
      );
      list = rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        accountId: r.account_id || undefined,
        receiptId: r.receipt_id || undefined,
        billId: r.bill_id || undefined,
        source: r.source || 'MANUAL',
        date: r.date,
        description: r.description,
        cleanDescription: r.clean_description || r.description,
        amount: Number(r.amount),
        type: r.type,
        category: r.category,
        paymentMethod: r.payment_method,
        merchant: r.merchant,
        notes: r.notes || undefined,
        isRecurring: Boolean(r.is_recurring),
        recurringFrequency: r.recurring_frequency || undefined,
        aiConfidence: r.ai_confidence !== null ? Number(r.ai_confidence) : 95,
        aiPredictedCategory: r.ai_predicted_category || r.category,
        userCorrected: Boolean(r.user_corrected),
        blockchainHash: r.blockchain_hash,
        blockNumber: Number(r.block_number),
        blockchainVerified: Boolean(r.blockchain_verified),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      list = db.getUserTransactions(userId);
    }

    if (list.length === 0) {
      list = db.getUserTransactions(userId);
    }

    // Attach account names from accounts cache
    for (const tx of list) {
      if (tx.accountId && !tx.accountName) {
        const acc = db.accounts.get(tx.accountId);
        if (acc) tx.accountName = acc.name;
      }
    }

    // Filters
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        t =>
          t.description.toLowerCase().includes(q) ||
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    if (accountId && accountId !== 'ALL') {
      list = list.filter(t => t.accountId === accountId);
    }

    if (category && category !== 'ALL') {
      list = list.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }

    if (type && type !== 'ALL') {
      list = list.filter(t => t.type === type.toUpperCase());
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      list = list.filter(t => t.paymentMethod === paymentMethod);
    }

    if (startDate) {
      list = list.filter(t => t.date >= startDate);
    }

    if (endDate) {
      list = list.filter(t => t.date <= endDate);
    }

    if (minAmount) {
      list = list.filter(t => t.amount >= Number(minAmount));
    }

    if (maxAmount) {
      list = list.filter(t => t.amount <= Number(maxAmount));
    }

    // Sorting
    list.sort((a: any, b: any) => {
      const valA = a[sortBy];
      const valB = b[sortBy];
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const totalCount = list.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const paginatedItems = list.slice((page - 1) * limit, page * limit);

    return sendSuccess(res, 200, {
      transactions: paginatedItems,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (err: any) {
    return sendError(res, 500, 'TRANSACTIONS_FETCH_ERROR', 'Failed to retrieve transactions: ' + err.message);
  }
});

// GET /api/transactions/:id - Retrieve single transaction with strict ownership check
transactionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const txId = req.params.id;
    const adapter = getDatabaseAdapter();

    let tx = await adapter.getTransactionForUser(txId, userId);
    if (!tx) {
      const memTx = db.transactions.get(txId);
      if (memTx && memTx.userId === userId) {
        tx = memTx;
      }
    }

    if (!tx) {
      return sendError(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found or inaccessible.');
    }

    if (tx.accountId && !tx.accountName) {
      const acc = db.accounts.get(tx.accountId);
      if (acc) tx.accountName = acc.name;
    }

    return sendSuccess(res, 200, { transaction: tx });
  } catch (err: any) {
    return sendError(res, 500, 'TRANSACTION_FETCH_ERROR', 'Failed to retrieve transaction: ' + err.message);
  }
});

// POST /api/transactions - Create transaction with atomic balance cascade & blockchain anchor
transactionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      description,
      amount,
      type = 'EXPENSE',
      category: manualCategory,
      paymentMethod = 'Credit Card',
      merchant,
      date = new Date().toISOString().split('T')[0],
      notes = '',
      isRecurring = false,
      recurringFrequency,
      accountId,
      receiptId,
      billId,
      source = 'MANUAL',
    } = req.body;

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Transaction description is required.');
    }

    const parsedAmount = parsePositiveAmount(amount, 'Transaction amount');
    if (parsedAmount.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
    }

    if (date && !isValidIsoDate(date)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Must be YYYY-MM-DD.');
    }

    const validTypes = ['INCOME', 'EXPENSE'];
    const finalType = validTypes.includes(String(type).toUpperCase()) ? String(type).toUpperCase() : 'EXPENSE';

    const { cleaned, extractedMerchant } = cleanTransactionDescription(description);
    const prediction = predictTransactionCategory(cleaned, parsedAmount.value, finalType as 'INCOME' | 'EXPENSE');
    const finalCategory: TransactionCategory = manualCategory || prediction.predictedCategory;
    const finalMerchant = merchant ? String(merchant).trim() : extractedMerchant;

    const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
    const canonicalData = {
      id: txId,
      userId,
      date,
      amount: parsedAmount.value,
      type: finalType,
      category: finalCategory,
      merchant: finalMerchant,
    };

    // Calculate canonical SHA-256 hash and anchor to cryptographic ledger
    const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
    const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

    const adapter = getDatabaseAdapter();
    let targetAccount: FinancialAccount | null = null;
    if (accountId) {
      targetAccount = await adapter.getAccountForUser(accountId, userId);
      if (!targetAccount) {
        targetAccount = db.accounts.get(accountId) || null;
      }
    }

    const now = new Date().toISOString();
    const newTx: Transaction = {
      id: txId,
      userId,
      accountId: targetAccount?.id,
      accountName: targetAccount?.name,
      receiptId: receiptId || undefined,
      billId: billId || undefined,
      source,
      date,
      description: description.trim(),
      cleanDescription: cleaned,
      amount: parsedAmount.value,
      type: finalType as 'INCOME' | 'EXPENSE',
      category: finalCategory,
      paymentMethod,
      merchant: finalMerchant,
      notes,
      isRecurring: Boolean(isRecurring),
      recurringFrequency: isRecurring ? (recurringFrequency || 'MONTHLY') : undefined,
      aiConfidence: manualCategory ? 100 : prediction.confidence,
      aiPredictedCategory: prediction.predictedCategory,
      userCorrected: Boolean(manualCategory && manualCategory !== prediction.predictedCategory),
      blockchainHash,
      blockNumber: onChainRecord.blockNumber,
      blockchainVerified: true,
      createdAt: now,
      updatedAt: now,
    };

    // Atomic cascade: persist transaction, update account balance, record audit event
    if (targetAccount) {
      const isIncome = newTx.type === 'INCOME';
      const balanceDelta = isIncome ? newTx.amount : -newTx.amount;
      const updatedBalance = targetAccount.currentBalance + balanceDelta;

      await adapter.createTransactionAtomic({
        transaction: newTx,
        account: targetAccount,
        newBalance: updatedBalance,
        auditEvent: {
          id: 'aud-' + crypto.randomBytes(6).toString('hex'),
          userId,
          eventType: 'TRANSACTION_CREATED',
          description: `Recorded ${newTx.type} of ₹${newTx.amount} for "${newTx.description}".`,
          timestamp: now,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.headers['user-agent'] as string) || 'Modern Web Client',
          blockchainTxId: blockchainHash,
        },
        ledgerRecord: onChainRecord,
      });

      targetAccount.currentBalance = updatedBalance;
      targetAccount.availableBalance = targetAccount.accountType === 'CREDIT_CARD' && targetAccount.creditLimit
        ? Math.max(0, targetAccount.creditLimit + updatedBalance)
        : updatedBalance;
      targetAccount.updatedAt = now;
      db.accounts.set(targetAccount.id, targetAccount);
    } else {
      await adapter.execute(
        `INSERT INTO transactions (id, user_id, account_id, receipt_id, bill_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, recurring_frequency, ai_confidence, ai_predicted_category, user_corrected, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25);`,
        [
          newTx.id, newTx.userId, newTx.accountId || null, newTx.receiptId || null, newTx.billId || null,
          newTx.source || 'MANUAL', newTx.date, newTx.description, newTx.cleanDescription, newTx.amount,
          newTx.type, newTx.category, newTx.paymentMethod, newTx.merchant, newTx.notes || null,
          newTx.isRecurring ? 1 : 0, newTx.recurringFrequency || null, newTx.aiConfidence || 95,
          newTx.aiPredictedCategory || newTx.category, newTx.userCorrected ? 1 : 0, newTx.blockchainHash,
          newTx.blockNumber || 0, newTx.blockchainVerified ? 1 : 0, newTx.createdAt, newTx.updatedAt,
        ]
      );
    }

    // Keep memory cache updated
    db.transactions.set(txId, newTx);

    // Link receipt if provided
    if (receiptId) {
      const rcpt = db.receipts.get(receiptId);
      if (rcpt && rcpt.userId === userId) {
        rcpt.linkedTransactionId = txId;
        rcpt.processingStatus = 'LINKED';
        rcpt.updatedAt = now;
      }
    }

    // Link bill if provided
    if (billId) {
      const bill = db.bills.get(billId);
      if (bill && bill.userId === userId) {
        bill.status = 'PAID';
        bill.linkedTransactionId = txId;
        bill.updatedAt = now;
        await adapter.saveBill(bill).catch(() => {});
      }
    }

    // Record category feedback
    if (manualCategory && manualCategory !== prediction.predictedCategory) {
      recordCategoryFeedback(description, manualCategory);
    }

    return sendSuccess(
      res,
      201,
      { transaction: newTx, blockchainRecord: onChainRecord },
      'Transaction created and anchored on cryptographic ledger.'
    );
  } catch (err: any) {
    return sendError(res, 500, 'TRANSACTION_CREATE_ERROR', 'Failed to save transaction: ' + err.message);
  }
});

// PATCH & PUT /api/transactions/:id - Edit transaction with balance reversion & re-anchoring
async function handleUpdateTransaction(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const txId = req.params.id;
    const adapter = getDatabaseAdapter();

    let tx = await adapter.getTransactionForUser(txId, userId);
    if (!tx) {
      const memTx = db.transactions.get(txId);
      if (memTx && memTx.userId === userId) {
        tx = memTx;
      }
    }

    if (!tx) {
      return sendError(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found or inaccessible.');
    }

    const { description, amount, type, category, paymentMethod, merchant, date, notes, isRecurring, accountId } = req.body;

    const oldAmount = tx.amount;
    const oldType = tx.type;
    const oldAccountId = tx.accountId;

    // Reverse old balance impact
    if (oldAccountId && (amount !== undefined || type !== undefined || accountId !== undefined)) {
      const oldAccount = await adapter.getAccountForUser(oldAccountId, userId);
      if (oldAccount) {
        const revertDelta = oldType === 'EXPENSE' ? oldAmount : -oldAmount;
        oldAccount.currentBalance += revertDelta;
        oldAccount.availableBalance += revertDelta;
        await adapter.saveAccount(oldAccount);
        db.accounts.set(oldAccount.id, oldAccount);
      }
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Description cannot be empty.');
      }
      tx.description = description.trim();
      const { cleaned, extractedMerchant } = cleanTransactionDescription(description);
      tx.cleanDescription = cleaned;
      if (!merchant) tx.merchant = extractedMerchant;
    }

    if (amount !== undefined) {
      const parsedAmount = parsePositiveAmount(amount, 'Transaction amount');
      if (parsedAmount.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
      tx.amount = parsedAmount.value;
    }

    if (type !== undefined) {
      const validTypes = ['INCOME', 'EXPENSE'];
      if (!validTypes.includes(String(type).toUpperCase())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Type must be INCOME or EXPENSE.');
      }
      tx.type = String(type).toUpperCase() as 'INCOME' | 'EXPENSE';
    }

    if (paymentMethod !== undefined) tx.paymentMethod = String(paymentMethod) as any;
    if (merchant !== undefined) tx.merchant = String(merchant).trim();

    if (date !== undefined) {
      if (!isValidIsoDate(date)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid date format. Must be YYYY-MM-DD.');
      }
      tx.date = date;
    }

    if (notes !== undefined) tx.notes = notes;
    if (isRecurring !== undefined) tx.isRecurring = Boolean(isRecurring);

    if (accountId !== undefined) {
      tx.accountId = accountId || undefined;
      const acc = accountId ? await adapter.getAccountForUser(accountId, userId) : null;
      tx.accountName = acc?.name;
    }

    // Apply new balance impact
    const targetAccountId = tx.accountId;
    if (targetAccountId && (amount !== undefined || type !== undefined || accountId !== undefined)) {
      const newAccount = await adapter.getAccountForUser(targetAccountId, userId);
      if (newAccount) {
        const applyDelta = tx.type === 'INCOME' ? tx.amount : -tx.amount;
        newAccount.currentBalance += applyDelta;
        newAccount.availableBalance += applyDelta;
        await adapter.saveAccount(newAccount);
        db.accounts.set(newAccount.id, newAccount);
      }
    }

    if (category && category !== tx.category) {
      recordCategoryFeedback(tx.description, category);
      tx.category = category;
      tx.userCorrected = true;
    }

    tx.updatedAt = new Date().toISOString();

    // Re-anchor updated hash on blockchain
    const canonicalData = {
      id: tx.id,
      userId: tx.userId,
      date: tx.date,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      merchant: tx.merchant,
    };
    const newHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
    const onChainRecord = blockchainAdapter.recordTransactionHash(tx.id, newHash);

    tx.blockchainHash = newHash;
    tx.blockNumber = onChainRecord.blockNumber;
    tx.blockchainVerified = true;

    // Persist to database
    await adapter.execute(
      `UPDATE transactions SET
         description = $1, clean_description = $2, amount = $3, type = $4, category = $5,
         payment_method = $6, merchant = $7, date = $8, notes = $9, is_recurring = $10,
         account_id = $11, blockchain_hash = $12, block_number = $13, updated_at = $14
       WHERE id = $15 AND user_id = $16;`,
      [
        tx.description, tx.cleanDescription || tx.description, tx.amount, tx.type, tx.category,
        tx.paymentMethod, tx.merchant, tx.date, tx.notes || null, tx.isRecurring ? 1 : 0,
        tx.accountId || null, tx.blockchainHash, tx.blockNumber, tx.updatedAt,
        tx.id, tx.userId
      ]
    );

    // Keep memory cache updated
    db.transactions.set(tx.id, tx);

    return sendSuccess(res, 200, { transaction: tx }, 'Transaction updated and re-anchored on blockchain.');
  } catch (err: any) {
    return sendError(res, 500, 'TRANSACTION_UPDATE_ERROR', 'Failed to update transaction: ' + err.message);
  }
}

transactionsRouter.patch('/:id', handleUpdateTransaction);
transactionsRouter.put('/:id', handleUpdateTransaction);

// DELETE /api/transactions/:id - Delete transaction with balance reversion
transactionsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const txId = req.params.id;
    const adapter = getDatabaseAdapter();

    let tx = await adapter.getTransactionForUser(txId, userId);
    if (!tx) {
      const memTx = db.transactions.get(txId);
      if (memTx && memTx.userId === userId) {
        tx = memTx;
      }
    }

    if (!tx) {
      return sendError(res, 404, 'TRANSACTION_NOT_FOUND', 'Transaction not found or inaccessible.');
    }

    // Unlink receipt if linked
    if (tx.receiptId) {
      const rcpt = db.receipts.get(tx.receiptId);
      if (rcpt) {
        rcpt.linkedTransactionId = undefined;
        rcpt.processingStatus = 'UNLINKED';
      }
    }

    // Reverse balance impact on account
    if (tx.accountId) {
      const targetAccount = await adapter.getAccountForUser(tx.accountId, userId);
      if (targetAccount) {
        const revertDelta = tx.type === 'EXPENSE' ? tx.amount : -tx.amount;
        targetAccount.currentBalance += revertDelta;
        targetAccount.availableBalance += revertDelta;
        targetAccount.updatedAt = new Date().toISOString();
        await adapter.saveAccount(targetAccount);
        db.accounts.set(targetAccount.id, targetAccount);
      }
    }

    // Delete from database
    await adapter.deleteTransaction(txId);
    db.transactions.delete(txId);

    db.recordAuditEvent({
      userId,
      eventType: 'TRANSACTION_DELETED',
      description: `Removed ${tx.type} transaction of ₹${tx.amount} for "${tx.description}".`,
    });

    return sendSuccess(res, 200, { id: txId }, 'Transaction deleted.');
  } catch (err: any) {
    return sendError(res, 500, 'TRANSACTION_DELETE_ERROR', 'Failed to delete transaction: ' + err.message);
  }
});

// POST /api/transactions/import - Bulk import transactions
transactionsRouter.post('/import', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || '127.0.0.1';
    const rateCheck = uploadRateLimiter.check(`import:${ip}`);
    if (!rateCheck.allowed) {
      return sendError(res, 429, 'RATE_LIMIT_EXCEEDED', `Too many import requests. Please try again in ${rateCheck.retryAfterSeconds} seconds.`);
    }

    const userId = (req as any).userId;
    const { items = [] } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'No transaction records provided in import payload.');
    }

    const adapter = getDatabaseAdapter();
    const imported: Transaction[] = [];

    for (const raw of items) {
      const desc = raw.description || raw.desc || 'Imported Transaction';
      const amount = Math.abs(Number(raw.amount) || 100);
      const type = (raw.type || 'EXPENSE').toUpperCase() as 'INCOME' | 'EXPENSE';
      const date = raw.date || new Date().toISOString().split('T')[0];

      const { cleaned, extractedMerchant } = cleanTransactionDescription(desc);
      const prediction = predictTransactionCategory(cleaned, amount, type);
      const category = raw.category || prediction.predictedCategory;
      const merchant = raw.merchant || extractedMerchant;

      const txId = 'tx-imp-' + crypto.randomBytes(6).toString('hex');
      const canonicalData = {
        id: txId,
        userId,
        date,
        amount,
        type,
        category,
        merchant,
      };

      const hash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
      const onChainRecord = blockchainAdapter.recordTransactionHash(txId, hash);

      const newTx: Transaction = {
        id: txId,
        userId,
        accountId: raw.accountId || undefined,
        source: 'CSV_IMPORT',
        date,
        description: desc,
        cleanDescription: cleaned,
        amount,
        type,
        category,
        paymentMethod: (raw.paymentMethod as any) || 'Credit Card',
        merchant,
        notes: raw.notes || 'Imported statement record',
        aiConfidence: prediction.confidence,
        aiPredictedCategory: prediction.predictedCategory,
        blockchainHash: hash,
        blockNumber: onChainRecord.blockNumber,
        blockchainVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await adapter.execute(
        `INSERT INTO transactions (id, user_id, account_id, source, date, description, clean_description, amount, type, category, payment_method, merchant, notes, is_recurring, ai_confidence, ai_predicted_category, blockchain_hash, block_number, blockchain_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21);`,
        [
          newTx.id, newTx.userId, newTx.accountId || null, newTx.source, newTx.date, newTx.description,
          newTx.cleanDescription, newTx.amount, newTx.type, newTx.category, newTx.paymentMethod,
          newTx.merchant, newTx.notes || null, 0, newTx.aiConfidence || 90,
          newTx.aiPredictedCategory || newTx.category, newTx.blockchainHash, newTx.blockNumber,
          1, newTx.createdAt, newTx.updatedAt,
        ]
      ).catch(() => {});

      db.transactions.set(txId, newTx);
      imported.push(newTx);
    }

    db.recordAuditEvent({
      userId,
      eventType: 'TRANSACTIONS_IMPORTED',
      description: `Imported ${imported.length} transaction records with cryptographic verification.`,
    });

    return sendSuccess(res, 201, { count: imported.length, transactions: imported }, `Imported ${imported.length} transactions successfully.`);
  } catch (err: any) {
    return sendError(res, 500, 'TRANSACTION_IMPORT_ERROR', 'Failed to import transactions: ' + err.message);
  }
});
