import type { Contract, LeaveSettings } from '@/types/domain';
import { contractCountdown } from '@/domain/contract';
import { earnedLeaveDays } from '@/domain/leave';
import { diffInDays } from '@/utils/date';

/** Seafarer wages are quoted per calendar month; the daily rate is the standard
 *  monthly ÷ 30 used across shipping payrolls. */
export const WAGE_DAYS_PER_MONTH = 30;

export function dailyWage(monthlyWage: number | null | undefined): number {
  if (!monthlyWage || monthlyWage <= 0) return 0;
  return monthlyWage / WAGE_DAYS_PER_MONTH;
}

export interface ContractFinance {
  hasWage: boolean;
  monthlyWage: number;
  dailyRate: number;
  currency: string;
  totalDays: number;
  elapsedDays: number;
  remainingDays: number;
  progress: number;
  ended: boolean;
  travelDays: number;
  travelPay: number;
  /** Wage for the days worked so far (join → today, capped at sign-off). */
  earnedToDate: number;
  /** Wage for the full contract length. */
  earnedFullContract: number;
  /** Full-contract wage plus the travel/repatriation allowance. */
  totalWithTravel: number;
}

/** Wage + progress figures for a contract as of `now`. */
export function contractFinance(contract: Contract, now: Date = new Date()): ContractFinance {
  const cd = contractCountdown(contract, now);
  const monthlyWage = contract.monthlyWage ?? 0;
  const rate = dailyWage(monthlyWage);
  const travelDays = Math.max(contract.travelDays ?? 0, 0);
  const travelPay = rate * travelDays;
  return {
    hasWage: monthlyWage > 0,
    monthlyWage,
    dailyRate: rate,
    currency: contract.wageCurrency || 'USD',
    totalDays: cd.totalDays,
    elapsedDays: cd.elapsedDays,
    remainingDays: cd.remainingDays,
    progress: cd.progress,
    ended: cd.ended,
    travelDays,
    travelPay,
    earnedToDate: rate * cd.elapsedDays,
    earnedFullContract: rate * cd.totalDays,
    totalWithTravel: rate * cd.totalDays + travelPay,
  };
}

export interface SignOffProjection {
  /** Onboard days from join to the chosen sign-off date. */
  days: number;
  /** Wage for those days plus the travel allowance. */
  wage: number;
  /** Wage for those days only (before the travel allowance). */
  wageBeforeTravel: number;
  /** Leave earned for those onboard days. */
  leaveDays: number;
}

/** What the sailor would earn and accrue if they signed off on `signOffISO`. */
export function projectSignOff(
  contract: Contract,
  settings: LeaveSettings,
  signOffISO: string
): SignOffProjection {
  const rate = dailyWage(contract.monthlyWage);
  const travelPay = rate * Math.max(contract.travelDays ?? 0, 0);
  const days = Math.max(diffInDays(contract.joinDate, signOffISO), 0);
  const wageBeforeTravel = rate * days;
  return {
    days,
    wageBeforeTravel,
    wage: wageBeforeTravel + travelPay,
    leaveDays: earnedLeaveDays(settings, days),
  };
}

/** Whole-unit money label with thousands separators, e.g. "12,500 USD". */
export function formatMoney(amount: number, currency: string): string {
  const rounded = Math.round(amount || 0);
  return `${rounded.toLocaleString('en-US')} ${currency}`;
}
