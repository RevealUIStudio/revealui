/**
 * Fail a pull request when a new Drizzle journal entry can be skipped.
 *
 * Drizzle walks `meta/_journal.json` in idx order and applies an entry only
 * when its `when` is strictly greater than the newest `created_at` already
 * stored. Two pull requests can each append a migration. The one that lands
 * first records a newer `when`. The other can then merge an older `when` at
 * a later idx, and databases that already applied the newer timestamp skip
 * the older entry with no error.
 *
 * This check compares the working tree with the PR base branch tip, which
 * CI fetches before the run. That tip includes migrations merged after the
 * branch point. Those are the timestamps that make an older entry skip.
 *
 * Pass `--base-ref`. In GitHub Actions, `GITHUB_BASE_REF` is used when the
 * flag is absent (`origin/<branch>`).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const JOURNAL_FILE = 'meta/_journal.json';
const JOURNAL_SUFFIX = `/${JOURNAL_FILE}`;
const GIT_MAX_BUFFER_BYTES = 32 * 1024 * 1024;
const MAX_MISSING_IDX_LISTED = 8;

export interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

export interface JournalDocument {
  entries: JournalEntry[];
}

export interface JournalWhenOrderResult {
  ok: boolean;
  errors: string[];
  journalCount: number;
}

export interface CheckOptions {
  repoRoot: string;
  baseRef: string;
}

interface ParseSuccess {
  ok: true;
  journal: JournalDocument;
}

interface ParseFailure {
  ok: false;
  errors: string[];
}

type ParseResult = ParseSuccess | ParseFailure;

interface GitFileMissing {
  status: 'missing';
}

interface GitFileFound {
  status: 'found';
  text: string;
}

interface GitFileError {
  status: 'error';
  message: string;
}

type GitFileResult = GitFileMissing | GitFileFound | GitFileError;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJournalPath(rel: string): boolean {
  return rel === JOURNAL_FILE || rel.endsWith(JOURNAL_SUFFIX);
}

function errorText(error: unknown): string {
  if (!isRecord(error)) return 'unknown git error';
  const { stderr, message } = error;
  if (typeof stderr === 'string' && stderr.length > 0) return stderr;
  if (stderr instanceof Buffer) return stderr.toString('utf8');
  if (typeof message === 'string') return message;
  return 'unknown git error';
}

function isMissingPath(stderr: string): boolean {
  return (
    stderr.includes('exists on disk, but not in') ||
    stderr.includes('does not exist in') ||
    stderr.includes('does not exist')
  );
}

export function parseJournal(text: string, label: string): ParseResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, errors: [`${label}: journal JSON is not valid`] };
  }
  if (!(isRecord(value) && Array.isArray(value.entries))) {
    return { ok: false, errors: [`${label}: journal is missing an entries array`] };
  }

  const entries: JournalEntry[] = [];
  const errors: string[] = [];
  for (let index = 0; index < value.entries.length; index++) {
    const parsed = parseEntry(value.entries[index], label, index);
    if (!parsed.ok) {
      errors.push(parsed.error);
      continue;
    }
    entries.push(parsed.entry);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, journal: { entries } };
}

function parseEntry(
  raw: unknown,
  label: string,
  index: number,
): { ok: true; entry: JournalEntry } | { ok: false; error: string } {
  if (!isRecord(raw)) {
    return { ok: false, error: `${label}: entry ${index} is not an object` };
  }
  const { idx, when, tag } = raw;
  if (typeof tag !== 'string' || tag.length === 0) {
    return { ok: false, error: `${label}: entry ${index} needs a non-empty tag` };
  }
  if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0) {
    return {
      ok: false,
      error: `${label}: ${tag} has idx ${String(idx)}, which must be a non-negative integer`,
    };
  }
  if (typeof when !== 'number' || !Number.isFinite(when)) {
    return {
      ok: false,
      error: `${label}: ${tag} has when ${String(when)}, which must be a finite number`,
    };
  }
  return { ok: true, entry: { idx, when, tag } };
}

function duplicateTagErrors(entries: JournalEntry[], label: string): string[] {
  const byTag = new Map<string, number[]>();
  for (const entry of entries) {
    const idxs = byTag.get(entry.tag) ?? [];
    idxs.push(entry.idx);
    byTag.set(entry.tag, idxs);
  }
  const errors: string[] = [];
  for (const tag of [...byTag.keys()].sort()) {
    const idxs = byTag.get(tag) ?? [];
    if (idxs.length < 2) continue;
    errors.push(`${label}: duplicate tag ${tag} at idx ${idxs.join(', ')}.`);
  }
  return errors;
}

function duplicateIdxErrors(entries: JournalEntry[], label: string): string[] {
  const byIdx = new Map<number, string[]>();
  for (const entry of entries) {
    const tags = byIdx.get(entry.idx) ?? [];
    tags.push(entry.tag);
    byIdx.set(entry.idx, tags);
  }
  const errors: string[] = [];
  for (const idx of [...byIdx.keys()].sort((left, right) => left - right)) {
    const tags = byIdx.get(idx) ?? [];
    if (tags.length < 2) continue;
    errors.push(`${label}: duplicate idx ${idx} for tags ${tags.join(', ')}.`);
  }
  return errors;
}

function missingIdxs(entries: JournalEntry[]): number[] {
  if (entries.length === 0) return [];
  const present = new Set<number>();
  let max = 0;
  for (const entry of entries) {
    present.add(entry.idx);
    if (entry.idx > max) max = entry.idx;
  }
  const missing: number[] = [];
  for (let idx = 0; idx <= max; idx++) {
    if (!present.has(idx)) missing.push(idx);
  }
  return missing;
}

function contiguityError(entries: JournalEntry[], label: string): string | null {
  const missing = missingIdxs(entries);
  if (missing.length === 0) return null;
  const shown = missing.slice(0, MAX_MISSING_IDX_LISTED);
  const extra = missing.length - shown.length;
  const suffix = extra > 0 ? ` (and ${extra} more)` : '';
  return `${label}: idx sequence is not contiguous: missing idx ${shown.join(', ')}${suffix}.`;
}

function maxWhenEntry(entries: JournalEntry[]): JournalEntry | null {
  let best: JournalEntry | null = null;
  for (const entry of entries) {
    if (!best || entry.when > best.when || (entry.when === best.when && entry.idx > best.idx)) {
      best = entry;
    }
  }
  return best;
}

function compareByIdxThenTag(left: JournalEntry, right: JournalEntry): number {
  if (left.idx !== right.idx) return left.idx - right.idx;
  if (left.tag < right.tag) return -1;
  if (left.tag > right.tag) return 1;
  return 0;
}

/**
 * Compare a head journal with the base-branch journal.
 *
 * New entries are head tags absent from the base. Each new `when` must be
 * strictly greater than every base `when`. New `when` values must be
 * strictly increasing in idx order. idx and tag must be unique, and idx
 * must be contiguous from 0 within the head journal and across the base
 * entries plus the new ones.
 */
