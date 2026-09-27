import { movePosition, nextSortMode, sortDocuments } from '../document-sort';

const docs = [
  { id: 'a', daysUntilExpiry: -3 },
  { id: 'b', daysUntilExpiry: 10 },
  { id: 'c', daysUntilExpiry: 400 },
  { id: 'd', daysUntilExpiry: null },
];
const ids = (list: { id: string }[]) => list.map((d) => d.id).join('');

describe('sortDocuments', () => {
  it('orders by days left, most first, no-expiry last', () => {
    expect(ids(sortDocuments(docs, { mode: 'daysDesc', order: [] }))).toBe('cbad');
  });

  it('orders by days left, fewest first, no-expiry last', () => {
    expect(ids(sortDocuments(docs, { mode: 'daysAsc', order: [] }))).toBe('abcd');
  });

  it('follows the manual order and keeps unlisted documents after it', () => {
    expect(ids(sortDocuments(docs, { mode: 'manual', order: ['c', 'a'] }))).toBe('cabd');
  });

  it('keeps the incoming order with no manual order saved', () => {
    expect(ids(sortDocuments(docs, { mode: 'manual', order: [] }))).toBe('abcd');
  });
});

describe('nextSortMode', () => {
  it('cycles most → fewest → arrange', () => {
    expect(nextSortMode('manual')).toBe('daysDesc');
    expect(nextSortMode('daysDesc')).toBe('daysAsc');
    expect(nextSortMode('daysAsc')).toBe('arrange');
  });
});

describe('movePosition', () => {
  const pos = { a: 0, b: 1, c: 2, d: 3 };
  it('moves down, shifting the ones between up', () => {
    expect(movePosition(pos, 'a', 2)).toEqual({ a: 2, b: 0, c: 1, d: 3 });
  });
  it('moves up, shifting the ones between down', () => {
    expect(movePosition(pos, 'd', 1)).toEqual({ a: 0, b: 2, c: 3, d: 1 });
  });
});
