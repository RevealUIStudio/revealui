/*
 * gen-dtcg.cjs — emit the W3C DTCG token export from tokens.css.
 * ──────────────────────────────────────────────────────────────────────────
 * Gate 4 of `Assessment · Enterprise Readiness.html`, high finding 10: tokens
 * shipped as CSS and typed TS and nothing a design tool can read, so any
 * designer — internal or licensee — rebuilt the palette by hand from a
 * stylesheet. An enterprise design org treats "no Figma library" as "no design
 * system," however good the code is.
 *
 * This is the feed the Figma library is BUILT FROM, not a second copy of it.
 * That distinction is the whole point: a hand-drawn Figma file drifts within a
 * sprint, a generated one cannot.
 *
 * Install alongside the existing pack generator so one command emits both:
 *
 *   packages/tokens/scripts/gen-dtcg.cjs
 *
 *   "gen:dtcg":       "node scripts/gen-dtcg.cjs",
 *   "gen:dtcg:check": "node scripts/gen-dtcg.cjs --check",
 *   "gen:manifest":   "node scripts/gen-manifest.cjs && node scripts/gen-dtcg.cjs",
 *
 * Wiring it into gen:manifest means the existing SHA drift gate
 * (gen:manifest:check, already hard-failing in ds.yml) covers the DTCG export
 * too — edit tokens.css without regenerating and CI stops you. No new gate to
 * maintain.
 *
 * Dependency-free CommonJS, matching the other scripts in this directory.
 *
 *   node scripts/gen-dtcg.cjs                    → src/tokens.dtcg.json
 *   node scripts/gen-dtcg.cjs --check            → exit 1 if stale
 *   node scripts/gen-dtcg.cjs --in <css> --out <json>
 *
 * DESIGN DECISIONS, so the next person doesn't relitigate them:
 *
 * · Dark-first. `$value` carries the dark-mode value because dark is the bare
 *   `:root` default in tokens.css. Light overrides go in
 *   `$extensions["com.revealui.theme"].light`. DTCG has no native theming; the
 *   $extensions convention is what Tokens Studio and the Figma Variables
 *   importers read, and it keeps one tree instead of two divergent ones.
 *
 * · `var(--rvui-x)` becomes a DTCG alias `{group.path}` when it points at a
 *   token we emit — so `--rvui-info: var(--rvui-brand)` exports as a real
 *   reference and a design tool shows one variable, not two colours that
 *   happen to match today.
 *
 * · Multi-layer shadows stay raw CSS strings, flagged
 *   `$extensions["com.revealui.format"] = "css"`. DTCG's composite shadow type
 *   cannot express two layered oklch shadows without loss, and a lossy export
 *   is worse than an honest passthrough.
 *
 * · Comments are stripped BEFORE parsing. The tokens.css header prose mentions
 *   `[data-theme="light"]`, which otherwise flips the scope detector before any
 *   real selector and files every token as a light override. (Found the hard
 *   way.)
 *
 * · Scope is the canon only. Named-palette ladders (`--rvui-cobalt-*`,
 *   `--rvui-paper`, `--rvui-prim-*`) live in the design system's own
 *   styles.css, not in the token package, and are deliberately out.
 */
'use strict';

const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join, resolve } = require('node:path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};

const IN = resolve(argVal('--in') || join(__dirname, '..', 'src', 'tokens.css'));
const OUT = resolve(argVal('--out') || join(__dirname, '..', 'src', 'tokens.dtcg.json'));

/* ── parse ─────────────────────────────────────────────────────────────── */

const source = readFileSync(IN, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

let inLight = false;
const dark = new Map();
const light = new Map();

for (const line of source.split('\n')) {
  if (/\[data-theme="light"\]\s*\{/.test(line)) {
    inLight = true;
    continue;
  }
  const m = line.match(/^\s*(--rvui-[a-z0-9-]+)\s*:\s*([^;]+);/i);
  if (!m) continue;
  (inLight ? light : dark).set(m[1], m[2].trim());
}

/* ── classify ──────────────────────────────────────────────────────────── */

// --rvui-text-* is overloaded: text-0/1/2 and text-on-* are colours, while
// text-xs…text-display are font sizes. This set is the disambiguator.
const FONT_SIZES = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'display']);

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** @returns {[top: string, group: string|null, leaf: string, type: string]|null} */
function classify(name) {
  const k = name.replace('--rvui-', '');
  let m;
  if ((m = k.match(/^(brand|accent)(?:-(.+))?$/))) return ['color', m[1], m[2] || 'base', 'color'];
  if ((m = k.match(/^surface-(\d)$/))) return ['color', 'surface', m[1], 'color'];
  if ((m = k.match(/^text-on-(.+)$/))) return ['color', 'textOn', m[1], 'color'];
  if ((m = k.match(/^text-(\d)$/))) return ['color', 'text', m[1], 'color'];
  if ((m = k.match(/^text-(.+)$/))) return FONT_SIZES.has(m[1]) ? ['fontSize', null, m[1], 'dimension'] : null;
  if ((m = k.match(/^(success|warning|error|info)(?:-(.+))?$/)))
    return ['color', 'status', m[1] + (m[2] ? `-${m[2]}` : ''), 'color'];
  if (k === 'border-width') return ['dimension', 'borderWidth', 'base', 'dimension'];
  if ((m = k.match(/^border(?:-(.+))?$/))) return ['color', 'border', m[1] || 'base', 'color'];
  if ((m = k.match(/^radius-(.+)$/))) return ['dimension', 'radius', m[1], 'dimension'];
  if ((m = k.match(/^space-(.+)$/))) return ['dimension', 'space', m[1], 'dimension'];
  if ((m = k.match(/^leading-(.+)$/))) return ['lineHeight', null, m[1], 'number'];
  if ((m = k.match(/^tracking-(.+)$/))) return ['letterSpacing', null, m[1], 'dimension'];
  if ((m = k.match(/^font-(.+)$/))) return ['fontFamily', null, m[1], 'fontFamily'];
  if ((m = k.match(/^duration-(.+)$/))) return ['duration', null, m[1], 'duration'];
  if (k === 'ease' || k.startsWith('ease-')) return ['easing', null, k === 'ease' ? 'base' : k.slice(5), 'cubicBezier'];
  if ((m = k.match(/^shadow-(.+)$/))) return ['shadow', null, m[1], 'shadow'];
  if ((m = k.match(/^z-(.+)$/))) return ['zIndex', null, m[1], 'number'];
  return null;
}

// Space half-steps keep the hyphen form: "." is the DTCG path separator, so
// space-0-5 must export as `0-5`, never `0.5`.
const leafName = (top, leaf) => (top === 'dimension' ? leaf : camel(leaf));
const pathOf = (c) => [c[0], c[1], leafName(c[0], c[2])].filter(Boolean).join('.');

function coerce(type, value) {
  if (type === 'cubicBezier') {
    const n = value.match(/cubic-bezier\(([^)]+)\)/);
    if (n) return n[1].split(',').map((v) => Number(v.trim()));
  }
  if (type === 'fontFamily') return value.split(',').map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
  if (type === 'number') return Number(value);
  return value;
}

