/**
 * Public GitHub comment gate — keep adversarial security reviews off public
 * surfaces. Guardrail-2 still records a verdict marker on the PR; the attack
 * writeup stays private.
 *
 * Zero authored regex: substring + token scans only.
 */

export interface PublicCommentGateResult {
  block: boolean;
  rule?: string;
  reason?: string;
}

/** Public org repos. Unknown owner/repo is treated as public (fail-closed). */
const PRIVATE_REPOS: readonly string[] = ['revealuistudio/revealui-jv'];

export const PUBLIC_VERDICT_MAX_CHARS = 800;

const ESSAY_MARKERS: readonly string[] = [
  'Attack checklist',
  'attack checklist',
  'AuthN/AuthZ',
  'Tenant/scope isolation',
  'privilege escalation',
  'best attack attempts',
  'Finding F1',
  'Finding F2',
  'Finding F3',
  '| repro |',
  'concrete bypass',
  'omit agentId',
];

function lower(s: string): string {
  return s.toLowerCase();
}

function tokenize(s: string): string[] {
  const parts: string[] = [];
  let cur = '';
  for (const ch of s) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
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

function isCommentPostSegment(s: string): boolean {
  const parts = tokenize(s);
  let sawGh = false;
  let sawPrOrIssue = false;
  let sawApi = false;
  for (const p of parts) {
    if (p === 'gh') sawGh = true;
    else if (sawGh && (p === 'pr' || p === 'issue')) sawPrOrIssue = true;
    else if (sawGh && p === 'api') sawApi = true;
    else if (sawPrOrIssue && (p === 'comment' || p === 'review')) return true;
  }
  if (sawGh && sawApi) {
    const low = lower(s);
    if (low.includes('/comments') || low.includes('/pulls/') || low.includes('/reviews')) {
      return true;
    }
  }
  return false;
}

export function isGithubCommentCommand(command: string): boolean {
  if (typeof command !== 'string' || command.length === 0) return false;
  for (const seg of shellSegments(command)) {
    if (isCommentPostSegment(seg)) return true;
  }
  return false;
}

function extractRepo(command: string): string | null {
  const parts = tokenize(command);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] ?? '';
    if (p === '-R' || p === '--repo') {
      const next = parts[i + 1];
      if (next) return lower(next);
    }
    if (p.startsWith('--repo=')) return lower(p.slice('--repo='.length));
    if (p.startsWith('-R=')) return lower(p.slice(3));
  }
  const apiIdx = command.indexOf('repos/');
  if (apiIdx >= 0) {
    const rest = command.slice(apiIdx + 'repos/'.length);
    const slash1 = rest.indexOf('/');
    if (slash1 > 0) {
      const owner = rest.slice(0, slash1);
      let end = slash1 + 1;
      while (end < rest.length) {
        const c = rest.charCodeAt(end);
        const ok =
          (c >= 48 && c <= 57) ||
          (c >= 65 && c <= 90) ||
          (c >= 97 && c <= 122) ||
          c === 45 ||
          c === 95 ||
          c === 46;
        if (!ok) break;
        end += 1;
      }
      const repo = rest.slice(slash1 + 1, end);
      if (owner && repo) return lower(`${owner}/${repo}`);
    }
  }
  return null;
}

function isPrivateRepo(repo: string | null): boolean {
  if (!repo) return false;
  return PRIVATE_REPOS.includes(repo);
}

