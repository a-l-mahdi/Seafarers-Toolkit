import type { LeaveSettings } from '@/types/domain';
import { addDaysISO } from '@/utils/date';

export function leaveDaysFor(settings: LeaveSettings): number {
  switch (settings.mode) {
    case 'ratio':
      return Math.max(settings.leaveDays, 0);
    case 'manual':
      return settings.manualLeaveStartDate && settings.manualLeaveEndDate
        ? Math.max(
            Math.round(
              (Date.parse(settings.manualLeaveEndDate) - Date.parse(settings.manualLeaveStartDate)) /
                86_400_000
            ),
            0
          )
        : settings.leaveDays;
    default:
      return settings.leaveDays;
  }
}

/** Date the sailor is expected to return to the vessel after sign off. */
export function expectedReturnDate(signOffDate: string, settings: LeaveSettings): string {
  return addDaysISO(signOffDate, leaveDaysFor(settings));
}

export function daysUntilReturn(expectedReturn: string, now: Date = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = expectedReturn.split('-').map(Number);
  const ret = new Date(y, m - 1, d);
  return Math.max(Math.round((ret.getTime() - today.getTime()) / 86_400_000), 0);
}
