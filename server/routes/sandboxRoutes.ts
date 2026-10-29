import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import {
  AVAILABLE_SANDBOX_PROVIDERS,
  DemoBankAdapter,
  DemoUPIAdapter,
  SyncPreviewItem,
} from '../financialAdapters.js';
import { blockchainAdapter } from '../blockchain.js';
import { Transaction } from '../types.js';

export const sandboxRouter = Router();

sandboxRouter.get('/providers', (req: Request, res: Response) => {
  return res.json({
    disclaimer: 'SYNTHETIC / DEMO ENVIRONMENT: No real banking credentials or live funds are involved.',
    providers: AVAILABLE_SANDBOX_PROVIDERS,
  });
});

sandboxRouter.post('/connect', (req: Request, res: Response) => {
  const { providerId } = req.body;
  const provider = AVAILABLE_SANDBOX_PROVIDERS.find(p => p.id === providerId);

  if (!provider) {
    return res.status(404).json({ error: 'Sandbox provider not found.' });
  }

  const connectionToken = 'sbx-auth-' + crypto.randomBytes(12).toString('hex');
  return res.json({
    message: `Connected to synthetic sandbox for ${provider.name}.`,
    isSyntheticDemo: true,
    connectionToken,
    provider,
    authorizedAt: new Date().toISOString(),
  });
});

sandboxRouter.get('/sync/:providerId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { providerId } = req.params;

    let adapter;
    if (providerId.includes('upi')) {
      adapter = new DemoUPIAdapter(providerId);
    } else {
      adapter = new DemoBankAdapter(providerId);
    }

    const existingUserTxs = db.getUserTransactions(userId).map(t => ({
      date: t.date,
      amount: t.amount,
      merchant: t.merchant,
      description: t.description,
    }));

    const result = await adapter.fetchTransactions('2026-08-01', '2026-08-31', existingUserTxs);

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to sync with sandbox provider: ' + err.message });
  }
});

sandboxRouter.post('/import', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      accountId,
      accountName = 'Sandbox Financial Account',
      transactions,
    } = req.body as {
      accountId?: string;
      accountName?: string;
      transactions: SyncPreviewItem[];
    };

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Please select at least one transaction to import.' });
    }

    let targetAccount = accountId ? db.accounts.get(accountId) : undefined;
    if (!targetAccount) {
      const userAccounts = db.getUserAccounts(userId);
      targetAccount = userAccounts[0];
    }

    const importedTransactions: Transaction[] = [];

    for (const item of transactions) {
      const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
      const canonicalData = {
        id: txId,
        userId,
        date: item.date,
        amount: Number(item.amount),
        type: item.type,
        category: item.predictedCategory,
        merchant: item.merchant,
      };

      const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
      const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

      const newTx: Transaction = {
        id: txId,
        userId,
        accountId: targetAccount?.id,
        accountName: targetAccount?.name || accountName,
        date: item.date,
        description: item.rawDescription,
        cleanDescription: item.cleanDescription,
        amount: Number(item.amount),
        type: item.type,
        category: item.predictedCategory,
        paymentMethod: item.paymentMethod,
        merchant: item.merchant,
        notes: `Imported via Synthetic Sandbox (${item.externalId})`,
        source: item.paymentMethod.includes('UPI') ? 'SANDBOX_UPI' : 'SANDBOX_BANK',
        aiConfidence: item.aiConfidence,
        aiPredictedCategory: item.predictedCategory,
        userCorrected: false,
        blockchainHash,
        blockNumber: onChainRecord.blockNumber,
        blockchainVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.transactions.set(txId, newTx);
      importedTransactions.push(newTx);

      if (targetAccount) {
        db.updateAccountBalance(targetAccount.id, newTx.amount, newTx.type === 'INCOME');
      }
    }

    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'SANDBOX_TRANSACTIONS_IMPORTED',
      description: `Imported ${importedTransactions.length} synthetic transactions from Sandbox into ledger.`,
    });

    return res.status(201).json({
      message: `Successfully imported ${importedTransactions.length} transactions and anchored them to the permissioned blockchain ledger.`,
      importedCount: importedTransactions.length,
      transactions: importedTransactions,
      isSyntheticDemo: true,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to import sandbox transactions.' });
  }
});
