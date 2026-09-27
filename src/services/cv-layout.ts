/**
 * One layout for the CV, drawn identically by the PDF (HTML table), the Excel
 * sheet (merged cells) and the in-app preview (views).
 *
 * The page is a grid of 24 equal columns (COL_PX wide; the builder works in
 * 12 "units" of two columns each) and rows of explicit
 * height (points). Every row spans all 12 columns; every cell has one style
 * from STYLES. Images (app icon, photo) sit at pixel positions over the grid.
 * Because all three renderers read the same numbers, they come out alike.
 */
import { diffInDays } from '@/utils/date';
import { countryLabel } from '@/domain/countries';
import type { CvProfile, Profile, Vessel } from '@/types/domain';

export const COLS = 24;
export const COL_PX = 29.5;
export const SHEET_PX = COLS * COL_PX; // 708 px: A4 width inside 10 mm margins
export const CELL_PAD_PX = 8; // ≈ Excel's one-step indent
export const ptToPx = (pt: number) => (pt * 4) / 3;

// Theme colours (the app's light palette).
const NAVY = '#0B3D75';
const BLUE = '#0E5AA7';
const CYAN = '#00B4D8';
const TEXT = '#12212E';
const MUTED = '#5B6B7A';
const LINE = '#DDE5EC';
const TINT = '#EAF2FB';
const ZEBRA = '#F5F8FC';

export interface Border {
  color: string;
  /** thin (hairline), medium, or thick */
  weight: 'thin' | 'medium' | 'thick';
}

export interface CellStyle {
  size: number; // pt
  bold?: boolean;
  italic?: boolean;
  color: string;
  /** Solid fill, or a horizontal gradient (resolved per cell to stay continuous). */
  fill?: string | { from: string; to: string };
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  upper?: boolean;
  spacing?: number; // letter spacing, px
  top?: Border;
  bottom?: Border;
  left?: Border;
}

const band = { from: NAVY, to: BLUE };
const thinLine: Border = { color: LINE, weight: 'thin' };

export const STYLES = {
  blank: { size: 8, color: TEXT },
  band: { size: 8, color: '#FFFFFF', fill: band },
  kicker: { size: 7.5, bold: true, color: '#8FC3F5', fill: band, upper: true, spacing: 1.5, valign: 'bottom' },
  name: { size: 20, bold: true, color: '#FFFFFF', fill: band },
  position: { size: 11, bold: true, color: '#D6E8FA', fill: band },
  meta: { size: 8.5, color: '#FFFFFF', fill: band },
  accent: { size: 2, color: CYAN, fill: CYAN },
  section: {
    size: 9.5,
    bold: true,
    color: BLUE,
    fill: TINT,
    upper: true,
    spacing: 0.8,
    left: { color: BLUE, weight: 'thick' },
  },
  label: { size: 7.5, color: MUTED, bottom: thinLine, valign: 'middle' },
  value: { size: 9, bold: true, color: TEXT, bottom: thinLine, valign: 'middle' },
  th: {
    size: 7.5,
    bold: true,
    color: '#FFFFFF',
    fill: BLUE,
    upper: true,
    top: { color: BLUE, weight: 'thin' },
    bottom: { color: BLUE, weight: 'thin' },
    left: { color: '#3B7BC0', weight: 'thin' },
  },
  td: { size: 8, color: TEXT, bottom: thinLine, left: thinLine },
  tdZebra: { size: 8, color: TEXT, fill: ZEBRA, bottom: thinLine, left: thinLine },
  tdStrong: { size: 8, bold: true, color: TEXT, bottom: thinLine, left: thinLine },
  tdStrongZebra: { size: 8, bold: true, color: TEXT, fill: ZEBRA, bottom: thinLine, left: thinLine },
  total: { size: 8.5, bold: true, color: BLUE, fill: TINT, align: 'right', bottom: { color: BLUE, weight: 'thin' } },
  answerNo: { size: 8, bold: true, color: '#1F8A4C', align: 'center', bottom: thinLine, left: thinLine },
  answerYes: { size: 8, bold: true, color: '#B27B0A', align: 'center', bottom: thinLine, left: thinLine },
  note: { size: 8, italic: true, color: MUTED, valign: 'top' },
  sign: { size: 8, color: MUTED, align: 'center', valign: 'top', top: { color: TEXT, weight: 'thin' } },
  footer: { size: 7, color: '#93A5B5', align: 'center' },
} satisfies Record<string, CellStyle>;

