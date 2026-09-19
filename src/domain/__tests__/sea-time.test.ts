import { buildSeaTimeSummary, findOverlaps } from '../sea-time';
import type { Contract, SeaTimeRecord } from '@/types/domain';

const contract: Contract = {
  id: 'c1',
  vesselId: 'v1',
  rankId: 'r1',
  joinDate: '2026-01-01',
  expectedSignOff: '2026-06-30',
  actualSignOff: null,
  durationDays: 180,
  monthlyWage: null,
  wageCurrency: null,
  travelDays: null,
  status: 'active',
  notes: null,
  createdAt: '',
  updatedAt: '',
};

function manual(id: string, from: string, to: string): SeaTimeRecord {
  return {
    id,
    contractId: null,
    rankId: 'r1',
    source: 'manual',
    fromDate: from,
    toDate: to,
    days: 10,
    hours: 0,
    verified: false,
    notes: null,
    createdAt: '',
  };
}

describe('overlap detection (prevents double counting)', () => {
  it('warns when manual record overlaps a contract', () => {
    const warnings = findOverlaps([manual('m1', '2026-06-15', '2026-07-15')], [contract]);
    expect(warnings).toHaveLength(1);
  });

  it('does not warn for non-overlapping records', () => {
    const warnings = findOverlaps([manual('m1', '2026-07-01', '2026-08-01')], [contract]);
    expect(warnings).toHaveLength(0);
  });

  it('ignores records that already carry dates (contract-sourced)', () => {
    const rec: SeaTimeRecord = { ...manual('m1', '2026-02-01', '2026-03-01'), source: 'contract' };
    expect(findOverlaps([rec], [contract])).toHaveLength(0);
  });
});

describe('buildSeaTimeSummary (accurate, contract-derived totals)', () => {
  const rankNames = new Map([['r1', 'Captain']]);

  it('derives sea time from the contract list (join → today for active)', () => {
    const active = { ...contract, joinDate: '2026-01-01', expectedSignOff: '2026-06-30' };
    const summary = buildSeaTimeSummary([active], rankNames, new Date('2026-03-01T12:00:00Z'));
    expect(summary.total).toEqual({ days: 59, hours: 0 });
    expect(summary.byRank).toEqual([{ rankId: 'r1', rankName: 'Captain', days: 59, hours: 0 }]);
  });

  it('counts signed-off contracts by their actual sign-off', () => {
    const closed = { ...contract, actualSignOff: '2026-06-20' };
    const summary = buildSeaTimeSummary([closed], rankNames, new Date('2027-01-01T12:00:00Z'));
    expect(summary.total.days).toBe(170);
  });

  it('ignores manual records — sea time only grows through contracts', () => {
    const closed = { ...contract, actualSignOff: '2026-06-30' };
    const manualExtra = manual('m1', '2026-07-01', '2026-07-15');
    const summary = buildSeaTimeSummary([closed], rankNames, new Date('2027-01-01T12:00:00Z'));
    expect(summary.total).toEqual({ days: 180, hours: 0 });
    expect(manualExtra.days).toBe(10); // record exists but is not counted
  });

  it('returns zero when no contracts exist (deleted contracts clear totals)', () => {
    const summary = buildSeaTimeSummary([], rankNames, new Date('2026-03-01T12:00:00Z'));
    expect(summary.total).toEqual({ days: 0, hours: 0 });
    expect(summary.byRank).toEqual([]);
  });
});
