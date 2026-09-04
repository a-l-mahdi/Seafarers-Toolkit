import type { DocumentStatusType } from '@/types/domain';
import { isBefore, todayISO } from '@/utils/date';

export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export function documentStatus(
  expiryDate: string | null,
  now: Date = new Date(),
  warningDays: number = DEFAULT_EXPIRY_WARNING_DAYS
): DocumentStatusType {
  if (!expiryDate) return 'no_expiry';
  const today = todayISO(now);
  if (isBefore(expiryDate, today)) return 'expired';
  const daysLeft = diff(expiryDate, today);
  return daysLeft <= warningDays ? 'expiring_soon' : 'valid';
}

export function daysUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  return diff(expiryDate, todayISO(now));
}

function diff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}
