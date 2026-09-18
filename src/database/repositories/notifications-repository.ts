import { openDatabase } from '../db';
import type { AppNotification } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

function mapRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    eventType: String(row.event_type),
    eventId: String(row.event_id),
    notificationType: String(row.notification_type),
    title: String(row.title),
    body: String(row.body),
    scheduledAt: (row.scheduled_at as string) ?? null,
    sentAt: (row.sent_at as string) ?? null,
    readAt: (row.read_at as string) ?? null,
    dismissedAt: (row.dismissed_at as string) ?? null,
    createdAt: String(row.created_at),
  };
}

/** Only *delivered* notifications (sent_at set) appear in the in-app centre;
 *  rows for future events that are still scheduled stay hidden until they fire. */
export async function listNotifications(includeDismissed = false): Promise<AppNotification[]> {
  const db = await openDatabase();
  const dismissClause = includeDismissed ? '' : 'AND dismissed_at IS NULL';
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM notifications WHERE sent_at IS NOT NULL ${dismissClause} ORDER BY sent_at DESC LIMIT 200`
  );
  return rows.map(mapRow);
}

export async function unreadCount(): Promise<number> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    'SELECT COUNT(*) AS c FROM notifications WHERE sent_at IS NOT NULL AND read_at IS NULL AND dismissed_at IS NULL'
  );
  return row?.c ?? 0;
}

/** Looks up a single notification by its dedupe key. */
export async function getNotification(
  eventType: string,
  eventId: string,
  notificationType: string
): Promise<{ id: string; sentAt: string | null; scheduledAt: string | null } | null> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT id, sent_at, scheduled_at FROM notifications
     WHERE event_type = ? AND event_id = ? AND notification_type = ?`,
    eventType,
    eventId,
    notificationType
  );
  if (!row) return null;
  return {
    id: String(row.id),
    sentAt: (row.sent_at as string) ?? null,
    scheduledAt: (row.scheduled_at as string) ?? null,
  };
}

/** Marks a previously-scheduled notification as delivered (its OS banner has fired). */
export async function markDelivered(id: string, sentAt: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('UPDATE notifications SET sent_at = ? WHERE id = ? AND sent_at IS NULL', sentAt, id);
}

/** Removes document notifications whose document no longer exists. */
export async function pruneDocumentNotifications(keepEventIds: string[]): Promise<void> {
  const db = await openDatabase();
  if (keepEventIds.length === 0) {
    await db.runAsync(`DELETE FROM notifications WHERE event_type = 'document'`);
    return;
  }
  const placeholders = keepEventIds.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM notifications WHERE event_type = 'document' AND event_id NOT IN (${placeholders})`,
    ...keepEventIds
  );
}

/** Insert a notification; ignored if an identical one already exists (dedupe). */
export async function upsertNotification(
  input: Omit<AppNotification, 'id' | 'readAt' | 'dismissedAt' | 'createdAt'>
): Promise<boolean> {
  const db = await openDatabase();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO notifications
       (id, event_type, event_id, notification_type, title, body, scheduled_at, sent_at, read_at, dismissed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
    newId(),
    input.eventType,
    input.eventId,
    input.notificationType,
    input.title,
    input.body,
    input.scheduledAt,
    input.sentAt,
    isoNow()
  );
  return result.changes > 0;
}

export async function markRead(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('UPDATE notifications SET read_at = ? WHERE id = ?', isoNow(), id);
}

export async function markAllRead(): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('UPDATE notifications SET read_at = ? WHERE read_at IS NULL', isoNow());
}

export async function dismiss(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('UPDATE notifications SET dismissed_at = ? WHERE id = ?', isoNow(), id);
}
