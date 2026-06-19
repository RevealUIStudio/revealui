/*
 * adherence-lint.cjs — keeps consuming surfaces on-system.
 * ──────────────────────────────────────────────────────────────────
 * Where the @revealui/tokens contract test guards the TOKEN VALUES (cobalt
 * pins + WCAG-AA), this guards the CODE THAT CONSUMES them: it scans app /
 * artifact source for the off-system patterns the three visual-drift
 * audits identified, so the fixes can't silently rot back in.
 *
 * CommonJS (.cjs), dependency-free
 * Node CLI. Run in CI and pre-commit:
 *
 *     node packages/tokens/scripts/adherence-lint.cjs <path> [<path> …]
 *     node packages/tokens/scripts/adherence-lint.cjs apps/marketing apps/docs
 *     node packages/tokens/scripts/adherence-lint.cjs --json apps/docs
 *
 * Flags:
 *   --json     machine-readable report
 *   --warn     exit 0 even on findings (report only; for first adoption)
 *   --quiet    suppress the per-file OK lines
 *
 * Each rule cites the audit + the canonical fix. Add an inline
 *   /* adherence-ignore: <rule-id> — <reason> *\/   (or // …, or <!-- … -->)
 * on the SAME line to suppress a deliberate, reviewed exception.
 *
 * Why this exists: the failing greys, the magenta inline code, and the
 * Source Sans 3 docs type all shipped because nothing checked them. The
 * audits are snapshots; this makes them a gate. See:
 *   Assessment · Production Visual Drift.html
 *   Assessment · Docs & Admin Drift.html
 *   Assessment · Dark-Mode Sweep.html  (the hardcoded-grey substitution table)
 */
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative, extname, basename } = require('node:path');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const WARN_ONLY = args.includes('--warn');
const QUIET = args.includes('--quiet');
const targets = args.filter((a) => !a.startsWith('--'));
if (targets.length === 0) targets.push('.');

const SCAN_EXT = new Set(['.css', '.scss', '.tsx', '.ts', '.jsx', '.js', '.html', '.mdx']);
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.next', '.git', 'coverage', '.turbo', 'out']);

/* ── rules ────────────────────────────────────────────────────────────
 * Each: id, severity, test(line) → match|null, why (audit), fix (token).
 * Tests are deliberately conservative — high signal, low false-positive.
 * Color tests run on every scanned file; some (fonts, tracking) too.
 */
const GREY_HEXES = {
  // Dark-Mode Sweep substitution table → token to use instead.
  '#1f2937': 'var(--rvui-text-0) / --mkt-fg', '#0c181e': 'var(--rvui-text-0)', '#0a0e1a': 'var(--rvui-text-0)',
  '#374151': 'var(--mkt-fg-body)', '#4b5563': 'var(--mkt-fg-body)',
  '#6b7280': 'var(--mkt-fg-muted)', '#6b7d96': 'var(--mkt-fg-muted)',
  '#9ca3af': 'var(--mkt-fg-subtle)', '#d1d5db': 'var(--mkt-fg-subtle)',
  '#f9fafb': 'var(--mkt-bg-subtle)', '#f3f4f6': 'var(--mkt-bg-subtle)', '#fafbfc': 'var(--mkt-bg-subtle)',
  '#e5e7eb': 'var(--mkt-border)', '#1a1a2e': 'var(--rvui-midnight)', '#fafafa': 'var(--rvui-surface-0)',
  '#e8eaed': 'var(--rvui-border)', '#5f6368': 'var(--rvui-text-2)',
};

// Specific off-brand colors the audits named.
const NAMED_OFFENDERS = {
  '#d63384': { fix: 'var(--rvui-brand-text) on var(--rvui-surface-2)', why: 'Docs audit D3 — magenta inline-code is a Bootstrap-era default, off-brand and off-token' },
  '#003e7a': { fix: 'var(--rvui-brand) / #003d94 (canonical sRGB)', why: 'pre-Cobalt-v4 brand hex; use the token or the canonical #003d94' },
  '#f0b519': { fix: 'var(--rvui-accent) / #eeb300 (canonical sRGB)', why: 'pre-Cobalt-v4 accent hex; use the token or canonical #eeb300' },
  '#1a5f9b': { fix: 'var(--rvui-brand) (lifted oklch(0.58) dark brand)', why: 'the retired failing dark-brand value' },
};

