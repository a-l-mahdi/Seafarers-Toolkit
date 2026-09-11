/**
 * Backup container format (like reputable apps: small encrypted header +
 * raw binary blobs):
 *
 *   SFTKB1\n
 *   <obfuscated header base64>      (metadata + DB tables — encrypted)
 *   \n<<<SFTK-BLOBS>>>\n
 *   <11-digit dataOffset>\n         (byte offset where blobs begin)
 *   [padding to a base64-aligned boundary]
 *   <raw file bytes, concatenated in header.files order>
 *
 * Only the header is encrypted; photo/PDF payloads are stored raw, which keeps
 * both backup and restore fast and memory-friendly. The offset line has a
 * fixed width so the blob area start is computable without circularity.
 */

import {
  bytesToBase64,
  deobfuscateText,
  deobfuscateWithPassword,
  obfuscateText,
  obfuscateWithPassword,
  stringToUtf8Bytes,
  utf8BytesToString,
} from './xor-codec';

export const CONTAINER_MAGIC = 'SFTKB1\n';
export const BLOB_MARKER = '\n<<<SFTK-BLOBS>>>\n';

export interface ContainerFileEntry {
  path: string;
  /** Raw size in bytes of this blob. */
  size: number;
  /** Offset of this blob relative to the start of the blob area. */
  offset: number;
}

export interface ContainerHeader {
  version: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
  files: ContainerFileEntry[];
}

export interface ParsedContainer {
  header: ContainerHeader;
  /** Absolute byte offset in the container where the blob area begins. */
  dataOffset: number;
}

/**
 * Builds the FULL container (prefix + raw blobs) as one base64 string.
 * The prefix is padded to a base64-aligned boundary so the raw blob bytes
 * follow directly.
 */
export function buildContainerBytes(
  header: ContainerHeader,
  password: string,
  blobs: Uint8Array[]
): string {
  const obfHeader = password
    ? obfuscateWithPassword(JSON.stringify(header), password)
    : obfuscateText(JSON.stringify(header));
  const base =
    stringToUtf8Bytes(CONTAINER_MAGIC).length +
    stringToUtf8Bytes(obfHeader).length +
    stringToUtf8Bytes(BLOB_MARKER).length;
  const lineLen = 12; // 11 fixed-width digits + "\n"
  const pad = (3 - ((base + lineLen) % 3)) % 3;
  const dataOffset = base + lineLen + pad;

  const blobTotal = blobs.reduce((acc, b) => acc + b.length, 0);
  const prefixStr =
    `${CONTAINER_MAGIC}${obfHeader}${BLOB_MARKER}` +
    `${String(dataOffset).padStart(11, '0')}\n` +
    '\n'.repeat(pad);
  const prefix = stringToUtf8Bytes(prefixStr);

  const container = new Uint8Array(prefix.length + blobTotal);
  container.set(prefix, 0);
  let cursor = prefix.length;
  for (const blob of blobs) {
    container.set(blob, cursor);
    cursor += blob.length;
  }
  return bytesToBase64(container);
}

/** Parses the container header from the first chunk of the file (bytes). */
export function parseContainerHeader(
  firstBytes: Uint8Array,
  password: string
): ParsedContainer | null {
  const magicBytes = stringToUtf8Bytes(CONTAINER_MAGIC);
  if (firstBytes.length < magicBytes.length) return null;
  for (let i = 0; i < magicBytes.length; i += 1) {
    if (firstBytes[i] !== magicBytes[i]) return null;
  }
  const markerBytes = stringToUtf8Bytes(BLOB_MARKER);
  const markerIdx = indexOfBytes(firstBytes, markerBytes, CONTAINER_MAGIC.length);
  if (markerIdx < 0) return null;
  // After the marker: "<11-digit dataOffset>\n"
  const afterMarker = markerIdx + markerBytes.length;
  let nl = afterMarker;
  while (nl < firstBytes.length && firstBytes[nl] !== 0x0a) nl += 1;
  if (nl >= firstBytes.length) return null;
  const dataOffset = parseInt(utf8BytesToString(firstBytes.subarray(afterMarker, nl)), 10);
  if (!Number.isFinite(dataOffset) || dataOffset <= 0) return null;
  // The header is stored as an ASCII base64 string — decode it, then deobfuscate.
  const headerAscii = utf8BytesToString(firstBytes.subarray(CONTAINER_MAGIC.length, markerIdx));
  const headerJson = password
    ? deobfuscateWithPassword(headerAscii, password)
    : deobfuscateText(headerAscii);
  try {
    const header = JSON.parse(headerJson) as ContainerHeader;
    if (!header || !header.tables || !Array.isArray(header.files)) return null;
    return { header, dataOffset };
  } catch {
    return null;
  }
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from: number): number {
  outer: for (let i = from; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
