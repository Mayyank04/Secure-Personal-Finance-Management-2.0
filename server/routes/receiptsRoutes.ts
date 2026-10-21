/**
 * Receipt Vault REST API Routes
 * 
 * Provides:
 * - Persistent receipt vault collection with OCR metadata
 * - Confidence scoring & low-confidence review requirement
 * - Image & OCR text re-parsing
 * - Automatic and manual linking with transactions
 * - Itemized breakdown & Tax extraction
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { parseReceiptData } from '../ai_ml.js';
import { blockchainAdapter } from '../blockchain.js';
import { ReceiptRecord, Transaction, TransactionCategory } from '../types.js';

export const receiptsRouter = Router();

// GET /api/receipts - List receipts for user
receiptsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const receipts = db.getUserReceipts(userId);

    // Attach linked transaction summary
    const enhanced = receipts.map(r => {
      const linkedTx = r.linkedTransactionId ? db.transactions.get(r.linkedTransactionId) : undefined;
      return {
        ...r,
        linkedTransaction: linkedTx
          ? {
              id: linkedTx.id,
              date: linkedTx.date,
              amount: linkedTx.amount,
              description: linkedTx.description,
              category: linkedTx.category,
            }
          : undefined,
      };
    });

    const needsReviewCount = receipts.filter(r => r.processingStatus === 'NEEDS_REVIEW').length;
    const linkedCount = receipts.filter(r => r.processingStatus === 'LINKED').length;

    return res.json({
      receipts: enhanced,
      summary: {
        totalReceipts: receipts.length,
        needsReviewCount,
        linkedCount,
        unlinkedCount: receipts.length - linkedCount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve receipts from vault.' });
  }
});

// POST /api/receipts - Scan & store new receipt
receiptsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { imageBase64, text, mimeType, manualMerchant, manualAmount, manualCategory } = req.body;

    if (!imageBase64 && !text && !manualMerchant) {
      return res.status(400).json({ error: 'Please provide either a receipt image or text to process.' });
    }

    let parsedResult;
    if (imageBase64 || text) {
      parsedResult = await parseReceiptData({ imageBase64, text, mimeType });
    } else {
      parsedResult = {
        merchant: manualMerchant || 'Merchant Receipt',
        date: new Date().toISOString().split('T')[0],
        totalAmount: Number(manualAmount) || 0,
        taxAmount: 0,
        category: (manualCategory as TransactionCategory) || 'Shopping',
        items: [],
        confidenceScore: 100,
        ocrRawText: 'Manual Receipt Entry',
      };
    }

    const receiptId = 'rcpt-' + crypto.randomBytes(6).toString('hex');
    const confidence = parsedResult.confidenceScore || 85;
    const status = confidence < 70 ? 'NEEDS_REVIEW' : 'UNLINKED';

    const newReceipt: ReceiptRecord = {
      id: receiptId,
      userId,
      merchant: parsedResult.merchant || 'Unidentified Merchant',
      date: parsedResult.date || new Date().toISOString().split('T')[0],
      amount: Number(parsedResult.totalAmount) || 0,
      tax: Number(parsedResult.taxAmount) || 0,
      items: parsedResult.items || [],
      ocrText: parsedResult.ocrRawText || text || '',
      ocrConfidence: confidence,
      category: (parsedResult.category as TransactionCategory) || 'Shopping',
      processingStatus: status,
      imageData: imageBase64 ? imageBase64.slice(0, 500000) : undefined,
      notes: confidence < 70 ? 'Low OCR confidence detected — please verify merchant and item totals.' : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.receipts.set(receiptId, newReceipt);

    db.recordAuditEvent({
      userId,
      eventType: 'RECEIPT_STORED',
      description: `Stored receipt for "${newReceipt.merchant}" (₹${newReceipt.amount}) in Receipt Vault.`,
    });

    persistentSqlite.syncFromMemoryDb(db);

    return res.status(201).json({
      message: 'Receipt processed and added to Vault.',
      receipt: newReceipt,
      needsReview: status === 'NEEDS_REVIEW',
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process receipt: ' + err.message });
  }
});

// GET /api/receipts/:id - Single receipt
receiptsRouter.get('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const rcpt = db.receipts.get(req.params.id);

  if (!rcpt || rcpt.userId !== userId) {
    return res.status(404).json({ error: 'Receipt not found in vault.' });
  }

  const linkedTx = rcpt.linkedTransactionId ? db.transactions.get(rcpt.linkedTransactionId) : undefined;
  return res.json({ receipt: rcpt, linkedTransaction: linkedTx });
});

// PUT /api/receipts/:id - Update receipt details
receiptsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const rcpt = db.receipts.get(req.params.id);

    if (!rcpt || rcpt.userId !== userId) {
      return res.status(404).json({ error: 'Receipt not found in vault.' });
    }

    const { merchant, date, amount, tax, items, category, notes, processingStatus } = req.body;

    if (merchant) rcpt.merchant = merchant.trim();
    if (date) rcpt.date = date;
    if (amount !== undefined) rcpt.amount = Number(amount);
    if (tax !== undefined) rcpt.tax = Number(tax);
    if (items) rcpt.items = items;
    if (category) rcpt.category = category;
    if (notes !== undefined) rcpt.notes = notes;
    if (processingStatus) rcpt.processingStatus = processingStatus;

    rcpt.updatedAt = new Date().toISOString();
    persistentSqlite.syncFromMemoryDb(db);

    return res.json({ message: 'Receipt updated successfully.', receipt: rcpt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update receipt.' });
  }
});

// POST /api/receipts/:id/link - Link receipt to transaction or create transaction from receipt
receiptsRouter.post('/:id/link', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const rcpt = db.receipts.get(req.params.id);

    if (!rcpt || rcpt.userId !== userId) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    const { transactionId, createNewTransaction, accountId, paymentMethod = 'Credit Card' } = req.body;

    let targetTx: Transaction | undefined;

    if (transactionId) {
      targetTx = db.transactions.get(transactionId);
      if (!targetTx || targetTx.userId !== userId) {
        return res.status(404).json({ error: 'Transaction not found to link.' });
      }
      targetTx.receiptId = rcpt.id;
      rcpt.linkedTransactionId = targetTx.id;
      rcpt.processingStatus = 'LINKED';
    } else if (createNewTransaction) {
      // Create new transaction from receipt metadata
      const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
      const canonicalData = {
        id: txId,
        userId,
        date: rcpt.date,
        amount: rcpt.amount,
        type: 'EXPENSE' as const,
        category: rcpt.category,
        merchant: rcpt.merchant,
      };

      const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
      const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

      const targetAccount = accountId ? db.accounts.get(accountId) : db.getUserAccounts(userId)[0];

      const newTx: Transaction = {
        id: txId,
        userId,
        accountId: targetAccount?.id,
        accountName: targetAccount?.name,
        date: rcpt.date,
        description: `${rcpt.merchant} - Receipt Verification`,
        cleanDescription: rcpt.merchant,
        amount: rcpt.amount,
        type: 'EXPENSE',
        category: rcpt.category,
        paymentMethod,
        merchant: rcpt.merchant,
        receiptId: rcpt.id,
        source: 'RECEIPT_SCAN',
        notes: `Auto-generated from Receipt Vault (${rcpt.id})`,
        aiConfidence: rcpt.ocrConfidence,
        aiPredictedCategory: rcpt.category,
        userCorrected: false,
        blockchainHash,
        blockNumber: onChainRecord.blockNumber,
        blockchainVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.transactions.set(txId, newTx);
      if (targetAccount) {
        db.updateAccountBalance(targetAccount.id, newTx.amount, false);
      }

      rcpt.linkedTransactionId = txId;
      rcpt.processingStatus = 'LINKED';
      targetTx = newTx;
    }

    rcpt.updatedAt = new Date().toISOString();

    db.recordAuditEvent({
      userId,
      eventType: 'RECEIPT_LINKED',
      description: `Linked receipt ${rcpt.id} to transaction ${targetTx?.id}.`,
    });

    persistentSqlite.syncFromMemoryDb(db);

    return res.json({
      message: 'Receipt linked to transaction successfully.',
      receipt: rcpt,
      transaction: targetTx,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to link receipt.' });
  }
});

// POST /api/receipts/:id/unlink - Unlink receipt from transaction
receiptsRouter.post('/:id/unlink', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const rcpt = db.receipts.get(req.params.id);

  if (!rcpt || rcpt.userId !== userId) {
    return res.status(404).json({ error: 'Receipt not found.' });
  }

  if (rcpt.linkedTransactionId) {
    const tx = db.transactions.get(rcpt.linkedTransactionId);
    if (tx) tx.receiptId = undefined;
  }

  rcpt.linkedTransactionId = undefined;
  rcpt.processingStatus = 'UNLINKED';
  rcpt.updatedAt = new Date().toISOString();

  return res.json({ message: 'Receipt unlinked successfully.', receipt: rcpt });
});

// POST /api/receipts/:id/reprocess - Reprocess OCR on receipt
receiptsRouter.post('/:id/reprocess', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const rcpt = db.receipts.get(req.params.id);

    if (!rcpt || rcpt.userId !== userId) {
      return res.status(404).json({ error: 'Receipt not found.' });
    }

    const scanResult = await parseReceiptData({
      text: rcpt.ocrText,
      imageBase64: rcpt.imageData,
    });

    rcpt.merchant = scanResult.merchant || rcpt.merchant;
    rcpt.date = scanResult.date || rcpt.date;
    rcpt.amount = scanResult.totalAmount || rcpt.amount;
    rcpt.tax = scanResult.taxAmount || rcpt.tax;
    rcpt.items = scanResult.items || rcpt.items;
    rcpt.ocrConfidence = scanResult.confidence || 85;
    rcpt.category = (scanResult.category as TransactionCategory) || rcpt.category;
    rcpt.processingStatus = rcpt.ocrConfidence < 70 ? 'NEEDS_REVIEW' : (rcpt.linkedTransactionId ? 'LINKED' : 'UNLINKED');
    rcpt.updatedAt = new Date().toISOString();

    return res.json({ message: 'Receipt reprocessed with AI OCR parser.', receipt: rcpt });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reprocess receipt.' });
  }
});

// DELETE /api/receipts/:id - Delete receipt
receiptsRouter.delete('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const rcpt = db.receipts.get(req.params.id);

  if (!rcpt || rcpt.userId !== userId) {
    return res.status(404).json({ error: 'Receipt not found.' });
  }

  if (rcpt.linkedTransactionId) {
    const tx = db.transactions.get(rcpt.linkedTransactionId);
    if (tx) tx.receiptId = undefined;
  }

  db.receipts.delete(req.params.id);
  persistentSqlite.deleteReceipt(req.params.id);
  persistentSqlite.syncFromMemoryDb(db);
  return res.json({ message: 'Receipt deleted from Vault.' });
});