export function checkJournalWhenOrder(
  head: JournalDocument,
  base: JournalDocument,
  label = 'journal',
): JournalWhenOrderResult {
  const errors: string[] = [
    ...duplicateTagErrors(head.entries, label),
    ...duplicateIdxErrors(head.entries, label),
  ];
  const headGap = contiguityError(head.entries, label);
  if (headGap) errors.push(headGap);

  const baseTags = new Set(base.entries.map((entry) => entry.tag));
  const newEntries = head.entries.filter((entry) => !baseTags.has(entry.tag));
  if (newEntries.length === 0 || base.entries.length === 0) {
    if (base.entries.length === 0 && newEntries.length > 1) {
      errors.push(...increasingWhenErrors(newEntries, label));
    }
    return { ok: errors.length === 0, errors, journalCount: 1 };
  }

  errors.push(...crossBranchIdxErrors(base.entries, newEntries, label));
  const merged = [...base.entries, ...newEntries];
  const mergedGap = contiguityError(merged, label);
  if (mergedGap && mergedGap !== headGap) errors.push(mergedGap);
  errors.push(...baseWhenErrors(base.entries, newEntries, label));
  errors.push(...increasingWhenErrors(newEntries, label));
  return { ok: errors.length === 0, errors, journalCount: 1 };
}

function crossBranchIdxErrors(
  baseEntries: JournalEntry[],
  newEntries: JournalEntry[],
  label: string,
): string[] {
  const tagsByIdx = new Map<number, string[]>();
  for (const entry of baseEntries) {
    const tags = tagsByIdx.get(entry.idx) ?? [];
    tags.push(entry.tag);
    tagsByIdx.set(entry.idx, tags);
  }
  const errors: string[] = [];
  const sorted = [...newEntries].sort(compareByIdxThenTag);
  for (const entry of sorted) {
    const baseTags = tagsByIdx.get(entry.idx);
    if (!baseTags || baseTags.length === 0) continue;
    errors.push(
      `${label}: duplicate idx ${entry.idx} for tags ${baseTags.join(', ')} and ${entry.tag}.`,
    );
  }
  return errors;
}

function baseWhenErrors(
  baseEntries: JournalEntry[],
  newEntries: JournalEntry[],
  label: string,
): string[] {
  const best = maxWhenEntry(baseEntries);
  if (!best) return [];
  const errors: string[] = [];
  for (const entry of [...newEntries].sort(compareByIdxThenTag)) {
    if (entry.when > best.when) continue;
    errors.push(
      [
        `${label}: ${entry.tag} (idx ${entry.idx}, when=${entry.when})`,
        'is not strictly greater than every when on the base branch',
        `(base max when=${best.when}, tag ${best.tag}).`,
      ].join(' '),
    );
  }
  return errors;
}

