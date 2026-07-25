/**
 * guardrail2-verdict — canonical parser for guardrail-2 verdict markers off PR
 * comments and reviews, and the hold/clear decision they drive.
 *
 * Control layer (GAP-408): this module is the single editable source. The
 * public revealui `scripts/validate/guardrail2-verdict.cjs` and the private
 * `.jv/scripts/guardrail2-verdict.js` are thin adapters that load THIS module
 * at runtime — neither carries a vendored copy of the logic below.
 *
 * Why this exists: the review-before-merge gate (security-review-gate.cjs /
 * security-pr-review-check.js) and the server-side label guard
 * (sec-audit-label-decision.cjs) used to clear a PR on the
 * `sec-review:approved` label alone. Neither looked for a live
 * REQUEST-CHANGES. revealui#1910 merged with the label applied AGAINST a
 * REQUEST-CHANGES verdict that was sitting right there as a comment. This
 * module is the shared parse+decide logic every gate consults so a
 * REQUEST-CHANGES cannot be papered over by the label.
 *
 * THE MARKER CONTRACT: every guardrail-2 verdict a session posts (comment OR
 * review body) carries a machine-parseable trailer on its own line:
 *     <!-- guardrail2-verdict: REQUEST-CHANGES -->
 *     <!-- guardrail2-verdict: APPROVE -->
 * An HTML comment: invisible in rendered markdown, unambiguous, greppable.
 * The human-readable `## Guardrail-2 ... verdict: <VERDICT>` heading stays
 * too, for people.
 *
 * TOPOLOGY NOTE (verified 2026-07-16, load-bearing). Every fleet PR — and
 * every comment and review on it — is authored by a single GitHub account.
 * So login CANNOT tell the builder's comment apart from the reviewer's
 * comment today. Two consequences:
 *   - The `evaluateGuardrail2` DISTINCT-REVIEWER branch (login-filtered
 *     non-author verdicts, the spec's primary logic) is correct and
 *     unit-tested, but only ENGAGES once reviewer verdicts carry a distinct
 *     identity (post org-migration, or a reviewing session that
 *     authenticates as a different account).
 *   - Until then the SINGLE-LOGIN fail-safe branch runs: author markers are
 *     NOT dropped (dropping them would ignore the reviewer's own
 *     REQUEST-CHANGES — the exact #1910 miss), the latest verdict governs,
 *     and a REQUEST-CHANGES holds.
 * This module only supplies the hold/clear signal. The `sec-review:approved`
 * label stays owner-applied; clearing a PR still needs both a non-holding
 * verdict AND the label the way it always did.
 *
 * Zero authored regex (fleet no-regex HARDLINE): startsWith/endsWith/slice/
 * trim + a lexicographic timestamp compare (ISO-8601 Z strings sort
 * chronologically).
 */

export const MARKER_OPEN = '<!-- guardrail2-verdict:';
export const MARKER_CLOSE = '-->';
export const REQUEST_CHANGES = 'REQUEST-CHANGES';
export const APPROVE = 'APPROVE';

export type Verdict = typeof REQUEST_CHANGES | typeof APPROVE;

export interface ReviewLike {
  author?: { login?: string | null } | null;
  body?: string | null;
  submittedAt?: string | null;
}

export interface CommentLike {
  author?: { login?: string | null } | null;
  body?: string | null;
  createdAt?: string | null;
}

export interface VerdictRecord {
  verdict: Verdict;
  timestamp: string;
  author: string;
  isAuthor: boolean;
}

export interface EvaluateInput {
  reviews?: readonly ReviewLike[];
  comments?: readonly CommentLike[];
  authorLogin?: string;
}

export interface NoMarkerResult {
  status: 'no-marker';
}

export interface HoldResult {
  status: 'hold';
  reviewer: string;
  timestamp: string;
  verdict: typeof REQUEST_CHANGES;
}

export interface ClearResult {
  status: 'clear';
  reviewer: string;
  timestamp: string;
  verdict: Verdict;
}

export type EvaluateResult = NoMarkerResult | HoldResult | ClearResult;

