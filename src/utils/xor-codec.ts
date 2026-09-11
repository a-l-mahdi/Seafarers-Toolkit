/**
 * Lightweight obfuscation for backup files: UTF-8 bytes XORed with a strong
 * app secret (optionally entangled with the user's backup password), then
 * base64-encoded. Operates on Uint8Array with chunked string building so it
 * stays fast and memory-friendly for large (multi-MB) backups.
 */

// 96-char ASCII secret — XOR key applied cyclically over the payload bytes.
const SECRET =
  'SfTk~2026!vQx7#mLw4$zR2p^X9cJ3&nB6tK9dF5(hG1s)Y0uE8oP2aM4iC7rN3bV6xQ5zT1wKj4Hf8Dg2Ls5Vn9';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = new Int16Array(128).fill(-1);
for (let i = 0; i < B64_CHARS.length; i += 1) {
  B64_LOOKUP[B64_CHARS.charCodeAt(i)] = i;
}

/** Encodes a JS string into UTF-8 bytes (surrogate pairs handled). */
export function stringToUtf8Bytes(input: string): Uint8Array {
  // Worst case: 3 bytes per UTF-16 unit (BMP non-ASCII); surrogate pairs use 4 bytes per 2 units.
  const bytes = new Uint8Array(input.length * 3 + 4);
  let n = 0;
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < input.length) {
      const low = input.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) {
      bytes[n++] = code;
    } else if (code < 0x800) {
      bytes[n++] = 0xc0 | (code >> 6);
      bytes[n++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      bytes[n++] = 0xe0 | (code >> 12);
      bytes[n++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[n++] = 0x80 | (code & 0x3f);
    } else {
      bytes[n++] = 0xf0 | (code >> 18);
      bytes[n++] = 0x80 | ((code >> 12) & 0x3f);
      bytes[n++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[n++] = 0x80 | (code & 0x3f);
    }
  }
  return bytes.subarray(0, n);
}

/** Decodes UTF-8 bytes back into a JS string (fast, chunked). */
export function utf8BytesToString(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  const total = bytes.length;
  while (i < total) {
    const b = bytes[i];
    if (b < 0x80) {
      const start = i;
      while (i < total && bytes[i] < 0x80) i += 1;
      // Cap each apply() at 0x8000 args — a huge ASCII run would overflow the call stack.
      for (let s = start; s < i; s += 0x8000) {
        out += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(s, Math.min(s + 0x8000, i)))
        );
      }
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      );
      i += 3;
    } else {
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f);
      i += 4;
      const adjusted = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : undefined;
    const b3 = i + 2 < len ? bytes[i + 2] : undefined;
    let group = B64_CHARS[b1 >> 2] + B64_CHARS[((b1 & 0x03) << 4) | ((b2 ?? 0) >> 4)];
    if (b2 === undefined) {
      group += '==';
    } else if (b3 === undefined) {
      group += B64_CHARS[(b2 & 0x0f) << 2] + '=';
    } else {
      group += B64_CHARS[((b2 & 0x0f) << 2) | (b3 >> 6)] + B64_CHARS[b3 & 0x3f];
    }
    parts.push(group);
  }
  return parts.join('');
}

export function base64ToBytes(base64: string): Uint8Array {
  // Keep '=' padding: indexOf('=') === -1 correctly marks missing chars.
  const clean = base64.replace(/\s/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let n = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_LOOKUP[clean.charCodeAt(i)] ?? -1;
    const c1 = B64_LOOKUP[clean.charCodeAt(i + 1)] ?? -1;
    const c2 = clean.charCodeAt(i + 2) === 61 ? -1 : B64_LOOKUP[clean.charCodeAt(i + 2)] ?? -1;
    const c3 = clean.charCodeAt(i + 3) === 61 ? -1 : B64_LOOKUP[clean.charCodeAt(i + 3)] ?? -1;
    out[n++] = ((c0 & 0x3f) << 2) | ((c1 & 0x3f) >> 4);
    if (c2 >= 0) out[n++] = ((c1 & 0x0f) << 4) | ((c2 & 0x3f) >> 2);
    if (c3 >= 0) out[n++] = ((c2 & 0x03) << 6) | (c3 & 0x3f);
  }
  return out.subarray(0, n);
}

/** XOR the bytes with the app secret (legacy static variant). */
function xorWithSecret(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ (SECRET.charCodeAt(i % SECRET.length) & 0xff);
  }
  return out;
}

/** XOR with the app secret entangled bit-wise with the user's backup password,
 *  so every byte of the payload depends on the password. */
function xorWithKey(bytes: Uint8Array, key: string): Uint8Array {
  const keyBytes = key ? stringToUtf8Bytes(key) : new Uint8Array([0x5e]);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i] ^ ((SECRET.charCodeAt(i % SECRET.length) & 0xff) ^ keyBytes[i % keyBytes.length]);
  }
  return out;
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
