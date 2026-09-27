import type { Contract } from '@/types/domain';
import { todayISO } from '@/utils/date';
import { seaTimeForContract } from './sea-time';

/** 1 month ≈ 30.44 days (same factor as rank promotion requirements). */
export const DAYS_PER_MONTH = 30.44;

export interface RankTrip {
  contractId: string;
  vesselName: string | null;
  joinDate: string;
  days: number;
}

export interface RankStage {
  rankId: string;
  /** Sea time served in this rank (all its trips). */
  days: number;
  /** Sea time from the first day at sea up to the end of this rank. */
  cumulativeDays: number;
  /** This rank's trips, oldest first. */
  trips: RankTrip[];
}

type TimelineContract = Contract & { vesselName?: string | null };

/**
 * Career timeline: ranks in the order they were first served, each carrying its
 * own sea time and the running total since the first day at sea — so the curve
 * only goes up (cadet 12 → ETO 2 at 12 → ETO 1 at 12 + 48 …).
 * Contracts without a rank, and ones that have not started yet, are left out.
 */
export function buildCareerTimeline(contracts: TimelineContract[], now: Date = new Date()): RankStage[] {
  const today = todayISO(now);
  const sorted = [...contracts]
    .filter((c) => !!c.rankId && c.joinDate <= today)
    .sort((a, b) => (a.joinDate < b.joinDate ? -1 : a.joinDate > b.joinDate ? 1 : 0));

  const stages = new Map<string, RankStage>();
  for (const c of sorted) {
    const rankId = c.rankId as string;
    let stage = stages.get(rankId);
    if (!stage) {
      stage = { rankId, days: 0, cumulativeDays: 0, trips: [] };
      stages.set(rankId, stage);
    }
    const days = seaTimeForContract(c, now).days;
    stage.days += days;
    stage.trips.push({ contractId: c.id, vesselName: c.vesselName ?? null, joinDate: c.joinDate, days });
  }

  let running = 0;
  const ordered = [...stages.values()];
  for (const stage of ordered) {
    running += stage.days;
    stage.cumulativeDays = running;
  }
  return ordered;
}

/** Days → months with one decimal (0.0 when none). */
export function toMonths(days: number): number {
  return Math.round((days / DAYS_PER_MONTH) * 10) / 10;
}
