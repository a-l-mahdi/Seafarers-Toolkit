import { careerProgress, estimatedQualificationDate } from '../career';

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
