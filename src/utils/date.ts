export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayISO(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const targetYear = y + Math.floor((m - 1 + months) / 12);
  const targetMonth = ((m - 1 + months) % 12 + 12) % 12;
  const daysInTarget = daysInMonth(targetYear, targetMonth + 1);
  return fromUtc(new Date(Date.UTC(targetYear, targetMonth, Math.min(d, daysInTarget))));
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function diffInDays(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function compareISO(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function isBefore(a: string, b: string): boolean {
  return compareISO(a, b) < 0;
}

export function isAfter(a: string, b: string): boolean {
  return compareISO(a, b) > 0;
}

export function clampISO(iso: string, min: string, max: string): string {
  if (isBefore(iso, min)) return min;
  if (isAfter(iso, max)) return max;
  return iso;
}

export function minISO(a: string, b: string): string {
  return isBefore(a, b) ? a : b;
}

export function maxISO(a: string, b: string): string {
  return isAfter(a, b) ? a : b;
}

export function isoToDate(iso: string): Date {
  return toUtc(iso);
}

export function formatGregorian(iso: string, locale = 'en-US'): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatJalali(iso: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { format } = require('date-fns-jalali') as typeof import('date-fns-jalali');
  return format(toUtc(iso), 'yyyy/MM/dd');
}

export function isoNow(): string {
  return new Date().toISOString();
}
