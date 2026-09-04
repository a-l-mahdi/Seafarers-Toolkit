import { openDatabase } from '../db';
import type { LeaveSettings, NotificationPreference, Rank, RankRequirement } from '@/types/domain';
import { isoNow } from '@/utils/date';
import { newId } from '@/utils/id';

export async function listRanks(): Promise<Rank[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    department: string;
    name: string;
    level: number;
    is_default: number;
  }>('SELECT * FROM ranks ORDER BY department, level, name');
  return rows.map((r) => ({
    id: r.id,
    department: r.department as Rank['department'],
    name: r.name,
    level: r.level,
    isDefault: !!r.is_default,
  }));
}

export async function createRank(department: Rank['department'], name: string, level: number): Promise<Rank> {
  const db = await openDatabase();
  const rank: Rank = { id: newId(), department, name, level, isDefault: false };
  await db.runAsync(
    'INSERT INTO ranks (id, department, name, level, is_default) VALUES (?, ?, ?, ?, 0)',
    rank.id,
    department,
    name,
    level
  );
  return rank;
}

export async function updateRank(rank: Rank): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'UPDATE ranks SET department = ?, name = ?, level = ? WHERE id = ?',
    rank.department,
    rank.name,
    rank.level,
    rank.id
  );
}

export async function deleteRank(id: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync('DELETE FROM ranks WHERE id = ?', id);
}

const RANK_REQUIREMENTS_KEY = 'rank_requirements';
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

export async function listRankRequirements(): Promise<RankRequirement[]> {
  return getSetting<RankRequirement[]>(RANK_REQUIREMENTS_KEY, []);
}

export async function saveRankRequirements(requirements: RankRequirement[]): Promise<void> {
  await setSetting(RANK_REQUIREMENTS_KEY, requirements);
}

export async function upsertRankRequirement(requirement: RankRequirement): Promise<void> {
  const all = await listRankRequirements();
  const idx = all.findIndex((r) => r.toRankId === requirement.toRankId && r.fromRankId === requirement.fromRankId);
  if (idx >= 0) all[idx] = requirement;
  else all.push(requirement);
  await saveRankRequirements(all);
}

export async function getRequiredSeaTimeFor(
  fromRankId: string | null,
  toRankId: string | null,
  fallback = 365
): Promise<number> {
  if (!toRankId) return fallback;
  const all = await listRankRequirements();
  const match =
    all.find((r) => r.fromRankId === fromRankId && r.toRankId === toRankId) ??
    all.find((r) => r.fromRankId === null && r.toRankId === toRankId);
  return match?.requiredSeaTimeDays ?? fallback;
}

export async function logAudit(action: string, entityId: string): Promise<void> {
  await setSetting(`audit:${isoNow()}:${newId()}`, { action, entityId });
}
