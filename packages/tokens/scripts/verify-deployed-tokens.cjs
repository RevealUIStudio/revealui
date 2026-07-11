/*
 * verify-deployed-tokens.cjs — post-deploy design-system verification.
 * ──────────────────────────────────────────────────────────────────
 * Where adherence-lint.cjs guards the SOURCE that consumes tokens, and the
 * @revealui/tokens contract test guards the CANONICAL token VALUES, this
 * guards the DEPLOYED ARTIFACT: it fetches production CSS and proves the
 * design system actually survived the build + CDN + CSP round-trip.
 *
 * It catches the class of drift static checks miss. Concrete case (2026-07):
 * www.revealui.com shipped token-correct CSS, but the brand fonts never
 * loaded — the CSP blocked the Google Fonts <link>, and the self-hosted
 * fontsource families are named "Inter Variable" while the token stacks said
 * 'Inter', so nothing resolved. Token parity passed; the page rendered in
 * system-ui. This script's font-resolvability check fails on exactly that.
 *
 * CommonJS (.cjs), dependency-free (Node 24 global fetch). Run in CI:
 *
 *   node packages/tokens/scripts/verify-deployed-tokens.cjs \
 *     --url https://www.revealui.com --url https://docs.revealui.com
 *
 * Flags:
 *   --url <u>          deployed URL to verify (repeatable, required)
 *   --tokens <path>    canonical tokens.css (default: ../src/tokens.css)
 *   --allowlist <path> extra-value allowlist JSON
 *                      (default: ./verify-deployed-tokens.allowlist.json)
 *   --json             machine-readable report
 *
 * Exit 0 when every URL passes; exit 1 with a per-failure report otherwise.
 *
 * Two checks per URL:
 *   1. TOKEN PARITY — every canonical --rvui-* token is present in the
 *      deployed CSS with a numerically-identical value (minifier formatting
 *      normalized away). A deployed token may carry EXTRA values only when
 *      allowlisted for that host (e.g. an app-level font override).
 *   2. FONT RESOLVABILITY — each --rvui-font-* token has at least one stack
 *      whose leading (non-generic) family is registered by an @font-face in
 *      the deployed CSS, OR is loadable given the live CSP response header.
 *      A font token where NO stack resolves fails. This is checked at the
 *      TOKEN level (at least one declared stack must resolve) because CSS
 *      cascade means only the effective value renders — an app override that
 *      redeclares --rvui-font-sans leaves the canonical stack in the bundle
 *      but it never paints, so flagging it would be a false positive.
 */

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/* ── value normalization ──────────────────────────────────────────────
 * Minifiers rewrite oklch(0.58 0.150 240) → oklch(58% .15 240), 120ms → .12s,
 * drop leading zeros, and swap quote styles. Normalize all of that so a
 * numeric/semantic comparison is quote- and formatting-insensitive. Regex is
 * the pragmatic tool for positional numeric canonicalization here and matches
 * the established style of the sibling adherence-lint.cjs script. */
