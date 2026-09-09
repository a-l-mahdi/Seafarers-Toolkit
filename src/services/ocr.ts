import { jalaliToGregorian } from '@/utils/date';

export interface OcrFields {
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
}

const DATE_RE = /\b(\d{2,4})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g;
const NUMBER_TOKEN_RE = /\b\d{5,15}\b/g;

const ISSUE_KEYWORDS = [
  'date of issue',
  'date issued',
  'issued',
  'issue',
  'صدور',
  'تاریخ صدور',
];
const EXPIRY_KEYWORDS = [
  'date of expiry',
  'expiry date',
  'expires',
  'expiry',
  'valid until',
  'valid',
  'validity',
  'انقضا',
  'اعتبار',
  'تا تاریخ',
];

/**
 * Pure parser that extracts document number, issue and expiry dates from OCR
 * text. Dates are matched to fields by their line labels first ("date of
 * issue" / "date of expiry" / «صدور» / «انقضا») and fall back to min/max
 * ordering. Handles Gregorian and Jalali (12xx-15xx) dates.
 * All returned dates are ISO Gregorian strings.
 */
export function parseDocumentText(text: string): OcrFields {
  let issueDate: string | null = null;
  let expiryDate: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const dates = extractDates(line);
    if (dates.length === 0) continue;
    const lower = line.toLowerCase();
    const hasIssue = matchesAny(lower, ISSUE_KEYWORDS);
    const hasExpiry = matchesAny(lower, EXPIRY_KEYWORDS);

    if (hasIssue && hasExpiry) {
      // Line carries both fields (e.g. "issued 2020/01/01, valid until 2030/01/01").
      const sorted = [...dates].sort();
      if (!issueDate) issueDate = sorted[0];
      if (!expiryDate) expiryDate = sorted[sorted.length - 1];
    } else if (hasIssue && !issueDate) {
      issueDate = dates[0];
    } else if (hasExpiry && !expiryDate) {
      expiryDate = dates[dates.length - 1];
    }
  }

  // Fallback: earliest = issue, latest = expiry.
  if (!issueDate || !expiryDate) {
    const sorted = [...extractDates(text)].sort();
    if (!issueDate && sorted.length > 0) issueDate = sorted[0];
    if (!expiryDate && sorted.length > 1) expiryDate = sorted[sorted.length - 1];
  }

  let best: { value: string; length: number } | null = null;
  for (const match of text.matchAll(NUMBER_TOKEN_RE)) {
    const value = match[0];
    if (!best || value.length > best.length) best = { value, length: value.length };
  }

  return { documentNumber: best?.value ?? null, issueDate, expiryDate };
}

function matchesAny(lower: string, keywords: string[]): boolean {
  return keywords.some((k) => lower.includes(k));
}

function extractDates(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(DATE_RE)) {
    const a = Number(match[1]);
    const b = Number(match[2]);
    const c = Number(match[3]);
    const iso = classify(a, b, c);
    if (iso) found.push(iso);
  }
  return found.filter(isUnique);
}

function classify(a: number, b: number, c: number): string | null {
  // Pattern 1: YYYY/MM/DD — Gregorian (19xx/20xx) or Jalali (12xx-15xx)
  if (a >= 1000 && a <= 9999) {
    if (a >= 1200 && a <= 1599) {
      return jalaliToGregorian(`${a}/${b}/${c}`);
    }
    if (a >= 1900 && a <= 2199) {
      return buildIso(a, b, c);
    }
    return null;
  }
  // Pattern 2: DD/MM/YYYY (Gregorian) or DD/MM/Jalali-short
  if (a >= 1 && a <= 31 && c >= 1000) {
    if (c >= 1200 && c <= 1599) {
      return jalaliToGregorian(`${c}/${b}/${a}`);
    }
    if (c >= 1900 && c <= 2199) {
      return buildIso(c, b, a);
    }
  }
  return null;
}

function buildIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(m)}-${p(d)}`;
}

function isUnique(value: string, index: number, arr: string[]): boolean {
  return arr.indexOf(value) === index;
}