function aliasOrValue(type, value) {
  const ref = value.match(/^var\((--rvui-[a-z0-9-]+)\)$/i);
  if (ref) {
    const rc = classify(ref[1]);
    if (rc) return `{${pathOf(rc)}}`;
  }
  return coerce(type, value);
}

/* ── build ─────────────────────────────────────────────────────────────── */

const tree = {};
const unmapped = [];
let emitted = 0;
let themed = 0;

for (const [name, value] of dark) {
  const c = classify(name);
  if (!c) {
    unmapped.push(name);
    continue;
  }
  const [top, group, leaf, type] = c;
  const node = { $type: type, $value: aliasOrValue(type, value) };

  const lv = light.get(name);
  if (lv !== undefined && lv !== value) {
    node.$extensions = {
      'com.revealui.theme': { dark: node.$value, light: aliasOrValue(type, lv) },
    };
    themed++;
  }
  if (type === 'shadow') {
    node.$extensions = Object.assign(node.$extensions || {}, { 'com.revealui.format': 'css' });
  }

  const path = [top, group, leafName(top, leaf)].filter(Boolean);
  let cur = tree;
  for (const seg of path.slice(0, -1)) cur = cur[seg] = cur[seg] || {};
  cur[path[path.length - 1]] = node;
  emitted++;
}

const lightOnly = [...light.keys()].filter((k) => !dark.has(k));

const doc = {
  $description:
    'RevealUI design tokens — DTCG export. GENERATED from packages/tokens/src/tokens.css by ' +
    'scripts/gen-dtcg.cjs. Do not hand-edit — edit tokens.css and run `pnpm --filter ' +
    '@revealui/tokens gen:dtcg`. Dark-first: $value carries the dark-mode value; light-mode ' +
    'overrides live in $extensions["com.revealui.theme"].light. Multi-layer shadows are carried as ' +
    "raw CSS strings (flagged com.revealui.format: css) because DTCG's composite shadow type " +
    'cannot express layered oklch shadows without loss.',
  ...tree,
};

const json = `${JSON.stringify(doc, null, 2)}\n`;

/* ── emit / check ──────────────────────────────────────────────────────── */

if (unmapped.length > 0) {
  console.error(`::error::gen-dtcg: ${unmapped.length} token(s) matched no group: ${unmapped.join(', ')}`);
  console.error('Add a classify() rule — an unmapped token is a token the design tool never sees.');
  process.exit(1);
}

if (lightOnly.length > 0) {
  console.error(`::error::gen-dtcg: token(s) declared only in the light block: ${lightOnly.join(', ')}`);
  console.error('Every token needs a dark value — dark is the :root default.');
  process.exit(1);
}

if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== json) {
    console.error('::error::gen-dtcg: tokens.dtcg.json is stale.');
    console.error('Run: pnpm --filter @revealui/tokens gen:dtcg');
    process.exit(1);
  }
  console.log(`gen-dtcg: in sync (${emitted} tokens, ${themed} themed)`);
  process.exit(0);
}

writeFileSync(OUT, json, 'utf8');
console.log(`gen-dtcg: wrote ${OUT}`);
console.log(`  ${emitted} tokens · ${themed} with a light-mode override`);
for (const [group, node] of Object.entries(tree)) {
  const count = JSON.stringify(node).match(/"\$type"/g)?.length ?? 0;
  console.log(`  ${group}: ${count}`);
}
