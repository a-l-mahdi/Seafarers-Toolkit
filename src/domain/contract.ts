import type { Contract, DurationMode } from '@/types/domain';
import { addDaysISO, addMonthsISO, diffInDays, isBefore, todayISO } from '@/utils/date';

export interface DurationInput {
  mode: DurationMode;
  days?: number;
  months?: number;
  customEndDate?: string | null;
}

/**
 * Computes the expected sign-off date from a join date and duration.
 * Days: join + N days. Months: join + N months (month-end clamped).
 * Custom: the user-provided date (must be after join).
 */
export function expectedSignOff(joinDate: string, duration: DurationInput): string | null {
  switch (duration.mode) {
    case 'days':
      return duration.days && duration.days > 0 ? addDaysISO(joinDate, duration.days) : null;
    case 'months':
      return duration.months && duration.months > 0
        ? addMonthsISO(joinDate, duration.months)
        : null;
    case 'custom_date':
      return duration.customEndDate && isBefore(joinDate, duration.customEndDate)
        ? duration.customEndDate
        : null;
    default:
      return null;
  }
}

export interface ContractCountdown {
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  progress: number;
  ended: boolean;
}

/** Days before the contract ends when the bar starts shifting from blue toward green. */
export const CONTRACT_APPROACH_DAYS = 20;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

/** Linear blend between two hex colors (t = 0 → a, t = 1 → b); passes through teal midway. */
export function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const mix = ca.map((v, i) => Math.round(v + (cb[i] - v) * Math.min(Math.max(t, 0), 1)));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Contract bar color: blue while plenty of time remains, blends toward green
 * over the last CONTRACT_APPROACH_DAYS days, fully green once the contract ends.
 */
export function contractProgressColor(
  colors: { primary: string; success: string },
  cd: ContractCountdown
): string {
  if (cd.ended) return colors.success;
  if (cd.remainingDays >= CONTRACT_APPROACH_DAYS) return colors.primary;
  return lerpColor(colors.primary, colors.success, 1 - cd.remainingDays / CONTRACT_APPROACH_DAYS);
}

export function contractCountdown(contract: Contract, now: Date = new Date()): ContractCountdown {
  const end = contract.actualSignOff ?? contract.expectedSignOff;
  const totalDays = diffInDays(contract.joinDate, end);
  const today = todayISO(now);
  const reference = isBefore(today, end) ? today : end;
  const elapsedDays = Math.max(diffInDays(contract.joinDate, reference), 0);
  const remainingDays = Math.max(totalDays - elapsedDays, 0);
  const progress = totalDays > 0 ? Math.min(elapsedDays / totalDays, 1) : 0;
  return { totalDays, elapsedDays, remainingDays, progress, ended: elapsedDays >= totalDays };
}

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * A sailor cannot be on two vessels at once: ranges [join, signOff] must not
 * overlap. Used both for form validation and as a safety net in the repository.
 */
export function contractRangesOverlap(
  a: { joinDate: string; expectedSignOff: string; actualSignOff?: string | null },
  b: { joinDate: string; expectedSignOff: string; actualSignOff?: string | null }
): boolean {
  const aEnd = a.actualSignOff ?? a.expectedSignOff;
  const bEnd = b.actualSignOff ?? b.expectedSignOff;
  return a.joinDate <= bEnd && b.joinDate <= aEnd;
}

export function validateContract(input: {
  joinDate: string;
  expectedSignOff: string;
  actualSignOff?: string | null;
}): ContractValidationResult {
  const errors: string[] = [];
  if (!isBefore(input.joinDate, input.expectedSignOff)) {
    errors.push('sign_off_before_join');
  }
  if (input.actualSignOff && !isBefore(input.joinDate, input.actualSignOff)) {
    errors.push('sign_off_before_join');
  }
  return { valid: errors.length === 0, errors };
}
