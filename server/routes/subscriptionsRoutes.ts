/**
 * Subscription Management REST API Routes
 * 
 * Provides:
 * - Full subscription tracking with monthly & annual burn rates
 * - Price change detection & alert flags
 * - Duplicate subscription warnings (e.g., multiple streaming or gym passes)
 * - Lifecycle status management (ACTIVE, PAUSED, CANCELLED)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
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
subscriptionsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const subs = db.getUserSubscriptions(userId);

    const activeSubs = subs.filter(s => s.status === 'ACTIVE');
    const totalMonthlyBurn = activeSubs.reduce((s, sub) => s + sub.monthlyCost, 0);
    const totalAnnualBurn = activeSubs.reduce((s, sub) => s + sub.annualCost, 0);

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

    return res.json({
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
    return res.status(500).json({ error: 'Failed to retrieve subscriptions.' });
  }
});

// POST /api/subscriptions - Create new subscription
subscriptionsRouter.post('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const {
      name,
      merchant,
      category = 'Subscriptions',
      amount,
      frequency = 'MONTHLY',
      nextBillingDate,
      accountId,
      notes,
    } = req.body;

    if (!name || !amount) {
      return res.status(400).json({ error: 'Subscription name and amount are required.' });
    }

    const subId = 'sub-' + crypto.randomBytes(6).toString('hex');
    const numAmount = Number(amount);
    const { monthly, annual } = calculateCosts(numAmount, frequency as SubscriptionFrequency);

    const newSub: Subscription = {
      id: subId,
      userId,
      merchant: merchant ? merchant.trim() : name.trim(),
      name: name.trim(),
      category: category as TransactionCategory,
      amount: numAmount,
      frequency: frequency as SubscriptionFrequency,
      nextBillingDate: nextBillingDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      monthlyCost: monthly,
      annualCost: annual,
      accountId,
      status: 'ACTIVE',
      previousAmount: numAmount,
      priceChangeDetected: false,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.subscriptions.set(subId, newSub);
    persistentSqlite.syncFromMemoryDb(db);

    db.recordAuditEvent({
      userId,
      eventType: 'SUBSCRIPTION_ADDED',
      description: `Registered subscription "${newSub.name}" (₹${newSub.amount}/${newSub.frequency.toLowerCase()}).`,
    });

    return res.status(201).json({ message: 'Subscription added successfully.', subscription: newSub });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create subscription.' });
  }
});

// PUT /api/subscriptions/:id - Update subscription
subscriptionsRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const sub = db.subscriptions.get(req.params.id);

    if (!sub || sub.userId !== userId) {
      return res.status(404).json({ error: 'Subscription not found.' });
    }

    const { name, merchant, category, amount, frequency, nextBillingDate, accountId, status, notes } = req.body;

    if (name) sub.name = name.trim();
    if (merchant) sub.merchant = merchant.trim();
    if (category) sub.category = category;
    if (amount !== undefined) {
      const newAmt = Number(amount);
      if (sub.amount !== newAmt) {
        sub.previousAmount = sub.amount;
        sub.priceChangeDetected = newAmt > sub.amount;
      }
      sub.amount = newAmt;
    }
    if (frequency) sub.frequency = frequency;
    if (nextBillingDate) sub.nextBillingDate = nextBillingDate;
    if (accountId !== undefined) sub.accountId = accountId;
    if (status) sub.status = status;
    if (notes !== undefined) sub.notes = notes;

    const { monthly, annual } = calculateCosts(sub.amount, sub.frequency);
    sub.monthlyCost = monthly;
    sub.annualCost = annual;
    sub.updatedAt = new Date().toISOString();
    persistentSqlite.syncFromMemoryDb(db);

    return res.json({ message: 'Subscription updated successfully.', subscription: sub });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update subscription.' });
  }
});

// PATCH /api/subscriptions/:id/status - Status change
subscriptionsRouter.patch('/:id/status', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const sub = db.subscriptions.get(req.params.id);

  if (!sub || sub.userId !== userId) {
    return res.status(404).json({ error: 'Subscription not found.' });
  }

  const { status } = req.body;
  if (!status || !['ACTIVE', 'PAUSED', 'CANCELLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be ACTIVE, PAUSED, or CANCELLED.' });
  }

  sub.status = status as SubscriptionStatus;
  sub.updatedAt = new Date().toISOString();
  persistentSqlite.syncFromMemoryDb(db);

  db.recordAuditEvent({
    userId,
    eventType: 'SUBSCRIPTION_STATUS_CHANGED',
    description: `Subscription "${sub.name}" status updated to ${status}.`,
  });

  return res.json({ message: `Subscription status updated to ${status}.`, subscription: sub });
});

// DELETE /api/subscriptions/:id - Delete subscription
subscriptionsRouter.delete('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const sub = db.subscriptions.get(req.params.id);

  if (!sub || sub.userId !== userId) {
    return res.status(404).json({ error: 'Subscription not found.' });
  }

  db.subscriptions.delete(req.params.id);
  persistentSqlite.deleteSubscription(req.params.id);
  persistentSqlite.syncFromMemoryDb(db);
  return res.json({ message: 'Subscription removed.' });
});
