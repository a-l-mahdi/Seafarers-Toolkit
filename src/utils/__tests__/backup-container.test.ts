import { buildContainerBytes, parseContainerHeader, CONTAINER_MAGIC } from '../backup-container';
import { base64ToBytes, utf8BytesToString } from '../xor-codec';

describe('backup container', () => {
  const header = {
    version: 2,
    exportedAt: '2026-09-11T10:00:00.000Z',
    tables: { documents: [{ id: 'd1', name: 'گواهی' }] },
    files: [
      { path: 'documents/d1/scan.jpg', size: 11, offset: 0 },
      { path: 'trips/c1/wages.pdf', size: 5, offset: 11 },
    ],
  };

  it('round-trips header and raw blobs (persian metadata, password)', () => {
    const blob1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const blob2 = new Uint8Array([201, 202, 203, 204, 205]);
    const withSettings = { ...header, appSettings: { locale: 'fa', theme: 'dark', calendar: 'jalali' } };
    const containerB64 = buildContainerBytes(withSettings, 'S3cret!', [blob1, blob2]);
    const bytes = base64ToBytes(containerB64);

    // Magic is visible and payload bytes are NOT readable as text.
    const magicStr = String.fromCharCode(...bytes.subarray(0, CONTAINER_MAGIC.length - 1));
    expect(magicStr).toBe(CONTAINER_MAGIC.trim());

    const parsed = parseContainerHeader(bytes, 'S3cret!');
    expect(parsed).not.toBeNull();
    const { header: parsedHeader, dataOffset } = parsed!;
    expect(parsedHeader.version).toBe(2);
    expect(parsedHeader.appSettings).toEqual({ locale: 'fa', theme: 'dark', calendar: 'jalali' });
    expect(parsedHeader.tables.documents).toEqual([{ id: 'd1', name: 'گواهی' }]);
    expect(parsedHeader.files).toHaveLength(2);
    // Blobs must land exactly where the header says.
    expect(Array.from(bytes.subarray(dataOffset + 0, dataOffset + 11))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(Array.from(bytes.subarray(dataOffset + 11, dataOffset + 16))).toEqual([201, 202, 203, 204, 205]);
  });

  it('rejects a wrong password for the header', () => {
    const containerB64 = buildContainerBytes(header, 'S3cret!', [new Uint8Array(11), new Uint8Array(5)]);
    const bytes = base64ToBytes(containerB64);
    const parsed = parseContainerHeader(bytes, 'nope');
    expect(parsed).toBeNull();
  });

  it('is not readable as plain json', () => {
    const containerB64 = buildContainerBytes(header, 'S3cret!', [new Uint8Array(11), new Uint8Array(5)]);
    const text = utf8BytesToString(base64ToBytes(containerB64));
    expect(text).not.toContain('گواهی');
    expect(text).not.toContain('"tables"');
  });
});
