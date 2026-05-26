/**
 * Served-docs broken-link validator.
 *
 * Fails when any served documentation page links to a relative `.md` target
 * that is NOT part of the public served set (`apps/docs/public/`). Three
 * broken-link classes are reported:
 *
 *   - internal-excluded — the target exists in the source `docs/` tree but is
 *     deliberately withheld from the public site (an internal-only file or dir
 *     stripped by `scripts/copy-docs.sh`). This is the most common 404 source.
 *   - missing — the target exists nowhere in `docs/` (typo, renamed doc, or a
 *     path that was never created).
 *   - outside-root — the relative path escapes the served root.
 *
 * The served set is computed by RUNNING `scripts/copy-docs.sh` — the single
 * authority for what ships publicly — and scanning `apps/docs/public/`. This
 * deliberately avoids re-encoding the internal-exclusion lists a THIRD time
 * (they already live in `copy-docs.sh` + `vite.config.ts`); the validator
 * checks the real shipped artifact rather than a model of it. The source
 * `docs/` tree is scanned only to CLASSIFY a broken target (present-in-source
 * ⇒ internal-excluded; absent ⇒ missing).
 *
 * No authored regex (fleet hardline): link extraction is an indexOf scan over
 * markdown `](target)` spans, with fenced and inline code stripped first.
 *
 * Run: `tsx scripts/check-links.ts` (wired as `pnpm --filter docs check:links`).
 */

import { execFileSync } from 'node:child_process';
import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const scriptDir = import.meta.dirname;
const docsApp = path.resolve(scriptDir, '..'); // apps/docs
const repoRoot = path.resolve(scriptDir, '..', '..', '..'); // monorepo root
const sourceDocs = path.join(repoRoot, 'docs');
const servedRoot = path.join(docsApp, 'public');
const copyDocsScript = path.join(scriptDir, 'copy-docs.sh');

type BrokenKind = 'internal-excluded' | 'missing' | 'outside-root';

interface BrokenLink {
  /** Served page (POSIX-relative to the served root) that holds the bad link. */
  source: string;
  /** The link target exactly as authored in the markdown. */
  raw: string;
  /** Resolved POSIX path, relative to the served root. */
  resolved: string;
  kind: BrokenKind;
}

function write(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** Collect every `.md` file under `root` as a set of POSIX-relative paths. */
function collectMarkdownFiles(root: string): Set<string> {
  const found = new Set<string>();
  let entries: Dirent[] = [];
  try {
    entries = readdirSync(root, { recursive: true, withFileTypes: true });
  } catch {
    return found; // root absent (e.g. public/ before a build) ⇒ empty set
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const abs = path.join(entry.parentPath, entry.name);
      found.add(path.relative(root, abs).split(path.sep).join('/'));
    }
  }
  return found;
}

/**
 * Blank out single-backtick inline-code spans so example link syntax written
 * inside `...` is not mistaken for a real link. Splitting on backticks, the
 * even-index segments are outside code and the odd-index segments are inside.
 */
function stripInlineCode(line: string): string {
  if (!line.includes('`')) {
    return line;
  }
  const parts = line.split('`');
  let out = '';
  let insideCode = false;
  for (const part of parts) {
    out += insideCode ? ' ' : part;
    insideCode = !insideCode;
  }
  return out;
}

/** Extract every `](target)` link target from markdown, skipping code. */
function extractLinkTargets(markdown: string): string[] {
  const targets: string[] = [];
  let inFence = false;
  let fence = '';
  for (const rawLine of markdown.split('\n')) {
    const trimmed = rawLine.trimStart();
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      const marker = trimmed.slice(0, 3);
      if (!inFence) {
        inFence = true;
        fence = marker;
      } else if (trimmed.startsWith(fence)) {
        inFence = false;
        fence = '';
      }
      continue;
    }
    if (inFence) {
      continue;
    }
    const line = stripInlineCode(rawLine);
    let open = line.indexOf('](');
    while (open !== -1) {
      const start = open + 2;
      const close = line.indexOf(')', start);
      if (close === -1) {
        break;
      }
      let target = line.slice(start, close).trim();
      // Drop a link title: [text](url "title").
      const space = target.indexOf(' ');
      if (space !== -1) {
        target = target.slice(0, space);
      }
      // Drop angle-bracket wrapping: [text](<url>).
      if (target.startsWith('<') && target.endsWith('>')) {
        target = target.slice(1, -1);
      }
      if (target.length > 0) {
        targets.push(target);
      }
      open = line.indexOf('](', close + 1);
    }
  }
  return targets;
}

