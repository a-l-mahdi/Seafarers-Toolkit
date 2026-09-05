import { daysUntilExpiry, documentStatus } from '../document-status';

describe('document status', () => {
  const now = new Date('2026-09-04T12:00:00Z');

  it('marks expired documents', () => {
    expect(documentStatus({ expiryDate: '2026-09-03' }, now)).toBe('expired');
  });

  it('marks expiring soon within default threshold', () => {
    expect(documentStatus({ expiryDate: '2026-10-04' }, now)).toBe('expiring_soon');
  });

  it('marks valid documents beyond threshold', () => {
    expect(documentStatus({ expiryDate: '2027-09-04' }, now)).toBe('valid');
  });

  it('handles documents without expiry', () => {
    expect(documentStatus({ expiryDate: null }, now)).toBe('no_expiry');
  });

  it('respects custom warning threshold', () => {
    expect(documentStatus({ expiryDate: '2026-11-01', warningThresholdDays: 90 }, now)).toBe('expiring_soon');
    expect(documentStatus({ expiryDate: '2026-11-01', warningThresholdDays: 14 }, now)).toBe('valid');
  });

  it('marks not_valid below the company validity rule (6 months = 180 days)', () => {
    // 100 days left < 180 → not valid to join, even though renewal warning (210) already passed
    expect(documentStatus({ expiryDate: '2026-12-13', validThresholdDays: 180 }, now)).toBe('not_valid');
    // 200 days left: above 180 but within warning 210 → expiring_soon (renew now)
    expect(documentStatus({ expiryDate: '2027-03-23', warningThresholdDays: 210, validThresholdDays: 180 }, now)).toBe('expiring_soon');
    // 220 days left: fully valid
    expect(documentStatus({ expiryDate: '2027-04-12', warningThresholdDays: 210, validThresholdDays: 180 }, now)).toBe('valid');
  });

  it('not_valid never overrides expired', () => {
    expect(documentStatus({ expiryDate: '2026-01-01', validThresholdDays: 180 }, now)).toBe('expired');
  });

  it('counts days until expiry independently of contract', () => {
    expect(daysUntilExpiry('2026-09-05', now)).toBe(1);
  });
});
