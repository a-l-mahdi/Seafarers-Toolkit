import { computeLeaveLedger, earnedLeaveDays, expectedReturnDate, leaveDaysFor } from '../leave';
import type { Contract } from '@/types/domain';

const ratio = (onboardDays: number, leaveDays: number) => ({
  mode: 'ratio' as const,
  onboardDays,
  leaveDays,
  manualLeaveStartDate: null,
  manualLeaveEndDate: null,
});

function contract(id: string, joinDate: string, expectedSignOff: string, actualSignOff: string | null = null): Contract {
  return {
    id,
    vesselId: 'v1',
    rankId: 'r1',
    joinDate,
    expectedSignOff,
    actualSignOff,
    durationDays: null,
    monthlyWage: null,
    wageCurrency: null,
    travelDays: null,
    status: actualSignOff ? 'completed' : 'active',
    notes: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('leave', () => {
  it('prorates leave by actual sea days (120/30 × 17.5 = 70)', () => {
    expect(earnedLeaveDays(ratio(30, 17.5), 120)).toBe(70);
  });

  it('rounds earned leave up to whole days', () => {
    // 100/30 × 17.5 = 58.33 → 59
    expect(earnedLeaveDays(ratio(30, 17.5), 100)).toBe(59);
    // 65.5 exact earning still rounds up to 66
    expect(earnedLeaveDays(ratio(30, 16.375), 120)).toBe(66);
  });

  it('handles fractional ratios like 17.5 leave per 30 days at 60 days', () => {
    expect(earnedLeaveDays(ratio(30, 17.5), 60)).toBe(35);
  });

  it('returns 0 for no sea time', () => {
    expect(earnedLeaveDays(ratio(30, 17.5), 0)).toBe(0);
  });

  it('keeps legacy alias behaviour for a full base period', () => {
    expect(leaveDaysFor(ratio(60, 30), 60)).toBe(30);
  });

  it('computes manual leave days from dates', () => {
    const s = { mode: 'manual' as const, onboardDays: 60, leaveDays: 30, manualLeaveStartDate: '2027-03-01', manualLeaveEndDate: '2027-03-11' };
    expect(earnedLeaveDays(s, 90)).toBe(10);
  });

  it('computes expected return date after sign off', () => {
    expect(expectedReturnDate('2027-03-01', ratio(60, 30), 60)).toBe('2027-03-31');
  });
});

describe('computeLeaveLedger (unused leave carries over to the next contract)', () => {
  // 30 days onboard → 17.5 leave, rounded up per contract.
  const settings = ratio(30, 17.5);

  it('adds unused leave on top of the next contract’s earned leave', () => {
    // A: 2026-01-01 → 2026-05-01 = 120 days → 70 earned. Return = 2026-07-10.
    // B starts 2026-05-11 → only 10 days of leave taken → 60 carried into B.
    // B: 2026-05-11 → 2026-09-01 = 113 days → ceil(65.83) = 66 earned.
    // B window = 66 + 60 = 126 → return 2027-01-05.
    const ledger = computeLeaveLedger(
      [contract('a', '2026-01-01', '2026-05-01', '2026-05-01'), contract('b', '2026-05-11', '2026-09-01')],
      settings
    );
    expect(ledger.entries[0]).toMatchObject({ earned: 70, carriedIn: 0, windowDays: 70, returnDate: '2026-07-10' });
    expect(ledger.entries[1]).toMatchObject({ earned: 66, carriedIn: 60, windowDays: 126, returnDate: '2027-01-05' });
    expect(ledger.entries[1].leaveUntil).toBe('2027-01-05');
  });

  it('transfers unused leave to after the new contract and stops leave at rejoin date', () => {
    const ledger = computeLeaveLedger(
      [contract('a', '2026-01-01', '2026-05-01', '2026-05-01'), contract('b', '2026-05-11', '2026-09-01')],
      settings
    );
    // A's drawn leave on the calendar ends when B starts (2026-05-11).
    expect(ledger.entries[0].leaveUntil).toBe('2026-05-11');
  });

  it('reports unused leave right now for the last contract', () => {
    // B ended 2026-09-01 (window 126 → return 2027-01-05); on 2026-11-01
    // 61 days of leave have been taken → 65 unused remain.
    const ledger = computeLeaveLedger(
      [
        contract('a', '2026-01-01', '2026-05-01', '2026-05-01'),
        contract('b', '2026-05-11', '2026-09-01', '2026-09-01'),
      ],
      settings,
      new Date('2026-11-01T12:00:00Z')
    );
    expect(ledger.unusedNow).toBe(65);
    expect(ledger.lastReturnDate).toBe('2027-01-05');
  });

  it('counts full window as unused while the sailor is still onboard', () => {
    const ledger = computeLeaveLedger(
      [contract('b', '2026-05-11', '2026-09-01')],
      settings,
      new Date('2026-06-01T12:00:00Z')
    );
    expect(ledger.unusedNow).toBe(66);
  });
});