function unquote(raw: string): string {
  if (raw.length >= 2) {
    const a = raw[0];
    const b = raw[raw.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

function extractHeredoc(command: string): string | null {
  const markers = ["<<'EOF'", '<<"EOF"', '<<EOF', "<<'BODY'", '<<"BODY"'] as const;
  for (const marker of markers) {
    const idx = command.indexOf(marker);
    if (idx < 0) continue;
    let start = idx + marker.length;
    if (command[start] === '\r' && command[start + 1] === '\n') start += 2;
    else if (command[start] === '\n') start += 1;
    const endName = marker.includes('BODY') ? 'BODY' : 'EOF';
    const rest = command.slice(start);
    const closers = [`\n${endName}\n`, `\n${endName}"`, `\n${endName}'`, `\n${endName})`, `\n${endName}`];
    let best = -1;
    let closerLen = 0;
    for (const closer of closers) {
      const at = rest.indexOf(closer);
      if (at >= 0 && (best < 0 || at < best)) {
        best = at;
        closerLen = closer.length;
      }
    }
    if (best >= 0) return rest.slice(0, best);
  }
  return null;
}

function readQuoted(command: string, start: number): { value: string; end: number } | null {
  const q = command[start];
  if (q !== '"' && q !== "'") return null;
  let i = start + 1;
  let value = '';
  while (i < command.length) {
    const ch = command[i] as string;
    if (ch === '\\' && q === '"' && i + 1 < command.length) {
      value += command[i + 1];
      i += 2;
      continue;
    }
    if (ch === q) return { value, end: i + 1 };
    value += ch;
    i += 1;
  }
  return { value, end: i };
}

function skipWs(command: string, start: number): number {
  let i = start;
  while (i < command.length && (command[i] === ' ' || command[i] === '\t' || command[i] === '\n')) {
    i += 1;
  }
  return i;
}

function findFlag(command: string, flag: string): number {
  let from = 0;
  while (from < command.length) {
    const idx = command.indexOf(flag, from);
    if (idx < 0) return -1;
    const before = idx === 0 ? ' ' : command[idx - 1];
    const after = command[idx + flag.length];
    const beforeOk = before === ' ' || before === '\t' || before === '\n';
    const afterOk =
      after === undefined || after === ' ' || after === '=' || after === '\t' || after === '\n';
    if (beforeOk && afterOk) return idx;
    from = idx + 1;
  }
  return -1;
}

function extractFlagValue(command: string, flag: string): string | null {
  const idx = findFlag(command, flag);
  if (idx < 0) return null;
  let i = skipWs(command, idx + flag.length);
  if (command[i] === '=') i = skipWs(command, i + 1);
  const quoted = readQuoted(command, i);
  if (quoted) return quoted.value;
  let end = i;
  while (end < command.length && command[end] !== ' ' && command[end] !== '\t' && command[end] !== '\n') {
    end += 1;
  }
  return end > i ? command.slice(i, end) : null;
}

export function extractCommentBody(command: string): string {
  const heredoc = extractHeredoc(command);
  if (heredoc !== null) return heredoc;

  for (const flag of ['--body', '-b', '--message', '-m'] as const) {
    const value = extractFlagValue(command, flag);
    if (value) return unquote(value);
  }

  const rawField = extractFlagValue(command, '--raw-field') ?? extractFlagValue(command, '-f');
  if (rawField && rawField.startsWith('body=')) return unquote(rawField.slice('body='.length));

  return '';
}

function countEssayMarkers(body: string): number {
  let n = 0;
  for (const marker of ESSAY_MARKERS) {
    if (body.includes(marker)) n += 1;
  }
  return n;
}

/**
 * Block a `gh` comment/review post that would publish an adversarial
 * security-review writeup to a public (or unknown) repo.
 */
export function checkPublicSecurityComment(command: string): PublicCommentGateResult {
  if (typeof command !== 'string' || command.length === 0) {
    return { block: false };
  }
  if (!isGithubCommentCommand(command)) {
    return { block: false };
  }

  const repo = extractRepo(command);
  if (isPrivateRepo(repo)) {
    return { block: false };
  }

  const body = extractCommentBody(command);
  const hasVerdict = body.includes('guardrail2-verdict');
  const markers = countEssayMarkers(body);
  const tooLongForPublicVerdict = hasVerdict && body.length > PUBLIC_VERDICT_MAX_CHARS;

  if (tooLongForPublicVerdict || (hasVerdict && markers > 0) || markers >= 2) {
    return {
      block: true,
      rule: 'public-security-comment',
      reason:
        'Blocked: adversarial security-review writeup on a public GitHub surface. ' +
        'Post only a short verdict + `<!-- guardrail2-verdict: APPROVE|REQUEST-CHANGES -->`. ' +
        'Keep the attack checklist, findings, and repros private (.jv).',
    };
  }

  if (!hasVerdict && markers === 1 && body.length > 2000) {
    return {
      block: true,
      rule: 'public-security-comment',
      reason:
        'Blocked: long public comment looks like a security-review essay. ' +
        'Keep exploit-shaped notes private.',
    };
  }

  return { block: false };
}

/** Public-safe guardrail-2 comment. Throws if `summary` is essay-shaped or too long. */
export function renderPublicGuardrail2Comment(
  verdict: 'APPROVE' | 'REQUEST-CHANGES',
  summary: string,
): string {
  const trimmed = summary.trim();
  if (trimmed.length > 400) {
    throw new Error('public guardrail-2 summary must be <= 400 characters');
  }
  if (countEssayMarkers(trimmed) > 0) {
    throw new Error('public guardrail-2 summary must not include attack-writeup markers');
  }
  return [
    `## Guardrail-2 security verdict: ${verdict}`,
    '',
    trimmed,
    '',
    'Residual review notes are private, not in this comment.',
    '',
    `<!-- guardrail2-verdict: ${verdict} -->`,
    '',
  ].join('\n');
}
