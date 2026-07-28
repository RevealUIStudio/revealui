/*
 * codemod-token-purge.cjs — Gate 0, step 1.
 * ─────────────────────────────────────────────────────────────────────────
 * Moves packages/presentation/src off raw Tailwind palette values and onto the
 * @theme bridge utilities. Dependency-free CommonJS; no AST, deliberately —
 * every target is a string literal inside a className, and a string codemod
 * with a --check mode is easier to audit than a transform.
 *
 *   node codemod-token-purge.cjs --check <dir>    report only, writes nothing
 *   node codemod-token-purge.cjs <dir>            apply
 *   node codemod-token-purge.cjs --json <dir>     machine-readable
 *
 * PREREQUISITE: theme.css must ship from @revealui/tokens first (README step
 * 0). These utilities resolve to nothing without the bridge.
 *
 * The table is ordered LONGEST-FIRST within each group. A `dark:` pair must be
 * consumed as one unit before its light half can match, or you get
 * `text-foreground dark:text-white` — half-migrated and worse than before.
 *
 * What this does NOT do: the judgement calls in TOKEN-MAP.md §3 (the 11
 * Catalyst colorways, Progress/Stepper's blue, code-block's fixed dark chrome).
 * Those change public API or need a design decision. --check lists every one it
 * finds so nothing goes quiet.
 */
'use strict';

