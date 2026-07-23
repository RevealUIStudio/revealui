/**
 * Pure batch planning for GAP-355 Stage 4 S4-3 (no I/O, no package side-effects).
 */

export interface SignedAuditRow {
  seq: number;
  signature: string;
}

function isContiguous(seqs: readonly number[]): boolean {
  if (seqs.length === 0) return false;
  for (let i = 1; i < seqs.length; i++) {
    const prev = seqs[i - 1];
    const cur = seqs[i];
    if (prev === undefined || cur === undefined || cur !== prev + 1) return false;
  }
  return true;
}

/**
 * Given last anchored seq (0 if none) and ordered candidate rows, return the
 * contiguous prefix to anchor, or null when the batch must be skipped (gap).
 */
export function planContiguousBatch(
  lastAnchoredSeq: number,
  rows: readonly SignedAuditRow[],
): SignedAuditRow[] | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  if (!first) return null;
  if (lastAnchoredSeq > 0 && first.seq !== lastAnchoredSeq + 1) {
    return null; // gap: do not skip ahead
  }
  if (isContiguous(rows.map((r) => r.seq))) {
    return [...rows];
  }
  // Longest contiguous prefix from the start
  const prefix: SignedAuditRow[] = [first];
  for (let i = 1; i < rows.length; i++) {
    const prev = prefix[prefix.length - 1];
    const cur = rows[i];
    if (!(prev && cur) || cur.seq !== prev.seq + 1) break;
    prefix.push(cur);
  }
  return prefix.length >= 1 ? prefix : null;
}