function increasingWhenErrors(newEntries: JournalEntry[], label: string): string[] {
  const sorted = [...newEntries].sort(compareByIdxThenTag);
  const errors: string[] = [];
  for (let index = 1; index < sorted.length; index++) {
    const prev = sorted[index - 1];
    const curr = sorted[index];
    if (!(prev && curr) || curr.when > prev.when) continue;
    errors.push(
      [
        `${label}: new entry ${curr.tag} (idx ${curr.idx}, when=${curr.when})`,
        `is not strictly greater than earlier new entry ${prev.tag}`,
        `(idx ${prev.idx}, when=${prev.when}) in idx order.`,
      ].join(' '),
    );
  }
  return errors;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function listJournalPaths(repoRoot: string): string[] {
  const output = git(repoRoot, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  const paths: string[] = [];
  for (const rel of output.split('\0')) {
    if (rel.length === 0 || !isJournalPath(rel)) continue;
    paths.push(rel);
  }
  paths.sort();
  return paths;
}

function assertBaseRef(repoRoot: string, baseRef: string): string | null {
  try {
    git(repoRoot, ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
    return null;
  } catch (error) {
    const detail = errorText(error).trim();
    const suffix = detail.length > 0 ? ` ${detail}` : '';
    return [
      `base ref '${baseRef}' is not available.`,
      `Fetch the PR base branch before running this check.${suffix}`,
    ].join(' ');
  }
}

function readBaseJournal(repoRoot: string, baseRef: string, rel: string): GitFileResult {
  try {
    const text = git(repoRoot, ['show', `${baseRef}:${rel}`]);
    return { status: 'found', text };
  } catch (error) {
    const stderr = errorText(error);
    if (isMissingPath(stderr)) return { status: 'missing' };
    return {
      status: 'error',
      message: `${rel}: unable to read ${baseRef}:${rel}. ${stderr.trim()}`,
    };
  }
}

export function checkRepository(options: CheckOptions): JournalWhenOrderResult {
  const refError = assertBaseRef(options.repoRoot, options.baseRef);
  if (refError) return { ok: false, errors: [refError], journalCount: 0 };

  let journals: string[];
  try {
    journals = listJournalPaths(options.repoRoot);
  } catch (error) {
    return {
      ok: false,
      errors: [`unable to list journals. ${errorText(error).trim()}`],
      journalCount: 0,
    };
  }
  if (journals.length === 0) {
    return {
      ok: false,
      errors: ['no meta/_journal.json files found in the repository'],
      journalCount: 0,
    };
  }

  const errors: string[] = [];
  for (const rel of journals) {
    let headText: string;
    try {
      headText = readFileSync(resolve(options.repoRoot, rel), 'utf8');
    } catch (error) {
      errors.push(`${rel}: unable to read journal. ${errorText(error).trim()}`);
      continue;
    }
    const head = parseJournal(headText, rel);
    if (!head.ok) {
      errors.push(...head.errors);
      continue;
    }
    const baseFile = readBaseJournal(options.repoRoot, options.baseRef, rel);
    if (baseFile.status === 'error') {
      errors.push(baseFile.message);
      continue;
    }
    const base =
      baseFile.status === 'missing'
        ? ({ ok: true, journal: { entries: [] } } satisfies ParseSuccess)
        : parseJournal(baseFile.text, `${rel} at ${options.baseRef}`);
    if (!base.ok) {
      errors.push(...base.errors);
      continue;
    }
    errors.push(...checkJournalWhenOrder(head.journal, base.journal, rel).errors);
  }
  return { ok: errors.length === 0, errors, journalCount: journals.length };
}

export function resolveBaseRef(
  argv: readonly string[],
  env: { GITHUB_BASE_REF?: string } = process.env,
): string | null {
  const explicit = readArg(argv, 'base-ref');
  if (explicit && explicit.length > 0) return explicit;
  const fromEnv = env.GITHUB_BASE_REF;
  if (fromEnv && fromEnv.length > 0) return `origin/${fromEnv}`;
  return null;
}

function readArg(argv: readonly string[], name: string): string | undefined {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg.startsWith(prefix)) return arg.slice(prefix.length);
    if (arg === flag) return argv[index + 1];
  }
  return undefined;
}

export function main(argv: readonly string[] = process.argv): number {
  const baseRef = resolveBaseRef(argv);
  const repoRoot = resolve(readArg(argv, 'repo-root') ?? process.cwd());
  if (!baseRef) {
    console.error(
      'drizzle-journal-when: pass --base-ref <ref> (or set GITHUB_BASE_REF to the PR base branch)',
    );
    return 1;
  }
  const result = checkRepository({ repoRoot, baseRef });
  if (!result.ok) {
    for (const error of result.errors) console.error(`drizzle-journal-when: ${error}`);
    return 1;
  }
  console.log(`drizzle-journal-when: ${result.journalCount} journal(s) checked against ${baseRef}`);
  return 0;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectRun()) {
  process.exit(main());
}
