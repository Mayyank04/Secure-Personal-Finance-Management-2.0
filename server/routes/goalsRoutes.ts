import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { blockchainAdapter } from '../blockchain.js';
import { sendSuccess, sendError, parsePositiveAmount, parseNonNegativeAmount, isValidIsoDate } from '../apiResponse.js';
import { SavingsGoal, GoalPriority, Transaction } from '../types.js';

export const goalsRouter = Router();

function computeGoalMetrics(goal: SavingsGoal): SavingsGoal & { progressPercent: number; remainingAmount: number } {
  const remainingAmount = Math.max(0, goal.targetAmount - goal.currentAmount);
  const progressPercent = goal.targetAmount > 0
    ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
    : 0;

  return {
    ...goal,
    remainingAmount,
    progressPercent,
  };
}

goalsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let list: SavingsGoal[] = [];
    try {
      const rows = await adapter.query(`SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC;`, [userId]);
      list = rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        targetAmount: Number(r.target_amount),
        currentAmount: Number(r.current_amount),
        targetDate: r.target_date || undefined,
        monthlyContribution: Number(r.monthly_contribution || 0),
        priority: r.priority || 'MEDIUM',
        category: r.category || undefined,
        estimatedCompletionDate: r.estimated_completion_date || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      list = Array.from(db.goals.values()).filter(g => g.userId === userId);
    }

    if (list.length === 0) {
      list = Array.from(db.goals.values()).filter(g => g.userId === userId);
    }

    const goalsWithMetrics = list.map(computeGoalMetrics);
    return sendSuccess(res, 200, { goals: goalsWithMetrics });
  } catch (err: any) {
    return sendError(res, 500, 'GOAL_FETCH_ERROR', 'Failed to retrieve goals: ' + err.message);
  }
});

goalsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const goalId = req.params.id;
    const adapter = getDatabaseAdapter();

    let goal = await adapter.getGoalForUser(goalId, userId);
    if (!goal) {
      const memGoal = db.goals.get(goalId);
      if (memGoal && memGoal.userId === userId) {
        goal = memGoal;
      }
    }

    if (!goal) {
      return sendError(res, 404, 'GOAL_NOT_FOUND', 'Savings goal not found or inaccessible.');
    }

    const goalWithMetrics = computeGoalMetrics(goal);
    return sendSuccess(res, 200, { goal: goalWithMetrics });
  } catch (err: any) {
    return sendError(res, 500, 'GOAL_FETCH_ERROR', 'Failed to retrieve savings goal: ' + err.message);
  }
});

goalsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      title,
      targetAmount,
      currentAmount = 0,
      targetDate,
      monthlyContribution = 5000,
      priority = 'MEDIUM',
      category = 'General Savings',
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Goal title is required.');
    }

    const parsedTarget = parsePositiveAmount(targetAmount, 'Target amount');
    if (parsedTarget.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedTarget.error);
    }

    const parsedCurrent = parseNonNegativeAmount(currentAmount, 'Current amount');
    if (parsedCurrent.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedCurrent.error);
    }

    const parsedMonthly = parseNonNegativeAmount(monthlyContribution, 'Monthly contribution');
    if (parsedMonthly.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedMonthly.error);
    }

    const validPriorities: GoalPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    const finalPriority = validPriorities.includes(priority) ? priority : 'MEDIUM';

    const goalId = 'goal-' + crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    const remaining = Math.max(0, parsedTarget.value - parsedCurrent.value);
    const monthsNeeded = parsedMonthly.value > 0 ? Math.ceil(remaining / parsedMonthly.value) : 12;
    const estDate = new Date();
    estDate.setMonth(estDate.getMonth() + monthsNeeded);
    const defaultTargetDate = targetDate && isValidIsoDate(targetDate) ? targetDate : estDate.toISOString().split('T')[0];

    const newGoal: SavingsGoal = {
      id: goalId,
      userId,
      title: title.trim(),
      targetAmount: parsedTarget.value,
      currentAmount: parsedCurrent.value,
      targetDate: defaultTargetDate,
      monthlyContribution: parsedMonthly.value,
      priority: finalPriority,
      category: category.trim(),
      estimatedCompletionDate: estDate.toISOString().split('T')[0],
      createdAt: now,
      updatedAt: now,
    };

    const adapter = getDatabaseAdapter();
    await adapter.saveGoal(newGoal);
    db.goals.set(goalId, newGoal);

    db.recordAuditEvent({
      userId,
      eventType: 'GOAL_CREATED',
      description: `Created savings goal "${newGoal.title}" (Target: ₹${newGoal.targetAmount}).`,
    });

    const goalWithMetrics = computeGoalMetrics(newGoal);
    return sendSuccess(res, 201, { goal: goalWithMetrics }, 'Savings goal created.');
  } catch (err: any) {
    return sendError(res, 500, 'GOAL_CREATE_ERROR', 'Failed to create savings goal: ' + err.message);
  }
});

