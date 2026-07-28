/*
 * gen-acr.cjs — generate the accessibility conformance report from the showcase registry.
 * ──────────────────────────────────────────────────────────────────────────────
 * Gate 1 of `Assessment · Enterprise Readiness.html`, blocker 3. The audit's
 * sharpest line was that an enterprise buyer asks for an Accessibility
 * Conformance Report and there is nothing to build one from. This builds it —
 * from the registry, so it cannot drift from the code.
 *
 * Decision on record (Gate 2, question 5): generated WCAG 2.2 AA table now,
 * VPAT assembled from the same data on first request. Hence one generator with
 * two output formats rather than two documents.
 *
 * Install as packages/tokens/scripts/gen-acr.cjs — or apps/docs/scripts/, since
 * it reads the docs registry. Either works; tokens/scripts keeps all the DS
 * gates in one directory.
 *
 *   node scripts/gen-acr.cjs                 → docs/accessibility/conformance.md
 *   node scripts/gen-acr.cjs --vpat          → also docs/accessibility/vpat.md
 *   node scripts/gen-acr.cjs --check         → exit 1 if any component lacks a claim
 *   node scripts/gen-acr.cjs --json          → machine-readable
 *   node scripts/gen-acr.cjs --root <dir>    → repo root (default: two levels up)
 *
 * WHY A PARSER RATHER THAN AN IMPORT
 *
 * The obvious implementation awaits each registry entry's `loader()` and reads
 * `story.a11y`. It also needs the package built, a TSX runtime, and an import
 * graph that survives Node — and it would mean this gate can only run after a
 * successful build. A focused brace-matching parser over the source has none of
 * those dependencies, so `--check` can run on a bare checkout in five seconds.
 * The tradeoff: a computed `a11y` object (spread, variable reference) is not
 * readable this way. The script reports those as unparseable rather than
 * silently treating them as absent — a false "missing" would be worse than an
 * honest "can't tell".
 *
 * COVERAGE AS OF 0.12.1: 6 of 58 showcases declare `conformance`. The schema
 * anticipated this report and roughly a tenth of it is filled in. `--check` lists
 * the other 52 as the work list rather than letting the report imply they were
 * assessed and passed.
 */
'use strict';

const { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const JSON_OUT = args.includes('--json');
const WANT_VPAT = args.includes('--vpat');
const argVal = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

const ROOT = resolve(argVal('--root') || join(__dirname, '..', '..', '..'));
const SHOWCASE_DIR = join(ROOT, 'apps', 'docs', 'app', 'showcase');
const REGISTRY = join(ROOT, 'apps', 'docs', 'app', 'components', 'showcase', 'registry.ts');
const OUT_DIR = join(ROOT, 'docs', 'accessibility');

const PKG_VERSION = (() => {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'packages', 'presentation', 'package.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
})();

/* ── read the registry for the canonical slug + category list ───────────── */

function readRegistry() {
  const src = readFileSync(REGISTRY, 'utf8');
  const entries = [];
  const re = /\{\s*slug:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'\s*,\s*category:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) entries.push({ slug: m[1], name: m[2], category: m[3] });
  return entries;
}

/* ── extract a balanced object literal following a key ─────────────────── */

function extractObject(src, key) {
  const at = src.search(new RegExp(`\\b${key}\\s*:\\s*\\{`));
  if (at === -1) return null;
  const open = src.indexOf('{', at);
  let depth = 0;
  let inStr = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return null;
}

/** String array literal: ['a', 'b'] → ['a','b'] */
function parseStringArray(block, key) {
  const m = block.match(new RegExp(`\\b${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) return null;
  return [...m[1].matchAll(/['"`]([^'"`]+)['"`]/g)].map((x) => x[1]);
}

/** Record literal: {"Tab": "Moves focus"} → [[key, value], …] */
function parseRecord(block, key) {
  const inner = extractObject(block, key);
  if (!inner) return null;
  return [...inner.matchAll(/['"`]?([A-Za-z0-9 +\-_:[\]]+?)['"`]?\s*:\s*['"`]([^'"`]*)['"`]/g)].map((m) => [m[1].trim(), m[2]]);
}

/* ── collect ───────────────────────────────────────────────────────────── */

function countComponents() {
  const dir = join(ROOT, 'packages', 'presentation', 'src', 'components');
  if (!existsSync(dir)) return null;
  return readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.startsWith('_')).length;
}

const registry = readRegistry();
const totalComponents = countComponents();
const onDisk = existsSync(SHOWCASE_DIR)
  ? readdirSync(SHOWCASE_DIR).filter((f) => f.endsWith('.showcase.tsx'))
  : [];

const records = [];
for (const entry of registry) {
  const file = join(SHOWCASE_DIR, `${entry.slug}.showcase.tsx`);
  if (!existsSync(file)) {
    records.push({ ...entry, state: 'no-showcase-file' });
    continue;
  }
  const src = readFileSync(file, 'utf8');
  const sourceUrl = (src.match(/sourceUrl:\s*['"]([^'"]+)['"]/) || [])[1] || null;

  if (!/\ba11y\s*:/.test(src)) {
    records.push({ ...entry, sourceUrl, state: 'no-claim' });
    continue;
  }
  const block = extractObject(src, 'a11y');
  if (!block) {
    records.push({ ...entry, sourceUrl, state: 'unparseable' });
    continue;
  }

  const conformance = parseStringArray(block, 'conformance');
  const keyboard = parseRecord(block, 'keyboard');
  const aria = parseRecord(block, 'aria');
  const notes = (block.match(/notes:\s*['"`]([\s\S]*?)['"`]\s*[,}]/) || [])[1] || null;

  records.push({
    ...entry,
    sourceUrl,
    state: conformance && conformance.length > 0 ? 'claimed' : 'partial',
    conformance: conformance || [],
    keyboard: keyboard || [],
    aria: aria || [],
    notes,
  });
}

const components = records.filter((r) => r.category === 'component');
const claimed = components.filter((r) => r.state === 'claimed');
const gaps = components.filter((r) => r.state !== 'claimed');

/* ── criteria index: which components claim each WCAG criterion ─────────── */

const criteria = new Map();
for (const r of claimed) {
  for (const c of r.conformance) {
    if (!criteria.has(c)) criteria.set(c, []);
    criteria.get(c).push(r.name);
  }
}

/* ── check mode ────────────────────────────────────────────────────────── */

if (JSON_OUT) {
  console.log(JSON.stringify({ version: PKG_VERSION, records, criteria: [...criteria] }, null, 2));
  process.exit(CHECK && gaps.length > 0 ? 1 : 0);
}

if (CHECK) {
  console.log(`\ngen-acr --check · @revealui/presentation@${PKG_VERSION}`);
  console.log(`  ${claimed.length}/${components.length} component showcases declare a11y.conformance\n`);
  if (gaps.length === 0) {
    console.log('  every component carries a conformance claim.\n');
    process.exit(0);
  }
  const byState = new Map();
  for (const g of gaps) {
    if (!byState.has(g.state)) byState.set(g.state, []);
    byState.get(g.state).push(g.slug);
  }
  for (const [state, slugs] of byState) {
    const label = {
      'no-claim': 'no a11y block at all',
      partial: 'a11y block present but conformance[] empty or missing',
      unparseable: 'a11y block is computed — cannot be read statically, assess by hand',
      'no-showcase-file': 'registered but no showcase file on disk',
    }[state];
    console.log(`  ${state} — ${label} (${slugs.length})`);
    for (const s of slugs) console.log(`    ${s}`);
    console.log('');
  }
  console.error(
    '::error::gen-acr: components without a conformance claim cannot appear in the ACR as assessed.\n' +
      'Fill a11y.conformance in each showcase, or accept that the published report lists them as\n' +
      'NOT ASSESSED — which is honest, and which procurement will ask about.',
  );
  process.exit(1);
}

/* ── emit: conformance report ──────────────────────────────────────────── */

const today = new Date().toISOString().slice(0, 10);
const denom = totalComponents ?? components.length;
const pct = denom ? Math.round((claimed.length / denom) * 100) : 0;
const undocumented = totalComponents ? totalComponents - components.length : 0;

const lines = [];
lines.push('<!-- GENERATED by scripts/gen-acr.cjs — do not edit by hand. -->');
lines.push('<!-- Regenerate: pnpm --filter @revealui/tokens gen:acr -->');
lines.push('');
lines.push('# Accessibility conformance report');
lines.push('');
lines.push(`**Package** \`@revealui/presentation@${PKG_VERSION}\`  `);
lines.push('**Target** WCAG 2.2 Level AA  ');
lines.push(`**Generated** ${today}  `);
lines.push(`**Assessed** ${claimed.length} of ${denom} shipped components (${pct}%)`);
lines.push(`**Documented** ${components.length} of ${denom} have a showcase page`);
lines.push('');
lines.push('## How this report is produced');
lines.push('');
lines.push('Generated from the component registry, not written by hand — so it cannot drift from');
lines.push('the code. Each row reflects the conformance claim declared in that component\'s');
lines.push('showcase definition, plus its documented keyboard and ARIA contract.');
lines.push('');
lines.push('Two automated gates back these claims, both hard-failing in CI on every pull request:');
lines.push('');
lines.push('- **axe-core** over every showcase page in both light and dark themes, failing on any');
lines.push('  violation of critical or serious impact (`e2e/showcase-a11y.e2e.ts`).');
lines.push('- **Contrast pins** on every token pair in the `@revealui/tokens` contract test, so a');
lines.push('  colour change that breaks a ratio fails the build rather than shipping.');
lines.push('');
lines.push('A claim in this table means: declared by the component author, exercised by the');
lines.push('component test suite, and covered by the axe gate. It does not mean an independent');
lines.push('third-party audit — none has been performed, and this report does not imply one.');
lines.push('');

if (gaps.length > 0) {
  lines.push('## Not yet assessed');
  lines.push('');
  lines.push(`${gaps.length} of the ${components.length} showcase pages carry no conformance claim. They are`);
  lines.push('covered by the axe gate like every other component, but no per-criterion claim has been');
  lines.push('recorded, so they are listed here rather than presented as conforming.');
  lines.push('');
  lines.push('| Component | Status |');
  lines.push('|---|---|');
  for (const g of gaps) {
    const status = {
      'no-claim': 'not assessed',
      partial: 'partially documented — no criteria listed',
      unparseable: 'declared dynamically — assess by hand',
      'no-showcase-file': 'no showcase',
    }[g.state];
    lines.push(`| ${g.name} | ${status} |`);
  }
  lines.push('');
}

if (undocumented > 0) {
  lines.push('## Not documented at all');
  lines.push('');
  lines.push(`${undocumented} of ${denom} shipped components have no showcase page. A component without a`);
  lines.push('showcase is outside the visual-regression gate, outside the axe gate, and outside this');
  lines.push('report — neither verified nor claimed. Closing that gap comes before backfilling');
  lines.push('conformance on the rest.');
  lines.push('');
}

lines.push('## Per-component conformance');
lines.push('');
for (const r of claimed) {
  lines.push(`### ${r.name}`);
  lines.push('');
  if (r.sourceUrl) lines.push(`Source: \`${r.sourceUrl}\`  `);
  lines.push(`Documentation: https://docs.revealui.com/showcase/${r.slug}`);
  lines.push('');
  lines.push('**Criteria met**');
  lines.push('');
  for (const c of r.conformance) lines.push(`- ${c}`);
  lines.push('');
  if (r.keyboard.length > 0) {
    lines.push('**Keyboard**');
    lines.push('');
    lines.push('| Key | Behaviour |');
    lines.push('|---|---|');
    for (const [k, v] of r.keyboard) lines.push(`| \`${k}\` | ${v} |`);
    lines.push('');
  }
  if (r.aria.length > 0) {
    lines.push('**ARIA**');
    lines.push('');
    lines.push('| Attribute | Use |');
    lines.push('|---|---|');
    for (const [k, v] of r.aria) lines.push(`| \`${k}\` | ${v} |`);
    lines.push('');
  }
  if (r.notes) {
    lines.push(`**Notes** ${r.notes}`);
    lines.push('');
  }
}

lines.push('## Criteria index');
lines.push('');
lines.push('| Criterion | Components claiming it |');
lines.push('|---|---|');
for (const [c, names] of [...criteria].sort()) lines.push(`| ${c} | ${names.join(', ')} |`);
lines.push('');
lines.push('## Known issues');
lines.push('');
lines.push('Documented rather than omitted. An accessibility claim that cannot be substantiated is');
lines.push('worse than a documented gap.');
lines.push('');
lines.push('| Issue | Scope | Status |');
lines.push('|---|---|---|');
lines.push('| `--rvui-text-2` is not AA-conformant as text on `surface-2` / `surface-3` | Tertiary text on muted layers | By design — it is an icon, border and separator colour on those layers; use `--rvui-text-1` for text. Enforced by review, not yet by lint. |');
lines.push('| Visual regression baselines are Chromium-only | Cross-browser rendering | Known limitation. Other engines get smoke passes, not pixel goldens; cross-browser font hinting makes multi-renderer goldens unreliable. |');
lines.push('| No RTL support | Right-to-left locales | Deferred by decision. Components use physical-direction CSS; an RTL locale gets a broken layout, not a mirrored one. |');
lines.push('| No independent third-party audit | Whole package | Not performed. All claims are first-party, automated-gate-backed. |');
lines.push('');
lines.push('## Feedback');
lines.push('');
lines.push('Accessibility defects: https://github.com/RevealUIStudio/revealui/issues with the');
lines.push('`package: presentation` label. A VPAT 2.5 can be produced from this report on request.');
lines.push('');

mkdirSync(OUT_DIR, { recursive: true });
const conformancePath = join(OUT_DIR, 'conformance.md');
writeFileSync(conformancePath, `${lines.join('\n')}\n`, 'utf8');
console.log(`gen-acr: wrote ${conformancePath}`);
console.log(`  ${claimed.length}/${denom} shipped components assessed (${pct}%) · ${criteria.size} criteria`);
console.log(`  ${components.length}/${denom} have a showcase${undocumented ? ` · ${undocumented} have none` : ''}`);

/* ── emit: VPAT 2.5, same data, procurement format ─────────────────────── */

if (WANT_VPAT) {
  const v = [];
  v.push('<!-- GENERATED by scripts/gen-acr.cjs --vpat — do not edit by hand. -->');
  v.push('');
  v.push(`# Accessibility Conformance Report — VPAT® 2.5 (WCAG edition)`);
  v.push('');
  v.push(`**Name of Product** @revealui/presentation ${PKG_VERSION}  `);
  v.push('**Product Description** React component library and design token system.  ');
  v.push(`**Report Date** ${today}  `);
  v.push('**Contact** founder@revealui.com  ');
  v.push('**Evaluation Methods Used** Automated testing with axe-core across every component');
  v.push('documentation page in light and dark themes; automated WCAG contrast assertions on every');
  v.push('design token pair; component-level keyboard interaction tests. First-party evaluation — no');
  v.push('independent third-party audit has been performed.');
  v.push('');
  v.push('## Applicable standards');
  v.push('');
  v.push('| Standard | Included |');
  v.push('|---|---|');
  v.push('| WCAG 2.2 Level A / AA | Yes |');
  v.push('| Revised Section 508 (36 CFR 1194) | Yes, by reference to WCAG 2.2 AA |');
  v.push('| EN 301 549 | Yes, by reference to WCAG 2.2 AA |');
  v.push('');
  v.push('## Terms');
  v.push('');
  v.push('**Supports** — the functionality meets the criterion without known defects.  ');
  v.push('**Partially Supports** — some functionality does not meet the criterion.  ');
  v.push('**Does Not Support** — the majority of functionality does not meet the criterion.  ');
  v.push('**Not Applicable** — the criterion is not relevant to this product.');
  v.push('');
  v.push('> A component library is not an application. Several criteria — page titles, language of');
  v.push('> page, bypass blocks, consistent navigation — are properties of the *consuming*');
  v.push('> application, and are marked Not Applicable here with the obligation noted. A buyer');
  v.push('> assessing a full product needs the consuming application\'s report as well as this one.');
  v.push('');
  v.push('## Criteria claimed by at least one component');
  v.push('');
  v.push('| Criterion | Conformance | Remarks |');
  v.push('|---|---|---|');
  for (const [c, names] of [...criteria].sort()) {
    v.push(`| ${c} | Supports | Claimed and gate-covered in: ${names.join(', ')} |`);
  }
  v.push('');
  v.push('## Known limitations affecting conformance');
  v.push('');
  v.push('| Criterion | Conformance | Remarks |');
  v.push('|---|---|---|');
  v.push('| 1.4.3 Contrast (Minimum) | Partially Supports | The tertiary text token is not AA-conformant as text on the two muted surface layers; it is specified as an icon, border and separator colour there. All other token pairs carry pinned contrast assertions. |');
  v.push('| 1.4.8 Visual Presentation (AAA) | Does Not Support | AAA criterion, out of the stated AA target. |');
  v.push('| 3.1.2 Language of Parts | Not Applicable | Determined by the consuming application. |');
  v.push('| 2.4.2 Page Titled | Not Applicable | Determined by the consuming application. |');
  v.push('| 2.4.1 Bypass Blocks | Not Applicable | Determined by the consuming application; layout shells accept a skip-link slot. |');
  v.push('');
  v.push(`## Components not yet individually assessed (${gaps.length} of ${components.length})`);
  v.push('');
  v.push('Covered by the automated axe gate, without a recorded per-criterion claim:');
  v.push('');
  v.push(gaps.map((g) => g.name).join(', ') || '(none)');
  v.push('');
  const vpatPath = join(OUT_DIR, 'vpat.md');
  writeFileSync(vpatPath, `${v.join('\n')}\n`, 'utf8');
  console.log(`gen-acr: wrote ${vpatPath}`);
}

if (onDisk.length !== registry.length) {
  console.log(
    `\nnote: ${onDisk.length} showcase file(s) on disk vs ${registry.length} registry entry/entries — ` +
      'an unregistered showcase is invisible to the sidebar, the visual gate, the axe gate and this report.',
  );
}
