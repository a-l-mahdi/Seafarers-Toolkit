import { daysUntilExpiry, documentStatus } from '../document-status';

describe('document status', () => {
  const now = new Date('2026-09-04T12:00:00Z');

  it('marks expired documents', () => {
    expect(documentStatus('2026-09-03', now)).toBe('expired');
  });

  it('marks expiring soon within threshold', () => {
    expect(documentStatus('2026-10-04', now)).toBe('expiring_soon');
  });

  it('marks valid documents beyond threshold', () => {
    expect(documentStatus('2027-09-04', now)).toBe('valid');
  });

  it('handles documents without expiry', () => {
    expect(documentStatus(null, now)).toBe('no_expiry');
  });

  it('respects custom threshold', () => {
    expect(documentStatus('2026-11-01', now, 90)).toBe('expiring_soon');
    expect(documentStatus('2026-11-01', now, 14)).toBe('valid');
  });

  it('counts days until expiry independently of contract', () => {
    expect(daysUntilExpiry('2026-09-05', now)).toBe(1);
  });
});