async function handleUpdateGoal(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const goalId = req.params.id;
    const adapter = getDatabaseAdapter();

    let goal = await adapter.getGoalForUser(goalId, userId);
    if (!goal) {
      const memGoal = db.goals.get(goalId);
      if (memGoal && memGoal.userId === userId) {
        goal = memGoal;
      }
    }

    if (!goal) {
      return sendError(res, 404, 'GOAL_NOT_FOUND', 'Savings goal not found or inaccessible.');
    }

    const { title, targetAmount, currentAmount, targetDate, monthlyContribution, priority, category } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Goal title cannot be empty.');
      }
      goal.title = title.trim();
    }

    if (targetAmount !== undefined) {
      const parsed = parsePositiveAmount(targetAmount, 'Target amount');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      goal.targetAmount = parsed.value;
    }

    if (currentAmount !== undefined) {
      const parsed = parseNonNegativeAmount(currentAmount, 'Current amount');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      goal.currentAmount = parsed.value;
    }

    if (monthlyContribution !== undefined) {
      const parsed = parseNonNegativeAmount(monthlyContribution, 'Monthly contribution');
      if (parsed.error) return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      goal.monthlyContribution = parsed.value;
    }

    if (targetDate !== undefined) {
      if (!isValidIsoDate(targetDate)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid target date format. Must be YYYY-MM-DD.');
      }
      goal.targetDate = targetDate;
    }

    if (priority !== undefined) {
      const validPriorities: GoalPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
      if (!validPriorities.includes(priority)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Priority must be LOW, MEDIUM, or HIGH.');
      }
      goal.priority = priority;
    }

    if (category !== undefined) {
      goal.category = String(category).trim();
    }

    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    if (goal.monthlyContribution && goal.monthlyContribution > 0) {
      const monthsNeeded = Math.ceil(remaining / goal.monthlyContribution);
      const estDate = new Date();
      estDate.setMonth(estDate.getMonth() + monthsNeeded);
      goal.estimatedCompletionDate = estDate.toISOString().split('T')[0];
    }

    goal.updatedAt = new Date().toISOString();

    await adapter.saveGoal(goal);
    db.goals.set(goalId, goal);

    db.recordAuditEvent({
      userId,
      eventType: 'GOAL_UPDATED',
      description: `Updated savings goal "${goal.title}".`,
    });

    const goalWithMetrics = computeGoalMetrics(goal);
    return sendSuccess(res, 200, { goal: goalWithMetrics }, 'Savings goal updated.');
  } catch (err: any) {
    return sendError(res, 500, 'GOAL_UPDATE_ERROR', 'Failed to update savings goal: ' + err.message);
  }
}

goalsRouter.patch('/:id', handleUpdateGoal);
goalsRouter.put('/:id', handleUpdateGoal);

goalsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const goalId = req.params.id;
    const adapter = getDatabaseAdapter();

    let goal = await adapter.getGoalForUser(goalId, userId);
    if (!goal) {
      const memGoal = db.goals.get(goalId);
      if (memGoal && memGoal.userId === userId) {
        goal = memGoal;
      }
    }

    if (!goal) {
      return sendError(res, 404, 'GOAL_NOT_FOUND', 'Savings goal not found or inaccessible.');
    }

    await adapter.deleteGoal(goalId);
    db.goals.delete(goalId);

    db.recordAuditEvent({
      userId,
      eventType: 'GOAL_DELETED',
      description: `Removed savings goal "${goal.title}".`,
    });

    return sendSuccess(res, 200, { id: goalId }, 'Savings goal deleted.');
  } catch (err: any) {
    return sendError(res, 500, 'GOAL_DELETE_ERROR', 'Failed to delete savings goal: ' + err.message);
  }
});

