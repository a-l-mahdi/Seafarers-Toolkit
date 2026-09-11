import { base64ToBytes, bytesToBase64, deobfuscateText, deobfuscateWithPassword, obfuscateText, obfuscateWithPassword, stringToUtf8Bytes, utf8BytesToString } from '../xor-codec';

describe('xor-codec', () => {
  it('round-trips utf-8 strings (english, persian, emoji, quotes)', () => {
    const samples = [
      'plain ascii json',
      '{"name":"گواهی صلاحیت دریانوردی","days":120}',
      'emoji 🚢 ⚓ and unicode تحویل',
      'quotes "nested \\" and backslash \\\\',
    ];
    for (const s of samples) {
      expect(utf8BytesToString(stringToUtf8Bytes(s))).toBe(s);
    }
  });

  it('base64 round-trips byte arrays', () => {
    const bytes = [0, 1, 2, 250, 251, 252, 253, 254, 255, 127, 128];
    expect(Array.from(base64ToBytes(bytesToBase64(new Uint8Array(bytes))))).toEqual(bytes);
  });

  it('obfuscated payload is not readable as plain json', () => {
    const json = JSON.stringify({ version: 1, tables: { documents: [{ name: 'پاسپورت' }] } });
    const payload = obfuscateText(json);
    expect(payload).not.toContain('version');
    expect(payload).not.toContain('پاسپورت');
    expect(payload).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('obfuscate → deobfuscate restores the original text', () => {
    const json = '{"exportedAt":"2026-09-09","tables":{"settings":[{"key":"calendar","value":"jalali"}]}}';
    expect(deobfuscateText(obfuscateText(json))).toBe(json);
  });

  it('deobfuscates payloads of multi-byte boundaries correctly', () => {
    const text = 'aسbسcس🚢d';
    expect(deobfuscateText(obfuscateText(text))).toBe(text);
  });

  it('password-protected payloads restore only with the exact password', () => {
    const json = JSON.stringify({ tables: { documents: [{ name: 'پاسپورت' }] } });
    const payload = obfuscateWithPassword(json, 'S3cret!');
    expect(deobfuscateWithPassword(payload, 'S3cret!')).toBe(json);
    expect(payload).not.toContain('پاسپورت');
    expect(deobfuscateWithPassword(payload, 'wrong')).not.toBe(json);
  });

  it('round-trips a multi-MB backup payload (realistic photo-heavy backup)', () => {
    const fileData = Array.from({ length: 2_000_000 }, (_, i) => String.fromCharCode(65 + (i % 26))).join('');
    const json = JSON.stringify({
      version: 1,
      tables: { documents: [{ id: 'd1', name: 'گواهی' }] },
      files: [{ path: 'documents/d1/scan.jpg', data: fileData }],
    });
    const payload = obfuscateWithPassword(json, 'S3cret!');
    expect(deobfuscateWithPassword(payload, 'S3cret!')).toBe(json);
    // legacy static variant round-trips too
    expect(deobfuscateText(obfuscateText(json))).toBe(json);
  });
});
