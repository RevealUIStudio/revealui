/*
 * token-drift-gate.cjs — keeps the design-system token mirror honest.
 * ──────────────────────────────────────────────────────────────────
 * CommonJS (.cjs) so the in-browser DS bundler ignores it; it is a Node CLI,
 * not part of the runtime bundle. Dependency-free. Run in CI and pre-commit,
 * alongside check_design_system:
 *
 *     node scripts/token-drift-gate.cjs
 *     node scripts/token-drift-gate.cjs --writesourcepin  # after a deliberate re-mirror
 *
 * It asserts four things about @revealui/presentation/design-context/tokens.css
 * (or RVUI_TOKENS_SRC when set):
 *   1. MANIFEST PIN  — sha of the source file matches @revealui/presentation's
 *                      MANIFEST.sha256 (internal-consistency check; skipped when
 *                      @revealui/presentation is not installed or RVUI_TOKENS_SRC
 *                      is set).
 *   2. MIRROR PIN    — the file's digest matches reference/MIRROR.sha256 so any
 *                      tokens.css update in the published package fails CI until
 *                      a reviewer bumps the pin (mirror-of-mirror protection).
 *   3. VALUE PINS    — the canonical cobalt brand values are present (the 0.46
 *                      dark-brand regression that shipped for a month would fail).
 *   4. CONTRAST      — every text/brand-on-surface pairing clears WCAG AA (4.5:1),
 *                      using the same OKLab→luminance math as the codebase contract
 *                      test (packages/presentation/src/__tests__/tokens.contract.test.ts).
 *
 * Source resolution (first that works wins):
 *   RVUI_TOKENS_SRC  — absolute path to a tokens.css (monorepo source override)
 *   @revealui/presentation/design-context/tokens.css — require.resolve from the
 *                      installed workspace/npm package
 *
 * Run `node scripts/token-drift-gate.cjs --writesourcepin` (with or without
 * RVUI_TOKENS_SRC) to adopt the current source digest as the new MIRROR.sha256 pin.
 *
 * Why this exists: the failing 0.46 dark brand shipped in this mirror for a month
 * because nothing checked it. This is that check. See "Spec · Token Drift Gate.html".
 */