goalsRouter.post('/:id/contribute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const goalId = req.params.id;
    const adapter = getDatabaseAdapter();

    let goal = await adapter.getGoalForUser(goalId, userId);
    if (!goal) {
      const memGoal = db.goals.get(goalId);
      if (memGoal && memGoal.userId === userId) {
        goal = memGoal;
      }
    }

    if (!goal) {
      return sendError(res, 404, 'GOAL_NOT_FOUND', 'Savings goal not found or inaccessible.');
    }

    const { amount, accountId } = req.body;
    const parsedAmount = parsePositiveAmount(amount, 'Contribution amount');
    if (parsedAmount.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
    }

    goal.currentAmount += parsedAmount.value;
    goal.updatedAt = new Date().toISOString();

    if (accountId) {
      const acc = await adapter.getAccountForUser(accountId, userId);
      if (acc) {
        const txId = 'tx-' + crypto.randomBytes(8).toString('hex');
        const canonicalData = {
          id: txId,
          userId,
          date: new Date().toISOString().split('T')[0],
          amount: parsedAmount.value,
          type: 'EXPENSE' as const,
          category: 'Savings' as const,
          merchant: `Goal: ${goal.title}`,
        };
        const blockchainHash = blockchainAdapter.computeCanonicalTransactionHash(canonicalData);
        const onChainRecord = blockchainAdapter.recordTransactionHash(txId, blockchainHash);

        const newTx: Transaction = {
          id: txId,
          userId,
          accountId: acc.id,
          accountName: acc.name,
          date: new Date().toISOString().split('T')[0],
          description: `Savings Contribution: ${goal.title}`,
          cleanDescription: `Goal Contribution - ${goal.title}`,
          amount: parsedAmount.value,
          type: 'EXPENSE',
          category: 'Investment',
          paymentMethod: 'Bank Transfer',
          merchant: goal.title,
          source: 'MANUAL',
          aiConfidence: 100,
          aiPredictedCategory: 'Investment',
          userCorrected: false,
          blockchainHash,
          blockNumber: onChainRecord.blockNumber,
          blockchainVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await adapter.createTransactionAtomic({
          transaction: newTx,
          account: acc,
          newBalance: acc.currentBalance - parsedAmount.value,
          auditEvent: {
            id: 'aud-' + crypto.randomBytes(6).toString('hex'),
            userId,
            eventType: 'GOAL_CONTRIBUTION',
            description: `Deposited ₹${parsedAmount.value} into goal "${goal.title}".`,
            timestamp: new Date().toISOString(),
            ipAddress: req.ip || '127.0.0.1',
            userAgent: (req.headers['user-agent'] as string) || 'Modern Web Client',
          },
          ledgerRecord: onChainRecord,
        }).catch(err => {
          console.error('[Goal Contribution] Atomic persistence error:', err);
        });

        db.transactions.set(txId, newTx);
        db.updateAccountBalance(acc.id, parsedAmount.value, false);
      }
    }

    await adapter.saveGoal(goal);
    db.goals.set(goalId, goal);

    db.recordAuditEvent({
      userId,
      eventType: 'GOAL_CONTRIBUTION',
      description: `Contributed ₹${parsedAmount.value} to savings goal "${goal.title}". Current: ₹${goal.currentAmount}.`,
    });

    const goalWithMetrics = computeGoalMetrics(goal);
    return sendSuccess(res, 200, { goal: goalWithMetrics }, `Successfully contributed ₹${parsedAmount.value}.`);
  } catch (err: any) {
    return sendError(res, 500, 'GOAL_CONTRIBUTE_ERROR', 'Failed to record contribution: ' + err.message);
  }
});
