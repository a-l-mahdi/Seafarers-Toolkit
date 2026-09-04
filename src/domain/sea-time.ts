import type { Contract, SeaTimeAmount, SeaTimeRecord } from '@/types/domain';
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