const { readFileSync, writeFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative, extname } = require('node:path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const JSON_OUT = args.includes('--json');
const targets = args.filter((a) => !a.startsWith('--'));
if (targets.length === 0) {
  console.error('usage: codemod-token-purge.cjs [--check] [--json] <dir…>');
  process.exit(2);
}

const SCAN_EXT = new Set(['.tsx', '.ts']);
const SKIP_DIR = new Set(['node_modules', 'dist', '__tests__', '.turbo']);

/* ── replacements ─────────────────────────────────────────────────────────
 * Ordered. `from` is a literal string, not a regex, so nothing escapes wrong.
 */
const REPLACEMENTS = [
  // ── text: paired dark: variants first ──
  ['text-zinc-950 dark:text-white', 'text-foreground'],
  ['text-zinc-950 sm:text-sm/6 dark:text-white', 'text-foreground sm:text-sm/6'],
  ['text-zinc-700 dark:text-zinc-300', 'text-body'],
  ['text-zinc-600 dark:text-zinc-400', 'text-body'],
  ['text-zinc-500 dark:text-zinc-400', 'text-muted-foreground'],
  ['text-zinc-400 dark:text-zinc-500', 'text-muted-foreground'],
  ['text-zinc-300 dark:text-zinc-600', 'text-muted-foreground'],
  ['hover:text-zinc-600 dark:hover:text-zinc-300', 'hover:text-foreground'],
  ['hover:text-zinc-600 dark:hover:text-zinc-200', 'hover:text-foreground'],
  ['hover:text-zinc-700 dark:hover:text-zinc-300', 'hover:text-foreground'],
  ['hover:text-zinc-950 dark:hover:text-white', 'hover:text-foreground'],
  ['hover:text-zinc-200 ', 'hover:text-foreground '],
  // ── text: unpaired ──
  ['text-zinc-950', 'text-foreground'],
  ['text-zinc-700', 'text-body'],
  ['text-zinc-600', 'text-body'],
  ['text-zinc-500', 'text-muted-foreground'],
  ['text-zinc-400', 'text-muted-foreground'],
  ['text-zinc-300', 'text-muted-foreground'],
  ['stroke-zinc-500', 'stroke-muted-foreground'],
  ['stroke-zinc-600', 'stroke-muted-foreground'],
  ['stroke-zinc-400', 'stroke-muted-foreground'],
  ['text-gray-700', 'text-body'],
  ['text-gray-200', 'text-body'],

  // ── surfaces: paired first ──
  ['bg-white dark:bg-zinc-900', 'bg-card'],
  ['bg-white dark:bg-zinc-800', 'bg-card'],
  ['bg-zinc-800/75', 'bg-popover/75'],
  ['bg-white/75 dark:bg-zinc-800/75', 'bg-popover/75'],
  ['bg-white/90', 'bg-card/90'],
  ['bg-gray-800/80', 'bg-card/90'],
  ['bg-zinc-200 dark:bg-zinc-700', 'bg-surface-2'],
  ['bg-zinc-100 dark:bg-zinc-800', 'bg-surface-2'],
  ['bg-zinc-50 dark:bg-zinc-900', 'bg-surface-2'],
  ['read-only:bg-zinc-50 dark:read-only:bg-zinc-900', 'read-only:bg-surface-2'],
  ['bg-zinc-200', 'bg-surface-2'],
  ['bg-zinc-100', 'bg-surface-2'],
  ['hover:bg-zinc-800', 'hover:bg-surface-3'],
  ['bg-zinc-800', 'bg-surface-3'],
  ['bg-white', 'bg-card'],

  // ── scrim (dialog / drawer / alert backdrops) ──
  ['bg-zinc-950/15 ', 'bg-scrim '],
  ['bg-zinc-950/25 ', 'bg-scrim '],
  ['bg-zinc-950/50', 'bg-scrim'],
  ['dark:bg-zinc-950/50', ''],

  // ── borders + rings: paired first ──
  ['border-zinc-200 dark:border-zinc-700', 'border-border'],
  ['border-zinc-300 dark:border-zinc-700', 'border-input'],
  ['border-zinc-300 dark:border-zinc-600', 'border-input'],
  ['border-b-foreground/10', 'border-b-border-strong'],
  ['hover:border-zinc-400 dark:hover:border-zinc-600', 'hover:border-border-strong'],
  ['disabled:hover:border-zinc-300 dark:disabled:hover:border-zinc-700', 'disabled:hover:border-input'],
  ['read-only:hover:border-zinc-300 dark:read-only:hover:border-zinc-700', 'read-only:hover:border-input'],
  ['divide-zinc-200 dark:divide-zinc-700', 'divide-border'],
  ['border-zinc-600', 'border-input'],
  ['border-zinc-300', 'border-input'],
  ['border-zinc-200', 'border-border'],
  ['border-zinc-800', 'border-border'],
  ['border-gray-200', 'border-border'],
  ['border-gray-700', 'border-border'],
  ['ring-zinc-950/10 dark:ring-white/10', 'ring-border-strong'],
  ['ring-zinc-950/5 dark:ring-white/10', 'ring-border'],
  ['ring-zinc-950/10', 'ring-border-strong'],
  ['ring-zinc-950/5', 'ring-border'],
  ['ring-zinc-200 dark:ring-zinc-700', 'ring-border'],
  ['ring-zinc-800', 'ring-border'],
  ['ring-zinc-700', 'ring-border'],
  ['ring-zinc-200', 'ring-border'],
  ['border-zinc-950/15', 'border-border-strong'],
  ['border-zinc-950/10', 'border-border'],
  ['border-zinc-950/5', 'border-border'],
  ['bg-zinc-950/5', 'bg-border'],
  ['border-b-zinc-950/10', 'border-b-border-strong'],
  ['border-l-foreground/5', 'border-l-border'],
  ['border-t border-zinc-950/5', 'border-t border-border'],

  // ── status foregrounds + fills ──
  ['aria-invalid:border-red-500', 'aria-invalid:border-destructive'],
  ['aria-invalid:focus-visible:border-red-500', 'aria-invalid:focus-visible:border-destructive'],
  ['aria-invalid:focus-visible:ring-red-500', 'aria-invalid:focus-visible:ring-destructive'],
  ['aria-invalid:ring-red-500', 'aria-invalid:ring-destructive'],
  ['group-data-invalid:border-red-500', 'group-data-invalid:border-destructive'],
  ['group-data-hover:group-data-invalid:border-red-500', 'group-data-hover:group-data-invalid:border-destructive'],
  ['dark:group-data-invalid:border-red-600', 'dark:group-data-invalid:border-destructive'],
  ['dark:data-hover:group-data-invalid:border-red-600', 'dark:data-hover:group-data-invalid:border-destructive'],
  ['data-invalid:border-red-500', 'data-invalid:border-destructive'],
  ['data-invalid:data-hover:border-red-500', 'data-invalid:data-hover:border-destructive'],
  ['dark:data-invalid:border-red-500', 'dark:data-invalid:border-destructive'],
  ['dark:data-invalid:data-hover:border-red-500', 'dark:data-invalid:data-hover:border-destructive'],
  ['ring-green-500/30', 'ring-success/30'],
  ['ring-red-500/30', 'ring-error/30'],
  ['ring-amber-500/30', 'ring-warning/30'],
  ['ring-blue-500/30', 'ring-info/30'],
  ['text-green-500', 'text-success'],
  ['text-red-500', 'text-error'],
  ['text-amber-500', 'text-warning-text'],
  ['text-blue-500', 'text-info'],
  ['fill-amber-400 text-amber-400', 'fill-warning text-warning'],

  // ── focus ring: the 16 sites of blocker 2 ──
  [
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  ],
  [
    'focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-blue-500',
    'focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-ring',
  ],
  [
    'group-data-focus:outline group-data-focus:outline-2 group-data-focus:outline-offset-2 group-data-focus:outline-blue-500',
    'group-data-focus:outline group-data-focus:outline-2 group-data-focus:outline-offset-2 group-data-focus:outline-ring',
  ],
  [
    'group-data-focus:outline-2 group-data-focus:outline-offset-2 group-data-focus:outline-blue-500',
    'group-data-focus:outline-2 group-data-focus:outline-offset-2 group-data-focus:outline-ring',
  ],
  ['data-focus:after:ring-2 data-focus:after:ring-blue-500', 'data-focus:after:ring-2 data-focus:after:ring-ring'],
  [
    'sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500',
    'sm:focus-within:after:ring-2 sm:focus-within:after:ring-ring',
  ],
  ['data-focus:bg-blue-500 data-focus:text-white', 'data-focus:bg-primary data-focus:text-primary-foreground'],
  ['group-data-focus:text-white', 'group-data-focus:text-primary-foreground'],
  ['group-data-focus/option:text-white', 'group-data-focus/option:text-primary-foreground'],
  ['group-data-focus/option:*:data-[slot=icon]:text-white', 'group-data-focus/option:*:data-[slot=icon]:text-primary-foreground'],
  ['data-focus:*:data-[slot=icon]:text-white', 'data-focus:*:data-[slot=icon]:text-primary-foreground'],
  ['dark:data-focus:*:data-[slot=icon]:text-white', 'dark:data-focus:*:data-[slot=icon]:text-primary-foreground'],
  [
    'focus-visible:[&::-webkit-slider-thumb]:outline-blue-500',
    'focus-visible:[&::-webkit-slider-thumb]:outline-ring',
  ],

  // ── tooltip: fixed dark chip → inverse surface ──
  ['bg-zinc-950 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-zinc-700', 'bg-foreground px-2.5 py-1.5 text-xs text-background shadow-lg'],

  // ── layout shells ──
  ['lg:bg-zinc-100 dark:bg-zinc-900 dark:lg:bg-zinc-950', 'lg:bg-background'],
  ['lg:bg-white', 'lg:bg-card'],
  ['dark:lg:bg-zinc-900', ''],
  ['dark:ring-white/10', ''],
  ['dark:lg:ring-white/10', ''],
  ['dark:border-white/5', ''],
  ['sm:dark:border-white/5', ''],
  ['dark:bg-white/5', ''],
  ['dark:*:bg-zinc-800', ''],
];

/* ── judgement calls: reported, never auto-changed (TOKEN-MAP.md §3) ── */
const FLAGS = [
  {
    id: 'catalyst-colorways',
    test: /--(?:switch|checkbox|radio)-[a-z-]*:var\(--color-/,
    note: 'Catalyst 11-colorway block — collapse to 5 semantic intents (SEMANTIC-INTENTS.md). Breaking API change.',
  },
  {
    id: 'progress-color-prop',
    test: /bg-(?:blue|green|red|amber|violet|zinc)-600 dark:bg-\w+-\d00/,
    note: 'Progress `color` prop maps straight to a palette. Collapse to semantic intents (SEMANTIC-INTENTS.md).',
  },
  {
    id: 'stepper-blue',
    test: /bg-blue-600|text-blue-600|border-blue-600/,
    note: 'Stepper paints progress Tailwind blue. Should be bg-primary / text-primary / border-primary.',
  },
  {
    id: 'fixed-dark-chrome',
    test: /rounded-xl bg-zinc-950 ring-1 ring-zinc-800/,
    note: 'CodeBlock is intentionally dark in both themes. Decide: keep as a fixed terminal surface (then use --rvui-midnight, not zinc-950) or make it theme-following.',
  },
  {
    id: 'residual-dark-variant',
    test: /\bdark:/,
    note: 'Residual `dark:` variant — follows the OS media query, not [data-theme]. Every one left is a theme-lock bug.',
  },
  {
    id: 'residual-palette',
    test: /\b(?:zinc|slate|gray|red|blue|green|emerald|amber|yellow|indigo|violet)-(?:50|100|200|300|400|500|600|700|800|900|950)\b/,
    note: 'Residual raw palette value with no mapping in this table — needs a token or a new one.',
  },
];

/* ── walk ── */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SCAN_EXT.has(extname(name))) out.push(p);
  }
  return out;
}

