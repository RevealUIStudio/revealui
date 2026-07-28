'use strict';
// archive-check.cjs — public-repo half of the fleet archive gate (GAP-451).
//
// When a stale doc is moved out of this repo into the central fleet archive
// (RevealUIStudio/revfleet-archive), every LIVE inbound link to its old path
// must be repointed at the archive URL. A link left behind is a dead link that
// still looks alive — in the one repo where that is externally visible.
//
// The matching logic is NOT vendored here. It lives once in
// @revealui/harnesses (packages/harnesses/src/gates/archive-check.ts) and is
// shared with the coordination repo's checker, so the two cannot drift — a
// guarded mirror is still a mirror (GAP-408 precedent).
//
// WHY NO ARCHIVE ACCESS: the archive repo is private and this repo is public.
// A public repo cannot safely hold a token to a private one (fork PRs get no
// secrets, so the gate would silently no-op on outside contributions, and
// private content could reach public logs). The scan does not need the
// archive — only the list of paths archived out of THIS repo, which are this
// repo's own paths. That list is the committed manifest below.
//
// The manifest is a convenience, not the authority: the coordination repo's
// checker reads the real archive and will flag a manifest that has drifted
// out of sync with it.
//
// FAIL-CLOSED on an unresolvable gates module (same posture as
// guardrail2-verdict.cjs) — silently passing is the failure mode this exists
// to prevent. Fails OPEN on a missing manifest, which just means nothing has
// been archived out of this repo yet.

const fs = require('node:fs');
const path = require('node:path');
const { resolveGatesModule } = require('./gates-resolver.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_PATH = path.join(__dirname, 'archived-paths.json');
const REPO_FOLDER_NAME = 'revealui';

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.turbo',
  'opensrc',
  'playwright-report',
  'test-results',
]);

function listMarkdownFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        stack.push(abs);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      out.push(abs);
    }
  }
  return out;
}

function readManifest() {
  let raw;
  try {
    raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  } catch {
    return null;
  }
  const parsed = JSON.parse(raw);
  const paths = parsed && parsed.archivedPaths;
  if (!Array.isArray(paths)) {
    throw new Error(
      `archive-check: ${path.relative(REPO_ROOT, MANIFEST_PATH)} must contain an "archivedPaths" array.`,
    );
  }
  return paths.filter((p) => typeof p === 'string' && p.length > 0);
}

function main() {
  const argv = process.argv.slice(2);
  const ciMode = argv.includes('--ci');

  const gates = resolveGatesModule();
  if (!gates) {
    throw new Error(
      'archive-check: could not resolve the @revealui/harnesses gates module.\n' +
        '  This gate protects published documentation links — failing closed rather\n' +
        '  than silently reporting zero violations.\n' +
        "  Fix: pnpm --filter @revealui/harnesses build (or set REVEALUI_HARNESSES_DIR).",
    );
  }

  const originPaths = readManifest();
  if (originPaths === null) {
    // Nothing archived out of this repo yet.
    if (ciMode) process.stdout.write('[archive-check] no manifest — nothing archived yet.\n');
    process.exit(0);
  }
  if (originPaths.length === 0) {
    if (ciMode) process.stdout.write('[archive-check] manifest empty — nothing to check.\n');
    process.exit(0);
  }

  const files = listMarkdownFiles(REPO_ROOT).map((abs) => ({
    path: path.relative(REPO_ROOT, abs).split(path.sep).join('/'),
    content: fs.readFileSync(abs, 'utf8'),
  }));

  const violations = gates.scanInboundLinks({
    repoFolderName: REPO_FOLDER_NAME,
    originPaths,
    files,
    historicalMarkers: gates.REVEALUI_HISTORICAL_MARKERS,
  });

  if (violations.length === 0) {
    process.stdout.write(
      `[archive-check] OK — ${originPaths.length} archived path(s), no dead inbound links.\n`,
    );
    process.exit(0);
  }

  const lines = [`[archive-check] ${violations.length} dead inbound link(s):`];
  for (const v of violations) lines.push(`  - ${v.detail}`);
  lines.push(
    ciMode
      ? '[archive-check] --ci mode: failing.'
      : '[archive-check] warn-only. Run with --ci to see enforcement behavior.',
  );
  process.stderr.write(`${lines.join('\n')}\n`);

  process.exit(ciMode ? 1 : 0);
}

main();
