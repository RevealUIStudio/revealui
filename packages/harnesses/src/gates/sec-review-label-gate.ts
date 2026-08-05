/**
 * sec-review label apply gate — pure policy for GAP-375 native pair.
 *
 * Provider-agnostic port of Claude PreToolUse `sec-review-audit-gate.js`:
 * withhold `sec-review:approved` until security-audit checks are green.
 * Never applies a label; only returns block/allow.
 *
 * Zero authored regex (fleet hardline): substring + startsWith / word splits.
 */

export const SEC_REVIEW_APPROVED_LABEL = 'sec-review:approved';

/** Required status check names (match protect-main-test / Claude hook). */
export const REQUIRED_SECURITY_AUDIT_CHECKS = [
  'Security Gate',
  'CodeQL',
  'Secret Scanning (Gitleaks)',
  'Dependency Review',
] as const;

const FAILING = new Set([
  'FAILURE',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'ERROR',
  'CANCELLED',
]);

export interface StatusCheckLike {
  name?: string | null;
  conclusion?: string | null;
  state?: string | null;
}

export interface LabelGateResult {
  block: boolean;
  /** Human-readable reason when block is true */
  message?: string;
  /** Override path was used */
  overridden?: boolean;
}

/**
 * True when `command` is an actual `gh pr edit … --add-label sec-review:approved`
 * (not prose that merely mentions the strings).
 */
/** Split a shell line into segments on common separators (no authored regex). */
function shellSegments(command: string): string[] {
  const out: string[] = [];
  let buf = '';
  for (let i = 0; i < command.length; i++) {
    const ch = command[i] as string;
    const two = command.slice(i, i + 2);
    if (two === '&&' || two === '||') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === ';' || ch === '|') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function tokenize(s: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const ch of s) {
    if (ch === ' ' || ch === '\t') {
      if (cur) {
        parts.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

export function isSecReviewApprovedLabelAdd(command: string): boolean {
  if (typeof command !== 'string' || command.length === 0) return false;
  for (const seg of shellSegments(command)) {
    const s = seg.trim();
    // allow leading env assignments: FOO=1 gh pr edit
    let candidate = s;
    const ghSpace = s.indexOf(' gh ');
    if (ghSpace >= 0 && !s.startsWith('gh ') && !s.startsWith('gh\t')) {
      candidate = s.slice(ghSpace + 1).trim();
    }
    if (segmentIsLabelAdd(candidate)) return true;
  }
  return false;
}

function segmentIsLabelAdd(s: string): boolean {
  if (!s.includes('pr') || !s.includes('edit')) return false;
  const parts = tokenize(s);
  let sawGh = false;
  let sawPr = false;
  let sawEdit = false;
  let sawAddLabel = false;
  for (const p of parts) {
    if (p === 'gh') sawGh = true;
    else if (sawGh && p === 'pr') sawPr = true;
    else if (sawPr && p === 'edit') sawEdit = true;
    else if (p === '--add-label' || p.startsWith('--add-label=')) sawAddLabel = true;
  }
  if (!(sawGh && sawPr && sawEdit && sawAddLabel)) return false;
  return s.includes(SEC_REVIEW_APPROVED_LABEL);
}

/**
 * Evaluate a statusCheckRollup for required security-audit checks.
 * Fail-closed: missing check → not ok.
 */
export function evaluateSecurityAuditRollup(
  rollup: readonly StatusCheckLike[] | null | undefined,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const list = rollup ?? [];
  for (const name of REQUIRED_SECURITY_AUDIT_CHECKS) {
    const entries = list.filter((c) => c && c.name === name);
    if (entries.length === 0) {
      problems.push(`${name}: missing`);
      continue;
    }
    const bad = entries.find((c) => FAILING.has(c.conclusion ?? '') || FAILING.has(c.state ?? ''));
    if (bad) {
      problems.push(`${name}: ${bad.conclusion || bad.state || 'failing'}`);
      continue;
    }
    // pending / queued without SUCCESS still not green
    const success = entries.some(
      (c) =>
        (c.conclusion === 'SUCCESS' || c.state === 'SUCCESS') &&
        !FAILING.has(c.conclusion ?? '') &&
        !FAILING.has(c.state ?? ''),
    );
    if (!success) {
      problems.push(`${name}: not green`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Pure gate for applying `sec-review:approved`.
 *
 * @param command - shell command under consideration
 * @param rollup - statusCheckRollup from gh; null means cannot verify → fail closed
 * @param options.override - SEC_REVIEW_AUDIT_OVERRIDE=1 style kill switch
 */
export function checkSecReviewLabelApply(
  command: string,
  rollup: readonly StatusCheckLike[] | null | undefined,
  options: { override?: boolean } = {},
): LabelGateResult {
  if (!isSecReviewApprovedLabelAdd(command)) {
    return { block: false };
  }

  if (options.override) {
    return {
      block: false,
      overridden: true,
      message:
        'SEC_REVIEW_AUDIT_OVERRIDE — security-audit gate bypassed for sec-review:approved (human override; audit NOT verified).',
    };
  }

  if (rollup == null) {
    return {
      block: true,
      message:
        'sec-review audit gate: could not verify security audit (no check rollup). Fail-closed — label withheld. Override with SEC_REVIEW_AUDIT_OVERRIDE=1.',
    };
  }

  const { ok, problems } = evaluateSecurityAuditRollup(rollup);
  if (!ok) {
    return {
      block: true,
      message:
        `sec-review audit gate — security audit is NOT green; ${SEC_REVIEW_APPROVED_LABEL} withheld:\n  ` +
        problems.join('\n  ') +
        '\nApply the approval only after every audit check passes.',
    };
  }

  return { block: false };
}
