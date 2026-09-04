import { contractCountdown, expectedSignOff, validateContract } from '../contract';
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
