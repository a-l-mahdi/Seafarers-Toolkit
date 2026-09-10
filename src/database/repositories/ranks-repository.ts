import { openDatabase } from '../db';
import type { LeaveSettings, NotificationPreference, Rank } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

/** Days conversion: promotion entered in months, computed in days (1 month ≈ 30.44). */
export const DAYS_PER_MONTH = 30.44;

export async function listRanks(): Promise<Rank[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    department: string;
    name: string;
    level: number;
    promotion_months: number | null;
    is_default: number;
  }>('SELECT * FROM ranks ORDER BY department, level, name');
  return rows.map((r) => ({
    id: r.id,
    department: r.department as Rank['department'],
    name: r.name,
    level: r.level,
    promotionMonths: (r.promotion_months as number | null) ?? null,
    isDefault: !!r.is_default,
  }));
}

export async function createRank(
  department: Rank['department'],
  name: string,
  level: number,
  promotionMonths: number | null = 12
): Promise<Rank> {
  const db = await openDatabase();
  const rank: Rank = { id: newId(), department, name, level, promotionMonths, isDefault: false };
  await db.runAsync(
    'INSERT INTO ranks (id, department, name, level, promotion_months, is_default) VALUES (?, ?, ?, ?, ?, 0)',
    rank.id,
    department,
    name,
    level,
    rank.promotionMonths
  );
  return rank;
}

export async function updateRank(rank: Rank): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE ranks SET department = ?, name = ?, level = ?, promotion_months = ? WHERE id = ?',
    rank.department,
    rank.name,
    rank.level,
    rank.promotionMonths,
    rank.id
  );
}

/** Moves a rank up/down within its department by swapping levels with the neighbour. */
export async function moveRank(id: string, dir: -1 | 1): Promise<void> {
  const db = await openDatabase();
  const rank = await db.getFirstAsync<{
    id: string;
    department: string;
    level: number;
  }>('SELECT id, department, level FROM ranks WHERE id = ?', id);
  if (!rank) return;
  const neighbours = await db.getAllAsync<{ id: string; level: number }>(
    'SELECT id, level FROM ranks WHERE department = ? ORDER BY level, name',
    rank.department
  );
  const idx = neighbours.findIndex((n) => n.id === id);
  const swapIdx = idx + (dir === -1 ? -1 : 1);
  if (idx < 0 || swapIdx < 0 || swapIdx >= neighbours.length) return;
  const other = neighbours[swapIdx];
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE ranks SET level = ? WHERE id = ?', other.level, rank.id);
    await db.runAsync('UPDATE ranks SET level = ? WHERE id = ?', rank.level, other.id);
  });
}

export async function deleteRank(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM ranks WHERE id = ?', id);
}

/** Promotion sea time in days for the given rank (its configured months × 30.44). */
export async function getPromotionDaysFor(rankId: string | null, fallback = 365): Promise<number> {
  if (!rankId) return fallback;
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ promotion_months: number | null }>(
    'SELECT promotion_months FROM ranks WHERE id = ?',
    rankId
  );
  const months = row?.promotion_months;
  if (!months || months <= 0) return fallback;
  return Math.round(months * DAYS_PER_MONTH);
}

const LEAVE_SETTINGS_KEY = 'leave_settings';
const NOTIFICATION_PREFS_KEY = 'notification_prefs';

export const DEFAULT_LEAVE_SETTINGS: LeaveSettings = {
  mode: 'ratio',
  onboardDays: 60,
  leaveDays: 30,
  manualLeaveStartDate: null,
  manualLeaveEndDate: null,
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreference = {
  documentExpiry: true,
  contractEnding: true,
  leaveEnding: true,
  rankProgress: true,
  thresholds: [90, 60, 30, 14, 7, 3, 1],
};

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

async function setSetting(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value)
  );
}

export async function getLeaveSettings(): Promise<LeaveSettings> {
  return getSetting<LeaveSettings>(LEAVE_SETTINGS_KEY, DEFAULT_LEAVE_SETTINGS);
}

export async function saveLeaveSettings(settings: LeaveSettings): Promise<void> {
  await setSetting(LEAVE_SETTINGS_KEY, settings);
}

export async function getNotificationPrefs(): Promise<NotificationPreference> {
  return getSetting<NotificationPreference>(NOTIFICATION_PREFS_KEY, DEFAULT_NOTIFICATION_PREFS);
}

export async function saveNotificationPrefs(prefs: NotificationPreference): Promise<void> {
  await setSetting(NOTIFICATION_PREFS_KEY, prefs);
}

export async function logAudit(action: string, entityId: string): Promise<void> {
  await setSetting(`audit:${isoNow()}:${newId()}`, { action, entityId });
}
