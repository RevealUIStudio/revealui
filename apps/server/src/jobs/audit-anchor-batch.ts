/**
 * Pure batch planning for GAP-355 Stage 4 S4-3 (no I/O, no package side-effects).
 * GAP-447 adds existence-classified hole traversal (`planTraversableBatch`)
 * alongside the original strict-contiguity planner, kept unchanged below for
 * compatibility.
 */

export interface SignedAuditRow {
  seq: number;
  signature: string;
}

/**
 * GAP-447: classification of one seq in (lastAnchoredSeq, maxCandidateSeq]
 * that is NOT itself a same-scope signed candidate — derived from a single
 * `SELECT seq, tenant, (signature IS NULL)` query over the range.
 */
export interface ScopeRangeRow {
  /** True when the row's tenant matches this anchor's scope (system or the given tenant). */
  sameScope: boolean;
  /** True when the row is signed (signature IS NOT NULL). */
  signed: boolean;
}

export interface HoleInfo {
  /** Seqs with no audit_log row at all — burned (nextval consumed, INSERT never landed). */
  burned: number[];
  /** Count of present rows scoped to a different tenant (their seqs are not individually recorded). */
  foreign: number;
}

export interface TraversableBatchResult {
  /** The signed rows to Merkle-root, in seq order. May be empty (only when `stalledAtSeq` is set). */
  rows: SignedAuditRow[];
  /** First seq attested by this batch's range (== lastAnchoredSeq + 1 once an anchor/floor exists). */
  seqFrom: number;
  /** Last seq attested by this batch's range (last processed seq, whether leaf, burned, or foreign). */
  seqTo: number;
  holes: HoleInfo;
  /**
   * Present when traversal stopped early at a present, same-scope, UNSIGNED
   * row (fail-closed — post-GAP-417 rails this should be impossible, so it is
   * the one remaining anomaly signal). `rows` covers everything strictly
   * before this seq; nothing at or after it is included this pass.
   */
  stalledAtSeq?: number;
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

/**
 * GAP-447: existence-classified hole traversal. Given the same-scope signed
 * candidates (ordered by seq) and a classification map covering every OTHER
 * seq in (lastAnchoredSeq, maxCandidateSeq], walk the full range seq-by-seq:
 *
 *   - seq matches the next candidate      → include it as a leaf.
 *   - seq absent from `rangeMap`          → burned (permanently absent — the
 *     append-only trigger makes deletion impossible); traversable.
 *   - seq present, other scope            → foreign; traversable (count only).
 *   - seq present, same scope, unsigned   → FAIL CLOSED: stop here. Post-
 *     GAP-417 rails this should be impossible; it is the one remaining
 *     anomaly signal, so it stalls the batch rather than being traversed.
 *
 * `lastAnchoredSeq === 0` (no prior anchor and no legacy floor for this
 * scope) is permissive at the START only, matching `planContiguousBatch`:
 * the walk begins at the first candidate's own seq rather than forcing
 * `seqFrom` back to 1 — the audit_log seq is a single sequence shared across
 * every tenant, so seqs before a scope's first-ever row are almost certainly
 * other tenants' rows, not holes worth enumerating. Once any anchor or floor
 * exists for the scope, `seqFrom` is exactly `lastAnchoredSeq + 1` so every
 * seq in between is attested (leaf, burned, or foreign) with no unattested
 * gap between consecutive anchors.
 *
 * Returns null only when there are no candidates at all (nothing to do this
 * pass). A stall with zero rows traversed still returns a result (rows: [])
 * so the caller can distinguish "genuine stall right at the start" (warn +
 * metric) from "no candidates" (silent skip).
 */
export function planTraversableBatch(
  lastAnchoredSeq: number,
  scopeCandidates: readonly SignedAuditRow[],
  rangeMap: ReadonlyMap<number, ScopeRangeRow>,
): TraversableBatchResult | null {
  if (scopeCandidates.length === 0) return null;
  const firstCandidate = scopeCandidates[0];
  const maxSeq = scopeCandidates[scopeCandidates.length - 1]?.seq;
  if (!firstCandidate || maxSeq === undefined) return null;

  const startSeq = lastAnchoredSeq > 0 ? lastAnchoredSeq + 1 : firstCandidate.seq;

  const rows: SignedAuditRow[] = [];
  const burned: number[] = [];
  let foreign = 0;
  let candidateIdx = 0;

  for (let seq = startSeq; seq <= maxSeq; seq++) {
    const nextCandidate = scopeCandidates[candidateIdx];
    if (nextCandidate && nextCandidate.seq === seq) {
      rows.push(nextCandidate);
      candidateIdx++;
      continue;
    }
    const info = rangeMap.get(seq);
    if (!info) {
      burned.push(seq);
      continue;
    }
    if (!info.sameScope) {
      foreign++;
      continue;
    }
    if (!info.signed) {
      return {
        rows,
        seqFrom: startSeq,
        seqTo: seq - 1,
        holes: { burned, foreign },
        stalledAtSeq: seq,
      };
    }
    // Present, same scope, signed, but not the expected next candidate:
    // candidates are fetched exhaustively over this same range, so this
    // should be unreachable. Defensive no-op rather than a thrown assertion,
    // matching the fail-closed posture of the branch above (never silently
    // skip ahead — but also never crash the sweep on a query mismatch).
  }

  if (rows.length === 0) return null;
  return { rows, seqFrom: startSeq, seqTo: maxSeq, holes: { burned, foreign } };
}

/**
 * True when `scopeCandidates` are contiguous with `lastAnchoredSeq` (or with
 * each other, when `lastAnchoredSeq === 0`) — the common case with zero
 * holes, where the classification-map query can be skipped entirely.
 */
export function isConsecutiveFromStart(
  lastAnchoredSeq: number,
  scopeCandidates: readonly SignedAuditRow[],
): boolean {
  if (scopeCandidates.length === 0) return true;
  const first = scopeCandidates[0];
  if (!first) return true;
  if (lastAnchoredSeq > 0 && first.seq !== lastAnchoredSeq + 1) return false;
  return isContiguous(scopeCandidates.map((r) => r.seq));
}

/**
 * Self-consistency check before signing (replaces `assertContiguousSeq` for
 * the traversable planner): every seq strictly between consecutive rows must
 * be accounted for by a recorded hole (burned, individually, or foreign, by
 * count), and the leaf span from `seqFrom`/`seqTo` must match `rows.length`
 * plus the total holes traversed.
 */
export function assertTraversalIntegrity(result: TraversableBatchResult): void {
  const { rows, seqFrom, seqTo, holes } = result;
  if (rows.length === 0) {
    throw new Error('assertTraversalIntegrity: empty batch');
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (!(prev && cur) || cur.seq <= prev.seq) {
      throw new Error(`assertTraversalIntegrity: seq not strictly increasing at index ${i}`);
    }
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!(first && last) || first.seq < seqFrom || last.seq > seqTo) {
    throw new Error('assertTraversalIntegrity: leaf seqs fall outside seqFrom..seqTo');
  }
  const span = seqTo - seqFrom + 1;
  const holesCount = holes.burned.length + holes.foreign;
  if (span !== rows.length + holesCount) {
    throw new Error(
      `assertTraversalIntegrity: span ${span} != leaves ${rows.length} + holes ${holesCount}`,
    );
  }
}
