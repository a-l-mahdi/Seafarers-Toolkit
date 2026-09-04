import { daysUntilReturn, expectedReturnDate, leaveDaysFor } from '../leave';

describe('leave', () => {
  it('uses configured leave days in ratio mode', () => {
    const s = { mode: 'ratio' as const, onboardDays: 60, leaveDays: 30, manualLeaveStartDate: null, manualLeaveEndDate: null };
    expect(leaveDaysFor(s)).toBe(30);
  });

  it('computes manual leave days from dates', () => {
    const s = { mode: 'manual' as const, onboardDays: 60, leaveDays: 30, manualLeaveStartDate: '2027-03-01', manualLeaveEndDate: '2027-03-11' };
    expect(leaveDaysFor(s)).toBe(10);
  });

  it('computes expected return date after sign off', () => {
    const s = { mode: 'ratio' as const, onboardDays: 60, leaveDays: 30, manualLeaveStartDate: null, manualLeaveEndDate: null };
    expect(expectedReturnDate('2027-03-01', s)).toBe('2027-03-31');
  });

  it('counts days until return and never goes negative', () => {
    const now = new Date('2027-03-08T12:00:00Z');
    expect(daysUntilReturn('2027-03-31', now)).toBe(23);
    expect(daysUntilReturn('2027-03-01', now)).toBe(0);
  });
});
