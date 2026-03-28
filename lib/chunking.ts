export function chunkBuffer(
  buffer: ArrayBuffer,
  chunkSize: number = 2 * 1024 * 1024,
): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  let offset = 0;

  while (offset < buffer.byteLength) {
    const end = Math.min(offset + chunkSize, buffer.byteLength);
    chunks.push(buffer.slice(offset, end));
    offset = end;
  }

  return chunks;
}

function encodeBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i] || 0;
    const b2 = bytes[i + 1] || 0;
    const b3 = bytes[i + 2] || 0;
    const triplet = (b1 << 16) | (b2 << 8) | b3;

    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    output += i + 1 < bytes.length ? chars[(triplet >> 6) & 0x3f] : '=';
    output += i + 2 < bytes.length ? chars[triplet & 0x3f] : '=';
  }

  return output;
}

function decodeBase64(input: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i += 4) {
    const c1 = chars.indexOf(clean[i]);
    const c2 = chars.indexOf(clean[i + 1]);
    const c3 = clean[i + 2] === '=' ? -1 : chars.indexOf(clean[i + 2]);
    const c4 = clean[i + 3] === '=' ? -1 : chars.indexOf(clean[i + 3]);

    const n1 = c1 < 0 ? 0 : c1;
    const n2 = c2 < 0 ? 0 : c2;
    const n3 = c3 < 0 ? 0 : c3;
    const n4 = c4 < 0 ? 0 : c4;

    const triplet = (n1 << 18) | (n2 << 12) | (n3 << 6) | n4;
    bytes.push((triplet >> 16) & 0xff);
    if (c3 >= 0) bytes.push((triplet >> 8) & 0xff);
    if (c4 >= 0) bytes.push(triplet & 0xff);
  }

  return new Uint8Array(bytes);
}

async function importAesKey(fileKey: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const keyBytes = decodeBase64(fileKey);
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, usages);
}

export async function encryptMediaChunks(
  chunks: ArrayBuffer[],
  fileKey: string,
): Promise<string[]> {
  const key = await importAesKey(fileKey, ['encrypt']);

  const encryptedChunks = await Promise.all(
    chunks.map(async (chunk) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        chunk,
      );

      const cipherBytes = new Uint8Array(encrypted);
      const packed = new Uint8Array(iv.byteLength + cipherBytes.byteLength);
      packed.set(iv, 0);
      packed.set(cipherBytes, iv.byteLength);
      return encodeBase64(packed);
    }),
  );

  return encryptedChunks;
}
