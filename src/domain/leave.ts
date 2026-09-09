import type { Contract, LeaveSettings } from '@/types/domain';
import { addDaysISO, diffInDays, todayISO } from '@/utils/date';

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

export interface LeaveLedgerEntry {
  contractId: string;
  /** Leave earned by this contract alone. */
  earned: number;
  /** Unused leave carried in from previous contracts. */
  carriedIn: number;
  /** Total leave window after this contract ends: earned + carriedIn. */
  windowDays: number;
  returnDate: string;
  /** Last day of the leave window (stops early if the next contract starts sooner). */
  leaveUntil: string;
}

export interface LeaveLedger {
  entries: LeaveLedgerEntry[];
  /** Unused leave available right now (banked carry-over + earned, minus taken days). */
  unusedNow: number;
  /** Expected return date of the most recent contract. */
  lastReturnDate: string | null;
}

/**
 * Chronological leave ledger across contracts. Leave a sailor did not use
 * before rejoining (a contract may start before the previous leave is over)
 * carries over and is added on top of the next contract's earned leave.
 */
export function computeLeaveLedger(
  contracts: Contract[],
  settings: LeaveSettings,
  now: Date = new Date()
): LeaveLedger {
  const today = todayISO(now);
  const sorted = [...contracts].sort((a, b) => (a.joinDate < b.joinDate ? -1 : 1));
  const entries: LeaveLedgerEntry[] = [];
  let carried = 0;
  let unusedNow = 0;

  for (let i = 0; i < sorted.length; i += 1) {
    const c = sorted[i];
    const end = c.actualSignOff ?? c.expectedSignOff;
    const earned = earnedLeaveDays(settings, Math.max(diffInDays(c.joinDate, end), 0));
    const carriedIn = carried;
    const windowDays = earned + carriedIn;
    const returnDate = addDaysISO(end, windowDays);
    const next = sorted[i + 1];
    let leaveUntil = returnDate;
    if (next) {
      // Days actually spent off the vessel between sign-off and the next join.
      const offDays = Math.max(diffInDays(end, next.joinDate), 0);
      carried = Math.max(windowDays - Math.min(offDays, windowDays), 0);
      leaveUntil = returnDate < next.joinDate ? returnDate : next.joinDate;
    } else {
      // Last contract: leave consumed up to today (0 while still onboard).
      const raw = diffInDays(end, today);
      const offDays = Math.max(Math.min(raw, windowDays), 0);
      unusedNow = Math.max(windowDays - offDays, 0);
    }
    entries.push({ contractId: c.id, earned, carriedIn, windowDays, returnDate, leaveUntil });
  }

  return { entries, unusedNow, lastReturnDate: entries.at(-1)?.returnDate ?? null };
}
