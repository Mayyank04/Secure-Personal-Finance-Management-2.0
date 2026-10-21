/**
 * Financial Calendar REST API Routes (Phase 7)
 * 
 * Provides:
 * - GET /api/calendar/events (Aggregated timeline of bills, subscriptions, loan EMIs, recurring payments, and expected salary)
 * - GET /api/calendar/export-ics (Standard RFC 5545 iCalendar (.ics) download)
 */

import { Router, Request, Response } from 'express';
import { db } from '../db.js';

export const calendarRouter = Router();

export interface CalendarEvent {
  id: string;
  title: string;
  category: 'BILL' | 'SUBSCRIPTION' | 'LOAN_EMI' | 'SALARY' | 'BUDGET_RESET';
  amount: number;
  date: string;
  status: 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'PAID' | 'COMPLETED';
  entityId: string;
  accountName?: string;
  notes?: string;
}

// Helper to calculate status relative to today
function calculateDateStatus(dateStr: string, currentStatus?: string): 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'PAID' | 'COMPLETED' {
  if (currentStatus === 'PAID' || currentStatus === 'COMPLETED') return currentStatus;
  const today = new Date().toISOString().split('T')[0];
  const diffDays = Math.ceil((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000);
  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 3) return 'DUE_SOON';
  return 'UPCOMING';
}

// GET /api/calendar/events - Aggregate all financial commitments and inflow dates
calendarRouter.get('/events', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { month = '2026-08' } = req.query as { month?: string };

    const events: CalendarEvent[] = [];

    // 1. Bills
    const bills = db.getUserBills(userId);
    for (const b of bills) {
      events.push({
        id: `evt-bill-${b.id}`,
        title: `${b.name} (Bill Due)`,
        category: 'BILL',
        amount: b.amount,
        date: b.dueDate,
        status: calculateDateStatus(b.dueDate, b.status),
        entityId: b.id,
        notes: b.notes,
      });
    }

    // 2. Subscriptions
    const subs = db.getUserSubscriptions(userId);
    for (const s of subs) {
      events.push({
        id: `evt-sub-${s.id}`,
        title: `${s.name} (Renewal)`,
        category: 'SUBSCRIPTION',
        amount: s.amount,
        date: s.nextBillingDate,
        status: calculateDateStatus(s.nextBillingDate, s.status === 'CANCELLED' ? 'COMPLETED' : undefined),
        entityId: s.id,
        notes: s.notes,
      });
    }

    // 3. Loans
    const loans = db.getUserLoans(userId);
    for (const l of loans) {
      if (l.status === 'ACTIVE') {
        const dayMatch = l.dueDate.match(/\d+/);
        const dayNum = dayMatch ? parseInt(dayMatch[0], 10) : 5;
        const loanDueDate = `${month}-${dayNum.toString().padStart(2, '0')}`;
        events.push({
          id: `evt-loan-${l.id}`,
          title: `${l.loanName} (EMI Payment)`,
          category: 'LOAN_EMI',
          amount: l.emi,
          date: loanDueDate,
          status: calculateDateStatus(loanDueDate),
          entityId: l.id,
          notes: `${l.lender} • ${l.interestRate}% APR`,
        });
      }
    }

    // 4. Expected Salary / Inflow (1st of month)
    events.push({
      id: `evt-salary-${month}-01`,
      title: 'Corporate Payroll / Salary Credit',
      category: 'SALARY',
      amount: 95000,
      date: `${month}-01`,
      status: 'COMPLETED',
      entityId: 'salary-01',
      notes: 'Expected regular monthly salary inflow',
    });

    // 5. Budget Reset (1st of month)
    events.push({
      id: `evt-bgt-${month}-01`,
      title: 'Monthly Budget Accounting Cycle Reset',
      category: 'BUDGET_RESET',
      amount: 0,
      date: `${month}-01`,
      status: 'COMPLETED',
      entityId: 'bgt-cycle',
      notes: 'Category allocations reset for new month',
    });

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.json({
      month,
      events,
      summary: {
        totalEvents: events.length,
        totalPayable: events.filter(e => e.category !== 'SALARY' && e.status !== 'PAID' && e.status !== 'COMPLETED').reduce((s, e) => s + e.amount, 0),
        overdueCount: events.filter(e => e.status === 'OVERDUE').length,
        dueSoonCount: events.filter(e => e.status === 'DUE_SOON').length,
        upcomingCount: events.filter(e => e.status === 'UPCOMING').length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve calendar events.' });
  }
});

// GET /api/calendar/export-ics - Export standard RFC 5545 iCalendar format
calendarRouter.get('/export-ics', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const bills = db.getUserBills(userId);
    const subs = db.getUserSubscriptions(userId);
    const loans = db.getUserLoans(userId);

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AegisFinance//Secure Financial Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:AegisFinance Financial Schedule',
      'X-WR-TIMEZONE:UTC',
    ];

    const todayStr = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // Export bills
    for (const b of bills) {
      const dtStart = b.dueDate.replace(/-/g, '');
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:bill-${b.id}@aegisfinance.local`,
        `DTSTAMP:${todayStr}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `SUMMARY:Bill Due: ${b.name} (₹${b.amount})`,
        `DESCRIPTION:Amount: ₹${b.amount}\\nCategory: ${b.category}\\nMerchant: ${b.merchant}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }

    // Export subscriptions
    for (const s of subs) {
      const dtStart = s.nextBillingDate.replace(/-/g, '');
      icsContent.push(
        'BEGIN:VEVENT',
        `UID:sub-${s.id}@aegisfinance.local`,
        `DTSTAMP:${todayStr}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `SUMMARY:Subscription Renewal: ${s.name} (₹${s.amount})`,
        `DESCRIPTION:Amount: ₹${s.amount}\\nMerchant: ${s.merchant}\\nFrequency: ${s.frequency}`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }

    icsContent.push('END:VCALENDAR');

    const fileContent = icsContent.join('\r\n');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="aegis-financial-calendar.ics"');
    return res.send(fileContent);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate iCalendar export.' });
  }
});
