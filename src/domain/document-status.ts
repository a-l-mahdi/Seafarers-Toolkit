import type { DocumentStatusType } from '@/types/domain';
import { isBefore, todayISO } from '@/utils/date';

export const DEFAULT_EXPIRY_WARNING_DAYS = 30;
/** Company rule: a document with less than this validity does not allow joining a vessel. */
export const DEFAULT_VALIDITY_DAYS = 180;

export interface DocumentStatusInput {
  expiryDate: string | null;
  warningThresholdDays?: number | null;
  validThresholdDays?: number | null;
}

export function documentStatus(
  input: DocumentStatusInput,
  now: Date = new Date()
): DocumentStatusType {
  if (!input.expiryDate) return 'no_expiry';
  const today = todayISO(now);
  if (isBefore(input.expiryDate, today)) return 'expired';
  const daysLeft = daysUntilExpiry(input.expiryDate, now);
  const validDays = input.validThresholdDays ?? 0;
  const warningDays = input.warningThresholdDays ?? DEFAULT_EXPIRY_WARNING_DAYS;
  if (validDays > 0 && daysLeft < validDays) return 'not_valid';
  return daysLeft <= warningDays ? 'expiring_soon' : 'valid';
}

export function daysUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  return diff(expiryDate, todayISO(now));
}

function diff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}
