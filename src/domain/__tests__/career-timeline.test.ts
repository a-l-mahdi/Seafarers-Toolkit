import { buildCareerTimeline, toMonths } from '../career-timeline';
import type { Contract } from '@/types/domain';

function c(id: string, rankId: string | null, join: string, signOff: string, vesselName: string): Contract & { vesselName: string } {
  return {
    id,
    vesselId: 'v',
    rankId: rankId as string,
    joinDate: join,
    expectedSignOff: signOff,
    actualSignOff: signOff,
    durationDays: 0,
    monthlyWage: null,
    wageCurrency: null,
    travelDays: null,
    bonus: null,
    status: 'completed',
    notes: null,
    createdAt: '',
    updatedAt: '',
    vesselName,
  };
}

describe('career timeline', () => {
  const contracts = [
    // Out of order on purpose: the timeline sorts by join date.
    c('c3', 'eto2', '2021-01-01', '2021-05-01', 'Gamma'),
    c('c1', 'cadet', '2020-01-01', '2020-05-20', 'Alpha'),
    c('c2', 'cadet', '2020-07-01', '2020-09-09', 'Beta'),
    c('c4', null, '2022-01-01', '2022-02-01', 'NoRank'),
  ];
  const now = new Date('2026-01-01T00:00:00Z');

  it('orders ranks by first service and accumulates sea time upward', () => {
    const t = buildCareerTimeline(contracts, now);
    expect(t.map((s) => s.rankId)).toEqual(['cadet', 'eto2']);
    expect(t[0].days).toBe(140 + 70);
    expect(t[0].cumulativeDays).toBe(210);
    expect(t[1].days).toBe(120);
    expect(t[1].cumulativeDays).toBe(330);
  });

  it('lists each rank’s trips oldest first with vessel and days', () => {
    const [cadet] = buildCareerTimeline(contracts, now);
    expect(cadet.trips.map((x) => [x.vesselName, x.days])).toEqual([
      ['Alpha', 140],
      ['Beta', 70],
    ]);
  });

  it('skips unranked contracts and handles none', () => {
    expect(buildCareerTimeline([contracts[3]], now)).toEqual([]);
    expect(buildCareerTimeline([], now)).toEqual([]);
  });

  it('converts days to months with one decimal', () => {
    expect(toMonths(365)).toBe(12);
    expect(toMonths(0)).toBe(0);
  });
});
