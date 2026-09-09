import type { LeaveSettings } from '@/types/domain';
import { addDaysISO } from '@/utils/date';

/**
 * Leave earned for a given amount of actual sea time.
 * Ratio mode: (daysOnboard / onboardDays) × leaveDays, rounded UP to whole days
 * (e.g. 65.5 earned days counts as 66 on the calendar).
 * Manual mode: the user's chosen leave window length, rounded up.
 */
export function earnedLeaveDays(settings: LeaveSettings, daysOnboard: number): number {
  switch (settings.mode) {
    case 'ratio': {
      const base = Math.max(settings.onboardDays, 1);
      const earned = (Math.max(daysOnboard, 0) / base) * Math.max(settings.leaveDays, 0);
      return Math.ceil(earned);
    }
    case 'manual': {
      if (!settings.manualLeaveStartDate || !settings.manualLeaveEndDate) {
        return Math.ceil(Math.max(settings.leaveDays, 0));
      }
      return Math.max(
        Math.ceil(
          (Date.parse(settings.manualLeaveEndDate) - Date.parse(settings.manualLeaveStartDate)) /
            86_400_000
        ),
        0
      );
    }
    default:
      return Math.ceil(Math.max(settings.leaveDays, 0));
  }
}

/** Backwards-compatible alias for earnedLeaveDays. */
export function leaveDaysFor(settings: LeaveSettings, daysOnboard: number): number {
  return earnedLeaveDays(settings, daysOnboard);
}

/** Date the sailor is expected to return to the vessel after sign off. */
export function expectedReturnDate(
  signOffDate: string,
  settings: LeaveSettings,
  daysOnboard: number
): string {
  return addDaysISO(signOffDate, earnedLeaveDays(settings, daysOnboard));
}

export function daysUntilReturn(expectedReturn: string, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = expectedReturn.split('-').map(Number);
  const ret = new Date(y, m - 1, d);
  return Math.max(Math.round((ret.getTime() - today.getTime()) / 86_400_000), 0);
}
