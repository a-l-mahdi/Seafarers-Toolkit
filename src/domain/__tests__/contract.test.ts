import { contractCountdown, contractProgressColor, contractRangesOverlap, expectedSignOff, lerpColor, validateContract } from '../contract';
import { seaTimeForContract, sum } from '../sea-time';
import type { Contract } from '@/types/domain';

const baseContract: Contract = {
  id: 'c1',
  vesselId: 'v1',
  rankId: 'r1',
  joinDate: '2026-09-01',
  expectedSignOff: '2027-03-01',
  actualSignOff: null,
  durationDays: 181,
  status: 'active',
  notes: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

describe('expected sign off', () => {
  it('adds days', () => {
    expect(expectedSignOff('2026-09-01', { mode: 'days', days: 90 })).toBe('2026-11-30');
  });

  it('adds months', () => {
    expect(expectedSignOff('2026-09-01', { mode: 'months', months: 6 })).toBe('2027-03-01');
  });

  it('uses custom end date only if after join', () => {
    expect(expectedSignOff('2026-09-01', { mode: 'custom_date', customEndDate: '2027-03-01' })).toBe('2027-03-01');
    expect(expectedSignOff('2026-09-01', { mode: 'custom_date', customEndDate: '2026-08-01' })).toBeNull();
  });
});

describe('contract countdown', () => {
  it('counts remaining days for an active contract', () => {
    const c = contractCountdown(baseContract, new Date('2026-09-05T10:00:00Z'));
    expect(c.totalDays).toBe(181);
    expect(c.elapsedDays).toBe(4);
    expect(c.remainingDays).toBe(177);
    expect(c.ended).toBe(false);
  });

  it('clamps to end when today is after sign off', () => {
    const c = contractCountdown(baseContract, new Date('2027-06-01T10:00:00Z'));
    expect(c.remainingDays).toBe(0);
    expect(c.ended).toBe(true);
  });
});

describe('contract -> sea time integration', () => {
  it('computes sea time up to today for active contracts', () => {
    const st = seaTimeForContract(baseContract, new Date('2026-09-05T10:00:00Z'));
    expect(st).toEqual({ days: 4, hours: 0 });
  });

  it('computes sea time from actual sign off when closed', () => {
    const closed = { ...baseContract, actualSignOff: '2026-06-30', joinDate: '2026-01-01' };
    const st = seaTimeForContract(closed, new Date('2026-07-10T10:00:00Z'));
    expect(st).toEqual({ days: 180, hours: 0 });
  });

  it('sums amounts with hours normalization', () => {
    expect(sum([{ days: 1, hours: 20 }, { days: 0, hours: 8 }])).toEqual({ days: 2, hours: 4 });
  });
});

describe('validateContract', () => {
  it('rejects sign off before join', () => {
    expect(validateContract({ joinDate: '2026-09-01', expectedSignOff: '2026-08-01' }).valid).toBe(false);
    expect(validateContract({ joinDate: '2026-09-01', expectedSignOff: '2026-09-01' }).valid).toBe(false);
    expect(validateContract({ joinDate: '2026-09-01', expectedSignOff: '2027-03-01' }).valid).toBe(true);
  });
});

describe('contractRangesOverlap (sailor cannot be on two vessels at once)', () => {
  // Real-world case: MT ARGO trip actually ended 2021-08-10 (sailor left the
  // vessel), even though the expected sign-off would have been 2021-09-18.
  // MT APAMA started 2021-09-12 — no real overlap, so adding it must be allowed.
  const apama = { joinDate: '2021-09-12', expectedSignOff: '2022-01-12', actualSignOff: '2021-09-28' };

  it('uses the ACTUAL sign-off as the effective end of a trip', () => {
    const argo = { joinDate: '2021-05-18', expectedSignOff: '2021-09-18', actualSignOff: '2021-08-10' };
    expect(contractRangesOverlap(apama, argo)).toBe(false);
  });

  it('still flags overlap when the actual end reaches into the next trip', () => {
    const argo = { joinDate: '2021-05-18', expectedSignOff: '2021-09-18', actualSignOff: '2021-09-15' };
    expect(contractRangesOverlap(apama, argo)).toBe(true);
  });

  it('flags overlap with contracts that have no actual sign-off yet', () => {
    const active = { joinDate: '2025-04-14', expectedSignOff: '2025-09-22', actualSignOff: null };
    const planned = { joinDate: '2025-08-01', expectedSignOff: '2025-12-01', actualSignOff: null };
    expect(contractRangesOverlap(active, planned)).toBe(true);
  });
});

describe('contractProgressColor', () => {
  const palette = { primary: '#0000ff', success: '#00ff00' };
  const cd = (remainingDays: number, ended = false) => ({
    totalDays: 180,
    elapsedDays: 180 - remainingDays,
    remainingDays,
    progress: (180 - remainingDays) / 180,
    ended,
  });

  it('stays primary while more than 20 days remain', () => {
    expect(contractProgressColor(palette, cd(40))).toBe('#0000ff');
  });

  it('blends to teal halfway through the last 20 days', () => {
    // remaining 10 → t = 0.5 → #008080
    expect(contractProgressColor(palette, cd(10))).toBe('#008080');
  });

  it('is fully green once the contract ended', () => {
    expect(contractProgressColor(palette, cd(0, true))).toBe('#00ff00');
  });

  it('lerps colors linearly', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpColor('#204a80', '#204a80', 0.3)).toBe('#204a80');
  });
});
