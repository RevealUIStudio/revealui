/*
 * gen-icon-manifest.cjs — enumerate the icon set. Gate 5, medium finding 14.
 * ──────────────────────────────────────────────────────────────────────────
 * There was no answer to "does an icon for X already exist" short of reading a
 * 449-line file — which is how `apps/marketing/app/routes/ProductsPage.tsx` ended
 * up hand-inlining the check-circle path that `IconCheckCircle` already exports.
 *
 * Generates src/icons/MANIFEST.md from the actual exports, and enforces the naming
 * policy in ICONS.md. Dependency-free CommonJS.
 *
 *   node scripts/gen-icon-manifest.cjs
 *   node scripts/gen-icon-manifest.cjs --check    # CI: stale or policy violation → exit 1
 *
 * Parses source rather than importing the built module, so it runs on a bare
 * checkout with no build step. Icons are plain exported functions with a stable
 * shape; a parser is sufficient and has no failure mode a build could avoid.
 *
 * WHAT IT ENFORCES
 *
 *  · general-purpose icons are `Icon` + PascalCase   (IconChevronDown)
 *  · brand marks are PascalCase + `Icon`             (GitHubIcon)
 *  · nothing is named both ways, or neither
 *  · the five brand primitives are present           (currently 4 of 5 MISSING —
 *    see ICONS.md; this check is the tracker, and it warns rather than fails until
 *    they land, because a check nobody can pass gets deleted)
 */
'use strict';

const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const JSON_OUT = args.includes('--json');
const argVal = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : null;
};

const SRC = resolve(argVal('--src') || join(__dirname, '..', 'src'));
const OUT = resolve(argVal('--out') || join(SRC, 'icons', 'MANIFEST.md'));

const SOURCES = [
  { file: join(SRC, 'components', 'icon.tsx'), family: 'ui', label: 'General-purpose UI' },
  { file: join(SRC, 'icons', 'providers.tsx'), family: 'brand', label: 'Provider / social / passkey' },
];

/* ── categories, taken from the section comments in icon.tsx ───────────── */
const CATEGORY_OF = {
  ChevronDown: 'Navigation', ChevronUp: 'Navigation', ChevronLeft: 'Navigation', ChevronRight: 'Navigation',
  ArrowLeft: 'Navigation', ArrowRight: 'Navigation', Close: 'Navigation', Menu: 'Navigation',
  Search: 'Navigation', Plus: 'Navigation', Minus: 'Navigation', MoreHorizontal: 'Navigation',
  MoreVertical: 'Navigation', ExternalLink: 'Navigation',
  Check: 'Status', CheckCircle: 'Status', AlertCircle: 'Status', AlertTriangle: 'Status',
  Info: 'Status', XCircle: 'Status', Loading: 'Status',
  Copy: 'Actions', Trash: 'Actions', Edit: 'Actions', Download: 'Actions', Upload: 'Actions',
  Filter: 'Actions', Refresh: 'Actions',
  User: 'Identity', Users: 'Identity', LogOut: 'Identity', Settings: 'Identity',
  Lock: 'Identity', Unlock: 'Identity', Eye: 'Identity', EyeOff: 'Identity',
  Sun: 'Theme', Moon: 'Theme', Monitor: 'Theme',
  Code: 'Product', Terminal: 'Product', Globe: 'Product', Heart: 'Product', Star: 'Product',
  PrimitivePeople: 'Brand primitives', PrimitiveContent: 'Brand primitives',
  PrimitiveOffers: 'Brand primitives', PrimitivePayments: 'Brand primitives',
  PrimitiveAgents: 'Brand primitives',
};

/**
 * The five semantic brand icons the marketing site is built around.
 *
 * Labels are the SHIPPED ones from apps/marketing/app/content/primitives.ts, not
 * README's (which still says Users / Products / Intelligence). The code is the truth;
 * an export named for a label no surface uses is worse than the documented drift.
 *
 * Their path data already exists in that same content file as `iconPath` strings, so
 * landing these is a move-and-import, not a design task. See ICONS.md.
 */
const PRIMITIVES = [
  { name: 'IconPrimitivePeople', primitive: 'People', accent: 'brand (cobalt)' },
  { name: 'IconPrimitiveContent', primitive: 'Content', accent: 'blue' },
  { name: 'IconPrimitiveOffers', primitive: 'Offers', accent: 'amber' },
  { name: 'IconPrimitivePayments', primitive: 'Payments', accent: 'cyan' },
  { name: 'IconPrimitiveAgents', primitive: 'Agents', accent: 'violet' },
];

/* ── collect ───────────────────────────────────────────────────────────── */

const icons = [];
const violations = [];

for (const { file, family, label } of SOURCES) {
  if (!existsSync(file)) {
    console.error(`::error::gen-icon-manifest: ${file} not found`);
    process.exit(1);
  }
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/^export function ([A-Za-z0-9]+)\s*\(/gm)) {
    const name = m[1];
    if (name === 'IconBase' || name === 'BaseIcon') continue;

    const isUi = /^Icon[A-Z]/.test(name);
    const isBrand = /Icon$/.test(name) && !isUi;

    if (family === 'ui' && !isUi) {
      violations.push({ name, file, why: 'general-purpose icons must be `Icon` + PascalCase (ICONS.md)' });
    }
    if (family === 'brand' && !isBrand) {
      violations.push({ name, file, why: 'brand marks must be PascalCase + `Icon` suffix (ICONS.md)' });
    }
    if (isUi && isBrand) {
      violations.push({ name, file, why: 'named both ways — pick one family' });
    }

    const concept = isUi ? name.slice(4) : name.replace(/Icon$/, '');
    icons.push({ name, concept, family, label, category: family === 'brand' ? 'Brand mark' : (CATEGORY_OF[concept] ?? 'Uncategorised') });
  }
}

