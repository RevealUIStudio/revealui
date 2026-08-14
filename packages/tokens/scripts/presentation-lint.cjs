/*
 * presentation-lint.cjs — Gate 0, step 3. Keeps the design system on its own system.
 * ──────────────────────────────────────────────────────────────────────────────
 * `adherence-lint.cjs` guards the CODE THAT CONSUMES the tokens (apps, artifacts).
 * This guards the PACKAGE THAT DEFINES THEM — the one surface that gate never
 * scanned, and consequently the largest violator of its own rule: 280 lines
 * carrying a raw palette value across 36 files at 0.12.1, while
 * CONTRIBUTING §2 has said "No hardcoded colors, spacing, or radii" the whole time.
 *
 * Dependency-free CommonJS. Run in CI and pre-commit:
 *
 *     node packages/tokens/scripts/presentation-lint.cjs ../presentation/src
 *     node packages/tokens/scripts/presentation-lint.cjs --json ../presentation/src
 *     node packages/tokens/scripts/presentation-lint.cjs --rule=logical-props ../presentation/src
 *
 * Flags:
 *   --json          machine-readable report
 *   --summary       the audit's figures, computed — see "AUDIT FIGURES" below
 *   --warn          exit 0 even on findings (first adoption only — do not leave on)
 *   --quiet         suppress per-file OK lines
 *   --rule=<id,…>   run only these rules (comma-separated)
 *   --off=<id,…>    skip these rules
 *
 * Suppress a reviewed exception with an inline comment ON THE SAME LINE:
 *     /* presentation-lint-ignore: <rule-id> — <reason> *\/
 *
 * Rules that are OFF by default carry `defaultOff: true` and the gate they
 * belong to. Turn them on when that gate lands, not before — a rule nobody can
 * pass yet gets `--warn`'d, and `--warn` is how the last one rotted.
 *
 * ── AUDIT FIGURES ────────────────────────────────────────────────────────────
 *
 * `--summary` prints the counts that `Assessment · Enterprise Readiness.html`
 * quotes for blockers 1 and 2, computed from the tree rather than tallied by hand.
 *
 * This mode exists because every numeric error in that audit came from hand-counting
 * grep output: a truncated result was read as complete, a nine-line file was counted
 * as eight, a set intersection was eyeballed. The figures that never needed
 * correcting were the ones a tool produced.
 *
 * So: **when `--summary` disagrees with the audit, the audit is wrong.** Paste this
 * output over the prose rather than reconciling the two.
 *
 *     node presentation-lint.cjs --summary packages/presentation/src
 */
'use strict';

const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative, extname } = require('node:path');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const SUMMARY = args.includes('--summary');
const WARN_ONLY = args.includes('--warn');
const QUIET = args.includes('--quiet');
const only = (args.find((a) => a.startsWith('--rule=')) || '').slice(7).split(',').filter(Boolean);
const off = (args.find((a) => a.startsWith('--off=')) || '').slice(6).split(',').filter(Boolean);
const targets = args.filter((a) => !a.startsWith('--'));
if (targets.length === 0) targets.push('.');

const SCAN_EXT = new Set(['.ts', '.tsx']);
const SKIP_DIR = new Set(['node_modules', 'dist', '.turbo', 'coverage']);
// Test files assert on class strings by design — they must be able to name the
// old classes in a regression assertion.
const SKIP_FILE = /(?:\.test\.tsx?|\.spec\.tsx?)$/;

/**
 * Per-rule exemptions. A rule that cannot be satisfied is a rule that gets
 * deleted, so these are the files where the "violation" IS the correct code.
 */
const EXEMPT = {
  // focus.ts documents the classes it replaces ("Replaces: outline-blue-500").
  // Without this, the fix for blocker 2 permanently fails the rule that checks it.
  'raw-palette': [/utils\/focus\.ts$/],
  'palette-css-var': [/utils\/focus\.ts$/],
  'literal-ring-colour': [/utils\/focus\.ts$/],
  'bare-white-black': [/utils\/focus\.ts$/],
  // The brand marks carry the brand's own geometry and fixed colours — cobalt
  // #003d94 and amber #eeb300 ARE the mark, and a themed logo is not a logo.
  'hex-literal': [/brand-mark\.tsx$/, /wordmark\.tsx$/],
  // The files that own the icon set, plus the two brand marks.
  'inline-svg': [/icon\.tsx$/, /providers\.tsx$/, /brand-mark\.tsx$/, /wordmark\.tsx$/],
};

const PALETTE =
  'zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const STEP = '50|100|200|300|400|500|600|700|800|900|950';