export type StyleKey = keyof typeof STYLES;

export interface Cell {
  col: number; // 0-based
  span: number;
  text: string;
  style: StyleKey;
}

export interface Row {
  height: number; // pt
  cells: Cell[];
  /** Keep on the same page as the next row (section headings, table heads). */
  keepWithNext?: boolean;
  /** Starts a new printed page (set by paginate). */
  pageBreakBefore?: boolean;
}

export interface SheetImage {
  kind: 'icon' | 'photo';
  x: number; // px from the sheet's left
  y: number; // px from the sheet's top
  width: number;
  height: number;
  radius: number;
}

export interface CvSheet {
  rows: Row[];
  images: SheetImage[];
}

export interface CvSource {
  profile: Profile | null;
  cv: CvProfile;
  documents: {
    name: string;
    typeName: string | null;
    number: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    issuingAuthority: string | null;
    issuingCountry: string | null;
    placeOfIssue: string | null;
  }[];
  contracts: {
    rankName: string | null;
    vesselName: string | null;
    joinDate: string;
    expectedSignOff: string;
    actualSignOff: string | null;
    durationDays: number | null;
    company?: string | null;
  }[];
  vesselsByName: Map<string, Vessel>;
  currentRankName: string | null;
  hasPhoto: boolean;
  /** "Generated on" date (ISO); defaults to today. */
  today?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO (yyyy-mm-dd) → "17 Sep 2025". Blank for missing. */
export function fmt(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${Number(d)} ${MONTHS[Number(mo) - 1] ?? mo} ${y}`;
}

/** "1y 4m" from a day count. */
export function durationLabel(days: number): string {
  if (days <= 0) return '';
  const years = Math.floor(days / 365);
  const months = Math.round((days % 365) / 30.44);
  const parts: string[] = [];
  if (years) parts.push(`${years}y`);
  if (months) parts.push(`${months}m`);
  return parts.join(' ') || `${days}d`;
}

/** Colour at fraction t (0–1) between two #RRGGBB colours. */
export function mix(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ch = (shift: number) => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`.toUpperCase();
}

/** The fill of one cell: a gradient cell gets its own slice of the row's gradient. */
export function cellFill(cell: Cell): { from: string; to: string } | string | null {
  const fill = (STYLES[cell.style] as CellStyle).fill;
  if (!fill) return null;
  if (typeof fill === 'string') return fill;
  return { from: mix(fill.from, fill.to, cell.col / COLS), to: mix(fill.from, fill.to, (cell.col + cell.span) / COLS) };
}

/** Rough wrapped line count of a cell's text (Arial metrics), used for row heights. */
function lineCount(text: string, style: CellStyle, span: number): number {
  if (!text) return 1;
  const charPx = ptToPx(style.size) * (style.upper ? 0.72 : style.bold ? 0.64 : 0.6) + (style.spacing ?? 0);
  const avail = span * COL_PX - CELL_PAD_PX * 2;
  const perLine = Math.max(1, Math.floor(avail / charPx));
  return text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / perLine)), 0);
}

