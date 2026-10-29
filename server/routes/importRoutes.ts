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

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

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

    const headerLine = lines[0];
    const commaCount = (headerLine.match(/,/g) || []).length;
    const semiCount = (headerLine.match(/;/g) || []).length;
    const tabCount = (headerLine.match(/\t/g) || []).length;
    const delimiter = tabCount > commaCount && tabCount > semiCount ? '\t' : semiCount > commaCount ? ';' : ',';

    const headers = parseCSVLine(headerLine, delimiter).map(h => h.trim());

    let mapping: ColumnMapping = {
      dateColumn: '',
      descriptionColumn: '',
    };

    if (customMapping) {
      mapping = { ...customMapping };
    } else {
      for (const h of headers) {
        const lower = h.toLowerCase();
        if (!mapping.dateColumn && (lower.includes('date') || lower.includes('time') || lower === 'txn_date')) {
          mapping.dateColumn = h;
        } else if (!mapping.descriptionColumn && (lower.includes('desc') || lower.includes('particular') || lower.includes('narration') || lower.includes('memo') || lower.includes('detail') || lower === 'payee')) {
          mapping.descriptionColumn = h;
        } else if (!mapping.amountColumn && (lower === 'amount' || lower === 'amt' || lower.includes('transaction amount'))) {
          mapping.amountColumn = h;
        } else if (!mapping.debitColumn && (lower.includes('debit') || lower.includes('withdrawal') || lower.includes('dr'))) {
          mapping.debitColumn = h;
        } else if (!mapping.creditColumn && (lower.includes('credit') || lower.includes('deposit') || lower.includes('cr'))) {
          mapping.creditColumn = h;
        } else if (!mapping.typeColumn && (lower === 'type' || lower.includes('txn_type'))) {
          mapping.typeColumn = h;
        } else if (!mapping.categoryColumn && (lower.includes('category') || lower.includes('tag'))) {
          mapping.categoryColumn = h;
        } else if (!mapping.methodColumn && (lower.includes('method') || lower.includes('mode') || lower.includes('channel'))) {
          mapping.methodColumn = h;
        }
      }
    }

    if (!mapping.dateColumn || !mapping.descriptionColumn) {
      return res.status(400).json({
        error: 'Could not auto-detect Date or Description columns. Please verify the CSV header.',
        detectedHeaders: headers,
        mapping,
      });
    }

    const userExistingTxs = db.getUserTransactions(userId);
    const previewRows: ParsedPreviewRow[] = [];
    let validCount = 0;
    let duplicateCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = parseCSVLine(line, delimiter);
      if (values.length < 2) continue;

      const rowMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowMap[h] = values[idx] || '';
      });

      const rawDate = rowMap[mapping.dateColumn] || '';
      const parsedDate = normalizeDate(rawDate);
      const rawDesc = rowMap[mapping.descriptionColumn] || '';
      const { cleaned, extractedMerchant } = cleanTransactionDescription(rawDesc);

      let parsedAmount = 0;
      let txType: 'INCOME' | 'EXPENSE' = 'EXPENSE';

      if (mapping.debitColumn && rowMap[mapping.debitColumn] && parseFloat(rowMap[mapping.debitColumn].replace(/[^0-9.-]/g, '')) > 0) {
        parsedAmount = Math.abs(parseFloat(rowMap[mapping.debitColumn].replace(/[^0-9.-]/g, '')));
        txType = 'EXPENSE';
      } else if (mapping.creditColumn && rowMap[mapping.creditColumn] && parseFloat(rowMap[mapping.creditColumn].replace(/[^0-9.-]/g, '')) > 0) {
        parsedAmount = Math.abs(parseFloat(rowMap[mapping.creditColumn].replace(/[^0-9.-]/g, '')));
        txType = 'INCOME';
      } else if (mapping.amountColumn && rowMap[mapping.amountColumn]) {
        const valStr = rowMap[mapping.amountColumn].replace(/[^0-9.-]/g, '');
        const valNum = parseFloat(valStr);
        if (!isNaN(valNum)) {
          if (valNum < 0) {
            parsedAmount = Math.abs(valNum);
            txType = 'EXPENSE';
          } else {
            parsedAmount = valNum;
            const explicitType = mapping.typeColumn ? rowMap[mapping.typeColumn]?.toLowerCase() : '';
            if (explicitType.includes('credit') || explicitType.includes('deposit') || explicitType.includes('income')) {
              txType = 'INCOME';
            } else if (explicitType.includes('debit') || explicitType.includes('expense')) {
              txType = 'EXPENSE';
            } else {
              txType = rawDesc.toLowerCase().includes('salary') || rawDesc.toLowerCase().includes('credit') ? 'INCOME' : 'EXPENSE';
            }
          }
        }
      }

      let isValid = true;
      let validationError: string | undefined;

      if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
        isValid = false;
        validationError = 'Missing or invalid transaction amount';
      } else if (!rawDesc || rawDesc.trim().length === 0) {
        isValid = false;
        validationError = 'Missing transaction description';
      }

      let isDuplicate = false;
      let duplicateReason: string | undefined;

      if (isValid) {
        const existingMatch = userExistingTxs.find(
          t => t.date === parsedDate && Math.abs(t.amount - parsedAmount) < 0.01 && t.type === txType
        );
        if (existingMatch) {
          isDuplicate = true;
          duplicateReason = `Exact match found on ${parsedDate} (₹${parsedAmount} - "${existingMatch.description}")`;
          duplicateCount++;
        } else {
          validCount++;
        }
      }

      const aiCat = predictTransactionCategory(rawDesc, parsedAmount, txType);

      let paymentMethod: PaymentMethod = 'Bank Transfer';
      const descLower = rawDesc.toLowerCase();
      if (descLower.includes('upi') || descLower.includes('@')) paymentMethod = 'UPI / Instant Transfer';
      else if (descLower.includes('card') || descLower.includes('pos')) paymentMethod = 'Debit Card';
      else if (descLower.includes('atm') || descLower.includes('cash')) paymentMethod = 'Cash';
      else if (descLower.includes('neft') || descLower.includes('rtgs') || descLower.includes('imps')) paymentMethod = 'Bank Transfer';

      previewRows.push({
        rowIndex: i,
        rawDate,
        parsedDate,
        rawDescription: rawDesc,
        cleanDescription: cleaned,
        rawAmount: String(rowMap[mapping.amountColumn || mapping.debitColumn || ''] || parsedAmount),
        parsedAmount: Math.round(parsedAmount * 100) / 100,
        type: txType,
        predictedCategory: aiCat.predictedCategory,
        aiConfidence: aiCat.confidence,
        paymentMethod,
        merchant: extractedMerchant,
        isDuplicate,
        duplicateReason,
        isValid,
        validationError,
      });
    }

    return res.json({
      detectedHeaders: headers,
      mapping,
      totalRows: previewRows.length,
      summary: {
        totalRows: previewRows.length,
        validCount,
        invalidCount: previewRows.length - validCount - duplicateCount,
        duplicateCount,
      },
      previewRows,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process statement CSV: ' + err.message });
  }
});

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