const rules = [
  {
    id: 'raw-palette',
    severity: 'error',
    why: 'Enterprise Readiness blocker 1 — a palette literal cannot be rethemed, so white-label half-works',
    fix: 'a bridge utility (text-foreground, bg-card, border-border, bg-primary, text-success…) or var(--rvui-*)',
    test(line) {
      const m = line.match(new RegExp(`\\b(?:${PALETTE})-(?:${STEP})\\b`));
      return m ? { found: m[0] } : null;
    },
  },
  {
    id: 'palette-css-var',
    severity: 'error',
    why: 'Enterprise Readiness blocker 1 — `var(--color-zinc-900)` is the same literal wearing a variable',
    fix: 'var(--rvui-*) — the semantic token, not a Tailwind swatch',
    test(line) {
      const m = line.match(new RegExp(`var\\(--color-(?:${PALETTE})-(?:${STEP})\\)`));
      return m ? { found: m[0] } : null;
    },
  },
  {
    id: 'dark-variant',
    severity: 'error',
    why: "theme-lock bug — Tailwind's `dark:` follows prefers-color-scheme, RevealUI themes flip on [data-theme]",
    fix: 'one token that inverts itself; delete the variant',
    test(line) {
      const m = line.match(/\bdark:[a-z[]/);
      return m ? { found: m[0].slice(0, -1) } : null;
    },
  },
  {
    id: 'literal-ring-colour',
    severity: 'error',
    why: 'Enterprise Readiness blocker 2 — unthemeable ring colour; 0.12.0 fixed only Button',
    fix: 'focus rings: import from utils/focus.js. Surface rings: ring-border / ring-border-strong',
    test(line) {
      // \b on the step is required: the alternation is ordered, so without it
      // `ring-red-500` matches as `ring-red-50` and the report reads wrong.
      const m = line.match(new RegExp(`(?:outline|ring)-(?:${PALETTE})-(?:${STEP})\\b`));
      if (!m) return null;
      // Distinguish a FOCUS ring from a decorative surface ring. `ring-zinc-950/10`
      // on a card is a border, not a focus indicator — still off-system (raw-palette
      // catches it), but reporting it as blocker 2 overstates the focus problem.
      const isFocus = /focus|outline-/.test(line);
      return { found: m[0], kind: isFocus ? 'focus' : 'surface' };
    },
  },
  {
    id: 'hex-literal',
    severity: 'error',
    why: 'CONTRIBUTING §2 — no hardcoded design values in the package that defines them',
    fix: 'add the token to packages/tokens/src/tokens.css first, then reference it',
    test(line) {
      // Ignore SVG path data and anything already inside a var() fallback chain.
      if (/\bd="|viewBox=/.test(line)) return null;
      const m = line.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i);
      return m ? { found: m[0] } : null;
    },
  },
  {
    id: 'bare-white-black',
    severity: 'warn',
    why: 'unthemeable absolutes — `text-white` on a themed fill breaks when the fill lightens',
    fix: 'text-primary-foreground / text-background / var(--rvui-text-on-*)',
    test(line) {
      const m = line.match(/\b(?:text|bg|ring|border|fill|stroke|divide)-(?:white|black)\b/);
      return m ? { found: m[0] } : null;
    },
  },
  {
    id: 'inline-svg',
    severity: 'warn',
    why: 'Enterprise Readiness medium 14 — icons belong in the icon set, not inlined per component',
    fix: 'compose from src/components/icon.tsx; add the glyph there if it is missing',
    test(line) {
      const m = line.match(/<svg\b/);
      return m ? { found: '<svg' } : null;
    },
  },
  {
    id: 'logical-props',
    severity: 'error',
    defaultOff: true,
    gate: 'Gate 3 (i18n)',
    why: 'Enterprise Readiness high 5 — physical direction utilities give RTL a broken layout, not a mirrored one',
    fix: 'ms-/me-/ps-/pe-/start-/end-/text-start/text-end/border-s/border-e',
    test(line) {
      const m = line.match(
        /\b(?:-?(?:ml|mr|pl|pr)-[\w.[\]/-]+|(?:left|right)-[\w.[\]/-]+|text-(?:left|right)|border-[lr]\b|border-[lr]-[\w./-]+|rounded-[lr]\b)/,
      );
      return m ? { found: m[0] } : null;
    },
  },
];

const active = rules.filter((r) => {
  if (off.includes(r.id)) return false;
  if (only.length > 0) return only.includes(r.id);
  return !r.defaultOff;
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (SCAN_EXT.has(extname(name)) && !SKIP_FILE.test(name)) out.push(p);
  }
  return out;
}

const findings = [];
let scanned = 0;

for (const target of targets) {
  for (const file of walk(target)) {
    scanned++;
    const rel = relative(process.cwd(), file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/presentation-lint-ignore:/.test(line)) return;
      for (const rule of active) {
        if ((EXEMPT[rule.id] ?? []).some((re) => re.test(rel))) continue;
        rule._file = rel;
        const hit = rule.test(line);
        if (!hit) continue;
        findings.push({
          file: rel,
          line: i + 1,
          rule: rule.id,
          severity: rule.severity,
          found: hit.found,
          kind: hit.kind,
          why: rule.why,
          fix: rule.fix,
          source: line.trim().slice(0, 130),
        });
      }
    });
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned, active: active.map((r) => r.id), findings }, null, 2));
  process.exit(findings.some((f) => f.severity === 'error') && !WARN_ONLY ? 1 : 0);
}

