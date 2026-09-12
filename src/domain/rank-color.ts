import type { Department, Rank } from '@/types/domain';
import { lerpColor } from './contract';

/** Deep (most senior) and light (most junior) endpoints for each branch. */
type Shade = { deep: string; light: string };

/**
 * Branch colours, chosen after the traditional merchant-navy "distinction cloth"
 * worn between the gold stripes:
 *  - Deck        → gold
 *  - Engine      → purple
 *  - Electrical  → green (#008000)
 *  - Ratings     → petrol/naval blue (deck + engine ratings share it)
 *  - Catering    → silver/grey (the purser/catering distinction cloth is white)
 * Within a branch, ranks shade from deep (most senior) to light (most junior).
 */
export const BRANCH_COLORS: Record<Department, Shade> = {
  deck: { deep: '#B8860B', light: '#EBD9A0' }, // gold
  engine: { deep: '#6A1B9A', light: '#D9B8E8' }, // purple
  electro: { deep: '#008000', light: '#8FD08F' }, // green
  deck_rating: { deep: '#0E4D63', light: '#A6C4CF' }, // petrol blue
  engine_rating: { deep: '#0E4D63', light: '#A6C4CF' }, // petrol blue
  catering: { deep: '#5B7683', light: '#CDD7DC' }, // silver / white distinction cloth
};

const FALLBACK: Shade = { deep: '#5B6B7A', light: '#AEB9C4' };

function shadeFor(department: string): Shade {
  return (BRANCH_COLORS as Record<string, Shade>)[department] ?? FALLBACK;
}

/**
 * Builds a map of rankId → colour. Ranks are grouped by branch and, within each
 * branch, sorted from most senior (lowest level) to most junior; the most senior
 * gets the deep branch colour and the most junior the light tint.
 */
export function buildRankColorMap(ranks: Rank[]): Map<string, string> {
  const byDept = new Map<string, Rank[]>();
  for (const rank of ranks) {
    const list = byDept.get(rank.department) ?? [];
    list.push(rank);
    byDept.set(rank.department, list);
  }

  const result = new Map<string, string>();
  for (const [department, list] of byDept) {
    const shade = shadeFor(department);
    const sorted = [...list].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    const n = sorted.length;
    sorted.forEach((rank, i) => {
      const t = n <= 1 ? 0 : i / (n - 1);
      result.set(rank.id, lerpColor(shade.deep, shade.light, t));
    });
  }
  return result;
}

/** Convenience: the colour for a single rank id given the full ranks list. */
export function rankColorFor(ranks: Rank[], rankId: string | null | undefined): string {
  if (!rankId) return FALLBACK.deep;
  return buildRankColorMap(ranks).get(rankId) ?? FALLBACK.deep;
}
