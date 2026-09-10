/**
 * Lightweight obfuscation for backup files: UTF-8 bytes XORed with a strong
 * app secret, then base64-encoded. Prevents the backup from being readable
 * as plain JSON while staying fully offline (no crypto dependency).
 * Backups are privacy protection, not security against a determined attacker
 * who has this source code.
 */

// 96-char ASCII secret — XOR key applied cyclically over the payload bytes.
const SECRET =
  'SfTk~2026!vQx7#mLw4$zR2p^X9cJ3&nB6t*K9dF5(hG1s)Y0uE8oP2aM4iC7rN3bV6xQ5zT1wKj4Hf8Dg2Ls5Vn9';

export function stringToUtf8Bytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

export function utf8BytesToString(bytes: number[]): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b === undefined) break;
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | ((bytes[i + 1] ?? 0) & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] ?? 0) & 0x3f) << 6 | ((bytes[i + 2] ?? 0) & 0x3f)
      );
      i += 3;
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] ?? 0) & 0x3f) << 12 |
        ((bytes[i + 2] ?? 0) & 0x3f) << 6 |
        ((bytes[i + 3] ?? 0) & 0x3f);
      i += 4;
      const adjusted = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
  }
  return out;
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] ?? 0;
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    out += B64_CHARS[b1 >> 2];
    out += B64_CHARS[((b1 & 0x03) << 4) | ((b2 ?? 0) >> 4)];
    out += b2 === undefined ? '=' : B64_CHARS[((b2 & 0x0f) << 2) | ((b3 ?? 0) >> 6)];
    out += b3 === undefined ? '=' : B64_CHARS[(b3 ?? 0) & 0x3f];
  }
  return out;
}

export function base64ToBytes(base64: string): number[] {
  // Keep '=' padding: indexOf('=') === -1 correctly marks missing chars.
  const clean = base64.replace(/\s/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = [
      B64_CHARS.indexOf(clean[i] ?? ''),
      B64_CHARS.indexOf(clean[i + 1] ?? ''),
      B64_CHARS.indexOf(clean[i + 2] ?? ''),
      B64_CHARS.indexOf(clean[i + 3] ?? ''),
    ];
    out.push(((n[0] & 0x3f) << 2) | ((n[1] & 0x3f) >> 4));
    if (n[2] >= 0) out.push(((n[1] & 0x0f) << 4) | ((n[2] & 0x3f) >> 2));
    if (n[3] >= 0) out.push(((n[2] & 0x03) << 6) | (n[3] & 0x3f));
  }
  return out;
}

function xorWithSecret(bytes: number[]): number[] {
  return bytes.map((b, i) => b ^ (SECRET.charCodeAt(i % SECRET.length) & 0xff));
}

/** XOR with the app secret entangled bit-wise with the user's backup password,
 *  so every byte of the payload depends on the password. */
function xorWithKey(bytes: number[], key: string): number[] {
  const keyBytes = key ? stringToUtf8Bytes(key) : [0x5e];
  return bytes.map(
    (b, i) => b ^ ((SECRET.charCodeAt(i % SECRET.length) & 0xff) ^ keyBytes[i % keyBytes.length])
  );
}

/** Encodes plain text into an obfuscated base64 payload. */
export function obfuscateText(text: string): string {
  return bytesToBase64(xorWithSecret(stringToUtf8Bytes(text)));
}

/** Decodes an obfuscated base64 payload back into plain text. */
export function deobfuscateText(payload: string): string {
  return utf8BytesToString(xorWithSecret(base64ToBytes(payload)));
}

/** Password-protected variant: without the exact password the payload is unreadable. */
export function obfuscateWithPassword(text: string, password: string): string {
  return bytesToBase64(xorWithKey(stringToUtf8Bytes(text), password));
}

export function deobfuscateWithPassword(payload: string, password: string): string {
  return utf8BytesToString(xorWithKey(base64ToBytes(payload), password));
}