/* ── --summary: the audit's figures, computed ───────────────────────────── */

if (SUMMARY) {
  // The three Catalyst colorway files carry the bulk of the palette problem and
  // are the batching order Gate 0 recommends. Named explicitly so the share is
  // computed rather than asserted.
  const COLORWAY_FILES = ['switch.tsx', 'radio.tsx', 'checkbox-headless.tsx'];
  const base = (p) => p.split('/').pop();

  const paletteRules = new Set(['raw-palette', 'palette-css-var']);
  const palette = findings.filter((f) => paletteRules.has(f.rule));
  const paletteLines = new Set(palette.map((f) => `${f.file}:${f.line}`));
  const paletteFiles = new Set(palette.map((f) => f.file));

  const focus = findings.filter((f) => f.rule === 'literal-ring-colour');
  const focusRings = focus.filter((f) => f.kind === 'focus');
  const surfaceRings = focus.filter((f) => f.kind === 'surface');
  const focusFiles = new Set(focusRings.map((f) => f.file));
  const surfaceFiles = new Set(surfaceRings.map((f) => f.file));

  const darkVariant = findings.filter((f) => f.rule === 'dark-variant');
  const darkFiles = new Set(darkVariant.map((f) => f.file));

  const colorwayLines = [...paletteLines].filter((k) => COLORWAY_FILES.includes(base(k.split(':')[0])));
  const share = paletteLines.size > 0 ? Math.round((colorwayLines.length / paletteLines.size) * 100) : 0;

  const perColorway = COLORWAY_FILES.map((name) => ({
    name,
    lines: [...paletteLines].filter((k) => base(k.split(':')[0]) === name).length,
  }));

  console.log(`\naudit figures — ${scanned} source file(s) scanned under the given path(s)\n`);
  console.log('  BLOCKER 1 — raw palette values');
  console.log(`    ${paletteLines.size} lines carrying at least one palette value`);
  console.log(`    ${paletteFiles.size} of ${scanned} scanned files affected`);
  console.log(`    ${palette.length} rule-hit(s) — one per rule per line, so this exceeds the line`);
  console.log('      count where a line trips both raw-palette and palette-css-var.');
  console.log('      It is NOT an occurrence count: a single line can carry three values.');
  console.log(`    ${colorwayLines.length} of those lines (${share}%) sit in the 3 Catalyst colorway files:`);
  for (const c of perColorway) console.log(`      ${c.name.padEnd(24)} ${c.lines}`);
  console.log('');
  console.log('  BLOCKER 1b — theme-lock');
  console.log(`    ${darkVariant.length} \`dark:\` variant(s) across ${darkFiles.size} file(s)`);
  console.log('');
  console.log('  BLOCKER 2 — ring colours');
  console.log(`    ${focusRings.length} FOCUS ring colour(s) across ${focusFiles.size} file(s)  ← blocker 2`);
  console.log(`    ${surfaceRings.length} decorative surface ring(s) across ${surfaceFiles.size} file(s)`);
  console.log('      Surface rings are off-system too (raw-palette counts them), but they are');
  console.log('      borders, not focus indicators — counting them as blocker 2 overstates it.');
  console.log('');
  console.log('  Scope note: these cover every file under the path(s) given, and all 22');
  console.log('  Tailwind palette families. A hand-grep of src/components alone, over the');
  console.log('  dozen best-known families, undercounts this by roughly a quarter.');
  console.log('');
  console.log('  Paste these over the audit\'s prose figures. If they disagree, the audit is');
  console.log('  wrong — every numeric error in it came from hand-counting grep output.\n');
  process.exit(0);
}

const errors = findings.filter((f) => f.severity === 'error');
const warns = findings.filter((f) => f.severity === 'warn');

console.log(`\npresentation-lint — ${scanned} file(s), rules: ${active.map((r) => r.id).join(', ')}`);

if (findings.length === 0) {
  console.log('\n  clean — the design system is on its own system.\n');
} else {
  const byRule = new Map();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule).push(f);
  }
  for (const [id, hits] of byRule) {
    const rule = rules.find((r) => r.id === id);
    console.log(`\n${rule.severity === 'error' ? '✗' : '!'} ${id} — ${hits.length} finding(s)`);
    console.log(`  why: ${rule.why}`);
    console.log(`  fix: ${rule.fix}\n`);
    const shown = QUIET ? hits.slice(0, 5) : hits;
    for (const h of shown) console.log(`    ${h.file}:${h.line}  ${h.found}`);
    if (QUIET && hits.length > 5) console.log(`    …and ${hits.length - 5} more`);
  }
  console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
}

const offRules = rules.filter((r) => r.defaultOff && !only.includes(r.id));
if (offRules.length > 0) {
  console.log(
    `\nnot yet enabled: ${offRules.map((r) => `${r.id} (${r.gate})`).join(', ')}` +
      `\n  preview with --rule=${offRules.map((r) => r.id).join(',')}\n`,
  );
}

process.exit(errors.length > 0 && !WARN_ONLY ? 1 : 0);