function normalizeValue(value) {
  // regex-ok: CSS value canonicalization needs positional numeric rewriting;
  // a hand-rolled tokenizer would be strictly worse here.
  let v = String(value)
    .trim()
    .replace(/"/g, "'") // unify quote style
    .replace(/oklch\(\s*([\d.]+)%/g, (_, p) => `oklch(${parseFloat(p) / 100}`) // % lightness → decimal
    .replace(/([\d.]+)ms\b/g, (_, n) => `${parseFloat(n) / 1000}s`) // ms → s
    .replace(/\s*\/\s*/g, '/')
    .replace(/,\s*/g, ',')
    .replace(/\s+/g, ' ');
  // canonicalize every number: .12 → 0.12, 0.150 → 0.15, 1.000 → 1
  v = v.replace(/(^|[\s(,/])(-?\.?\d+(?:\.\d+)?)/g, (_, pre, n) => pre + String(parseFloat(n)));
  return v;
}

/* ── declaration extraction ───────────────────────────────────────────
 * Parse every --rvui-* custom-property declaration into
 * Map<name, Set<normalizedValue>> (a token is declared once per theme scope,
 * so a Set collapses duplicate identical values while preserving distinct
 * dark/light/override values). Comments are stripped first. */
function stripComments(css) {
  // regex-ok: CSS comment stripping; no nested comments in CSS.
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractTokenDecls(css) {
  const clean = stripComments(css);
  const map = new Map();
  // regex-ok: custom-property declaration scan over already-comment-stripped CSS.
  const re = /(--rvui-[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const name = m[1];
    const value = normalizeValue(m[2]);
    if (!value) continue;
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(value);
  }
  return map;
}

// Ordered list of each font token's declared stacks (raw + normalized),
// preserving source order so "effective value" reasoning is possible.
function extractFontDecls(css) {
  const clean = stripComments(css);
  const map = new Map();
  // regex-ok: font custom-property scan over comment-stripped CSS.
  const re = /(--rvui-font-[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const name = m[1];
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(m[2].trim());
  }
  return map;
}

// Family names registered by @font-face rules, lowercased.
function extractFontFaceFamilies(css) {
  const clean = stripComments(css);
  const families = new Set();
  // regex-ok: locate @font-face blocks, then their font-family descriptor.
  const blockRe = /@font-face\s*\{([^}]*)\}/gi;
  let block;
  while ((block = blockRe.exec(clean)) !== null) {
    const body = block[1];
    const fam = /font-family\s*:\s*([^;]+)/i.exec(body);
    if (!fam) continue;
    families.add(stripQuotes(fam[1].trim()).toLowerCase());
  }
  return families;
}

function stripQuotes(s) {
  const t = s.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  return t;
}

const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
  'inherit',
  'initial',
  'unset',
  'revert',
]);

// The leading, non-generic families of a font stack (the brand faces).
function namedFamilies(stack) {
  return stack
    .split(',')
    .map((part) => stripQuotes(part))
    .filter((fam) => fam.length > 0 && !GENERIC_FAMILIES.has(fam.toLowerCase()));
}

/* ── CSP ──────────────────────────────────────────────────────────────
 * A missing header counts as permitted (no policy = nothing blocked). */
function parseCsp(header) {
  if (!header) return null;
  const directives = new Map();
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const bits = trimmed.split(/\s+/);
    const name = bits.shift().toLowerCase();
    directives.set(name, bits);
  }
  return directives;
}

function hostMatchesSource(host, src) {
  let s = src.replace(/^https?:\/\//i, '');
  const slash = s.indexOf('/');
  if (slash !== -1) s = s.slice(0, slash);
  if (!s || s.startsWith("'")) return false; // keyword sources ('self', 'unsafe-inline', ...)
  if (s === host) return true;
  if (s.startsWith('*.')) return host.endsWith(s.slice(1)); // "*.gstatic.com" → ".gstatic.com"
  return false;
}

// Does the live CSP permit loading a `kind` resource from `host`?
function cspAllows(csp, host, kind) {
  if (!csp) return true;
  const directive = kind === 'font' ? 'font-src' : 'style-src';
  let sources = csp.get(directive);
  if (!sources) sources = csp.get('default-src');
  if (!sources) return true; // no applicable directive, no default → allow all
  if (sources.includes("'none'")) return false;
  for (const src of sources) {
    if (src === '*') return true;
    if (hostMatchesSource(host, src)) return true;
  }
  return false;
}

/* ── token parity ─────────────────────────────────────────────────────
 * allowlist: Map<tokenName, Set<normalizedValue>> of extra values permitted
 * for THIS host. Returns { missing: [...], extra: [...] } failures. */
function compareTokens(canonical, deployed, allowlist) {
  const missing = [];
  const extra = [];
  for (const [name, canonValues] of canonical) {
    const deployedValues = deployed.get(name);
    if (!deployedValues) {
      missing.push({ token: name, reason: 'absent from deployed CSS', expected: [...canonValues] });
      continue;
    }
    for (const cv of canonValues) {
      if (!deployedValues.has(cv)) {
        missing.push({ token: name, reason: 'canonical value not found', expected: cv, deployed: [...deployedValues] });
      }
    }
    const allowed = allowlist.get(name) || new Set();
    for (const dv of deployedValues) {
      if (!canonValues.has(dv) && !allowed.has(dv)) {
        extra.push({ token: name, value: dv, hint: 'add to allowlist if this is an intentional app override' });
      }
    }
  }
  return { missing, extra };
}

/* ── font resolvability ───────────────────────────────────────────────
 * fontDecls: Map<name, [rawStack, ...]>. A token passes when AT LEAST ONE of
 * its stacks resolves. externalFontRefs: [{ host, kind }] the page pulls fonts
 * or stylesheets from. Returns per-token failures for tokens where NO stack
 * resolves. */
function checkFontResolvability(fontDecls, fontFaceFamilies, csp, externalFontRefs) {
  const cspPermitsExternal = externalFontRefs.some((ref) => cspAllows(csp, ref.host, ref.kind));
  const failures = [];
  for (const [name, stacks] of fontDecls) {
    const stackReports = [];
    let anyResolved = false;
    for (const stack of stacks) {
      const families = namedFamilies(stack);
      const viaFontFace = families.filter((f) => fontFaceFamilies.has(f.toLowerCase()));
      const resolved = viaFontFace.length > 0 || cspPermitsExternal;
      if (resolved) anyResolved = true;
      stackReports.push({
        stack,
        families,
        registeredByFontFace: viaFontFace,
        resolvedByCsp: viaFontFace.length === 0 && cspPermitsExternal,
        resolved,
      });
    }
    if (!anyResolved) {
      failures.push({ token: name, stacks: stackReports, fontFaceRegistered: [...fontFaceFamilies] });
    }
  }
  return failures;
}

/* ── HTML / CSS discovery ─────────────────────────────────────────────── */
function discoverFromHtml(html, pageUrl) {
  const pageOrigin = new URL(pageUrl).origin;
  const cssLinks = [];
  const externalFontRefs = [];
  const inlineStyles = [];

  // regex-ok: <link> tag scan; the deployed HTML is a bundler-emitted document.
  const linkRe = /<link\b([^>]*)>/gi;
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    const attrs = lm[1];
    const rel = (attr(attrs, 'rel') || '').toLowerCase().split(/\s+/);
    const href = attr(attrs, 'href');
    if (!href) continue;
    let abs;
    try {
      abs = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (rel.includes('stylesheet')) {
      if (abs.origin === pageOrigin) cssLinks.push(abs.href);
      else externalFontRefs.push({ host: abs.hostname, kind: 'style' });
    } else if (rel.includes('preload') && (attr(attrs, 'as') || '').toLowerCase() === 'font') {
      if (abs.origin !== pageOrigin) externalFontRefs.push({ host: abs.hostname, kind: 'font' });
    }
  }

  // regex-ok: inline <style> block extraction.
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRe.exec(html)) !== null) inlineStyles.push(sm[1]);

  return { cssLinks, externalFontRefs, inlineStyles, pageOrigin };
}

function attr(attrs, name) {
  // regex-ok: single attribute value read from an already-isolated tag string.
  const re = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(attrs);
  if (!m) return null;
  return m[2] !== undefined ? m[2] : m[3];
}

function discoverCssImports(css, cssUrl, pageOrigin) {
  const sameOrigin = [];
  const external = [];
  // regex-ok: @import url(...) / @import "..." scan.
  const re = /@import\s+(?:url\(\s*)?["']?([^"')\s]+)["']?\s*\)?/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    let abs;
    try {
      abs = new URL(m[1], cssUrl);
    } catch {
      continue;
    }
    if (abs.origin === pageOrigin) sameOrigin.push(abs.href);
    else external.push({ host: abs.hostname, kind: 'style' });
  }
  return { sameOrigin, external };
}

