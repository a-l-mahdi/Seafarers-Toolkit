import {
  careerProgress,
  estimatedQualificationDate,
  isTopRank,
  nextRankId,
  ranksForDepartment,
  resolveNextRankId,
  seniorRanks,
} from '../career';

// Level 1 = most senior within a department.
const RANKS = [
  { id: 'eto1', department: 'electro', level: 1 },
  { id: 'eto2', department: 'electro', level: 2 },
  { id: 'etr', department: 'electro', level: 3 },
  { id: 'etoc', department: 'electro', level: 4 },
  { id: 'capt', department: 'deck', level: 1 },
  { id: 'co', department: 'deck', level: 2 },
];

describe('rank ladder', () => {
  it('promotes to the closest more-senior rank in the same department', () => {
    expect(nextRankId('eto2', RANKS)).toBe('eto1');
    expect(nextRankId('etoc', RANKS)).toBe('etr');
    expect(nextRankId('co', RANKS)).toBe('capt');
  });

  it('has no next rank at the top of a department', () => {
    expect(nextRankId('eto1', RANKS)).toBeNull();
    expect(isTopRank('eto1', RANKS)).toBe(true);
    expect(isTopRank('eto2', RANKS)).toBe(false);
  });

  it('lists only senior ranks of the same department, nearest first', () => {
    expect(seniorRanks('etr', RANKS).map((r) => r.id)).toEqual(['eto2', 'eto1']);
    expect(seniorRanks(null, RANKS)).toEqual([]);
  });

  it('filters ranks by department', () => {
    expect(ranksForDepartment(RANKS, 'deck').map((r) => r.id)).toEqual(['capt', 'co']);
    expect(ranksForDepartment(RANKS, null)).toHaveLength(RANKS.length);
  });

  it('keeps a valid chosen next rank and falls back to the ladder otherwise', () => {
    expect(resolveNextRankId('etr', 'eto1', RANKS)).toBe('eto1');
    expect(resolveNextRankId('etr', 'capt', RANKS)).toBe('eto2');
    expect(resolveNextRankId('eto2', 'etoc', RANKS)).toBe('eto1');
    expect(resolveNextRankId('eto2', null, RANKS)).toBe('eto1');
  });
});

describe('career progress', () => {
  it('computes remaining and progress', () => {
    const p = careerProgress(270, 365);
    expect(p.remaining).toBe(95);
    expect(p.progress).toBeCloseTo(0.7397, 4);
    expect(p.complete).toBe(false);
  });

  it('never shows negative remaining or progress over 100%', () => {
    const p = careerProgress(400, 365);
    expect(p.remaining).toBe(0);
    expect(p.progress).toBe(1);
    expect(p.complete).toBe(true);
  });

  it('handles zero requirement', () => {
    const p = careerProgress(100, 0);
    expect(p.progress).toBe(0);
    expect(p.complete).toBe(false);
    expect(p.remaining).toBe(0);
  });

  it('never accepts negative completed', () => {
    const p = careerProgress(-50, 365);
    expect(p.completed).toBe(0);
    expect(p.remaining).toBe(365);
  });
});

describe('estimated qualification date', () => {
  it('predicts based on remaining days', () => {
    const d = estimatedQualificationDate(95, '2026-09-01', '2027-03-01', new Date('2026-09-01T10:00:00Z'));
    expect(d).toBe('2026-12-05');
  });

  it('returns null when requirement already met', () => {
    expect(estimatedQualificationDate(0, '2026-09-01', '2027-03-01')).toBeNull();
  });

  it('returns null without an active contract', () => {
    expect(estimatedQualificationDate(95, null, null)).toBeNull();
  });

  it('returns null when contract already ended', () => {
    const d = estimatedQualificationDate(
      95,
      '2026-09-01',
      '2027-03-01',
      new Date('2027-03-02T10:00:00Z')
    );
    expect(d).toBeNull();
  });
});