const rules = [
  {
    id: 'grey-hex',
    severity: 'error',
    why: 'Dark-Mode Sweep — hardcoded Tailwind greys ignore the theme toggle',
    test(line) {
      const m = line.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi);
      if (!m) return null;
      for (const raw of m) {
        const hex = raw.toLowerCase();
        if (GREY_HEXES[hex]) return { found: raw, fix: GREY_HEXES[hex], why: this.why };
      }
      return null;
    },
  },
  {
    id: 'off-token-color',
    severity: 'error',
    why: 'audit-named off-brand color literal',
    test() { return null; }, // handled inline below (needs custom why/fix per hex)
  },
  {
    id: 'non-brand-font',
    severity: 'error',
    why: 'Docs audit D1 — the brand type is Inter (body) + Inter Tight (display)',
    test(line) {
      // only flag font declarations, not prose mentions
      if (!/font-family|--font-sans|--font-display|--font-mono/i.test(line)) return null;
      const m = line.match(/\b(Source Sans 3|Source Sans Pro|Mona Sans|Geist|Roboto|Open Sans|Lato|Nunito|Poppins)\b/i);
      if (!m) return null;
      return { found: m[1], fix: "Inter / 'Inter Tight' (--rvui-font-sans / --rvui-font-display)", why: this.why };
    },
  },
  {
    id: 'eyebrow-tracking',
    severity: 'warn',
    why: 'Marketing audit items 2 & 7 — eyebrows track at 0.20em (tracking-widest)',
    test(line) {
      // uppercase eyebrow label using the weaker tracking step
      if (!/uppercase/i.test(line)) return null;
      if (!/tracking-wider\b/i.test(line)) return null;
      return { found: 'tracking-wider on an uppercase label', fix: 'tracking-widest (0.20em)', why: this.why };
    },
  },
  {
    id: 'eyebrow-tracking-css',
    severity: 'warn',
    why: 'eyebrow tracking standard is 0.20em (--rvui-tracking-wide)',
    test(line) {
      const m = line.match(/letter-spacing:\s*0\.22em/i);
      if (!m) return null;
      return { found: '0.22em', fix: 'var(--rvui-tracking-wide) (0.20em)', why: this.why };
    },
  },
  {
    id: 'emerald-utility',
    severity: 'warn',
    why: 'CLAUDE.md token rules — don\'t author new emerald-* utilities (cobalt era)',
    test(line) {
      // new emerald utility classes in JSX className strings
      const m = line.match(/\b(?:bg|text|border|ring|from|to|via)-emerald-\d{2,3}\b/);
      if (!m) return null;
      return { found: m[0], fix: 'use a cobalt-* / --rvui-* equivalent', why: this.why };
    },
  },
  {
    id: 'checkmark-glyph',
    severity: 'warn',
    why: 'voice rule — checkmarks/close are always inline SVG, never the unicode glyph',
    test(line) {
      const m = line.match(/[\u2713\u2714\u2717\u2718]/);
      if (!m) return null;
      return { found: 'unicode ✓/✗ glyph', fix: 'inline <svg> check / close', why: this.why };
    },
  },
];

/* ── inline-ignore ────────────────────────────────────────────────── */
function ignoredRules(line) {
  const m = line.match(/adherence-ignore:\s*([a-z0-9-]+)/i);
  return m ? m[1] : null;
}

/* ── walk ─────────────────────────────────────────────────────────── */
function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (SKIP_DIR.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (SCAN_EXT.has(extname(name))) out.push(p);
  }
}

function scanFile(file, findings) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return; }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ignore = ignoredRules(line);

    // off-token named colors (custom per-hex message)
    {
      const m = line.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/gi);
      if (m) {
        for (const raw of m) {
          const hex = raw.toLowerCase();
          const off = NAMED_OFFENDERS[hex];
          if (off && ignore !== 'off-token-color') {
            findings.push({ file, line: i + 1, rule: 'off-token-color', severity: 'error', found: raw, fix: off.fix, why: off.why, src: line.trim().slice(0, 120) });
          }
        }
      }
    }

    for (const rule of rules) {
      if (rule.id === 'off-token-color') continue;
      if (ignore === rule.id) continue;
      const hit = rule.test(line);
      if (hit) findings.push({ file, line: i + 1, rule: rule.id, severity: rule.severity, found: hit.found, fix: hit.fix, why: hit.why, src: line.trim().slice(0, 120) });
    }
  }
}

/* ── run ──────────────────────────────────────────────────────────── */
const files = [];
for (const t of targets) {
  let st;
  try { st = statSync(t); } catch { console.error(`path not found: ${t}`); process.exit(2); }
  if (st.isDirectory()) walk(t, files);
  else if (SCAN_EXT.has(extname(t))) files.push(t);
}

const findings = [];
for (const f of files) scanFile(f, findings);

const errors = findings.filter((f) => f.severity === 'error');
const warns = findings.filter((f) => f.severity === 'warn');

if (JSON_OUT) {
  console.log(JSON.stringify({ scanned: files.length, errors: errors.length, warnings: warns.length, findings }, null, 2));
} else {
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  if (findings.length === 0) {
    console.log(`✓ adherence lint — ${files.length} file(s) scanned, on-system`);
  } else {
    console.error(`\n✗ adherence lint — ${errors.length} error(s), ${warns.length} warning(s) across ${byFile.size} file(s):\n`);
    for (const [file, fs] of byFile) {
      console.error(`  ${relative(process.cwd(), file)}`);
      for (const f of fs) {
        const tag = f.severity === 'error' ? 'ERROR' : 'warn ';
        console.error(`    ${tag} L${f.line} [${f.rule}] ${f.found}`);
        console.error(`          → ${f.fix}`);
        console.error(`          · ${f.why}`);
      }
      console.error('');
    }
    console.error(`  Suppress a reviewed exception with an inline  adherence-ignore: <rule-id> — <reason>`);
    console.error('');
  }
}

if (!QUIET && !JSON_OUT && findings.length === 0 && files.length > 0) {
  // already printed the OK line above
}

process.exit(errors.length && !WARN_ONLY ? 1 : 0);
