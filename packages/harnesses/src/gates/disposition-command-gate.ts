/**
 * disposition-command-gate — pure policy for GAP-375 native pair.
 *
 * Enforces disposition-actions.md in-loop for any harness that routes shell
 * through RevDev tool-guard: agents propose; owner disposes merges and
 * gate-clearing labels.
 *
 * Zero authored regex: substring and token scans only.
 */

export interface DispositionGateResult {
  block: boolean;
  rule?: string;
  reason?: string;
}

/**
 * True when the command is a `gh pr merge` (agent self-merge / dispose).
 */
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

export function isGhPrMergeCommand(command: string): boolean {
  if (typeof command !== 'string' || command.length === 0) return false;
  for (const seg of shellSegments(command)) {
    const s = seg.trim();
    if (segmentIsGhPrMerge(s)) return true;
    const ghIdx = s.indexOf(' gh ');
    if (ghIdx >= 0 && segmentIsGhPrMerge(s.slice(ghIdx + 1).trim())) return true;
  }
  return false;
}

function segmentIsGhPrMerge(s: string): boolean {
  const parts = tokenize(s);
  let sawGh = false;
  let sawPr = false;
  for (const p of parts) {
    if (p === 'gh') sawGh = true;
    else if (sawGh && p === 'pr') sawPr = true;
    else if (sawPr && p === 'merge') return true;
  }
  return false;
}

/**
 * True when the command removes a holding review / tries to clear a security
 * gate via gh (agent self-clear). Conservative: blocks request-changes dismiss
 * and force-approve patterns used as workarounds.
 */
export function isSecuritySelfClearCommand(command: string): boolean {
  if (typeof command !== 'string' || command.length === 0) return false;
  const lower = command.toLowerCase();
  // dismiss a REQUEST_CHANGES review
  if (
    lower.includes('gh') &&
    lower.includes('pr') &&
    lower.includes('review') &&
    lower.includes('dismiss')
  ) {
    return true;
  }
  // remove sec-review:approved after applying (owner-only cleanup is rare; agents must not)
  if (
    lower.includes('gh') &&
    lower.includes('pr') &&
    lower.includes('edit') &&
    lower.includes('--remove-label') &&
    lower.includes('sec-review')
  ) {
    return true;
  }
  return false;
}

/**
 * Pure disposition gate for agent-executed shell commands.
 * Blocks merge and security self-clear; does not replace CI gates.
 */
export function checkDispositionCommand(command: string): DispositionGateResult {
  if (isGhPrMergeCommand(command)) {
    return {
      block: true,
      rule: 'disposition-no-merge',
      reason:
        'Agents propose; the owner disposes merges (disposition-actions). Do not run `gh pr merge` from an agent tool path. List the one-line owner command instead.',
    };
  }
  if (isSecuritySelfClearCommand(command)) {
    return {
      block: true,
      rule: 'disposition-no-self-clear',
      reason:
        'Agents must not dismiss security reviews or remove sec-review labels. Owner disposes gate-clearing actions.',
    };
  }
  return { block: false };
}
