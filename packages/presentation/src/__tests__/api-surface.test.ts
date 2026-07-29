/**
 * API surface snapshot — Gate 2, high finding 7.
 * ─────────────────────────────────────────────────────────────────────────
 * Seven public entry points and, until this file, nothing that failed when an
 * export was added, removed or renamed. The 0.12.0 icon move from `/server` to
 * the main entry was managed by hand and by memory. Post-1.0 that is how you
 * ship an unintended breaking change: not by deciding to, but by not noticing.
 *
 * This asserts the exported NAMES of every public entry point against a
 * checked-in baseline. It does not assert types — `tsc` already does that, and
 * a name-level snapshot is the part that catches the accident.
 *
 * FIRST RUN writes the baseline and passes. Commit `api-surface.snapshot.json`.
 * Every run after that diffs against it.
 *
 * When a change is intentional:
 *
 *   pnpm --filter @revealui/presentation test api-surface -- -u
 *
 * and the diff appears in the PR, which is the entire point — a reviewer sees
 * "3 exports removed" in the diff instead of a consumer finding out.
 *
 * Runs against `dist/`, not `src/`, deliberately: what ships is what the export
 * map resolves to, and a name reachable in source but not in the built bundle is
 * exactly the bug this catches. So `pnpm build` must precede it.
 *
 * `./utils` is absent on purpose — it is internal per SUPPORT.md. If it ever
 * appears in this baseline, someone re-exported it and the narrowing regressed.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = join(__dirname, '..', '..', 'dist');
const BASELINE = join(__dirname, 'api-surface.snapshot.json');
const UPDATE = process.argv.includes('-u') || process.argv.includes('--update');

/** Public entry points, per SUPPORT.md. Keep in sync with package.json `exports`. */
const ENTRY_POINTS = {
  '.': 'index.js',
  './components': 'components/index.js',
  './primitives': 'primitives/index.js',
  './server': 'server.js',
  './client': 'client.js',
  './hooks': 'hooks/index.js',
  './animations': 'animations/index.js',
} as const;

type Surface = Record<string, string[]>;

async function readSurface(): Promise<Surface> {
  const surface: Surface = {};
  for (const [entry, file] of Object.entries(ENTRY_POINTS)) {
    const path = join(DIST, file);
    if (!existsSync(path)) {
      throw new Error(
        `dist/${file} is missing — run \`pnpm --filter @revealui/presentation build\` first. ` +
          'This test reads the built output because the export map is what consumers resolve.',
      );
    }
    const mod = await import(/* @vite-ignore */ path);
    surface[entry] = Object.keys(mod)
      .filter((k) => k !== 'default' && !k.startsWith('__'))
      .sort();
  }
  return surface;
}

describe('public API surface', () => {
  it('matches the committed baseline', async () => {
    const current = await readSurface();

    if (!existsSync(BASELINE) || UPDATE) {
      writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
      const total = Object.values(current).reduce((n, names) => n + names.length, 0);
      console.log(
        `\napi-surface: baseline written — ${total} export(s) across ${Object.keys(current).length} entry point(s).` +
          '\nCommit api-surface.snapshot.json. Subsequent runs diff against it.\n',
      );
      return;
    }

    const baseline: Surface = JSON.parse(readFileSync(BASELINE, 'utf8'));

    // Report per entry point rather than as one blob: "3 exports removed from
    // /server" is actionable, a 400-line object diff is not.
    for (const entry of Object.keys(ENTRY_POINTS)) {
      const was = new Set(baseline[entry] ?? []);
      const now = new Set(current[entry] ?? []);
      const removed = [...was].filter((n) => !now.has(n));
      const added = [...now].filter((n) => !was.has(n));

      expect(
        removed,
        `\n${entry}: ${removed.length} export(s) REMOVED — this is a BREAKING change.\n` +
          `  ${removed.join(', ')}\n` +
          '  Per SUPPORT.md a removal needs: a major bump, two minors of deprecation with both\n' +
          '  names live, a CHANGELOG migration note, and a codemod. If all four are in this PR,\n' +
          '  update the baseline with `-u`.\n',
      ).toEqual([]);

      expect(
        added,
        `\n${entry}: ${added.length} export(s) ADDED.\n` +
          `  ${added.join(', ')}\n` +
          '  Additions are a minor bump and fine — but they are permanent: once published, each\n' +
          '  name is public API for 12 months minimum. Confirm each is intended to be public,\n' +
          '  then update the baseline with `-u`.\n',
      ).toEqual([]);
    }
  });

  it('keeps the focus-ring constants internal', async () => {
    const current = await readSurface();
    const leaked = Object.entries(current).flatMap(([entry, names]) =>
      names
        .filter((n) => n.startsWith('focusRing') || n === 'activeOption')
        .map((n) => `${entry} → ${n}`),
    );

    expect(
      leaked,
      `\nInternal utilities are exported publicly:\n  ${leaked.join('\n  ')}\n\n` +
        '  `cn` wraps tailwind-merge and is an implementation detail; the focus-ring constants must\n' +
        '  stay internal or changing the focus treatment becomes a breaking change (SUPPORT.md).\n' +
        '  Stop re-exporting ./utils from the barrel.\n',
    ).toEqual([]);
  });

  it('covers every entry point declared in package.json', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'));
    const declared = Object.keys(pkg.exports).filter(
      (k) => !k.endsWith('.css') && !k.includes('design-context'),
    );
    const tested = Object.keys(ENTRY_POINTS);
    const untested = declared.filter((e) => !tested.includes(e));

    expect(
      untested,
      `\nEntry point(s) in package.json with no snapshot coverage: ${untested.join(', ')}\n` +
        '  Either add them to ENTRY_POINTS above, or — if they are internal — remove them from\n' +
        '  the export map. An entry point consumers can import but nothing guards is the gap\n' +
        '  this test exists to close.\n',
    ).toEqual([]);
  });
});
