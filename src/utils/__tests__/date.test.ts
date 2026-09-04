import {
  addDaysISO,
  addMonthsISO,
  compareISO,
  diffInDays,
  formatJalali,
  isISODate,
  todayISO,
} from '../date';

describe('date utils', () => {
  it('computes day differences across months and leap years', () => {
    expect(diffInDays('2026-01-01', '2026-06-30')).toBe(180);
    expect(diffInDays('2024-02-01', '2024-03-01')).toBe(29);
    expect(diffInDays('2023-02-01', '2023-03-01')).toBe(28);
  });

  it('adds days', () => {
    expect(addDaysISO('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysISO('2026-03-01', 0)).toBe('2026-03-01');
  });

  it('adds months with month-end clamping', () => {
    expect(addMonthsISO('2026-09-01', 6)).toBe('2027-03-01');
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsISO('2026-10-31', 4)).toBe('2027-02-28');
  });

  it('compares and validates ISO dates', () => {
    expect(compareISO('2026-01-01', '2026-01-02')).toBe(-1);
    expect(isISODate('2026-01-01')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('nope')).toBe(false);
  });

  it('returns today as the local calendar date', () => {
    const d = new Date('2026-09-03T22:00:00+03:30');
    const p = (n: number) => String(n).padStart(2, '0');
    expect(todayISO(d)).toBe(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    expect(todayISO(new Date(2026, 8, 4, 1, 30))).toBe('2026-09-04');
  });

  it('formats jalali dates', () => {
    expect(formatJalali('2026-09-01')).toBe('1405/06/10');
  });
});
