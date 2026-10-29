import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { sendSuccess, sendError, parseNonNegativeAmount } from '../apiResponse.js';
import { Budget, TransactionCategory } from '../types.js';

export const budgetsRouter = Router();

function computeBudgetProgress(budget: Budget, userId: string): Budget & { spentAmount: number; remainingAmount: number; progressPercent: number } {
  const [year, month] = budget.month.split('-');
  const txList = db.getUserTransactions(userId).filter(t => {
    if (t.type !== 'EXPENSE') return false;
    const [tYear, tMonth] = t.date.split('-');
    return tYear === year && tMonth === month;
  });

  const spentAmount = txList.reduce((acc, t) => acc + t.amount, 0);
  const remainingAmount = Math.max(0, budget.totalBudget - spentAmount);
  const progressPercent = budget.totalBudget > 0 ? Math.round((spentAmount / budget.totalBudget) * 100) : 0;

  const enrichedCategoryBudgets = Array.isArray(budget.categoryBudgets)
    ? budget.categoryBudgets.map((item: any) => {
        const catSpent = txList
          .filter(t => t.category.toLowerCase() === String(item.category).toLowerCase())
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          ...item,
          spent: catSpent,
          remaining: Math.max(0, (Number(item.allocated) || Number(item.amount) || 0) - catSpent),
        };
      })
    : budget.categoryBudgets;

  return {
    ...budget,
    categoryBudgets: enrichedCategoryBudgets,
    spentAmount,
    remainingAmount,
    progressPercent,
  };
}

budgetsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let list: Budget[] = [];
    try {
      const rows = await adapter.query(`SELECT * FROM budgets WHERE user_id = $1 ORDER BY month DESC;`, [userId]);
      list = rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        month: r.month,
        totalBudget: Number(r.total_budget),
        categoryBudgets: r.category_budgets_json ? JSON.parse(r.category_budgets_json) : {},
        rolloverEnabled: Boolean(r.rollover_enabled),
        alertThresholds: r.alert_thresholds_json ? JSON.parse(r.alert_thresholds_json) : { normal: 70, high: 90, exceeded: 100 },
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch {
      list = Array.from(db.budgets.values()).filter(b => b.userId === userId);
    }

    if (list.length === 0) {
      list = Array.from(db.budgets.values()).filter(b => b.userId === userId);
    }

    const budgetsWithProgress = list.map(b => computeBudgetProgress(b, userId));
    return sendSuccess(res, 200, { budgets: budgetsWithProgress });
  } catch (err: any) {
    return sendError(res, 500, 'BUDGET_FETCH_ERROR', 'Failed to retrieve budgets: ' + err.message);
  }
});

budgetsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const budgetId = req.params.id;
    const adapter = getDatabaseAdapter();

    let budget = await adapter.getBudgetForUser(budgetId, userId);
    if (!budget) {
      const memBudget = db.budgets.get(budgetId);
      if (memBudget && memBudget.userId === userId) {
        budget = memBudget;
      }
    }

    if (!budget) {
      return sendError(res, 404, 'BUDGET_NOT_FOUND', 'Budget not found or inaccessible.');
    }

    const budgetWithProgress = computeBudgetProgress(budget, userId);
    return sendSuccess(res, 200, { budget: budgetWithProgress });
  } catch (err: any) {
    return sendError(res, 500, 'BUDGET_FETCH_ERROR', 'Failed to retrieve budget: ' + err.message);
  }
});

budgetsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      month = new Date().toISOString().slice(0, 7),
      totalBudget,
      categoryBudgets = {},
      rolloverEnabled = true,
      alertThresholds,
    } = req.body;

    const parsedTotal = parseNonNegativeAmount(totalBudget, 'Total budget');
    if (parsedTotal.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedTotal.error);
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Month must be in YYYY-MM format.');
    }

    const budgetId = 'bgt-' + crypto.randomBytes(6).toString('hex');
    const now = new Date().toISOString();

    const newBudget: Budget = {
      id: budgetId,
      userId,
      month,
      totalBudget: parsedTotal.value,
      categoryBudgets: typeof categoryBudgets === 'object' ? categoryBudgets : {},
      rolloverEnabled: Boolean(rolloverEnabled),
      alertThresholds: alertThresholds || { normal: 70, high: 90, exceeded: 100 },
      createdAt: now,
      updatedAt: now,
    };

    const adapter = getDatabaseAdapter();
    await adapter.saveBudget(newBudget);

    db.budgets.set(budgetId, newBudget);

    db.recordAuditEvent({
      userId,
      eventType: 'BUDGET_CREATED',
      description: `Configured budget for ${month} with limit of ₹${newBudget.totalBudget}.`,
    });

    const budgetWithProgress = computeBudgetProgress(newBudget, userId);
    return sendSuccess(res, 201, { budget: budgetWithProgress }, 'Budget configured successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'BUDGET_CREATE_ERROR', 'Failed to configure budget: ' + err.message);
  }
});

async function handleUpdateBudget(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const budgetId = req.params.id;
    const adapter = getDatabaseAdapter();

    let budget = await adapter.getBudgetForUser(budgetId, userId);
    if (!budget) {
      const memBudget = db.budgets.get(budgetId);
      if (memBudget && memBudget.userId === userId) {
        budget = memBudget;
      }
    }

    if (!budget) {
      return sendError(res, 404, 'BUDGET_NOT_FOUND', 'Budget not found or inaccessible.');
    }

    const { totalBudget, categoryBudgets, rolloverEnabled, alertThresholds, month } = req.body;

    if (totalBudget !== undefined) {
      const parsed = parseNonNegativeAmount(totalBudget, 'Total budget');
      if (parsed.error) {
        return sendError(res, 400, 'VALIDATION_ERROR', parsed.error);
      }
      budget.totalBudget = parsed.value;
    }

    if (month !== undefined) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Month must be in YYYY-MM format.');
      }
      budget.month = month;
    }

    if (categoryBudgets !== undefined && typeof categoryBudgets === 'object') {
      budget.categoryBudgets = categoryBudgets;
    }

    if (rolloverEnabled !== undefined) {
      budget.rolloverEnabled = Boolean(rolloverEnabled);
    }

    if (alertThresholds !== undefined && typeof alertThresholds === 'object') {
      budget.alertThresholds = alertThresholds;
    }

    budget.updatedAt = new Date().toISOString();

    await adapter.saveBudget(budget);

    db.budgets.set(budgetId, budget);

    db.recordAuditEvent({
      userId,
      eventType: 'BUDGET_UPDATED',
      description: `Updated budget for ${budget.month} (Total: ₹${budget.totalBudget}).`,
    });

    const budgetWithProgress = computeBudgetProgress(budget, userId);
    return sendSuccess(res, 200, { budget: budgetWithProgress }, 'Budget updated successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'BUDGET_UPDATE_ERROR', 'Failed to update budget: ' + err.message);
  }
}

budgetsRouter.patch('/:id', handleUpdateBudget);
budgetsRouter.put('/:id', handleUpdateBudget);

budgetsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const budgetId = req.params.id;
    const adapter = getDatabaseAdapter();

    let budget = await adapter.getBudgetForUser(budgetId, userId);
    if (!budget) {
      const memBudget = db.budgets.get(budgetId);
      if (memBudget && memBudget.userId === userId) {
        budget = memBudget;
      }
    }

    if (!budget) {
      return sendError(res, 404, 'BUDGET_NOT_FOUND', 'Budget not found or inaccessible.');
    }

    await adapter.deleteBudget(budgetId);
    db.budgets.delete(budgetId);

    db.recordAuditEvent({
      userId,
      eventType: 'BUDGET_DELETED',
      description: `Removed budget for ${budget.month}.`,
    });

    return sendSuccess(res, 200, { id: budgetId }, 'Budget removed successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'BUDGET_DELETE_ERROR', 'Failed to delete budget: ' + err.message);
  }
});