export function buildCvSheet(src: CvSource): CvSheet {
  const { profile, cv, documents, contracts, vesselsByName, currentRankName } = src;
  const rows: Row[] = [];
  const images: SheetImage[] = [];

  /** Adds a row; missing columns are filled with `filler` cells. */
  const push = (cells: Cell[], minHeight: number, filler: StyleKey = 'blank') => {
    const full: Cell[] = [];
    let col = 0;
    for (const c of [...cells].sort((a, b) => a.col - b.col)) {
      if (c.col > col) full.push({ col, span: c.col - col, text: '', style: filler });
      full.push(c);
      col = c.col + c.span;
    }
    if (col < COLS) full.push({ col, span: COLS - col, text: '', style: filler });
    const height = Math.max(
      minHeight,
      ...full
        .filter((c) => c.text)
        .map((c) => {
          const s = STYLES[c.style] as CellStyle;
          return lineCount(c.text, s, c.span) * s.size * 1.3 + 6;
        }),
    );
    rows.push({ height: Math.round(height * 2) / 2, cells: full });
  };
  const keepLast = () => {
    rows[rows.length - 1].keepWithNext = true;
  };
  const gap = (pt: number) => push([], pt);
  // Positions and spans below are in units of 1/12 of the page (two grid columns).
  const c = (col: number, span: number, text: string, style: StyleKey): Cell => ({
    col: col * 2,
    span: span * 2,
    text,
    style,
  });

  // ---------------- Header band ----------------
  const fullName =
    [profile?.firstName, cv.middleName, profile?.lastName].filter(Boolean).join(' ').trim() || 'Seafarer';
  const position = cv.positionAppliedFor || currentRankName || 'Seafarer';
  const nationality = countryLabel(profile?.nationality, 'en');
  const meta = [
    currentRankName ? `Present rank: ${currentRankName}` : '',
    nationality ? `Nationality: ${nationality}` : '',
    cv.dateOfAvailability ? `Available from: ${fmt(cv.dateOfAvailability)}` : '',
  ]
    .filter(Boolean)
    .join('   •   ');

  push([], 8, 'band');
  push([c(2, 8, "Seafarer's Toolkit  •  Curriculum Vitae", 'kicker')], 14, 'band');
  push([c(2, 8, fullName, 'name')], 30, 'band');
  push([c(2, 8, position, 'position')], 18, 'band');
  push([c(2, 8, meta, 'meta')], 16, 'band');
  push([c(2, 8, cv.addressedTo ? `To: ${cv.addressedTo}` : '', 'meta')], cv.addressedTo ? 16 : 10, 'band');
  push([], 10, 'band');
  const bandPx = rows.reduce((h, r) => h + ptToPx(r.height), 0);
  push([], 3, 'accent');
  gap(10);

  images.push({ kind: 'icon', x: 30, y: (bandPx - 58) / 2, width: 58, height: 58, radius: 13 });
  if (src.hasPhoto) {
    const w = 96;
    const h = 120;
    images.push({
      kind: 'photo',
      x: 20 * COL_PX + (4 * COL_PX - w) / 2,
      y: (bandPx - h) / 2,
      width: w,
      height: h,
      radius: 6,
    });
  }

  // ---------------- Sections ----------------
  const section = (title: string) => {
    push([c(0, 12, title, 'section')], 18, 'section');
    keepLast();
    gap(4);
    keepLast();
  };
  /** Label/value pairs, two per row; long values take a full row. */
  const fields = (pairs: [string, string][]) => {
    const kept = pairs.filter(([, v]) => v && v.trim() !== '');
    let i = 0;
    while (i < kept.length) {
      const [l1, v1] = kept[i];
      const next = kept[i + 1];
      const wide = (v: string) => v.length > 28;
      if (wide(v1) || !next || wide(next[1])) {
        push([c(0, 2.5, l1, 'label'), c(2.5, 9.5, v1, 'value')], 17);
        i += 1;
      } else {
        push(
          [
            c(0, 2.5, l1, 'label'),
            c(2.5, 3.5, v1, 'value'),
            c(6, 2.5, next[0], 'label'),
            c(8.5, 3.5, next[1], 'value'),
          ],
          17,
        );
        i += 2;
      }
    }
    gap(8);
  };
  /** A bordered table; `spans` must add up to 12. `strong` = index of the bold column. */
  const table = (headers: string[], spans: number[], data: string[][], strong = 0) => {
    let col = 0;
    push(
      headers.map((h, i) => {
        const cell = c(col, spans[i], h, 'th');
        col += spans[i];
        return cell;
      }),
      17,
    );
    keepLast();
    data.forEach((cells, r) => {
      let at = 0;
      const zebra = r % 2 === 1;
      push(
        cells.map((text, i) => {
          const style: StyleKey = i === strong ? (zebra ? 'tdStrongZebra' : 'tdStrong') : zebra ? 'tdZebra' : 'td';
          const cell = c(at, spans[i], text, style);
          at += spans[i];
          return cell;
        }),
        16,
      );
    });
  };

  const genderMap: Record<string, string> = { male: 'Male', female: 'Female' };
  const maritalMap: Record<string, string> = { single: 'Single', married: 'Married', other: 'Other' };

  section('Personal details');
  fields([
    ['Position applied for', cv.positionAppliedFor],
    ['Present rank', currentRankName ?? ''],
    ['Date of birth', fmt(profile?.dateOfBirth)],
    ['Place of birth', cv.placeOfBirth],
    ['Nationality', nationality ?? ''],
    ['Gender', genderMap[cv.gender] ?? ''],
    ['Marital status', maritalMap[cv.maritalStatus] ?? ''],
    ['Children', cv.children],
    ['Height', cv.heightCm ? `${cv.heightCm} cm` : ''],
    ['Weight', cv.weightKg ? `${cv.weightKg} kg` : ''],
    ['Blood group', cv.bloodGroup],
    ['Languages', cv.languages],
    ['Nearest airport', cv.nearestAirport],
    ['Available from', fmt(cv.dateOfAvailability)],
  ]);

  section('Contact & address');
  fields([
    ['Email', profile?.email ?? ''],
    ['Mobile', profile?.phone ?? ''],
    ['Landline', profile?.landline ?? ''],
    [
      'Address',
      [profile?.address, profile?.city, profile?.state, profile?.zipCode, profile?.country].filter(Boolean).join(', '),
    ],
  ]);

  section('Identification');
  fields([
    ['Passport no.', profile?.passportNumber ?? ''],
    ["Seaman's book no.", profile?.seamanBookNumber ?? ''],
    ['National seafarer ID', cv.nationalSeafarerId],
    ['SID no.', cv.sidNumber],
    ['Union membership', cv.unionMembership],
  ]);

  if (documents.length) {
    section('Certificates & documents');
    table(
      ['Certificate', 'Number', 'Issued', 'Expiry', 'Place of issue'],
      [4, 2, 2, 2, 2],
      documents.map((d) => [
        d.name || d.typeName || '',
        d.number ?? '',
        fmt(d.issueDate),
        d.expiryDate ? fmt(d.expiryDate) : 'Unlimited',
        [d.placeOfIssue, d.issuingAuthority, d.issuingCountry].filter(Boolean).join(', '),
      ]),
    );
    gap(10);
  }

  if (contracts.length) {
    section('Sea service');
    let totalDays = 0;
    const data = contracts.map((k) => {
      const end = k.actualSignOff ?? k.expectedSignOff;
      const days = k.durationDays ?? Math.max(diffInDays(k.joinDate, end), 0);
      totalDays += days;
      const v = k.vesselName ? vesselsByName.get(k.vesselName) : undefined;
      return [
        k.rankName ?? '',
        k.vesselName ?? '',
        [v?.type, v?.grossTonnage ? `${v.grossTonnage} GT` : ''].filter(Boolean).join(' • '),
        fmt(k.joinDate),
        fmt(end),
        durationLabel(days),
        k.company || v?.managementCompany || v?.owner || '',
      ];
    });
    table(
      ['Rank', 'Vessel', 'Type / GT', 'Sign on', 'Sign off', 'Period', 'Company'],
      [2, 2, 2, 1.5, 1.5, 1.5, 1.5],
      data,
      1,
    );
    push([c(0, 12, `Total sea service:  ${durationLabel(totalDays)}`, 'total')], 17);
    gap(10);
  }

  if (cv.education.length) {
    section('Education & training');
    table(
      ['Institution', 'Period', 'Qualification', 'Location'],
      [4, 3, 3, 2],
      cv.education.map((e) => [
        e.institution,
        [fmt(e.from), fmt(e.to)].filter(Boolean).join(' – '),
        e.qualification,
        e.location ?? '',
      ]),
    );
    gap(10);
  }

  section('Next of kin');
  fields([
    ['Name', cv.nokName],
    ['Relationship', cv.nokRelationship],
    ['Phone', cv.nokPhone],
    ['Address', cv.nokAddress],
  ]);

  section('Bank details');
  fields([
    ['Bank name', cv.bankName],
    ['Account holder', cv.bankAccountHolder],
    ['Account no.', cv.bankAccountNumber],
    ['Branch code', cv.bankBranchCode],
    ['SWIFT', cv.bankSwift],
    ['IBAN', cv.bankIban],
    ['Bank address', cv.bankAddress],
  ]);

  section('Health declaration');
  const health: [string, boolean][] = [
    ['Involved in any marine accident / investigation', cv.healthMarineAccident],
    ['Suffered an accident causing temporary / partial disability', cv.healthDisability],
    ['Currently under medical treatment / medication', cv.healthMedication],
    ['Suffer from any disease affecting fitness for sea service', cv.healthDisease],
    ['Underwent psychiatric treatment', cv.healthPsychiatric],
    ['Addicted to alcohol or drugs', cv.healthAddiction],
  ];
  health.forEach(([q, yes], i) =>
    push([c(0, 10, q, i % 2 ? 'tdZebra' : 'td'), c(10, 2, yes ? 'YES' : 'NO', yes ? 'answerYes' : 'answerNo')], 16),
  );
  if (cv.healthDetails) {
    gap(4);
    push([c(0, 12, cv.healthDetails, 'note')], 14);
  }

  // ---------------- Signature & footer ----------------
  gap(34);
  push([c(0, 4, 'Date', 'sign'), c(8, 4, 'Signature', 'sign')], 14);
  gap(14);
  push([c(0, 12, `Prepared with Seafarer's Toolkit  •  ${fmt(src.today ?? new Date().toISOString())}`, 'footer')], 12);

  paginate(rows);
  return { rows, images };
}

