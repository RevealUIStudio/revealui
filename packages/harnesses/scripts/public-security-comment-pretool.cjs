#!/usr/bin/env node
/**
 * Grok (and other) PreToolUse entry: block public adversarial security-review
 * comments even when the harnesses CLI / policy snapshot is missing.
 *
 * Tries @revealui/harnesses/gates first. Falls back to the inlined classifier
 * so a missing dist cannot re-open the leak. Lockstep is proven by the
 * harnesses gate tests (same markers + length contract).
 *
 * Stdin: Grok/Claude hook JSON. On deny: { decision: "deny", reason } + exit 2.
 * On allow: run `revealui-harnesses hook grok` with the same stdin when this
 * file is the Grok entry; otherwise exit 0.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PUBLIC_VERDICT_MAX_CHARS = 800;
const PRIVATE_REPOS = ['revealuistudio/revealui-jv'];
const ESSAY_MARKERS = [
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

function tokenize(s) {
  const parts = [];
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

function shellSegments(command) {
  const out = [];
  let buf = '';
  for (let i = 0; i < command.length; i += 1) {
    const two = command.slice(i, i + 2);
    if (two === '&&' || two === '||') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += 1;
      continue;
    }
    const ch = command[i];
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

function isCommentPostSegment(s) {
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
    const low = s.toLowerCase();
    if (low.includes('/comments') || low.includes('/pulls/') || low.includes('/reviews')) {
      return true;
    }
  }
  return false;
}

function isGithubCommentCommand(command) {
  if (typeof command !== 'string' || command.length === 0) return false;
  for (const seg of shellSegments(command)) {
    if (isCommentPostSegment(seg)) return true;
  }
  return false;
}

function extractRepo(command) {
  const parts = tokenize(command);
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i] || '';
    if (p === '-R' || p === '--repo') {
      const next = parts[i + 1];
      if (next) return next.toLowerCase();
    }
    if (p.startsWith('--repo=')) return p.slice('--repo='.length).toLowerCase();
    if (p.startsWith('-R=')) return p.slice(3).toLowerCase();
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
      if (owner && repo) return `${owner}/${repo}`.toLowerCase();
    }
  }
  return null;
}

function unquote(raw) {
  if (raw.length >= 2) {
    const a = raw[0];
    const b = raw[raw.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return raw.slice(1, -1);
  }
  return raw;
}

function extractHeredoc(command) {
  const markers = ["<<'EOF'", '<<"EOF"', '<<EOF', "<<'BODY'", '<<"BODY"'];
  for (const marker of markers) {
    const idx = command.indexOf(marker);
    if (idx < 0) continue;
    let start = idx + marker.length;
    if (command[start] === '\r' && command[start + 1] === '\n') start += 2;
    else if (command[start] === '\n') start += 1;
    const endName = marker.includes('BODY') ? 'BODY' : 'EOF';
    const rest = command.slice(start);
    const closers = [
      `\n${endName}\n`,
      `\n${endName}"`,
      `\n${endName}'`,
      `\n${endName})`,
      `\n${endName}`,
    ];
    let best = -1;
    for (const closer of closers) {
      const at = rest.indexOf(closer);
      if (at >= 0 && (best < 0 || at < best)) best = at;
    }
    if (best >= 0) return rest.slice(0, best);
  }
  return null;
}

function readQuoted(command, start) {
  const q = command[start];
  if (q !== '"' && q !== "'") return null;
  let i = start + 1;
  let value = '';
  while (i < command.length) {
    const ch = command[i];
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

function skipWs(command, start) {
  let i = start;
  while (i < command.length && (command[i] === ' ' || command[i] === '\t' || command[i] === '\n')) {
    i += 1;
  }
  return i;
}

function findFlag(command, flag) {
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

function extractFlagValue(command, flag) {
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

function isGhApiCommand(command) {
  const parts = tokenize(command);
  let sawGh = false;
  for (const p of parts) {
    if (p === 'gh') sawGh = true;
    else if (sawGh && p === 'api') return true;
  }
  return false;
}

function readBodyFile(filePath) {
  const file = unquote(filePath);
  if (!file || file === '-') return { body: '', unread: true };
  try {
    return { body: fs.readFileSync(file, 'utf8'), unread: false };
  } catch {
    return { body: '', unread: true };
  }
}

function resolveFieldBody(raw) {
  const value = unquote(raw.startsWith('body=') ? raw.slice('body='.length) : raw);
  if (value.startsWith('@')) return readBodyFile(value.slice(1));
  return { body: value, unread: false };
}

function extractCommentBody(command) {
  const heredoc = extractHeredoc(command);
  if (heredoc !== null) return { body: heredoc, unread: false };
  for (const flag of ['--body', '-b', '--message', '-m']) {
    const value = extractFlagValue(command, flag);
    if (value) return { body: unquote(value), unread: false };
  }
  const fileFlag = extractFlagValue(command, '--body-file');
  if (fileFlag) return readBodyFile(fileFlag);
  if (!isGhApiCommand(command)) {
    const dashF = extractFlagValue(command, '-F');
    if (dashF && !dashF.startsWith('body=')) return readBodyFile(dashF);
  }
  const rawField = extractFlagValue(command, '--raw-field') || extractFlagValue(command, '-F');
  if (rawField && rawField.startsWith('body=')) return resolveFieldBody(rawField);
  const shortField = extractFlagValue(command, '-f');
  if (shortField && shortField.startsWith('body=')) return resolveFieldBody(shortField);
  return { body: '', unread: false };
}

function countEssayMarkers(body) {
  let n = 0;
  for (const marker of ESSAY_MARKERS) {
    if (body.includes(marker)) n += 1;
  }
  return n;
}

function fallbackCheck(command) {
  if (typeof command !== 'string' || command.length === 0) return { block: false };
  if (!isGithubCommentCommand(command)) return { block: false };
  const repo = extractRepo(command);
  if (repo && PRIVATE_REPOS.includes(repo)) return { block: false };
  const extracted = extractCommentBody(command);
  if (extracted.unread) {
    return {
      block: true,
      reason:
        'Blocked: public GitHub comment body could not be classified ' +
        '(`--body-file` / `-F` unread or stdin). Post a short inline `--body` ' +
        'or a readable body file.',
    };
  }
  const body = extracted.body;
  const hasVerdict = body.includes('guardrail2-verdict');
  const markers = countEssayMarkers(body);
  if (
    (hasVerdict && body.length > PUBLIC_VERDICT_MAX_CHARS) ||
    (hasVerdict && markers > 0) ||
    markers >= 2
  ) {
    return {
      block: true,
      reason:
        'Blocked: adversarial security-review writeup on a public GitHub surface. ' +
        'Post only a short verdict + `<!-- guardrail2-verdict: APPROVE|REQUEST-CHANGES -->`. ' +
        'Keep the attack checklist, findings, and repros private (.jv).',
    };
  }
  if (!hasVerdict && markers === 1 && body.length > 2000) {
    return {
      block: true,
      reason:
        'Blocked: long public comment looks like a security-review essay. ' +
        'Keep exploit-shaped notes private.',
    };
  }
  return { block: false };
}

function loadCheck() {
  const candidates = [
    path.join(__dirname, '..', 'dist', 'gates', 'public-security-comment-gate.js'),
    path.join(
      os.homedir(),
      'revfleet',
      'revealui',
      'packages',
      'harnesses',
      'dist',
      'gates',
      'public-security-comment-gate.js',
    ),
  ];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const loaded = require(file);
        if (typeof loaded.checkPublicSecurityComment === 'function') {
          return loaded.checkPublicSecurityComment;
        }
      }
    } catch {
      /* try next */
    }
  }
  try {
    const loaded = require('@revealui/harnesses/gates');
    if (typeof loaded.checkPublicSecurityComment === 'function') {
      return loaded.checkPublicSecurityComment;
    }
  } catch {
    /* fallback */
  }
  return fallbackCheck;
}

