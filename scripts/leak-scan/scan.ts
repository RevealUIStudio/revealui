import { type Dirent, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { matchGlob } from './glob';
import type { Rule } from './rules';

export interface Finding {
  readonly tag: string;
  readonly file: string;
  readonly line: number;
  readonly reason: string;
  readonly content: string;
}

export interface ScanOptions {
  readonly excludeDirs?: ReadonlySet<string>;
  readonly excludeFileGlobs?: readonly string[];
  /** `(relPath, tag) => true` suppresses a finding. Defaults to never-ignore. */
  readonly isIgnored?: (relPath: string, tag: string) => boolean;
  /** Files larger than this many bytes are skipped (binary/asset guard). */
  readonly maxBytes?: number;
}

/** Build/dev-artifact dirs skipped by default — mirrors the bash EXCLUDE_DIRS. */
export const DEFAULT_EXCLUDE_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.pnpm',
  'coverage',
  'target',
  '.direnv',
  '.nyc_output',
]);

/**
 * Lockfiles + binary assets skipped by default — mirrors the bash EXCLUDE_FILES,
 * MINUS the scanner's own filename, `.leakignore`, and `settings.local.json`:
 * those are deliberately scanned (revdev#55 — excluding the allowlist or a
 * stray local settings file would let a real leak bypass the gate).
 */
export const DEFAULT_EXCLUDE_FILE_GLOBS: readonly string[] = [
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'Cargo.lock',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.webp',
  '*.pdf',
  '*.zip',
  '*.tar.gz',
  '*.tgz',
  '*.ico',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.otf',
];

function isExcludedFile(name: string, globs: readonly string[]): boolean {
  for (const glob of globs) {
    if (matchGlob(name, glob)) return true;
  }
  return false;
}

/** Apply every rule to every line of `content`. Pure; performs no I/O. */
export function scanContent(rules: readonly Rule[], content: string, file: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    for (const rule of rules) {
      if (rule.matches(line)) {
        findings.push({ tag: rule.tag, file, line: i + 1, reason: rule.reason, content: line });
      }
    }
  }
  return findings;
}

/**
 * Recursively collect scannable file paths under `root`, honoring the dir +
 * file excludes. Symlinks are skipped (avoids cycles and the worktree's
 * `node_modules` symlink). Unreadable dirs are skipped, not fatal.
 */
export function walkFiles(
  root: string,
  excludeDirs: ReadonlySet<string>,
  excludeFileGlobs: readonly string[],
): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      let isSymlink = false;
      try {
        isSymlink = lstatSync(full).isSymbolicLink();
      } catch {
        continue;
      }
      if (isSymlink) continue;
      if (entry.isDirectory()) {
        if (!excludeDirs.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        if (!isExcludedFile(entry.name, excludeFileGlobs)) out.push(full);
      }
    }
  }
  return out;
}

function toForwardSlashes(p: string): string {
  return p.split('\\').join('/');
}

/**
 * Scan one or more roots. Returns allowlist-filtered findings plus a violation
 * count. Binary files (containing a NUL byte) and oversized files are skipped,
 * mirroring `grep -I`.
 */
export function scanPaths(
  rules: readonly Rule[],
  roots: readonly string[],
  opts: ScanOptions = {},
): { findings: Finding[]; violations: number } {
  const excludeDirs = opts.excludeDirs ?? DEFAULT_EXCLUDE_DIRS;
  const excludeFileGlobs = opts.excludeFileGlobs ?? DEFAULT_EXCLUDE_FILE_GLOBS;
  const isIgnored = opts.isIgnored ?? (() => false);
  const maxBytes = opts.maxBytes ?? 5_000_000;
  const findings: Finding[] = [];
  for (const root of roots) {
    for (const file of walkFiles(root, excludeDirs, excludeFileGlobs)) {
      let content: string;
      try {
        const buf = readFileSync(file);
        if (buf.length > maxBytes || buf.includes(0)) continue;
        content = buf.toString('utf8');
      } catch {
        continue;
      }
      const rel = toForwardSlashes(relative(root, file));
      for (const finding of scanContent(rules, content, file)) {
        if (!isIgnored(rel, finding.tag)) findings.push(finding);
      }
    }
  }
  return { findings, violations: findings.length };
}
