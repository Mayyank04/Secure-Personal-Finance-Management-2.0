/**
 * Subscription Management REST API Routes
 * 
 * Provides:
 * - Full subscription tracking with monthly & annual burn rates
 * - Full CRUD endpoints: GET, POST, GET /:id, PATCH /:id, PUT /:id, DELETE /:id
 * - Direct database persistence to PostgreSQL/SQLite
 * - Price change detection & alert flags
 * - Duplicate subscription warnings
 * - Lifecycle status management (ACTIVE, PAUSED, CANCELLED)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { getDatabaseAdapter } from '../db/index.js';
import { sendSuccess, sendError, parsePositiveAmount, isValidIsoDate } from '../apiResponse.js';
import { Subscription, SubscriptionStatus, SubscriptionFrequency, TransactionCategory } from '../types.js';

export const subscriptionsRouter = Router();

function calculateCosts(amount: number, freq: SubscriptionFrequency): { monthly: number; annual: number } {
  let monthly = amount;
  let annual = amount * 12;

  if (freq === 'WEEKLY') {
    monthly = Math.round(amount * 4.33);
    annual = amount * 52;
  } else if (freq === 'QUARTERLY') {
    monthly = Math.round(amount / 3);
    annual = amount * 4;
  } else if (freq === 'ANNUAL') {
    monthly = Math.round(amount / 12);
    annual = amount;
  }

  return { monthly, annual };
}

// GET /api/subscriptions - List subscriptions with burn calculations & flags
subscriptionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const adapter = getDatabaseAdapter();

    let subs: Subscription[] = [];
    try {
      const rows = await adapter.query(`SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC;`, [userId]);
      subs = rows.map((r: any) => {
        const amount = Number(r.amount);
        const freq = r.frequency || 'MONTHLY';
        const { monthly, annual } = calculateCosts(amount, freq);
        return {
          id: r.id,
          userId: r.user_id,
          accountId: r.account_id || undefined,
          name: r.name,
          merchant: r.merchant,
          amount,
          frequency: freq,
          category: r.category || 'Subscriptions',
          nextBillingDate: r.next_renewal_date,
          nextRenewalDate: r.next_renewal_date,
          monthlyCost: monthly,
          annualCost: annual,
          previousAmount: r.previous_amount !== null ? Number(r.previous_amount) : undefined,
          priceChangeDetected: Boolean(r.price_change_detected),
          status: r.status,
          linkedTransactionId: r.linked_transaction_id || undefined,
          notes: r.notes || undefined,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        };
      });
    } catch {
      subs = db.getUserSubscriptions(userId);
    }

    if (subs.length === 0) {
      subs = db.getUserSubscriptions(userId);
    }

    // Filters
    const { status, category } = req.query as Record<string, string>;
    if (status && status !== 'ALL') {
      subs = subs.filter(s => s.status === status);
    }
    if (category && category !== 'ALL') {
      subs = subs.filter(s => s.category.toLowerCase() === category.toLowerCase());
    }

    const activeSubs = subs.filter(s => s.status === 'ACTIVE');
    const totalMonthlyBurn = activeSubs.reduce((s, sub) => s + (sub.monthlyCost || sub.amount), 0);
    const totalAnnualBurn = activeSubs.reduce((s, sub) => s + (sub.annualCost || sub.amount * 12), 0);

    // Duplicate detection flags
    const categoryCounts: Record<string, number> = {};
    for (const sub of activeSubs) {
      categoryCounts[sub.category] = (categoryCounts[sub.category] || 0) + 1;
    }

    const duplicateFlags: string[] = [];
    if ((categoryCounts['Subscriptions'] || 0) >= 3) {
      duplicateFlags.push(`You have ${categoryCounts['Subscriptions']} active digital streaming subscriptions.`);
    }

    const priceChangeAlerts = activeSubs.filter(s => s.priceChangeDetected);

    return sendSuccess(res, 200, {
      subscriptions: subs,
      summary: {
        totalSubscriptions: subs.length,
        activeCount: activeSubs.length,
        pausedCount: subs.filter(s => s.status === 'PAUSED').length,
        cancelledCount: subs.filter(s => s.status === 'CANCELLED').length,
        totalMonthlyBurn,
        totalAnnualBurn,
        duplicateFlags,
        priceChangeAlertsCount: priceChangeAlerts.length,
      },
    });
  } catch (err: any) {
    return sendError(res, 500, 'SUBSCRIPTIONS_FETCH_ERROR', 'Failed to retrieve subscriptions: ' + err.message);
  }
});

// GET /api/subscriptions/:id - Retrieve single subscription
subscriptionsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const subId = req.params.id;
    const adapter = getDatabaseAdapter();

    let sub = await adapter.getSubscriptionForUser(subId, userId);
    if (!sub) {
      const memSub = db.subscriptions.get(subId);
      if (memSub && memSub.userId === userId) {
        sub = memSub;
      }
    }

    if (!sub) {
      return sendError(res, 404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found or inaccessible.');
    }

    const { monthly, annual } = calculateCosts(sub.amount, sub.frequency);
    sub.monthlyCost = monthly;
    sub.annualCost = annual;

    return sendSuccess(res, 200, { subscription: sub });
  } catch (err: any) {
    return sendError(res, 500, 'SUBSCRIPTION_FETCH_ERROR', 'Failed to retrieve subscription: ' + err.message);
  }
});

// POST /api/subscriptions - Create new subscription
subscriptionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      merchant,
      category = 'Subscriptions',
      amount,
      cost,
      frequency,
      billingCycle,
      nextBillingDate,
      nextPaymentDate,
      nextRenewalDate,
      accountId,
      notes,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Subscription name is required.');
    }

    const rawAmount = amount !== undefined ? amount : cost;
    const parsedAmount = parsePositiveAmount(rawAmount, 'Subscription amount');
    if (parsedAmount.error) {
      return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
    }

    const subFrequency = (frequency || billingCycle || 'MONTHLY') as SubscriptionFrequency;
    const subId = 'sub-' + crypto.randomBytes(6).toString('hex');
    const { monthly, annual } = calculateCosts(parsedAmount.value, subFrequency);
    const now = new Date().toISOString();
    const renewalCandidate = nextBillingDate || nextPaymentDate || nextRenewalDate;
    const defaultRenewal = renewalCandidate && isValidIsoDate(renewalCandidate)
      ? renewalCandidate
      : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const newSub: Subscription = {
      id: subId,
      userId,
      merchant: merchant ? String(merchant).trim() : name.trim(),
      name: name.trim(),
      category: category as TransactionCategory,
      amount: parsedAmount.value,
      frequency: subFrequency,
      nextBillingDate: defaultRenewal,
      nextRenewalDate: defaultRenewal,
      monthlyCost: monthly,
      annualCost: annual,
      accountId: accountId || undefined,
      status: 'ACTIVE',
      previousAmount: parsedAmount.value,
      priceChangeDetected: false,
      notes: notes || undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Direct database persistence
    const adapter = getDatabaseAdapter();
    await adapter.saveSubscription(newSub);

    // Keep memory cache updated
    db.subscriptions.set(subId, newSub);

    db.recordAuditEvent({
      userId,
      eventType: 'SUBSCRIPTION_ADDED',
      description: `Registered subscription "${newSub.name}" (₹${newSub.amount}/${newSub.frequency.toLowerCase()}).`,
    });

    return sendSuccess(res, 201, { subscription: newSub }, 'Subscription added successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'SUBSCRIPTION_CREATE_ERROR', 'Failed to create subscription: ' + err.message);
  }
});

// PATCH & PUT /api/subscriptions/:id - Update subscription
async function handleUpdateSubscription(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    const subId = req.params.id;
    const adapter = getDatabaseAdapter();

    let sub = await adapter.getSubscriptionForUser(subId, userId);
    if (!sub) {
      const memSub = db.subscriptions.get(subId);
      if (memSub && memSub.userId === userId) {
        sub = memSub;
      }
    }

    if (!sub) {
      return sendError(res, 404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found or inaccessible.');
    }

    const { name, merchant, category, amount, frequency, nextBillingDate, accountId, status, notes } = req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Subscription name cannot be empty.');
      }
      sub.name = name.trim();
    }

    if (merchant !== undefined) sub.merchant = String(merchant).trim();
    if (category !== undefined) sub.category = category as TransactionCategory;

    if (amount !== undefined) {
      const parsedAmount = parsePositiveAmount(amount, 'Subscription amount');
      if (parsedAmount.error) return sendError(res, 400, 'VALIDATION_ERROR', parsedAmount.error);
      if (sub.amount !== parsedAmount.value) {
        sub.previousAmount = sub.amount;
        sub.priceChangeDetected = parsedAmount.value > sub.amount;
      }
      sub.amount = parsedAmount.value;
    }

    if (frequency !== undefined) sub.frequency = frequency as SubscriptionFrequency;

    if (nextBillingDate !== undefined) {
      if (!isValidIsoDate(nextBillingDate)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid next renewal date. Must be YYYY-MM-DD.');
      }
      sub.nextBillingDate = nextBillingDate;
      sub.nextRenewalDate = nextBillingDate;
    }

    if (accountId !== undefined) sub.accountId = accountId || undefined;

    if (status !== undefined) {
      if (!['ACTIVE', 'PAUSED', 'CANCELLED'].includes(status)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Status must be ACTIVE, PAUSED, or CANCELLED.');
      }
      sub.status = status as SubscriptionStatus;
    }

    if (notes !== undefined) sub.notes = notes;

    const { monthly, annual } = calculateCosts(sub.amount, sub.frequency);
    sub.monthlyCost = monthly;
    sub.annualCost = annual;
    sub.updatedAt = new Date().toISOString();

    // Persist to database
    await adapter.saveSubscription(sub);

    // Keep memory cache updated
    db.subscriptions.set(subId, sub);

    db.recordAuditEvent({
      userId,
      eventType: 'SUBSCRIPTION_UPDATED',
      description: `Updated subscription "${sub.name}".`,
    });

    return sendSuccess(res, 200, { subscription: sub }, 'Subscription updated successfully.');
  } catch (err: any) {
    return sendError(res, 500, 'SUBSCRIPTION_UPDATE_ERROR', 'Failed to update subscription: ' + err.message);
  }
}

subscriptionsRouter.put('/:id', handleUpdateSubscription);
subscriptionsRouter.patch('/:id', handleUpdateSubscription);

// PATCH /api/subscriptions/:id/status - Status change
subscriptionsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const subId = req.params.id;
    const adapter = getDatabaseAdapter();

    let sub = await adapter.getSubscriptionForUser(subId, userId);
    if (!sub) {
      const memSub = db.subscriptions.get(subId);
      if (memSub && memSub.userId === userId) {
        sub = memSub;
      }
    }

    if (!sub) {
      return sendError(res, 404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found or inaccessible.');
    }

    const { status } = req.body;
    if (!status || !['ACTIVE', 'PAUSED', 'CANCELLED'].includes(status)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid status. Must be ACTIVE, PAUSED, or CANCELLED.');
    }

    sub.status = status as SubscriptionStatus;
    sub.updatedAt = new Date().toISOString();

    await adapter.saveSubscription(sub);
    db.subscriptions.set(subId, sub);

    db.recordAuditEvent({
      userId,
      eventType: 'SUBSCRIPTION_STATUS_CHANGED',
      description: `Subscription "${sub.name}" status updated to ${status}.`,
    });

    return sendSuccess(res, 200, { subscription: sub }, `Subscription status updated to ${status}.`);
  } catch (err: any) {
    return sendError(res, 500, 'SUBSCRIPTION_STATUS_ERROR', 'Failed to update subscription status: ' + err.message);
  }
});

// DELETE /api/subscriptions/:id - Delete subscription
subscriptionsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const subId = req.params.id;
    const adapter = getDatabaseAdapter();

    let sub = await adapter.getSubscriptionForUser(subId, userId);
    if (!sub) {
      const memSub = db.subscriptions.get(subId);
      if (memSub && memSub.userId === userId) {
        sub = memSub;
      }
    }

    if (!sub) {
      return sendError(res, 404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found or inaccessible.');
    }

    await adapter.deleteSubscription(subId);
    db.subscriptions.delete(subId);

    db.recordAuditEvent({
      userId,
      eventType: 'SUBSCRIPTION_DELETED',
      description: `Removed subscription "${sub.name}".`,
    });

    return sendSuccess(res, 200, { id: subId }, 'Subscription removed.');
  } catch (err: any) {
    return sendError(res, 500, 'SUBSCRIPTION_DELETE_ERROR', 'Failed to delete subscription: ' + err.message);
  }
});
