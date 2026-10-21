/**
 * Persistent Notification REST API Routes & Event Engine (Phase 4 / Phase 8)
 * 
 * Provides:
 * - GET /api/notifications (List user notifications with unread count)
 * - PATCH /api/notifications/:id/read (Mark single notification as read)
 * - POST /api/notifications/mark-all-read (Mark all notifications as read)
 * - DELETE /api/notifications/:id (Delete notification)
 * - POST /api/notifications/dispatch-simulated (Development Email / Push notification simulation)
 * - Event trigger helpers (budget thresholds, upcoming bills, renewals, anomalies, security events)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { persistentSqlite } from '../database.js';
import { NotificationItem, NotificationType } from '../types.js';

export const notificationsRouter = Router();

/**
 * Dispatches and persists a database-backed notification with duplicate suppression
 */
export function triggerNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  actionUrl?: string
): NotificationItem | null {
  // Duplicate check: avoid repeating the exact same message to the same user within 24 hours
  const oneDayAgo = Date.now() - 24 * 3600 * 1000;
  for (const n of db.notifications.values()) {
    if (
      n.userId === userId &&
      n.type === type &&
      n.title === title &&
      new Date(n.timestamp).getTime() > oneDayAgo
    ) {
      return null; // Suppress duplicate notification
    }
  }

  const notifId = 'notif-' + crypto.randomBytes(6).toString('hex');
  const newNotif: NotificationItem = {
    id: notifId,
    userId,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    isRead: false,
    actionUrl,
  };

  db.notifications.set(notifId, newNotif);
  return newNotif;
}

// GET /api/notifications - List notifications
notificationsRouter.get('/', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const list = Array.from(db.notifications.values())
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const unreadCount = list.filter(n => !n.isRead).length;

    return res.json({
      notifications: list,
      unreadCount,
      totalCount: list.length,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

// PATCH /api/notifications/:id/read - Mark notification as read
notificationsRouter.patch('/:id/read', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const notifId = req.params.id;
    const notif = db.notifications.get(notifId);

    if (!notif || notif.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    notif.isRead = true;
    return res.json({ message: 'Notification marked as read.', notification: notif });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update notification status.' });
  }
});

// POST /api/notifications/mark-all-read - Mark all read
notificationsRouter.post('/mark-all-read', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    let count = 0;
    for (const notif of db.notifications.values()) {
      if (notif.userId === userId && !notif.isRead) {
        notif.isRead = true;
        count++;
      }
    }
    return res.json({ message: `Marked ${count} notifications as read.`, updatedCount: count });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
});

// DELETE /api/notifications/:id - Delete single notification
notificationsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const notifId = req.params.id;
    const notif = db.notifications.get(notifId);

    if (!notif || notif.userId !== userId) {
      return res.status(404).json({ error: 'Notification not found.' });
    }

    db.notifications.delete(notifId);
    persistentSqlite.deleteNotification(notifId);
    return res.json({ message: 'Notification deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete notification.' });
  }
});

// POST /api/notifications/dispatch-simulated - Simulated notification / email dispatcher
notificationsRouter.post('/dispatch-simulated', (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { type, title, message, actionUrl } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    const notif = triggerNotification(userId, type || 'SYSTEM', title, message, actionUrl);

    return res.status(201).json({
      message: 'Simulated development notification dispatched successfully.',
      provider: 'Development Email Simulation (SimulatedEmailProvider)',
      notification: notif,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to dispatch simulated notification.' });
  }
});
