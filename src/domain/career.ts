import type { CareerProgress } from '@/types/domain';
import { addDaysISO, todayISO } from '@/utils/date';

export interface RankLike {
  id: string;
  department: string;
  level: number;
}

/** True when the sailor holds the highest rank within their department (no further promotion). */
export function isTopRank(rankId: string | null, ranks: RankLike[]): boolean {
  if (!rankId) return false;
  const current = ranks.find((r) => r.id === rankId);
  if (!current) return false;
  return !ranks.some((r) => r.department === current.department && r.level < current.level);
}

/**
 * The promotion target: the closest more-senior rank in the same department.
 * Level 1 is the most senior, so "senior" means a LOWER level (ETO 2 → ETO 1).
 */
export function nextRankId(rankId: string | null, ranks: RankLike[]): string | null {
  if (!rankId) return null;
  const current = ranks.find((r) => r.id === rankId);
  if (!current) return null;
  const senior = ranks
    .filter((r) => r.department === current.department && r.level < current.level)
    .sort((a, b) => b.level - a.level);
  return senior[0]?.id ?? null;
}

/** Ranks more senior than `rankId` in its department, most junior first (valid "next rank" picks). */
export function seniorRanks<T extends RankLike>(rankId: string | null, ranks: T[]): T[] {
  const current = rankId ? ranks.find((r) => r.id === rankId) : null;
  if (!current) return [];
  return ranks
    .filter((r) => r.department === current.department && r.level < current.level)
    .sort((a, b) => b.level - a.level);
}

/** Ranks of one department (all ranks when no department is chosen yet). */
export function ranksForDepartment<T extends RankLike>(ranks: T[], department: string | null): T[] {
  return department ? ranks.filter((r) => r.department === department) : ranks;
}

/**
 * The sailor's next rank: the one picked in the profile when it is still a valid
 * promotion (same department, more senior), otherwise the next rank on the ladder.
 */
export function resolveNextRankId(
  currentRankId: string | null,
  preferredNextId: string | null,
  ranks: RankLike[]
): string | null {
  if (preferredNextId && seniorRanks(currentRankId, ranks).some((r) => r.id === preferredNextId)) {
    return preferredNextId;
  }
  return nextRankId(currentRankId, ranks);
}

/** Promotion sea time in days from the rank's configured months (1 month ≈ 30.44 days). */
export function promotionDaysFromMonths(months: number | null, fallback = 365): number {
  if (!months || months <= 0) return fallback;
  return Math.round(months * 30.44);
}

export function careerProgress(completedDays: number, requiredDays: number): CareerProgress {
  const required = Math.max(requiredDays, 0);
  const completed = Math.max(completedDays, 0);
  const remaining = Math.max(required - completed, 0);
  const progress = required > 0 ? Math.min(completed / required, 1) : 0;
  return { completed, required, remaining, progress, complete: remaining === 0 && required > 0 };
}

/** Estimated date the remaining sea time is completed if the sailor stays onboard continuously. */
export function estimatedQualificationDate(
  remainingDays: number,
  activeContractJoinDate: string | null,
  activeContractExpectedSignOff: string | null,
  now: Date = new Date()
): string | null {
  if (remainingDays <= 0) return null;
  if (!activeContractJoinDate || !activeContractExpectedSignOff) return null;
  const today = todayISO(now);
  // Prediction only makes sense while the contract is running (or still ahead:
  // sea time then starts counting on its join date).
  if (today > activeContractExpectedSignOff) return null;
  const from = today > activeContractJoinDate ? today : activeContractJoinDate;
  return addDaysISO(from, remainingDays);
}
