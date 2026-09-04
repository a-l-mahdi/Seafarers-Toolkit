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
