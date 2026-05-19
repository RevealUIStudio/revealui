/**
 * Internal helpers shared across storage providers.
 *
 * Underscore prefix denotes private-to-storage/; not re-exported from
 * packages/core/src/storage/index.ts.
 *
 * GAP-208 Phase 2a (2026-05-18).
 */

/**
 * Normalize the four accepted body types into a Uint8Array so providers
 * can compute size + hand a known buffer to their underlying SDKs.
 */
export async function toUint8Array(
  data: Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  const reader = data.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
