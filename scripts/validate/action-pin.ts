#!/usr/bin/env tsx

/**
 * Action pin check.
 *
 * Third-party `uses:` in `.github/workflows` and `.github/actions` must
 * name a 40-character commit SHA. Local `./` actions are exempt.
 *
 * No authored regex. The scan is a line walk that tracks YAML block
 * scalars so `uses:` inside `run:` scripts is not a finding.
 *
 * Exit codes:
 *   0 - every third-party use is pinned
 *   1 - one or more unpinned uses
 *   2 - filesystem error
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const COMMIT_SHA_LENGTH = 40;
const HEX_DIGITS = '0123456789abcdef';
const ACTION_PIN_ROOTS = ['.github/workflows', '.github/actions'] as const;

export interface UnpinnedActionUse {
  file: string;
  line: number;
  uses: string;
}

export function isFullCommitSha(value: string): boolean {
  if (value.length !== COMMIT_SHA_LENGTH) return false;
  for (const ch of value) {
    if (!HEX_DIGITS.includes(ch)) return false;
  }
  return true;
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

/** A third-party use is pinned only when the ref after `@` is a full SHA. */
export function isPinnedActionUse(usesValue: string): boolean {
  const value = unquote(usesValue.trim());
  if (value.startsWith('./')) return true;
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return false;
  return isFullCommitSha(value.slice(at + 1));
}

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    if (ch === '\r') continue;
    if (ch === '\n') {
      lines.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  lines.push(current);
  return lines;
}

function indentOf(line: string): number {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i += 1;
  return i;
}

function stripComment(line: string): string {
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === "'" && !double) {
      single = !single;
      continue;
    }
    if (ch === '"' && !single) {
      double = !double;
      continue;
    }
    if (
      ch === '#' &&
      !single &&
      !double &&
      (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t')
    ) {
      return line.slice(0, i);
    }
  }
  return line;
}

function isBlockIndicator(value: string): boolean {
  if (value.length === 0) return false;
  const head = value[0];
  if (head !== '|' && head !== '>') return false;
  for (let i = 1; i < value.length; i += 1) {
    const ch = value[i] ?? '';
    const isSign = ch === '+' || ch === '-';
    const isDigit = ch >= '0' && ch <= '9';
    if (!(isSign || isDigit)) return false;
  }
  return true;
}

function usesValue(trimmed: string): string | null {
  let i = 0;
  if (trimmed.startsWith('-')) {
    i = 1;
    while (i < trimmed.length && trimmed[i] === ' ') i += 1;
  }
  if (!trimmed.startsWith('uses:', i)) return null;
  return trimmed.slice(i + 'uses:'.length).trim();
}

function mappingValue(trimmed: string): string | null {
  let i = 0;
  if (trimmed.startsWith('-')) {
    i = 1;
    while (i < trimmed.length && trimmed[i] === ' ') i += 1;
  }
  const colon = trimmed.indexOf(':', i);
  if (colon <= i) return null;
  return trimmed.slice(colon + 1).trim();
}

function collectBlock(
  lines: string[],
  startIndex: number,
  keyIndent: number,
): { value: string; nextIndex: number } {
  const parts: string[] = [];
  let j = startIndex;
  for (; j < lines.length; j += 1) {
    const line = lines[j] ?? '';
    if (line.trim().length === 0) continue;
    if (indentOf(line) <= keyIndent) break;
    const piece = stripComment(line).trim();
    if (piece.length > 0) parts.push(piece);
  }
  return { value: parts.join(''), nextIndex: j };
}

export function scanActionPinText(text: string, file: string): UnpinnedActionUse[] {
  const lines = splitLines(text);
  const findings: UnpinnedActionUse[] = [];
  let blockIndent = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (blockIndent >= 0) {
      if (line.trim().length === 0 || indentOf(line) > blockIndent) continue;
      blockIndent = -1;
    }

    const trimmed = stripComment(line).trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;

    const rawUses = usesValue(trimmed);
    if (rawUses !== null) {
      const lineNumber = i + 1;
      let value = rawUses;
      if (isBlockIndicator(rawUses)) {
        const collected = collectBlock(lines, i + 1, indentOf(line));
        value = collected.value;
        i = collected.nextIndex - 1;
      }
      const uses = unquote(value.trim());
      if (!isPinnedActionUse(uses)) {
        findings.push({ file, line: lineNumber, uses });
      }
      continue;
    }

    const value = mappingValue(trimmed);
    if (value !== null && isBlockIndicator(value)) {
      blockIndent = indentOf(line);
    }
  }

  return findings;
}

function posixRelative(root: string, fullPath: string): string {
  let out = '';
  for (const ch of relative(root, fullPath)) {
    out += ch === '\\' ? '/' : ch;
  }
  return out;
}

function isYamlName(name: string): boolean {
  return name.endsWith('.yml') || name.endsWith('.yaml');
}

function collectYamlFiles(dir: string, files: string[]): void {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';
    if (code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectYamlFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && isYamlName(entry.name)) files.push(fullPath);
  }
}

export function scanActionPinRoots(repoRoot: string): UnpinnedActionUse[] {
  const files: string[] = [];
  for (const root of ACTION_PIN_ROOTS) {
    collectYamlFiles(join(repoRoot, root), files);
  }

  const findings: UnpinnedActionUse[] = [];
  for (const fullPath of files) {
    const stat = statSync(fullPath);
    if (!stat.isFile()) continue;
    const text = readFileSync(fullPath, 'utf8');
    const file = posixRelative(repoRoot, fullPath);
    findings.push(...scanActionPinText(text, file));
  }

  findings.sort((a, b) => {
    if (a.file === b.file) return a.line - b.line;
    return a.file < b.file ? -1 : 1;
  });
  return findings;
}

function main(): void {
  const repoRoot = join(import.meta.dirname, '..', '..');
  let findings: UnpinnedActionUse[];
  try {
    findings = scanActionPinRoots(repoRoot);
  } catch (error) {
    process.stderr.write(
      `[action-pin] FATAL: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  }

  if (findings.length === 0) {
    process.stdout.write('[action-pin] OK: third-party uses are pinned to a 40-character SHA.\n');
    return;
  }

  process.stderr.write('[action-pin] FAIL: third-party uses must be a 40-character commit SHA.\n');
  for (const finding of findings) {
    process.stderr.write(`  ${finding.file}:${finding.line}  ${finding.uses}\n`);
  }
  const noun = findings.length === 1 ? 'use' : 'uses';
  process.stderr.write(`Found ${findings.length} unpinned ${noun}.\n`);
  process.exit(1);
}

if (process.argv[1]?.endsWith('action-pin.ts')) {
  main();
}
