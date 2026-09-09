import { parseDocumentText } from '../ocr';

describe('OCR document text parser', () => {
  it('extracts gregorian issue/expiry dates', () => {
    const result = parseDocumentText('PASSPORT\nNo. 1234567\nIssued: 2020/05/10\nExpiry: 2030/05/09');
    expect(result.issueDate).toBe('2020-05-10');
    expect(result.expiryDate).toBe('2030-05-09');
    expect(result.documentNumber).toBe('1234567');
  });

  it('converts jalali dates to gregorian', () => {
    const result = parseDocumentText('گواهی\nصدور: 1404/02/15\nاعتبار: 1405/02/15');
    expect(result.issueDate).toBe('2025-05-05');
    expect(result.expiryDate).toBe('2026-05-05');
  });

  it('handles dd/mm/yyyy format', () => {
    const result = parseDocumentText('Date of issue 10/05/2020 - valid until 09/05/2030');
    expect(result.issueDate).toBe('2020-05-10');
    expect(result.expiryDate).toBe('2030-05-09');
  });

  it('picks the longest digit token as document number', () => {
    const result = parseDocumentText('Seaman Book\nGB 1234567\nIMO 987654321\nCode 55');
    expect(result.documentNumber).toBe('987654321');
  });

  it('returns nulls for text without dates or numbers', () => {
    const result = parseDocumentText('no useful data here');
    expect(result.issueDate).toBeNull();
    expect(result.expiryDate).toBeNull();
    expect(result.documentNumber).toBeNull();
  });

  it('keeps dates sorted regardless of order in text', () => {
    const result = parseDocumentText('valid 2030/01/01, issued 2020/01/01');
    expect(result.issueDate).toBe('2020-01-01');
    expect(result.expiryDate).toBe('2030-01-01');
  });

  it('assigns dates by "date of issue" / "date of expiry" labels', () => {
    const result = parseDocumentText(
      'SEAFARER PASSPORT\nDate of issue: 2021/03/10\nDate of expiry: 2031/03/09\nNo. 7654321'
    );
    expect(result.issueDate).toBe('2021-03-10');
    expect(result.expiryDate).toBe('2031-03-09');
    expect(result.documentNumber).toBe('7654321');
  });

  it('label assignment wins even when order contradicts min/max', () => {
    // Expiry printed before issue on the document (layout quirk)
    const result = parseDocumentText('Date of expiry 2032/01/01\nDate of issue 2022/01/01');
    expect(result.issueDate).toBe('2022-01-01');
    expect(result.expiryDate).toBe('2032-01-01');
  });

  it('assigns Persian labels (صدور / انقضا)', () => {
    const result = parseDocumentText('تاریخ صدور: 1403/05/01\nتاریخ انقضا: 1404/05/01');
    expect(result.issueDate).toBe('2024-07-22');
    expect(result.expiryDate).toBe('2025-07-23');
  });

  it('uses labeled expiry alone without forcing issue', () => {
    const result = parseDocumentText('This certificate is valid until 2029/06/15');
    expect(result.expiryDate).toBe('2029-06-15');
  });
});