async function fetchDeployed(pageUrl) {
  const res = await fetch(pageUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${pageUrl} → HTTP ${res.status}`);
  const html = await res.text();
  const csp = parseCsp(res.headers.get('content-security-policy'));
  const { cssLinks, externalFontRefs, inlineStyles, pageOrigin } = discoverFromHtml(html, pageUrl);

  const cssParts = [...inlineStyles];
  const seen = new Set();
  const queue = [...cssLinks];
  while (queue.length > 0) {
    const cssUrl = queue.shift();
    if (seen.has(cssUrl)) continue;
    seen.add(cssUrl);
    let cssText;
    try {
      const cr = await fetch(cssUrl, { redirect: 'follow' });
      if (!cr.ok) continue;
      cssText = await cr.text();
    } catch {
      continue;
    }
    cssParts.push(cssText);
    const imports = discoverCssImports(cssText, cssUrl, pageOrigin);
    for (const u of imports.sameOrigin) if (!seen.has(u)) queue.push(u);
    for (const ext of imports.external) externalFontRefs.push(ext);
  }

  return { css: cssParts.join('\n'), csp, externalFontRefs, cssBundleCount: seen.size };
}

/* ── allowlist loading ────────────────────────────────────────────────
 * Shape: { "overrides": { "<host>": { "--rvui-token": ["raw value", ...] } } }
 * Values are normalized on load so they compare against normalized deployed
 * values. */
function loadAllowlist(path, host) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return new Map();
  }
  const forHost = (raw.overrides && raw.overrides[host]) || {};
  const map = new Map();
  for (const [token, values] of Object.entries(forHost)) {
    map.set(token, new Set(values.map(normalizeValue)));
  }
  return map;
}

/* ── per-URL verification ─────────────────────────────────────────────── */
async function verifyUrl(pageUrl, canonicalTokens, canonicalFontNames, allowlistPath) {
  const host = new URL(pageUrl).hostname;
  const { css, csp, externalFontRefs, cssBundleCount } = await fetchDeployed(pageUrl);
  const deployedTokens = extractTokenDecls(css);
  const deployedFonts = extractFontDecls(css);
  const fontFaceFamilies = extractFontFaceFamilies(css);
  const allowlist = loadAllowlist(allowlistPath, host);

  const parity = compareTokens(canonicalTokens, deployedTokens, allowlist);
  const fontFailures = checkFontResolvability(deployedFonts, fontFaceFamilies, csp, externalFontRefs);

  // Only assert resolvability on canonical font tokens (ignore any app-only ones).
  const relevantFontFailures = fontFailures.filter((f) => canonicalFontNames.has(f.token));

  const ok = parity.missing.length === 0 && parity.extra.length === 0 && relevantFontFailures.length === 0;
  return {
    url: pageUrl,
    ok,
    cssBundleCount,
    hasCsp: csp !== null,
    externalFontRefs,
    parity,
    fontFailures: relevantFontFailures,
  };
}

/* ── CLI ──────────────────────────────────────────────────────────────── */
function parseArgs(argv) {
  const urls = [];
  let tokens = join(__dirname, '..', 'src', 'tokens.css');
  let allowlist = join(__dirname, 'verify-deployed-tokens.allowlist.json');
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') urls.push(argv[++i]);
    else if (a === '--tokens') tokens = argv[++i];
    else if (a === '--allowlist') allowlist = argv[++i];
    else if (a === '--json') json = true;
  }
  return { urls, tokens, allowlist, json };
}

function reportHuman(results) {
  for (const r of results) {
    if (r.ok) {
      console.log(`✓ ${r.url} — ${r.parityCount} tokens verified, fonts resolvable (${r.cssBundleCount} CSS bundle(s), CSP ${r.hasCsp ? 'present' : 'absent'})`);
      continue;
    }
    console.error(`\n✗ ${r.url} — design-system verification FAILED`);
    for (const m of r.parity.missing) {
      console.error(`  MISSING token ${m.token}: ${m.reason}`);
      console.error(`    expected: ${Array.isArray(m.expected) ? m.expected.join(' | ') : m.expected}`);
      if (m.deployed) console.error(`    deployed: ${m.deployed.join(' | ')}`);
    }
    for (const e of r.parity.extra) {
      console.error(`  EXTRA value on ${e.token}: ${e.value}`);
      console.error(`    ${e.hint}`);
    }
    for (const f of r.fontFailures) {
      console.error(`  FONT ${f.token} — no stack resolves:`);
      for (const s of f.stacks) {
        console.error(`    stack: ${s.stack}`);
        console.error(`      families: ${s.families.join(', ') || '(none)'}`);
      }
      console.error(`    @font-face registers: ${f.fontFaceRegistered.join(', ') || '(none)'}`);
    }
  }
}

async function main() {
  const { urls, tokens, allowlist, json } = parseArgs(process.argv.slice(2));
  if (urls.length === 0) {
    console.error('error: at least one --url is required');
    process.exit(2);
  }

  let canonicalCss;
  try {
    canonicalCss = readFileSync(tokens, 'utf8');
  } catch {
    console.error(`error: cannot read canonical tokens.css at ${tokens}`);
    process.exit(2);
  }
  const canonicalTokens = extractTokenDecls(canonicalCss);
  const canonicalFontNames = new Set([...extractFontDecls(canonicalCss).keys()]);

  const results = [];
  for (const url of urls) {
    try {
      const r = await verifyUrl(url, canonicalTokens, canonicalFontNames, allowlist);
      r.parityCount = canonicalTokens.size;
      results.push(r);
    } catch (err) {
      results.push({ url, ok: false, error: String(err && err.message ? err.message : err), parity: { missing: [], extra: [] }, fontFailures: [] });
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (json) {
    console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  } else {
    for (const r of results) {
      if (r.error) console.error(`\n✗ ${r.url} — ${r.error}`);
    }
    reportHuman(results.filter((r) => !r.error));
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

module.exports = {
  normalizeValue,
  stripComments,
  extractTokenDecls,
  extractFontDecls,
  extractFontFaceFamilies,
  stripQuotes,
  namedFamilies,
  parseCsp,
  hostMatchesSource,
  cspAllows,
  compareTokens,
  checkFontResolvability,
  discoverFromHtml,
  discoverCssImports,
  loadAllowlist,
};

if (require.main === module) {
  main();
}