/** Page margins in mm (shared by the PDF and Excel page setup). */
export const PAGE_MARGIN_MM = { top: 18, bottom: 16, side: 10 };
/** Printable A4 height inside the margins, in px, with a little slack. */
export const PAGE_PX = Math.floor(((297 - PAGE_MARGIN_MM.top - PAGE_MARGIN_MM.bottom) / 25.4) * 96) - 8;

/**
 * Decides the page breaks once, so the PDF and Excel break at the same rows:
 * a block of rows kept together moves to the next page when it does not fit.
 */
function paginate(rows: Row[]): void {
  let used = 0;
  let i = 0;
  while (i < rows.length) {
    let j = i;
    let block = ptToPx(rows[i].height);
    while (rows[j].keepWithNext && j + 1 < rows.length) {
      j += 1;
      block += ptToPx(rows[j].height);
    }
    if (used > 0 && used + block > PAGE_PX) {
      rows[i].pageBreakBefore = true;
      used = 0;
    }
    used += block;
    i = j + 1;
  }
}

/** Top of each row in px (plus the total height as the last entry). */
export function rowOffsets(sheet: CvSheet): number[] {
  const out = [0];
  for (const r of sheet.rows) out.push(out[out.length - 1] + ptToPx(r.height));
  return out;
}
