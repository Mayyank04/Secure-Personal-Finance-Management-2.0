import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { blockchainAdapter } from '../blockchain.js';
import { sendSuccess, sendError, parsePositiveAmount, parseNonNegativeAmount, isValidIsoDate } from '../apiResponse.js';
import { Loan, LoanType, LoanStatus, Transaction } from '../types.js';

export const loansRouter = Router();

loansRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let loans: Loan[] = [];
    try {
      const rows = await adapter.query(`SELECT * FROM loans WHERE user_id = $1 ORDER BY created_at DESC;`, [userId]);
      loans = rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        loanName: r.name,
        lender: r.lender,
        loanType: 'PERSONAL_LOAN' as LoanType,
        principal: Number(r.principal),
        outstandingBalance: Number(r.outstanding_balance),
        interestRate: Number(r.interest_rate),
        emi: Number(r.emi_amount),
        dueDate: r.due_date,
        startDate: r.created_at ? r.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        maturityDate: new Date(Date.now() + 5 * 365 * 86400000).toISOString().split('T')[0],
        tenureMonths: Number(r.tenure_months || 60),
        remainingMonths: Number(r.remaining_tenure_months || 48),
        status: r.status as LoanStatus,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      loans = Array.from(db.loans.values()).filter(l => l.userId === userId);
    }

    if (loans.length === 0) {
      loans = Array.from(db.loans.values()).filter(l => l.userId === userId);
    }

    const totalPrincipal = loans.reduce((s, l) => s + l.principal, 0);
    const totalOutstanding = loans.reduce((s, l) => s + l.outstandingBalance, 0);
    const totalMonthlyEmi = loans.filter(l => l.status === 'ACTIVE').reduce((s, l) => s + l.emi, 0);

    const activeLoans = loans.filter(l => l.status === 'ACTIVE');
    const weightedInterestRate = activeLoans.length > 0 && totalOutstanding > 0
      ? Math.round((activeLoans.reduce((s, l) => s + l.interestRate * l.outstandingBalance, 0) / totalOutstanding) * 10) / 10
      : 10.5;

    const profile = db.profiles.get(userId);
    const monthlyIncome = 120000;
    const debtToIncomeRatio = Math.round((totalMonthlyEmi / monthlyIncome) * 100);

    return sendSuccess(res, 200, {
      loans,
      summary: {
        totalPrincipal,
        totalOutstanding,
        totalMonthlyEmi,
        weightedInterestRate,
        activeLoansCount: activeLoans.length,
        debtToIncomeRatio,
      },
    });
  } catch (err: any) {
    return sendError(res, 500, 'LOANS_FETCH_ERROR', 'Failed to retrieve debt and loan portfolio: ' + err.message);
  }
});

loansRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const loanId = req.params.id;
    const adapter = getDatabaseAdapter();

    let loan = await adapter.getLoanForUser(loanId, userId);
    if (!loan) {
      const memLoan = db.loans.get(loanId);
      if (memLoan && memLoan.userId === userId) {
        loan = memLoan;
      }
    }

    if (!loan) {
      return sendError(res, 404, 'LOAN_NOT_FOUND', 'Loan record not found or inaccessible.');
    }

    return sendSuccess(res, 200, { loan });
  } catch (err: any) {
    return sendError(res, 500, 'LOAN_FETCH_ERROR', 'Failed to retrieve loan: ' + err.message);
  }
});

