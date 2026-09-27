import type { Contract } from '@/types/domain';
import { contractFinance } from '@/domain/contract-finance';
import { contractPhase } from '@/domain/contract';
import { seaTimeForContract } from '@/domain/sea-time';
import { diffInDays, gregorianToJalali, jalaliToGregorianExact, maxISO, minISO, todayISO } from '@/utils/date';

/** Days as years / months / days (365- and 30-day units, as crews count sea time). */
export function splitDuration(totalDays: number): { years: number; months: number; days: number } {
  const total = Math.max(Math.round(totalDays), 0);
  const years = Math.floor(total / 365);
  const rest = total - years * 365;
  const months = Math.floor(rest / 30);
  return { years, months, days: rest - months * 30 };
}

export type CalendarKind = 'gregorian' | 'jalali';

function yearOf(iso: string, calendar: CalendarKind): number {
  return Number((calendar === 'jalali' ? gregorianToJalali(iso) : iso).slice(0, 4));
}

function yearStart(year: number, calendar: CalendarKind): string {
  return calendar === 'jalali' ? (jalaliToGregorianExact(year, 1, 1) ?? `${year + 621}-03-21`) : `${year}-01-01`;
}

/** The dates a contract counts as sea time (same rule as the sea-time totals); null if not started. */
function seaSpan(contract: Contract, now: Date): { from: string; to: string } | null {
  const today = todayISO(now);
  if (contract.joinDate > today) return null;
  const days = seaTimeForContract(contract, now).days;
  if (days <= 0) return null;
  const to = contract.actualSignOff ?? minISO(contract.expectedSignOff, today);
  return { from: contract.joinDate, to };
}

/** Sea days falling in each calendar year (Gregorian or Jalali), oldest first. */
export function seaDaysByYear(
  contracts: Contract[],
  calendar: CalendarKind,
  now: Date = new Date(),
): { year: number; days: number }[] {
  const byYear = new Map<number, number>();
  for (const c of contracts) {
    const span = seaSpan(c, now);
    if (!span) continue;
    for (let y = yearOf(span.from, calendar); y <= yearOf(span.to, calendar); y += 1) {
      const from = maxISO(span.from, yearStart(y, calendar));
      const to = minISO(span.to, yearStart(y + 1, calendar));
      const days = Math.max(diffInDays(from, to), 0);
      if (days > 0) byYear.set(y, (byYear.get(y) ?? 0) + days);
    }
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, days]) => ({ year, days }));
}

/** Share of the time since the first day at sea that was spent on board (0–1). */
export function atSeaShare(contracts: Contract[], now: Date = new Date()): number {
  const spans = contracts.map((c) => seaSpan(c, now)).filter((s): s is { from: string; to: string } => !!s);
  if (!spans.length) return 0;
  const first = spans.reduce((min, s) => minISO(min, s.from), spans[0].from);
  const elapsed = diffInDays(first, todayISO(now));
  if (elapsed <= 0) return 1;
  const sea = contracts.reduce((sum, c) => sum + seaTimeForContract(c, now).days, 0);
  return Math.min(sea / elapsed, 1);
}

export interface CurrencyEarnings {
  currency: string;
  /** Every contract's full pay: wage for its length + travel allowance + bonus. */
  total: number;
  /** Already earned: finished trips in full, the running trip's wage so far. */
  earned: number;
  wages: number;
  travel: number;
  bonus: number;
  contracts: number;
}

/** Earnings per currency, the largest first. */
export function earningsByCurrency(contracts: Contract[], now: Date = new Date()): CurrencyEarnings[] {
  const map = new Map<string, CurrencyEarnings>();
  for (const c of contracts) {
    const fin = contractFinance(c, now);
    if (!fin.hasWage) continue;
    const e = map.get(fin.currency) ?? {
      currency: fin.currency,
      total: 0,
      earned: 0,
      wages: 0,
      travel: 0,
      bonus: 0,
      contracts: 0,
    };
    const phase = contractPhase(c, now);
    e.total += fin.totalWithTravel;
    e.earned += phase === 'completed' ? fin.totalWithTravel : phase === 'active' ? fin.earnedToDate : 0;
    e.wages += fin.earnedFullContract;
    e.travel += fin.travelPay;
    e.bonus += fin.bonus;
    e.contracts += 1;
    map.set(fin.currency, e);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
