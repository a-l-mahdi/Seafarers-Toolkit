import { contractFinance, projectSignOff, dailyWage } from '../contract-finance';
import type { Contract, LeaveSettings } from '@/types/domain';

const ratio: LeaveSettings = {
  mode: 'ratio',
  onboardDays: 30,
  leaveDays: 15, // 0.5 leave day per onboard day
  manualLeaveStartDate: null,
  manualLeaveEndDate: null,
};

function contract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 'c1',
    vesselId: 'v1',
    rankId: 'r1',
    joinDate: '2026-01-01',
    expectedSignOff: '2026-05-01', // 120 days
    actualSignOff: null,
    durationDays: 120,
    monthlyWage: 3000, // → 100/day
    wageCurrency: 'USD',
    travelDays: 2,
    status: 'active',
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('contract finance', () => {
  it('daily rate is monthly ÷ 30', () => {
    expect(dailyWage(3000)).toBe(100);
    expect(dailyWage(0)).toBe(0);
    expect(dailyWage(null)).toBe(0);
  });

  it('earns full contract wage plus the travel allowance', () => {
    // "now" past the end so it is fully elapsed.
    const fin = contractFinance(contract(), new Date('2026-06-01T00:00:00'));
    expect(fin.totalDays).toBe(120);
    expect(fin.elapsedDays).toBe(120);
    expect(fin.earnedFullContract).toBe(12000); // 120 × 100
    expect(fin.travelPay).toBe(200); // 2 × 100
    expect(fin.totalWithTravel).toBe(12200);
  });

  it('prorates earnings to the days worked so far', () => {
    // 30 days into the contract.
    const fin = contractFinance(contract(), new Date('2026-01-31T00:00:00'));
    expect(fin.elapsedDays).toBe(30);
    expect(fin.earnedToDate).toBe(3000); // 30 × 100
  });

  it('projects wage + leave for a chosen sign-off date', () => {
    const proj = projectSignOff(contract(), ratio, '2026-03-02'); // 60 days
    expect(proj.days).toBe(60);
    expect(proj.wageBeforeTravel).toBe(6000); // 60 × 100
    expect(proj.wage).toBe(6200); // + 2 travel days × 100
    expect(proj.leaveDays).toBe(30); // 60 × 0.5
  });

  it('reports no wage when none is set', () => {
    const fin = contractFinance(contract({ monthlyWage: null }));
    expect(fin.hasWage).toBe(false);
    expect(fin.earnedFullContract).toBe(0);
  });
});