const { readFileSync, writeFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const MIRROR_PIN = join(ROOT, 'reference', 'MIRROR.sha256');

/* ── Resolve the source tokens file ──────────────────────────────── */
let manifestPath = null;
let tokensPath = null;
try {
  manifestPath = require.resolve('@revealui/presentation/design-context/MANIFEST.sha256');
  tokensPath   = require.resolve('@revealui/presentation/design-context/tokens.css');
} catch {
  // @revealui/presentation not installed — RVUI_TOKENS_SRC must be set
}

const src = process.env.RVUI_TOKENS_SRC ?? tokensPath;
if (!src) {
  console.error(
    'error: could not find token source.\n' +
    '  Install @revealui/presentation or set RVUI_TOKENS_SRC to the tokens.css path.',
  );
  process.exit(1);
}

const css = readFileSync(src, 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');

/* ── --writesourcepin: adopt the current source digest as the pin ── */
if (process.argv.includes('--writesourcepin')) {
  const d = sha(css);
  writeFileSync(MIRROR_PIN, `${d}  tokens.css\n`);
  console.log(`wrote reference/MIRROR.sha256 = ${d}`);
  process.exit(0);
}

const fails = [];
const fail = (m) => fails.push(m);

/* ── 1 · MANIFEST PIN (published-package internal consistency) ───── */
// Only when using the published package (not a RVUI_TOKENS_SRC override).
if (manifestPath && !process.env.RVUI_TOKENS_SRC) {
  try {
    const entry = readFileSync(manifestPath, 'utf8').trim();
    const firstSpace = entry.indexOf(' ');
    const pinned = firstSpace === -1 ? entry : entry.slice(0, firstSpace);
    const actual = sha(css);
    if (pinned !== actual) {
      fail(
        `@revealui/presentation internal inconsistency\n` +
          `      MANIFEST.sha256 = ${pinned}\n      tokens.css digest = ${actual}`,
      );
    }
  } catch (e) {
    fail(`could not read MANIFEST.sha256: ${e.message}`);
  }
}

/* ── 2 · MIRROR PIN ───────────────────────────────────────────────── */
try {
  const entry = readFileSync(MIRROR_PIN, 'utf8').trim();
  const firstSpace = entry.indexOf(' ');
  const pin = firstSpace === -1 ? entry : entry.slice(0, firstSpace);
  const actual = sha(css);
  if (pin && pin !== actual) {
    fail(
      `tokens.css changed since last pin — bump reference/MIRROR.sha256\n` +
        `      pinned ${pin}\n      actual ${actual}\n` +
        `      → run: node scripts/token-drift-gate.cjs --writesourcepin`,
    );
  }
} catch {
  /* no pin yet — first run; use --writesourcepin to create it */
}

/* ── token lookup (per-theme block) ───────────────────────────────── */
// Split on the rule selector specifically (selector + " {"); the bare string
// "[data-theme=\"light\"]" also appears in header/precedence/NOTE comments.
const lightIdx = css.indexOf('[data-theme="light"] {');
const darkPart = css.slice(0, lightIdx);   // invariant :root + dark semantic block
const lightPart = css.slice(lightIdx);     // light semantic block
const val = (block, name) => {
  const key = `--rvui-${name}:`;
  const i = block.lastIndexOf(key);
  if (i === -1) return null;
  const start = i + key.length;
  return block.slice(start, block.indexOf(';', start)).trim();
};

/* ── 3 · VALUE PINS ───────────────────────────────────────────────── */
const pinVal = (block, name, expected, label) => {
  const got = val(block, name);
  if (got !== expected) fail(`${label}: --rvui-${name} = ${got ?? '(absent)'} — expected ${expected}`);
};
pinVal(darkPart, 'brand', 'oklch(0.58 0.150 240)', 'dark brand (WCAG AA lift)');
pinVal(lightPart, 'brand', 'oklch(0.36 0.190 240)', 'light brand');
for (const n of ['warning-text', 'surface-0', 'text-0', 'text-1', 'text-2']) {
  if (val(darkPart, n) === null) fail(`dark canon missing --rvui-${n}`);
  if (val(lightPart, n) === null) fail(`light canon missing --rvui-${n}`);
}

/* ── 4 · CONTRAST CONTRACT — OKLab → WCAG relative luminance ───────── */
/*    Verbatim from packages/presentation/src/__tests__/tokens.contract.test.ts */
function parseOklch(v) {
  const o = v.indexOf('('), c = v.lastIndexOf(')');
  if (o === -1 || c === -1) throw new Error(`not oklch(): ${v}`);
  const inner = v.slice(o + 1, c);
  if (inner.includes('/')) throw new Error(`value carries alpha: ${v}`);
  const p = inner.split(' ').filter(Boolean).map(Number);
  if (p.length !== 3 || p.some(Number.isNaN)) throw new Error(`bad oklch: ${v}`);
  return { L: p[0], C: p[1], h: p[2] };
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function relativeLuminance(v) {
  const { L, C, h } = parseOklch(v);
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * bl;
}
const contrast = (fg, bg) => {
  const a = relativeLuminance(fg), b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

const AA = 4.5;
const pair = (block, fg, bg, label) => {
  const f = val(block, fg), b = val(block, bg);
  if (!f || !b) return fail(`${label}: missing token(s)`);
  let r;
  try { r = contrast(f, b); } catch (e) { return fail(`${label}: ${e.message}`); }
  if (r < AA) fail(`${label} = ${r.toFixed(2)}:1 (needs ${AA}:1)`);
};

// dark mode — body text, muted text, brand-as-text, CTA labels on layered surfaces
for (const [f, b] of [
  ['text-0', 'surface-0'], ['text-0', 'surface-1'], ['text-0', 'surface-2'],
  ['text-1', 'surface-0'], ['text-1', 'surface-1'],
  ['text-2', 'surface-0'], ['text-2', 'surface-1'],
  ['warning-text', 'surface-0'], ['brand', 'surface-0'],
  // dark CTA label promoted from warn-only: 2026-06-14 ink swap clears AA (~4.69:1)
  ['text-on-brand', 'brand'],
]) pair(darkPart, f, b, `dark ${f} on ${b}`);

// light mode
for (const [f, b] of [
  ['text-0', 'surface-0'], ['text-0', 'surface-1'],
  ['text-1', 'surface-0'], ['text-1', 'surface-1'],
  ['text-2', 'surface-0'], ['text-2', 'surface-1'],
  ['warning-text', 'surface-0'], ['brand', 'surface-0'],
  ['text-on-brand', 'brand'],
]) pair(lightPart, f, b, `light ${f} on ${b}`);

/* ── report ───────────────────────────────────────────────────────── */
if (fails.length) {
  console.error(`\n✗ token drift gate — ${fails.length} failure(s):\n`);
  for (const f of fails) console.error('  • ' + f);
  console.error('');
  process.exit(1);
}
console.log('✓ token drift gate — source in sync: MANIFEST + MIRROR pin + value pins + WCAG AA contrast');
