import { base64ToBytes, bytesToBase64, deobfuscateText, obfuscateText, stringToUtf8Bytes, utf8BytesToString } from '../xor-codec';

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
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
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
});