/** External / non-filesystem links we never resolve against the served tree. */
function isExternal(target: string): boolean {
  const lower = target.toLowerCase();
  return (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('//')
  );
}

function checkLinks(served: Set<string>, source: Set<string>): BrokenLink[] {
  const broken: BrokenLink[] = [];
  for (const rel of served) {
    const content = readFileSync(path.join(servedRoot, rel), 'utf8');
    for (const raw of extractLinkTargets(content)) {
      // Strip anchor + query before resolving.
      let target = raw;
      const hash = target.indexOf('#');
      if (hash !== -1) {
        target = target.slice(0, hash);
      }
      const query = target.indexOf('?');
      if (query !== -1) {
        target = target.slice(0, query);
      }
      if (target.length === 0 || isExternal(target)) {
        continue; // pure #anchor / ?query, or an external link
      }
      let decoded = target;
      try {
        decoded = decodeURIComponent(target);
      } catch {
        // not valid percent-encoding — resolve the raw form
      }
      if (!decoded.endsWith('.md')) {
        continue; // only relative .md links are in scope
      }
      const resolved = decoded.startsWith('/')
        ? path.posix.normalize(decoded.slice(1)) // site-absolute ⇒ served root
        : path.posix.normalize(path.posix.join(path.posix.dirname(rel), decoded));
      if (resolved.startsWith('..')) {
        broken.push({ source: rel, raw, resolved, kind: 'outside-root' });
        continue;
      }
      if (served.has(resolved)) {
        continue; // resolves to a served page — good
      }
      broken.push({
        source: rel,
        raw,
        resolved,
        kind: source.has(resolved) ? 'internal-excluded' : 'missing',
      });
    }
  }
  return broken;
}

function describe(link: BrokenLink): string {
  switch (link.kind) {
    case 'internal-excluded':
      return `[internal-only — '${link.resolved}' exists in docs/ but is excluded from the public site; repoint or de-link]`;
    case 'missing':
      return `[missing — '${link.resolved}' does not exist in docs/ (typo or never created)]`;
    case 'outside-root':
      return `[outside-root — '${link.resolved}' escapes the served docs root]`;
  }
}

function main(): void {
  // Refresh the served set exactly as the build does — copy-docs.sh is the
  // single authority for what ships to the public site.
  try {
    execFileSync('bash', [copyDocsScript], { stdio: 'inherit' });
  } catch {
    write('✗ docs link check: scripts/copy-docs.sh failed; cannot build the served set.');
    process.exitCode = 1;
    return;
  }

  const served = collectMarkdownFiles(servedRoot);
  const source = collectMarkdownFiles(sourceDocs);
  const broken = checkLinks(served, source);

  if (broken.length === 0) {
    write(`✓ docs link check: ${served.size} served pages, 0 broken relative .md links.`);
    return;
  }

  const bySource = new Map<string, BrokenLink[]>();
  for (const link of broken) {
    const list = bySource.get(link.source) ?? [];
    list.push(link);
    bySource.set(link.source, list);
  }

  write('');
  write(
    `✗ docs link check: ${broken.length} broken relative .md link(s) across ${bySource.size} served page(s).`,
  );
  write('');
  for (const src of [...bySource.keys()].sort()) {
    write(`  ${src}`);
    for (const link of bySource.get(src) ?? []) {
      write(`    → ${link.raw}   ${describe(link)}`);
    }
  }
  write('');
  write('Repoint each link to a served doc, or remove it. Internal-only targets');
  write('(excluded by scripts/copy-docs.sh) must never be linked from served pages —');
  write('they 404 on the public site.');
  process.exitCode = 1;
}

main();
