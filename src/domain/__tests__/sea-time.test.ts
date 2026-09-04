import { findOverlaps } from '../sea-time';
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