/**
 * The verdict for ONE body: its LAST well-formed marker line, or null. A
 * line counts only when, trimmed, it starts with MARKER_OPEN, ends with
 * MARKER_CLOSE, and the text between them trims to exactly one of the two
 * tokens. Prose that merely mentions the marker mid-sentence, or an unknown
 * token, is not a verdict. Last-wins lets a reviewer correct themselves
 * within a single comment.
 */
export function verdictForBody(body: string | null | undefined): Verdict | null {
  if (typeof body !== 'string' || body.length === 0) return null;
  let found: Verdict | null = null;
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!(line.startsWith(MARKER_OPEN) && line.endsWith(MARKER_CLOSE))) continue;
    const inner = line.slice(MARKER_OPEN.length, line.length - MARKER_CLOSE.length).trim();
    if (inner === REQUEST_CHANGES || inner === APPROVE) found = inner;
    // malformed / unknown token → ignored (fail-safe: an ambiguous marker is not a verdict)
  }
  return found;
}

/**
 * Normalize reviews + comments into verdict records — one per body that
 * carries a verdict. Author-inclusive; each record is tagged `isAuthor`.
 * Reviews stamp their time in `submittedAt`, comments in `createdAt`.
 */
export function collectVerdicts(input: EvaluateInput = {}): VerdictRecord[] {
  const { reviews = [], comments = [], authorLogin = '' } = input;
  const out: VerdictRecord[] = [];
  const consume = (item: ReviewLike | CommentLike, timestamp: string): void => {
    const login = item.author?.login ?? '';
    const verdict = verdictForBody(item.body);
    if (verdict) {
      out.push({
        verdict,
        timestamp,
        author: login,
        isAuthor: login !== '' && login === authorLogin,
      });
    }
  };
  for (const r of reviews) consume(r, r.submittedAt ?? '');
  for (const c of comments) consume(c, c.createdAt ?? '');
  return out;
}

/**
 * Max-timestamp record; on a timestamp tie, REQUEST-CHANGES wins (fail-safe
 * — a same-instant APPROVE never masks a REQUEST-CHANGES). ISO-8601 Z
 * strings compare lexicographically === chronologically.
 */
function latest(records: readonly VerdictRecord[]): VerdictRecord | null {
  let best: VerdictRecord | null = null;
  for (const rec of records) {
    if (best === null || rec.timestamp > best.timestamp) {
      best = rec;
    } else if (rec.timestamp === best.timestamp && rec.verdict === REQUEST_CHANGES) {
      best = rec;
    }
  }
  return best;
}

/**
 * The gate decision.
 *   { status: 'no-marker' }                             → caller falls back to legacy label/review logic
 *   { status: 'hold',  reviewer, timestamp, verdict }    → an outstanding REQUEST-CHANGES; do NOT clear
 *   { status: 'clear', reviewer, timestamp, verdict }    → latest verdict is APPROVE
 */
export function evaluateGuardrail2(input: EvaluateInput = {}): EvaluateResult {
  const all = collectVerdicts(input);
  if (all.length === 0) return { status: 'no-marker' };

  // DISTINCT-REVIEWER branch (spec's primary logic; engages when reviewer
  // verdicts carry a login other than the PR author). The builder can never
  // self-clear: only NON-AUTHOR verdicts are considered, so a later author
  // APPROVE cannot lift a reviewer's REQUEST-CHANGES.
  const nonAuthor = all.filter((r) => !r.isAuthor);
  // SINGLE-LOGIN fail-safe: when no verdict is attributable to a non-author
  // (today's topology), fall back to the whole set rather than dropping the
  // reviewer's verdict.
  const pool = nonAuthor.length > 0 ? nonAuthor : all;

  const gov = latest(pool);
  if (gov === null) return { status: 'no-marker' };
  if (gov.verdict === REQUEST_CHANGES) {
    return { status: 'hold', reviewer: gov.author, timestamp: gov.timestamp, verdict: gov.verdict };
  }
  return { status: 'clear', reviewer: gov.author, timestamp: gov.timestamp, verdict: gov.verdict };
}