const byName = new Set(icons.map((i) => i.name));
const missingPrimitives = PRIMITIVES.filter((p) => !byName.has(p.name));

/* ── report / emit ─────────────────────────────────────────────────────── */

if (JSON_OUT) {
  console.log(JSON.stringify({ total: icons.length, icons, violations, missingPrimitives }, null, 2));
  process.exit(violations.length > 0 ? 1 : 0);
}

const ui = icons.filter((i) => i.family === 'ui');
const brand = icons.filter((i) => i.family === 'brand');

const byCategory = new Map();
for (const i of ui) {
  if (!byCategory.has(i.category)) byCategory.set(i.category, []);
  byCategory.get(i.category).push(i);
}
const CATEGORY_ORDER = [
  'Navigation',
  'Status',
  'Actions',
  'Identity',
  'Theme',
  'Product',
  'Brand primitives',
  'Uncategorised',
];

const lines = [];
lines.push('<!-- GENERATED by scripts/gen-icon-manifest.cjs — do not edit by hand. -->');
lines.push('<!-- Regenerate: node scripts/gen-icon-manifest.cjs -->');
lines.push('');
lines.push('# Icon manifest');
lines.push('');
lines.push(`**${icons.length} icons** — ${ui.length} general-purpose, ${brand.length} brand marks.`);
lines.push('');
lines.push('Before adding an icon, search this file. A hand-inlined duplicate of a shipped');
lines.push('glyph is the specific mistake this manifest exists to prevent.');
lines.push('');
lines.push('Naming policy and the rules for adding one: `remediation/gate-5/ICONS.md`.');
lines.push('');

for (const cat of CATEGORY_ORDER) {
  const group = byCategory.get(cat);
  if (!group || group.length === 0) continue;
  lines.push(`## ${cat} (${group.length})`);
  lines.push('');
  lines.push(group.map((i) => `\`${i.name}\``).join(' · '));
  lines.push('');
}

lines.push(`## Brand marks (${brand.length})`);
lines.push('');
lines.push(brand.map((i) => `\`${i.name}\``).join(' · '));
lines.push('');
lines.push('Vendor geometry, not restyleable. `currentColor` so an OAuth row reads as one');
lines.push('family; `aria-hidden` because the parent button carries the label.');
lines.push('');

if (missingPrimitives.length > 0) {
  lines.push('## Missing — the brand primitive icons');
  lines.push('');
  lines.push(`${missingPrimitives.length} of the 5 semantic primitive icons are **not exports of this package.**`);
  lines.push('README calls them "the visual backbone of the marketing site" — hero background,');
  lines.push('Primitives grid, meta links, footer.');
  lines.push('');
  lines.push('The artwork is not missing: all five exist as `iconPath` strings in');
  lines.push('`apps/marketing/app/content/primitives.ts`, interpolated into an SVG by');
  lines.push('`landing/Primitives.tsx`. Landing them is a **move-and-import, not a design task.**');
  lines.push('');
  lines.push('| Expected export | Primitive | Accent |');
  lines.push('|---|---|---|');
  for (const p of missingPrimitives) lines.push(`| \`${p.name}\` | ${p.primitive} | ${p.accent} |`);
  lines.push('');
  lines.push('This — not thirty more general-purpose glyphs — is the icon work. The set is');
  lines.push("already 15 icons past `Spec · Visual Dimensions`' 35-icon target; that target is");
  lines.push('stale, and the gap is these five.');
  lines.push('');
}

if (CHECK) {
  let failed = false;

  if (violations.length > 0) {
    console.error(`\n::error::gen-icon-manifest: ${violations.length} naming violation(s)\n`);
    for (const v of violations) console.error(`  ${v.name} — ${v.why}`);
    failed = true;
  }

  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== `${lines.join('\n')}\n`) {
    console.error('\n::error::gen-icon-manifest: MANIFEST.md is stale. Run: node scripts/gen-icon-manifest.cjs');
    failed = true;
  }

  if (missingPrimitives.length > 0) {
    // Warn, not fail: a check nobody can pass yet gets deleted rather than fixed.
    console.log(`\n::warning::${missingPrimitives.length} of 5 brand primitive icons missing: ${missingPrimitives.map((p) => p.name).join(', ')}`);
  }

  if (failed) process.exit(1);
  console.log(`gen-icon-manifest: in sync (${icons.length} icons, naming clean)`);
  process.exit(0);
}

writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
console.log(`gen-icon-manifest: wrote ${OUT}`);
console.log(`  ${icons.length} icons — ${ui.length} general-purpose, ${brand.length} brand marks`);
for (const cat of CATEGORY_ORDER) {
  const n = byCategory.get(cat)?.length;
  if (n) console.log(`    ${cat}: ${n}`);
}
if (violations.length > 0) {
  console.log(`\n  ${violations.length} naming violation(s):`);
  for (const v of violations) console.log(`    ${v.name} — ${v.why}`);
}
if (missingPrimitives.length > 0) {
  console.log(`\n  missing brand primitives (${missingPrimitives.length}/5): ${missingPrimitives.map((p) => p.name).join(', ')}`);
  console.log('  Path data already exists in apps/marketing/app/content/primitives.ts —');
  console.log('  this is a move-and-import, not a design task. See ICONS.md.');
}
