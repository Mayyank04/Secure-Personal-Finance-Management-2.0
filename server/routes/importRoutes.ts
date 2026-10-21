/**
 * CSV / Bank Statement Import REST API Routes
 * 
 * Provides:
 * - Smart column detection for major bank CSV formats (HDFC, ICICI, SBI, Chase, Standard CSV)
 * - Parsing of Date, Description, Amount/Debit/Credit, and Category
 * - Duplicate detection against existing ledger
 * - AI classification & confidence scoring
 * - Two-phase preview and batch commit with blockchain anchoring
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { cleanTransactionDescription, predictTransactionCategory } from '../ai_ml.js';
import { blockchainAdapter } from '../blockchain.js';
import { Transaction, TransactionCategory, PaymentMethod } from '../types.js';

export const importRouter = Router();

interface ColumnMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  typeColumn?: string;
  categoryColumn?: string;
  methodColumn?: string;
}

interface ParsedPreviewRow {
  rowIndex: number;
  rawDate: string;
  parsedDate: string;
  rawDescription: string;
  cleanDescription: string;
  rawAmount: string;
  parsedAmount: number;
  type: 'INCOME' | 'EXPENSE';
  predictedCategory: TransactionCategory;
  aiConfidence: number;
  paymentMethod: PaymentMethod;
  merchant: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  isValid: boolean;
  validationError?: string;
}

function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const values: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      values.push(cur.trim().replace(/^["']|["']$/g, ''));
      cur = '';
    } else {
      cur += ch;
    }
  }
  values.push(cur.trim().replace(/^["']|["']$/g, ''));
  return values;
}

function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const cleaned = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY
  const mdyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// POST /api/import/csv-preview - Upload CSV string, auto-detect columns, return row preview
importRouter.post('/csv-preview', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { csvContent, customMapping } = req.body;

    if (!csvContent || typeof csvContent !== 'string' || csvContent.trim().length === 0) {
      return res.status(400).json({ error: 'Please provide CSV content to analyze.' });
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must contain at least a header row and one data row.' });
    }

    // Detect delimiter
    const sampleLine = lines[0];
    let delimiter = ',';
    if (sampleLine.includes('\t')) delimiter = '\t';
    else if (sampleLine.includes(';') && !sampleLine.includes(',')) delimiter = ';';

    const headers = parseCSVLine(lines[0], delimiter);
    const headersLower = headers.map(h => h.toLowerCase());

    // Auto-detect column mapping if not provided
    const mapping: ColumnMapping = customMapping || {
      dateColumn: headers[headersLower.findIndex(h => h.includes('date') || h.includes('txn') || h.includes('time'))] || headers[0],
      descriptionColumn: headers[headersLower.findIndex(h => h.includes('desc') || h.includes('narr') || h.includes('particular') || h.includes('detail') || h.includes('remark') || h.includes('merchant'))] || headers[1],
      amountColumn: headers[headersLower.findIndex(h => (h.includes('amount') || h.includes('amt') || h.includes('sum') || h.includes('value')) && !h.includes('debit') && !h.includes('credit'))],
      debitColumn: headers[headersLower.findIndex(h => h.includes('debit') || h.includes('dr') || h.includes('withdrawal'))],
      creditColumn: headers[headersLower.findIndex(h => h.includes('credit') || h.includes('cr') || h.includes('deposit'))],
      typeColumn: headers[headersLower.findIndex(h => h === 'type' || h.includes('cr/dr') || h.includes('txn type'))],
      categoryColumn: headers[headersLower.findIndex(h => h.includes('cat'))],
      methodColumn: headers[headersLower.findIndex(h => h.includes('method') || h.includes('mode') || h.includes('channel'))],
    };

    const dateIdx = headers.indexOf(mapping.dateColumn);
    const descIdx = headers.indexOf(mapping.descriptionColumn);
    const amtIdx = mapping.amountColumn ? headers.indexOf(mapping.amountColumn) : -1;
    const debitIdx = mapping.debitColumn ? headers.indexOf(mapping.debitColumn) : -1;
    const creditIdx = mapping.creditColumn ? headers.indexOf(mapping.creditColumn) : -1;
    const typeIdx = mapping.typeColumn ? headers.indexOf(mapping.typeColumn) : -1;
    const catIdx = mapping.categoryColumn ? headers.indexOf(mapping.categoryColumn) : -1;
    const methodIdx = mapping.methodColumn ? headers.indexOf(mapping.methodColumn) : -1;

    const existingTxs = db.getUserTransactions(userId);
    const previewRows: ParsedPreviewRow[] = [];

    let duplicateCount = 0;
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i], delimiter);
      if (cols.length === 0 || (cols.length === 1 && cols[0] === '')) continue;

      const rawDate = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : '';
      const rawDesc = descIdx >= 0 && cols[descIdx] ? cols[descIdx] : 'Unspecified Transaction';
      
      let amount = 0;
      let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
      let rawAmtStr = '';

      if (debitIdx >= 0 && cols[debitIdx] && parseFloat(cols[debitIdx].replace(/[^0-9.-]/g, '')) > 0) {
        amount = Math.abs(parseFloat(cols[debitIdx].replace(/[^0-9.-]/g, '')));
        type = 'EXPENSE';
        rawAmtStr = cols[debitIdx];
      } else if (creditIdx >= 0 && cols[creditIdx] && parseFloat(cols[creditIdx].replace(/[^0-9.-]/g, '')) > 0) {
        amount = Math.abs(parseFloat(cols[creditIdx].replace(/[^0-9.-]/g, '')));
        type = 'INCOME';
        rawAmtStr = cols[creditIdx];
      } else if (amtIdx >= 0 && cols[amtIdx]) {
        rawAmtStr = cols[amtIdx];
        const cleanAmtStr = cols[amtIdx].replace(/[^0-9.-]/g, '');
        const val = parseFloat(cleanAmtStr);
        if (!isNaN(val)) {
          amount = Math.abs(val);
          if (val < 0) {
            type = 'EXPENSE';
          } else if (typeIdx >= 0 && cols[typeIdx]) {
            const tStr = cols[typeIdx].toLowerCase();
            type = (tStr.includes('cr') || tStr.includes('inc') || tStr.includes('dep')) ? 'INCOME' : 'EXPENSE';
          } else {
            type = 'EXPENSE';
          }
        }
      }

      const parsedDate = normalizeDate(rawDate);
      const { cleaned, extractedMerchant } = cleanTransactionDescription(rawDesc);
      
      let category: TransactionCategory;
      let confidence = 85;

      if (catIdx >= 0 && cols[catIdx]) {
        category = cols[catIdx] as TransactionCategory;
        confidence = 98;
      } else {
        const prediction = predictTransactionCategory(cleaned, amount, type);
        category = prediction.predictedCategory;
        confidence = prediction.confidence;
      }

      let paymentMethod: PaymentMethod = 'Bank Transfer';
      if (methodIdx >= 0 && cols[methodIdx]) {
        const m = cols[methodIdx];
        if (m.toLowerCase().includes('card')) paymentMethod = 'Credit Card';
        else if (m.toLowerCase().includes('upi')) paymentMethod = 'UPI / Instant Transfer';
        else if (m.toLowerCase().includes('cash')) paymentMethod = 'Cash';
      }

      // Check validation
      let isValid = true;
      let validationError: string | undefined;

      if (isNaN(amount) || amount <= 0) {
        isValid = false;
        validationError = 'Missing or invalid numeric amount.';
        invalidCount++;
      } else {
        validCount++;
      }

      // Check duplicate
      const isDuplicate = existingTxs.some(
        tx =>
          tx.date === parsedDate &&
          Math.abs(tx.amount - amount) < 0.01 &&
          (tx.merchant.toLowerCase().includes(extractedMerchant.toLowerCase()) ||
            rawDesc.toLowerCase().includes(tx.description.toLowerCase()))
      );

      let duplicateReason: string | undefined;
      if (isDuplicate) {
        duplicateCount++;
        duplicateReason = `Matches existing record on ${parsedDate} (₹${amount.toLocaleString('en-IN')})`;
      }

      previewRows.push({
        rowIndex: i,
        rawDate,
        parsedDate,
        rawDescription: rawDesc,
        cleanDescription: cleaned,
        rawAmount: rawAmtStr,
        parsedAmount: amount,
        type,
        predictedCategory: category,
        aiConfidence: confidence,
        paymentMethod,
        merchant: extractedMerchant || rawDesc.slice(0, 30),
        isDuplicate,
        duplicateReason,
        isValid,
        validationError,
      });
    }

    return res.json({
      headers,
      detectedMapping: mapping,
      summary: {
        totalRows: previewRows.length,
        validCount,
        invalidCount,
        duplicateCount,
      },
      previewRows,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process statement CSV: ' + err.message });
  }
});

// POST /api/import/csv-confirm - Confirm and commit approved rows
importRouter.post('/csv-confirm', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { accountId, rows } = req.body as {
      accountId?: string;
      rows: ParsedPreviewRow[];
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No transaction rows provided for import.' });
    }

    let targetAccount = accountId ? db.accounts.get(accountId) : undefined;
    if (targetAccount && targetAccount.userId !== userId) {
      return res.status(403).json({ error: 'Access Denied: You cannot import transactions into another user’s financial account.' });
    }
    if (!targetAccount) {
      const userAccounts = db.getUserAccounts(userId);
      targetAccount = userAccounts[0];
    }

    const importedTxs: Transaction[] = [];

    for (const row of rows) {
      if (!row.isValid || row.parsedAmount <= 0) continue;

      const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
      const canonicalData = {
        id: txId,
        userId,
        date: row.parsedDate,
        amount: Number(row.parsedAmount),
        type: row.type,
        category: row.predictedCategory,
        merchant: row.merchant,
      };

      const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
      const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

      const newTx: Transaction = {
        id: txId,
        userId,
        accountId: targetAccount?.id,
        accountName: targetAccount?.name,
        date: row.parsedDate,
        description: row.rawDescription,
        cleanDescription: row.cleanDescription,
        amount: Number(row.parsedAmount),
        type: row.type,
        category: row.predictedCategory,
        paymentMethod: row.paymentMethod,
        merchant: row.merchant,
        notes: `Imported via CSV Bank Statement`,
        source: 'CSV_IMPORT',
        aiConfidence: row.aiConfidence,
        aiPredictedCategory: row.predictedCategory,
        userCorrected: false,
        blockchainHash,
        blockNumber: onChainRecord.blockNumber,
        blockchainVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.transactions.set(txId, newTx);
      importedTxs.push(newTx);

      if (targetAccount) {
        db.updateAccountBalance(targetAccount.id, newTx.amount, newTx.type === 'INCOME');
      }
    }

    db.recordAuditEvent({
      userId,
      eventType: 'CSV_STATEMENT_IMPORTED',
      description: `Imported ${importedTxs.length} transactions from CSV statement.`,
    });

    persistentSqlite.syncFromMemoryDb(db);

    return res.status(201).json({
      message: `Successfully imported ${importedTxs.length} statement rows and anchored to blockchain ledger.`,
      importedCount: importedTxs.length,
      transactions: importedTxs,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to import CSV statement records: ' + err.message });
  }
});
