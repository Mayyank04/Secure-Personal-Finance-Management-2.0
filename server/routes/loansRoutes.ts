/**
 * Debt & Loans REST API Routes
 * 
 * Provides:
 * - Loan registry (Personal, Education, Home, Vehicle, Credit Card, Other)
 * - Debt payoff calculator (Outstanding balance, EMI obligations, Interest totals, DTI)
 * - EMI Payment settlement with automatic transaction recording
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { Loan, LoanType, LoanStatus, Transaction } from '../types.js';
import { blockchainAdapter } from '../blockchain.js';

export const loansRouter = Router();

// GET /api/loans - List loans with full debt analytics
loansRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const debtSummary = db.getDebtSummary(userId);
    return res.json(debtSummary);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve debt and loan portfolio.' });
  }
});

// POST /api/loans - Create new loan / debt
loansRouter.post('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      lender,
      loanName,
      loanType = 'PERSONAL_LOAN',
      principal,
      outstandingBalance,
      interestRate,
      emi,
      dueDate,
      startDate,
      maturityDate,
      notes,
    } = req.body;

    if (!lender || !loanName || !principal || !outstandingBalance || !interestRate) {
      return res.status(400).json({ error: 'Lender, loan name, principal, balance, and interest rate are required.' });
    }

    const loanId = 'loan-' + crypto.randomBytes(6).toString('hex');
    const numPrincipal = Number(principal);
    const numBalance = Number(outstandingBalance);
    const numRate = Number(interestRate);

    // Auto calculate EMI if not provided using Standard Amortization Formula: P * r * (1+r)^n / ((1+r)^n - 1)
    let numEmi = Number(emi);
    if (!numEmi || isNaN(numEmi)) {
      const monthlyRate = numRate / 100 / 12;
      const tenureMonths = 60; // default 5 years
      numEmi = Math.round(
        (numBalance * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
          (Math.pow(1 + monthlyRate, tenureMonths) - 1)
      );
    }

    const newLoan: Loan = {
      id: loanId,
      userId,
      lender: lender.trim(),
      loanName: loanName.trim(),
      loanType: loanType as LoanType,
      principal: numPrincipal,
      outstandingBalance: numBalance,
      interestRate: numRate,
      emi: numEmi,
      dueDate: dueDate || '5th of every month',
      startDate: startDate || new Date().toISOString().split('T')[0],
      maturityDate: maturityDate || new Date(Date.now() + 5 * 365 * 86400000).toISOString().split('T')[0],
      status: 'ACTIVE',
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.loans.set(loanId, newLoan);
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'LOAN_ADDED',
      description: `Added ${loanType} loan "${newLoan.loanName}" from ${newLoan.lender} (Balance: ₹${newLoan.outstandingBalance}).`,
    });

    return res.status(201).json({ message: 'Loan registered successfully.', loan: newLoan });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create loan record.' });
  }
});

// PUT /api/loans/:id - Update loan
loansRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const loan = db.loans.get(req.params.id);

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found.' });
    }

    const { lender, loanName, loanType, principal, outstandingBalance, interestRate, emi, dueDate, startDate, maturityDate, status, notes } = req.body;

    if (lender) loan.lender = lender.trim();
    if (loanName) loan.loanName = loanName.trim();
    if (loanType) loan.loanType = loanType;
    if (principal !== undefined) loan.principal = Number(principal);
    if (outstandingBalance !== undefined) loan.outstandingBalance = Number(outstandingBalance);
    if (interestRate !== undefined) loan.interestRate = Number(interestRate);
    if (emi !== undefined) loan.emi = Number(emi);
    if (dueDate) loan.dueDate = dueDate;
    if (startDate) loan.startDate = startDate;
    if (maturityDate) loan.maturityDate = maturityDate;
    if (status) loan.status = status;
    if (notes !== undefined) loan.notes = notes;

    loan.updatedAt = new Date().toISOString();
    persistentSqlite.syncFromMemoryDb(db);

    return res.json({ message: 'Loan updated successfully.', loan });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update loan.' });
  }
});

// POST /api/loans/:id/payment - Record EMI payment
loansRouter.post('/:id/payment', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const loan = db.loans.get(req.params.id);

    if (!loan || loan.userId !== userId) {
      return res.status(404).json({ error: 'Loan not found.' });
    }

    const { paymentAmount, accountId, paymentMethod = 'Bank Transfer', notes } = req.body;
    const amount = Number(paymentAmount) || loan.emi;

    loan.outstandingBalance = Math.max(0, loan.outstandingBalance - amount);
    if (loan.outstandingBalance === 0) {
      loan.status = 'CLOSED';
    }
    loan.updatedAt = new Date().toISOString();

    // Create matching transaction
    const targetAccount = accountId ? db.accounts.get(accountId) : db.getUserAccounts(userId)[0];
    const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
    const canonicalData = {
      id: txId,
      userId,
      date: new Date().toISOString().split('T')[0],
      amount,
      type: 'EXPENSE' as const,
      category: 'Bills' as const,
      merchant: loan.lender,
    };

    const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
    const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

    const newTx: Transaction = {
      id: txId,
      userId,
      accountId: targetAccount?.id,
      accountName: targetAccount?.name,
      date: new Date().toISOString().split('T')[0],
      description: `EMI Payment: ${loan.loanName}`,
      cleanDescription: `Loan Payment - ${loan.lender}`,
      amount,
      type: 'EXPENSE',
      category: 'Bills',
      paymentMethod,
      merchant: loan.lender,
      notes: notes || `Loan installment payment for ${loan.loanName}`,
      source: 'MANUAL',
      aiConfidence: 100,
      aiPredictedCategory: 'Bills',
      userCorrected: false,
      blockchainHash,
      blockNumber: onChainRecord.blockNumber,
      blockchainVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.transactions.set(txId, newTx);

    if (targetAccount) {
      db.updateAccountBalance(targetAccount.id, amount, false);
    }
    
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'LOAN_PAYMENT_RECORDED',
      description: `Recorded EMI payment of ₹${amount} for "${loan.loanName}". Remaining balance: ₹${loan.outstandingBalance}.`,
    });

    return res.json({
      message: `Payment of ₹${amount} recorded for ${loan.loanName}.`,
      loan,
      transaction: newTx,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to record loan payment.' });
  }
});

// DELETE /api/loans/:id - Delete loan
loansRouter.delete('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const loan = db.loans.get(req.params.id);

  if (!loan || loan.userId !== userId) {
    return res.status(404).json({ error: 'Loan not found.' });
  }

  db.loans.delete(req.params.id);
  persistentSqlite.deleteLoan(req.params.id);
  persistentSqlite.syncFromMemoryDb(db);
  return res.json({ message: 'Loan deleted successfully.' });
});
