import type { CareerProgress } from '@/types/domain';
import { addDaysISO, todayISO } from '@/utils/date';

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
  // Prediction only makes sense while the contract is running.
  if (today > activeContractExpectedSignOff) return null;
  return addDaysISO(today, remainingDays);
}
