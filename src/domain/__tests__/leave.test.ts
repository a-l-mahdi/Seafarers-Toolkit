import { daysUntilReturn, earnedLeaveDays, expectedReturnDate, leaveDaysFor } from '../leave';

const ratio = (onboardDays: number, leaveDays: number) => ({
  mode: 'ratio' as const,
  onboardDays,
  leaveDays,
  manualLeaveStartDate: null,
  manualLeaveEndDate: null,
});

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

  it('counts days until return and never goes negative', () => {
    const now = new Date('2027-03-08T12:00:00Z');
    expect(daysUntilReturn('2027-03-31', now)).toBe(23);
    expect(daysUntilReturn('2027-03-01', now)).toBe(0);
  });
});
