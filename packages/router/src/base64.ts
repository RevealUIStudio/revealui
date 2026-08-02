/**
 * Chunked base64 encode for RSC payload inlining (ADR D15).
 * Avoids `String.fromCharCode(...spread)` which blows the call stack on large payloads.
 */
const CHUNK = 0x8000;

export function encodeBase64Chunked(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    // Build string without spread — loop keeps stack flat for large slices.
    let part = '';
    for (const byte of slice) {
      part += String.fromCharCode(byte);
    }
    binary += part;
  }
  return btoa(binary);
}

/** Collect a full ReadableStream into one Uint8Array (edge-safe, no Buffer). */
export async function readStreamToUint8Array(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}