loansRouter.post('/', async (req: Request, res: Response) => {
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
      dueDate = '5th of every month',
      startDate,
      maturityDate,
      notes,
    } = req.body;

    if (!lender || typeof lender !== 'string' || lender.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Lender name is required.');
    }
    if (!loanName || typeof loanName !== 'string' || loanName.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Loan title / name is required.');
    }

    const parsedPrincipal = parsePositiveAmount(principal, 'Principal amount');
    if (parsedPrincipal.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedPrincipal.error);

    const parsedBalance = parseNonNegativeAmount(outstandingBalance, 'Outstanding balance');
    if (parsedBalance.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedBalance.error);

    const parsedRate = parseNonNegativeAmount(interestRate, 'Interest rate');
    if (parsedRate.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedRate.error);

    let numEmi = Number(emi);
    if (!numEmi || isNaN(numEmi) || numEmi <= 0) {
      const monthlyRate = parsedRate.value / 100 / 12;
      const tenureMonths = 60;
      numEmi = Math.round(
        (parsedBalance.value * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
          (Math.pow(1 + monthlyRate, tenureMonths) - 1)
      );
    }

    const loanId = 'loan-' + crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    const newLoan: Loan = {
      id: loanId,
      userId,
      lender: lender.trim(),
      loanName: loanName.trim(),
      loanType: loanType as LoanType,
      principal: parsedPrincipal.value,
      outstandingBalance: parsedBalance.value,
      interestRate: parsedRate.value,
      emi: numEmi,
      dueDate,
      startDate: startDate && isValidIsoDate(startDate) ? startDate : now.split('T')[0],
      maturityDate: maturityDate && isValidIsoDate(maturityDate) ? maturityDate : new Date(Date.now() + 5 * 365 * 86400000).toISOString().split('T')[0],
      tenureMonths: 60,
      remainingMonths: 48,
      status: 'ACTIVE',
      notes: notes || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const adapter = getDatabaseAdapter();
    await adapter.saveLoan(newLoan);

    db.loans.set(loanId, newLoan);

    db.recordAuditEvent({
      userId,
      eventType: 'LOAN_ADDED',
      description: `Added ${loanType} loan "${newLoan.loanName}" from ${newLoan.lender} (Balance: ₹${newLoan.outstandingBalance}).`,
    });

    return sendSuccess(res, 201, { loan: newLoan }, 'Loan registered successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'LOAN_CREATE_ERROR', 'Failed to create loan record: ' + err.message);
  }
});

async function handleUpdateLoan(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const loanId = req.params.id;
    const adapter = getDatabaseAdapter();

    let loan = await adapter.getLoanForUser(loanId, userId);
    if (!loan) {
      const memLoan = db.loans.get(loanId);
      if (memLoan && memLoan.userId === userId) {
        loan = memLoan;
      }
    }

    if (!loan) {
      return sendError(res, 404, 'LOAN_NOT_FOUND', 'Loan record not found or inaccessible.');
    }

    const { lender, loanName, loanType, principal, outstandingBalance, interestRate, emi, dueDate, startDate, maturityDate, status, notes } = req.body;

    if (lender !== undefined) {
      if (typeof lender !== 'string' || lender.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Lender name cannot be empty.');
      }
      loan.lender = lender.trim();
    }

    if (loanName !== undefined) {
      if (typeof loanName !== 'string' || loanName.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Loan title cannot be empty.');
      }
      loan.loanName = loanName.trim();
    }

    if (loanType !== undefined) loan.loanType = loanType as LoanType;

    if (principal !== undefined) {
      const parsed = parsePositiveAmount(principal, 'Principal amount');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      loan.principal = parsed.value;
    }

    if (outstandingBalance !== undefined) {
      const parsed = parseNonNegativeAmount(outstandingBalance, 'Outstanding balance');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      loan.outstandingBalance = parsed.value;
    }

    if (interestRate !== undefined) {
      const parsed = parseNonNegativeAmount(interestRate, 'Interest rate');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      loan.interestRate = parsed.value;
    }

    if (emi !== undefined) {
      const parsed = parsePositiveAmount(emi, 'EMI amount');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      loan.emi = parsed.value;
    }

    if (dueDate !== undefined) loan.dueDate = String(dueDate);
    if (startDate !== undefined) loan.startDate = String(startDate);
    if (maturityDate !== undefined) loan.maturityDate = String(maturityDate);

    if (status !== undefined) {
      if (!['ACTIVE', 'PAID_OFF', 'CLOSED', 'DEFAULTED'].includes(status)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Status must be ACTIVE, PAID_OFF, CLOSED, or DEFAULTED.');
      }
      loan.status = status as LoanStatus;
    }

    if (notes !== undefined) loan.notes = notes;

    loan.updatedAt = new Date().toISOString();

    await adapter.saveLoan(loan);

    db.loans.set(loanId, loan);

    db.recordAuditEvent({
      userId,
      eventType: 'LOAN_UPDATED',
      description: `Updated details for loan "${loan.loanName}".`,
    });

    return sendSuccess(res, 200, { loan }, 'Loan updated successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'LOAN_UPDATE_ERROR', 'Failed to update loan: ' + err.message);
  }
}

loansRouter.put('/:id', handleUpdateLoan);
loansRouter.patch('/:id', handleUpdateLoan);

loansRouter.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const loanId = req.params.id;
    const adapter = getDatabaseAdapter();

    let loan = await adapter.getLoanForUser(loanId, userId);
    if (!loan) {
      const memLoan = db.loans.get(loanId);
      if (memLoan && memLoan.userId === userId) {
        loan = memLoan;
      }
    }

    if (!loan) {
      return sendError(res, 404, 'LOAN_NOT_FOUND', 'Loan record not found or inaccessible.');
    }

    const { paymentAmount, accountId, paymentMethod = 'Bank Transfer', notes } = req.body;
    const parsedAmount = paymentAmount !== undefined
      ? parsePositiveAmount(paymentAmount, 'Payment amount')
      : { value: loan.emi };

    if (parsedAmount.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
    }

    const amount = parsedAmount.value;
    loan.outstandingBalance = Math.max(0, loan.outstandingBalance - amount);
    if (loan.outstandingBalance === 0) {
      loan.status = 'CLOSED';
    }
    loan.updatedAt = new Date().toISOString();

    let targetAccount = accountId ? await adapter.getAccountForUser(accountId, userId) : null;
    if (!targetAccount) {
      const accounts = await adapter.query(`SELECT * FROM accounts WHERE user_id = $1 LIMIT 1;`, [userId]);
      if (accounts.length > 0) targetAccount = accounts[0];
      else targetAccount = db.getUserAccounts(userId)[0] || null;
    }

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

    if (targetAccount) {
      await adapter.payLoanEmiAtomic({
        loan,
        transaction: newTx,
        account: targetAccount,
        newBalance: targetAccount.currentBalance - amount,
        auditEvent: {
          id: 'aud-' + crypto.randomBytes(6).toString('hex'),
          userId,
          eventType: 'LOAN_PAYMENT_RECORDED',
          description: `Recorded EMI payment of ₹${amount} for "${loan.loanName}". Remaining balance: ₹${loan.outstandingBalance}.`,
          timestamp: new Date().toISOString(),
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.headers['user-agent'] as string) || 'Modern Web Client',
          blockchainTxId: blockchainHash,
        },
        ledgerRecord: onChainRecord,
      }).catch(err => {
        console.error('[Loan Payment] Atomic persistence warning:', err);
      });

      db.transactions.set(txId, newTx);
      db.updateAccountBalance(targetAccount.id, amount, false);
    } else {
      await adapter.saveLoan(loan);
    }

    db.loans.set(loan.id, loan);

    return sendSuccess(
      res,
      200,
      { loan, transaction: newTx },
      `Payment of ₹${amount} recorded for ${loan.loanName}.`
    );
  } catch (err: any) {
    return sendError(res, 500, 'LOAN_PAYMENT_ERROR', 'Failed to record loan payment: ' + err.message);
  }
});

loansRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const loanId = req.params.id;
    const adapter = getDatabaseAdapter();

    let loan = await adapter.getLoanForUser(loanId, userId);
    if (!loan) {
      const memLoan = db.loans.get(loanId);
      if (memLoan && memLoan.userId === userId) {
        loan = memLoan;
      }
    }

    if (!loan) {
      return sendError(res, 404, 'LOAN_NOT_FOUND', 'Loan record not found or inaccessible.');
    }

    await adapter.deleteLoan(loanId);
    db.loans.delete(loanId);

    db.recordAuditEvent({
      userId,
      eventType: 'LOAN_DELETED',
      description: `Deleted loan "${loan.loanName}".`,
    });

    return sendSuccess(res, 200, { id: loanId }, 'Loan deleted successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'LOAN_DELETE_ERROR', 'Failed to delete loan: ' + err.message);
  }
});