function readCommandFromHookPayload(raw) {
  if (!raw || !raw.trim()) return '';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return '';
  }
  const input = parsed.toolInput || parsed.tool_input || {};
  if (typeof input.command === 'string') return input.command;
  if (typeof parsed.command === 'string') return parsed.command;
  return '';
}

function deny(reason) {
  process.stdout.write(`${JSON.stringify({ decision: 'deny', reason })}\n`);
  process.exit(2);
}

function forwardToHarnessesHook(raw) {
  const cli = path.join(
    os.homedir(),
    'revfleet',
    'revealui',
    'packages',
    'harnesses',
    'dist',
    'cli.js',
  );
  const args = fs.existsSync(cli)
    ? ['node', cli, 'hook', 'grok']
    : ['revealui-harnesses', 'hook', 'grok'];
  const result = spawnSync(args[0], args.slice(1), {
    input: raw,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  if (result.error) {
    process.stdout.write(`${JSON.stringify({ decision: 'allow' })}\n`);
    process.exit(0);
    return;
  }
  if (result.stdout) process.stdout.write(result.stdout);
  process.exit(result.status === 2 ? 2 : 0);
}

if (require.main === module) {
  const raw = fs.readFileSync(0, 'utf8');
  const command = readCommandFromHookPayload(raw);
  const check = loadCheck();
  const verdict = check(command);
  if (verdict && verdict.block) {
    deny(verdict.reason || 'Denied by public-security-comment gate');
  }
  if (process.env.PUBLIC_COMMENT_GATE_ONLY === '1') {
    process.stdout.write(`${JSON.stringify({ decision: 'allow' })}\n`);
    process.exit(0);
  }
  forwardToHarnessesHook(raw);
}

module.exports = {
  checkPublicSecurityComment: fallbackCheck,
  extractCommentBody,
  isGithubCommentCommand,
  PUBLIC_VERDICT_MAX_CHARS,
};
