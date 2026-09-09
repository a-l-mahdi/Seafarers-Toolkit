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
    const summary = buildSeaTimeSummary([active], [], rankNames, new Date('2026-03-01T12:00:00Z'));
    expect(summary.total).toEqual({ days: 59, hours: 0 });
    expect(summary.byRank).toEqual([{ rankId: 'r1', rankName: 'Captain', days: 59, hours: 0 }]);
  });

  it('counts signed-off contracts by their actual sign-off', () => {
    const closed = { ...contract, actualSignOff: '2026-06-20' };
    const summary = buildSeaTimeSummary([closed], [], rankNames, new Date('2027-01-01T12:00:00Z'));
    expect(summary.total.days).toBe(170);
  });

  it('counts non-overlapping manual records on top of contract time', () => {
    const closed = { ...contract, actualSignOff: '2026-06-30' };
    const extra = manual('m1', '2026-07-01', '2026-07-15'); // 10 days
    const summary = buildSeaTimeSummary([closed], [extra], rankNames, new Date('2027-01-01T12:00:00Z'));
    expect(summary.total.days).toBe(180 + 10);
  });

  it('excludes manual records overlapping a same-rank contract (no double count)', () => {
    const active = { ...contract, joinDate: '2026-01-01', expectedSignOff: '2026-06-30' };
    const overlapping = manual('m1', '2026-02-01', '2026-03-01');
    const summary = buildSeaTimeSummary([active], [overlapping], rankNames, new Date('2026-03-01T12:00:00Z'));
    expect(summary.total).toEqual({ days: 59, hours: 0 });
  });

  it('keeps manual records that overlap a different-rank contract', () => {
    const active = { ...contract, joinDate: '2026-01-01', expectedSignOff: '2026-06-30' };
    const otherRank: SeaTimeRecord = { ...manual('m1', '2026-02-01', '2026-03-01'), rankId: 'r2' };
    const summary = buildSeaTimeSummary(
      [active],
      [otherRank],
      new Map([...rankNames, ['r2', 'Chief Officer']]),
      new Date('2026-03-01T12:00:00Z')
    );
    expect(summary.byRank.find((r) => r.rankId === 'r2')?.days).toBe(10);
  });
});
