import type { Contract, SeaTimeAmount, SeaTimeByRank, SeaTimeRecord } from '@/types/domain';
import { diffInDays, isBefore, todayISO } from '@/utils/date';

export function normalize({ days, hours }: SeaTimeAmount): SeaTimeAmount {
  const totalHours = days * 24 + hours;
  return { days: Math.floor(totalHours / 24), hours: totalHours % 24 };
}

export function add(a: SeaTimeAmount, b: SeaTimeAmount): SeaTimeAmount {
  return normalize({ days: a.days + b.days, hours: a.hours + b.hours });
}

export function sum(items: SeaTimeAmount[]): SeaTimeAmount {
  return items.reduce((acc, cur) => add(acc, cur), { days: 0, hours: 0 });
}

export function seaTimeFromRange(fromDate: string, toDate: string): SeaTimeAmount {
  const days = diffInDays(fromDate, toDate);
  return { days: Math.max(days, 0), hours: 0 };
}

/**
 * Sea time earned by a contract up to a reference date.
 * - Active/planned contracts: counted up to min(today, expectedSignOff).
 * - Signed off contracts: counted between join and actual sign off.
 */
export function seaTimeForContract(contract: Contract, now: Date = new Date()): SeaTimeAmount {
  if (contract.actualSignOff) {
    return seaTimeFromRange(contract.joinDate, contract.actualSignOff);
  }
  const today = todayISO(now);
  const end = isBefore(contract.expectedSignOff, today) ? contract.expectedSignOff : today;
  return seaTimeFromRange(contract.joinDate, end);
}

export interface OverlapWarning {
  manualRecordId: string;
  contractId: string;
}

/** Detect manual sea time records overlapping a contract for the same rank. */
export function findOverlaps(
  manualRecords: SeaTimeRecord[],
  contracts: Contract[]
): OverlapWarning[] {
  const warnings: OverlapWarning[] = [];
  for (const record of manualRecords) {
    if (record.source !== 'manual' || !record.fromDate || !record.toDate) continue;
    for (const contract of contracts) {
      const end = contract.actualSignOff ?? contract.expectedSignOff;
      const overlaps =
        !isBefore(record.toDate, contract.joinDate) && !isBefore(end, record.fromDate);
      if (overlaps) {
        warnings.push({ manualRecordId: record.id, contractId: contract.id });
      }
    }
  }
  return warnings;
}

export interface SeaTimeSummary {
  total: SeaTimeAmount;
  byRank: SeaTimeByRank[];
}

/**
 * Accurate sea-time totals derived ONLY from the contracts list (computed live
 * so sign-off dates and edits are always reflected). Manual/imported records
 * are not counted — sea time grows by adding and completing contracts.
 */
export function buildSeaTimeSummary(
  contracts: Contract[],
  rankNames: Map<string, string>,
  now: Date = new Date()
): SeaTimeSummary {
  const buckets = new Map<string | null, SeaTimeAmount>();
  const push = (rankId: string | null, amount: SeaTimeAmount) => {
    const key = rankId ?? '_none';
    buckets.set(key, sum([buckets.get(key) ?? { days: 0, hours: 0 }, amount]));
  };

  for (const contract of contracts) {
    push(contract.rankId || null, seaTimeForContract(contract, now));
  }

  const byRank: SeaTimeByRank[] = [...buckets.entries()]
    .map(([key, amount]) => {
      const rankId = key === '_none' ? null : key;
      const rankName = rankId ? (rankNames.get(rankId) ?? rankId) : 'Unranked';
      return { rankId, rankName, days: amount.days, hours: amount.hours };
    })
    .sort((a, b) => b.days - a.days);

  return { total: sum([...buckets.values()]), byRank };
}
