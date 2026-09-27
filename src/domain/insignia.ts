/**
 * Merchant-navy shoulder insignia (epaulettes): gold stripes on a navy board,
 * the merchant-navy diamond above them and, for the technical and service
 * branches, a coloured "distinction cloth" between (or beside) the stripes:
 *  - Deck        → gold stripes only
 *  - Engine      → purple
 *  - Electrical  → green
 *  - Catering    → white
 * Cadets wear a single narrow stripe. Ratings normally wear none.
 */

export type NamedCloth = 'none' | 'purple' | 'green' | 'red' | 'white';
/** A named branch colour, or any custom colour as '#RRGGBB'. */
export type InsigniaCloth = NamedCloth | `#${string}`;
/** The emblem above the stripes: the merchant-navy diamond, or a round curl. */
export type InsigniaEmblem = 'diamond' | 'circle';

export interface Insignia {
  /** Gold stripes: 0 – 4, or 0.5 for a cadet's single narrow stripe. */
  stripes: number;
  cloth: InsigniaCloth;
  /** Whether the emblem is shown above the stripes. */
  diamond: boolean;
  /** Emblem shape (missing = diamond). */
  emblem?: InsigniaEmblem;
}

export const STRIPE_OPTIONS = [0, 0.5, 1, 2, 3, 4] as const;
export const CLOTH_OPTIONS: NamedCloth[] = ['none', 'purple', 'green', 'red', 'white'];

export const CLOTH_COLORS: Record<Exclude<NamedCloth, 'none'>, string> = {
  purple: '#5E2A84',
  green: '#1F7A3A',
  white: '#ECEFF3',
  red: '#8B1A2B',
};

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isCustomCloth(cloth: InsigniaCloth): cloth is `#${string}` {
  return HEX.test(cloth);
}

/** Fill colour of the distinction cloth (null = none). */
export function clothColor(cloth: InsigniaCloth): string | null {
  if (cloth === 'none') return null;
  return isCustomCloth(cloth) ? cloth : CLOTH_COLORS[cloth];
}

const officer = (stripes: number, cloth: InsigniaCloth = 'none'): Insignia => ({ stripes, cloth, diamond: true });

/** Standard epaulettes of the built-in officer ranks (ratings have none). */
export const DEFAULT_INSIGNIA: Record<string, Insignia> = {
  // Deck
  rank_captain: officer(4),
  rank_chief_officer: officer(3),
  rank_2nd_officer: officer(2),
  rank_3rd_officer: officer(1),
  rank_catering_officer: officer(1, 'white'),
  rank_deck_cadet: officer(0.5),
  // Engine
  rank_chief_engineer: officer(4, 'purple'),
  rank_2nd_engineer: officer(3, 'purple'),
  rank_3rd_engineer: officer(2, 'purple'),
  rank_4th_engineer: officer(1, 'purple'),
  rank_engine_cadet: officer(0.5, 'purple'),
  // Electrical (the ETR is a rating: no epaulette)
  rank_chief_eto: officer(3, 'green'),
  rank_eto_1: officer(2, 'green'),
  rank_eto_2: officer(1, 'green'),
  rank_eto_cadet: officer(0.5, 'green'),
};

/** Stored value for "no epaulette" (NULL means "not set yet": the default applies). */
export const NO_INSIGNIA = 'none';

export function serializeInsignia(insignia: Insignia | null): string {
  return insignia ? JSON.stringify(insignia) : NO_INSIGNIA;
}

/** Reads the stored value; anything missing or malformed means no epaulette. */
export function parseInsignia(raw: unknown): Insignia | null {
  if (typeof raw !== 'string' || !raw || raw === NO_INSIGNIA) return null;
  try {
    const v = JSON.parse(raw) as Partial<Insignia>;
    const stripes = (STRIPE_OPTIONS as readonly number[]).includes(Number(v.stripes)) ? Number(v.stripes) : 0;
    const c = String(v.cloth ?? '');
    // 'blue' was a fixed option before custom colours existed.
    const cloth: InsigniaCloth =
      c === 'blue'
        ? '#1D4F91'
        : CLOTH_OPTIONS.includes(c as NamedCloth) || HEX.test(c)
          ? (c as InsigniaCloth)
          : 'none';
    const insignia: Insignia = { stripes, cloth, diamond: v.diamond !== false };
    if (v.emblem === 'circle') insignia.emblem = 'circle';
    return insignia;
  } catch {
    return null;
  }
}

export function sameInsignia(a: Insignia | null, b: Insignia | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.stripes === b.stripes &&
    a.cloth.toLowerCase() === b.cloth.toLowerCase() &&
    a.diamond === b.diamond &&
    (a.emblem ?? 'diamond') === (b.emblem ?? 'diamond')
  );
}

export interface StripeBand {
  kind: 'gold' | 'cloth';
  /** Top edge and height, in the 64 × 128 board's units. */
  y: number;
  h: number;
}

export const BOARD = { width: 64, height: 128, bottom: 122, stripe: 11, narrow: 5.5, gap: 4.5 } as const;

/**
 * Bands of the stripe block, top to bottom, laid up from the board's lower
 * edge. With several stripes the cloth fills the gaps between them; a single
 * (or cadet's narrow) stripe carries its cloth as a band below it, so the
 * diamond always rests on gold.
 */
export function stripeBands(insignia: Insignia): StripeBand[] {
  const { stripes, cloth } = insignia;
  if (stripes <= 0) return [];
  const bands: StripeBand[] = [];
  let y = BOARD.bottom;
  const push = (kind: StripeBand['kind'], h: number) => {
    y -= h;
    bands.unshift({ kind, y, h });
  };
  if (stripes <= 1 && cloth !== 'none') push('cloth', BOARD.gap);
  if (stripes < 1) {
    push('gold', BOARD.narrow);
    return bands;
  }
  for (let i = 0; i < stripes; i += 1) {
    if (i > 0) push('cloth', BOARD.gap);
    push('gold', BOARD.stripe);
  }
  // Without cloth the gaps show the navy board.
  return cloth === 'none' ? bands.filter((b) => b.kind === 'gold') : bands;
}
