/** How the documents list is ordered: the user's own order, or by days left. */
export type DocumentSortMode = 'manual' | 'daysDesc' | 'daysAsc';

export interface DocumentSort {
  mode: DocumentSortMode;
  /** Document ids in the user's own order (manual mode). */
  order: string[];
}

export const DEFAULT_DOCUMENT_SORT: DocumentSort = { mode: 'manual', order: [] };

type Sortable = { id: string; daysUntilExpiry: number | null };

/**
 * Orders documents for the list. `docs` arrive by expiry date, which is also the
 * fallback: documents missing from a manual order keep that order after the
 * arranged ones; documents without an expiry stay last when sorting by days.
 */
export function sortDocuments<T extends Sortable>(docs: T[], sort: DocumentSort): T[] {
  const indexed = docs.map((doc, i) => ({ doc, i }));
  if (sort.mode === 'manual') {
    const rank = new Map(sort.order.map((id, i) => [id, i]));
    const key = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER;
    indexed.sort((a, b) => key(a.doc.id) - key(b.doc.id) || a.i - b.i);
  } else {
    const dir = sort.mode === 'daysDesc' ? -1 : 1;
    indexed.sort((a, b) => {
      const da = a.doc.daysUntilExpiry;
      const db = b.doc.daysUntilExpiry;
      if (da === null || db === null) return (da === null ? 1 : 0) - (db === null ? 1 : 0) || a.i - b.i;
      return (da - db) * dir || a.i - b.i;
    });
  }
  return indexed.map((x) => x.doc);
}

/** The next state of the sort button: most days left → fewest → arrange by hand. */
export function nextSortMode(mode: DocumentSortMode): DocumentSortMode | 'arrange' {
  if (mode === 'manual') return 'daysDesc';
  if (mode === 'daysDesc') return 'daysAsc';
  return 'arrange';
}

/** Moves the item at `from` to `to`, shifting the ones between (positions map id → index). */
export function movePosition(positions: Record<string, number>, id: string, to: number): Record<string, number> {
  'worklet';
  const from = positions[id];
  if (from === undefined || from === to) return positions;
  const next: Record<string, number> = {};
  for (const key in positions) {
    const p = positions[key];
    if (key === id) next[key] = to;
    else if (from < to && p > from && p <= to) next[key] = p - 1;
    else if (from > to && p >= to && p < from) next[key] = p + 1;
    else next[key] = p;
  }
  return next;
}
