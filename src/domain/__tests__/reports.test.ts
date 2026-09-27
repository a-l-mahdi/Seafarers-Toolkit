import type { Contract } from '@/types/domain';
import { atSeaShare, earningsByCurrency, seaDaysByYear, splitDuration } from '../reports';

const NOW = new Date('2025-06-01T12:00:00Z');

function contract(partial: Partial<Contract>): Contract {
  return {
    id: partial.id ?? 'c',
    vesselId: 'v',
    rankId: 'r',
    joinDate: '2024-01-01',
    expectedSignOff: '2024-07-01',
    actualSignOff: null,
    durationDays: null,
    monthlyWage: null,
    wageCurrency: 'USD',
    travelDays: null,
    bonus: null,
    status: 'completed',
    notes: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('reports', () => {
  it('splits days into years, months and days', () => {
    expect(splitDuration(365 + 65)).toEqual({ years: 1, months: 2, days: 5 });
    expect(splitDuration(0)).toEqual({ years: 0, months: 0, days: 0 });
  });

  it('splits sea days across the years a trip spans', () => {
    const c = contract({ joinDate: '2023-12-01', actualSignOff: '2024-02-01' });
    expect(seaDaysByYear([c], 'gregorian', NOW)).toEqual([
      { year: 2023, days: 31 },
      { year: 2024, days: 31 },
    ]);
  });

  it('uses Nowruz as the year boundary on the Jalali calendar', () => {
    // 1403 starts on 2024-03-20.
    const c = contract({ joinDate: '2024-03-10', actualSignOff: '2024-03-30' });
    expect(seaDaysByYear([c], 'jalali', NOW)).toEqual([
      { year: 1402, days: 10 },
      { year: 1403, days: 10 },
    ]);
  });

  it('counts a running trip up to today and skips future ones', () => {
    const running = contract({ id: 'a', joinDate: '2025-05-01', expectedSignOff: '2025-11-01' });
    const future = contract({ id: 'b', joinDate: '2025-08-01', expectedSignOff: '2025-12-01' });
    expect(seaDaysByYear([running, future], 'gregorian', NOW)).toEqual([{ year: 2025, days: 31 }]);
    expect(atSeaShare([running, future], NOW)).toBe(1);
  });

  it('sums earnings per currency, earned vs total', () => {
    const done = contract({ id: 'a', actualSignOff: '2024-01-31', monthlyWage: 3000, travelDays: 3, bonus: 100 });
    const running = contract({ id: 'b', joinDate: '2025-05-02', expectedSignOff: '2025-07-01', monthlyWage: 3000 });
    const euro = contract({ id: 'c', actualSignOff: '2024-01-11', monthlyWage: 600, wageCurrency: 'EUR' });
    const [usd, eur] = earningsByCurrency([done, running, euro], NOW);
    expect(usd.currency).toBe('USD');
    expect(usd.total).toBe(3000 + 300 + 100 + 6000);
    expect(usd.earned).toBe(3400 + 3000);
    expect(usd.contracts).toBe(2);
    expect(eur).toMatchObject({ currency: 'EUR', total: 200 });
  });
});