const report = { changed: [], flagged: [], replacements: 0 };

for (const target of targets) {
  for (const file of walk(target)) {
    const original = readFileSync(file, 'utf8');
    let text = original;
    const applied = [];

    for (const [from, to] of REPLACEMENTS) {
      if (!text.includes(from)) continue;
      const count = text.split(from).length - 1;
      text = text.split(from).join(to);
      applied.push({ from, to, count });
      report.replacements += count;
    }

    // Collapse double spaces left when a dark: token was removed mid-className.
    // Only between non-whitespace (never touch indentation or quote spacing).
    // Prior versions used / +'/ and /(['"`]) +/ which stripped spaces around
    // every single-quoted string in the file (`from 'react'` → `from'react'`).
    if (applied.length > 0) {
      text = text.replace(/(?<=\S) {2,}(?=\S)/g, ' ');
    }

    const rel = relative(process.cwd(), file);
    if (applied.length > 0) report.changed.push({ file: rel, applied });

    for (const flag of FLAGS) {
      const lines = text.split('\n');
      const hits = [];
      lines.forEach((line, i) => {
        if (flag.test.test(line)) hits.push({ line: i + 1, text: line.trim().slice(0, 120) });
      });
      if (hits.length > 0) report.flagged.push({ file: rel, id: flag.id, note: flag.note, hits });
    }

    if (!CHECK && text !== original) writeFileSync(file, text, 'utf8');
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const mode = CHECK ? 'CHECK (nothing written)' : 'APPLIED';
console.log(`\ntoken-purge — ${mode}`);
console.log(`${report.replacements} replacement(s) across ${report.changed.length} file(s)\n`);

for (const { file, applied } of report.changed) {
  console.log(`  ${file}`);
  for (const { from, to, count } of applied) {
    const shown = from.length > 62 ? `${from.slice(0, 59)}…` : from;
    console.log(`    ${count}×  ${shown}\n         →  ${to || '(removed)'}`);
  }
}

if (report.flagged.length > 0) {
  const byId = new Map();
  for (const f of report.flagged) {
    if (!byId.has(f.id)) byId.set(f.id, { note: f.note, files: [] });
    byId.get(f.id).files.push(f);
  }
  console.log('\n── needs a human ──────────────────────────────────────────\n');
  for (const [id, { note, files }] of byId) {
    const total = files.reduce((n, f) => n + f.hits.length, 0);
    console.log(`  ${id}  (${total} site(s) in ${files.length} file(s))`);
    console.log(`  ${note}`);
    for (const f of files) console.log(`    ${f.file}: ${f.hits.map((h) => h.line).join(', ')}`);
    console.log('');
  }
}

console.log(
  CHECK
    ? 'Re-run without --check to apply. Read the "needs a human" list first.\n'
    : 'Now: pnpm --filter @revealui/presentation test  (3 assertion updates expected — see README)\n',
);
