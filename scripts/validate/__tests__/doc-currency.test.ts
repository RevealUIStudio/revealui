import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COMMON_EXON,
  extractStringLiterals,
  type Hit,
  hitKey,
  loadBaseline,
  parseArgs,
  RULES,
  ruleMatches,
  scanAll,
  scanContentFile,
  scanMarkdownFile,
  shouldSkipFile,
  writeBaseline,
} from '../doc-currency.js';

function rule(id: string) {
  const found = RULES.find((r) => r.id === id);
  if (!found) throw new Error(`no such rule: ${id}`);
  return found;
}

/** Run the same extract-then-match pipeline `scanContentFile` uses, but on
 *  raw source text (no disk I/O) — mirrors the file-based scan logic while
 *  keeping the test pure. */
function ruleIdsInSource(source: string): string[] {
  const ids: string[] = [];
  for (const span of extractStringLiterals(source, 'fixture.ts')) {
    const lower = span.text.toLowerCase();
    for (const r of RULES) {
      if (ruleMatches(lower, r)) ids.push(r.id);
    }
  }
  return ids;
}

describe('ruleMatches', () => {
  it('flags supabase mentioned as current', () => {
    expect(ruleMatches('we use supabase for auth today', rule('supabase-as-current'))).toBe(true);
  });

  it('does not flag supabase when exonerated by a common marker', () => {
    expect(
      ruleMatches('supabase is being removed in favor of neon', rule('supabase-as-current')),
    ).toBe(false);
  });

  it('does not flag a legitimate historical Railway reference', () => {
    expect(ruleMatches('railway was dropped for fly', rule('railway-as-current'))).toBe(false);
  });

  it('flags Railway presented as a live target', () => {
    expect(ruleMatches('deploy your app to railway', rule('railway-as-current'))).toBe(true);
  });

  it('flags RevealCoin presented as current', () => {
    expect(ruleMatches('pay with revealcoin today', rule('revealcoin-as-current'))).toBe(true);
  });

  it('does not flag RevealCoin when marked cancelled', () => {
    expect(ruleMatches('revealcoin was cancelled 2026-05-29', rule('revealcoin-as-current'))).toBe(
      false,
    );
  });

  it('flags the retired Forge tier name', () => {
    expect(ruleMatches('sign up for the forge tier', rule('forge-tier-name'))).toBe(true);
  });

  it('does not flag Forge tier when marked renamed', () => {
    expect(ruleMatches('the forge tier was renamed to enterprise', rule('forge-tier-name'))).toBe(
      false,
    );
  });

  it('flags Vercel Blob presented as canonical storage', () => {
    expect(
      ruleMatches('set the blob_read_write_token env var', rule('vercel-blob-as-current')),
    ).toBe(true);
  });

  it('does not flag Vercel Blob when R2 is named in the same line', () => {
    expect(
      ruleMatches(
        'vercel blob is retiring; use cloudflare r2 instead',
        rule('vercel-blob-as-current'),
      ),
    ).toBe(false);
  });
});

describe('stripe-not-live-claim', () => {
  const stripeRule = rule('stripe-not-live-claim');

  it('flags the regression fixture: marketing copy presenting Stripe as not yet flipped', () => {
    // Pre-fix homepage/pricing-teaser style claim — Stripe live mode IS on,
    // so this future-tense framing is stale drift.
    const fixture =
      'Paid tiers (Pro, Max, Enterprise) are previews. ' +
      'Subscription billing opens when we flip Stripe live mode.';
    expect(ruleMatches(fixture.toLowerCase(), stripeRule)).toBe(true);
  });

  it('fires the same fixture when extracted from a content .ts string literal', () => {
    const source = `
      export const PRICING_TEASER_SECTION = {
        body: 'Paid tiers (Pro, Max, Enterprise) are previews. Subscription billing opens when we flip Stripe live mode.',
      } as const;
    `;
    expect(ruleIdsInSource(source)).toContain('stripe-not-live-claim');
  });

  it('does not flag the corrected past-tense phrasing', () => {
    expect(
      ruleMatches('stripe live mode was flipped 2026-06-26; billing is live', stripeRule),
    ).toBe(false);
  });

  it('does not use COMMON_EXON markers that would defeat the bespoke exon list', () => {
    // "pending" / "not yet" / "before" are COMMON_EXON markers that must NOT
    // exonerate this rule — the bespoke list intentionally omits them.
    expect(ruleMatches('stripe is not flipped; billing is pending', stripeRule)).toBe(true);
  });
});

describe('extractStringLiterals — AST scope', () => {
  it('does not scan import module specifiers', () => {
    const source = `import { Railway } from 'railway-sdk';\nexport const x = 'clean copy';`;
    const texts = extractStringLiterals(source, 'fixture.ts').map((s) => s.text);
    expect(texts).not.toContain('railway-sdk');
    expect(texts).toContain('clean copy');
  });

  it('does not scan re-export module specifiers', () => {
    const source = `export { Railway } from 'railway-sdk';`;
    const texts = extractStringLiterals(source, 'fixture.ts').map((s) => s.text);
    expect(texts).not.toContain('railway-sdk');
  });

  it('does not fire on an identifier named after a banned term', () => {
    const source = `const railwayLegacyAdapter = 'ok';\nexport { railwayLegacyAdapter };`;
    expect(ruleIdsInSource(source)).not.toContain('railway-as-current');
  });

  it('does not scan comments', () => {
    const source = `
      // Supabase is our primary database today, allegedly.
      export const x = 'nothing to see here';
    `;
    expect(ruleIdsInSource(source)).not.toContain('supabase-as-current');
  });

  it('extracts no-substitution template literal text', () => {
    const source = 'export const x = `we use supabase for auth`;';
    const texts = extractStringLiterals(source, 'fixture.ts').map((s) => s.text);
    expect(texts).toContain('we use supabase for auth');
  });

  it('extracts the literal spans of a template expression, not the interpolated identifier', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture is TS source text, not a template literal itself
    const source = 'declare const name: string;\nexport const x = `we use supabase for ${name}`;';
    const spans = extractStringLiterals(source, 'fixture.ts').map((s) => s.text);
    expect(spans.some((t) => t.includes('we use supabase for'))).toBe(true);
    expect(spans).not.toContain('name');
  });
});

describe('shouldSkipFile — historical exemptions', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-currency-skip-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('skips files under an archive/ path segment', () => {
    expect(shouldSkipFile('docs/archive/old.md', path.join(tmpRoot, 'missing.md'))).toBe(true);
  });

  it('skips HANDOFF-*.md session snapshots', () => {
    const abs = path.join(tmpRoot, 'HANDOFF-2026-01-01-topic.md');
    fs.writeFileSync(abs, 'Supabase is our database.');
    expect(shouldSkipFile('docs/HANDOFF-2026-01-01-topic.md', abs)).toBe(true);
  });

  it('skips a file whose head carries a SUPERSEDED banner', () => {
    const abs = path.join(tmpRoot, 'old-plan.md');
    fs.writeFileSync(abs, '# Old Plan\n\nStatus: SUPERSEDED\n\nSupabase is our database.');
    expect(shouldSkipFile('docs/old-plan.md', abs)).toBe(true);
  });

  it('does not skip an ordinary current doc', () => {
    const abs = path.join(tmpRoot, 'current.md');
    fs.writeFileSync(abs, '# Current\n\nWe use Neon and ElectricSQL.');
    expect(shouldSkipFile('docs/current.md', abs)).toBe(false);
  });
});

describe('baseline round-trip + CI-mode suppression', () => {
  let tmpRoot: string;
  let baselinePath: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-currency-baseline-'));
    baselinePath = path.join(tmpRoot, 'baseline.json');
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('writes and reloads a baseline of (file::ruleId) pairs', () => {
    const hits: Hit[] = [
      { file: 'docs/a.md', line: 3, ruleId: 'supabase-as-current', excerpt: 'x' },
      { file: 'docs/a.md', line: 3, ruleId: 'supabase-as-current', excerpt: 'x (dup)' },
      { file: 'docs/b.md', line: 1, ruleId: 'railway-as-current', excerpt: 'y' },
    ];
    const count = writeBaseline(hits, baselinePath);
    expect(count).toBe(2); // deduped by (file::ruleId)

    const reloaded = loadBaseline(baselinePath);
    expect(reloaded.has('docs/a.md::supabase-as-current')).toBe(true);
    expect(reloaded.has('docs/b.md::railway-as-current')).toBe(true);
    expect(reloaded.size).toBe(2);
  });

  it('CI mode: an existing baselined pair passes, a new pair fails', () => {
    const baseline = new Set(['docs/a.md::supabase-as-current']);
    const hits: Hit[] = [
      { file: 'docs/a.md', line: 3, ruleId: 'supabase-as-current', excerpt: 'baselined' },
      { file: 'docs/c.md', line: 5, ruleId: 'railway-as-current', excerpt: 'brand new' },
    ];
    const newHits = hits.filter((h) => !baseline.has(hitKey(h)));
    expect(newHits).toHaveLength(1);
    expect(newHits[0]?.file).toBe('docs/c.md');
  });

  it('returns an empty set when the baseline file does not exist', () => {
    expect(loadBaseline(path.join(tmpRoot, 'nope.json')).size).toBe(0);
  });
});

describe('parseArgs', () => {
  it('defaults to cli mode, no flags', () => {
    expect(parseArgs([])).toEqual({ quiet: false, updateBaseline: false, mode: 'cli' });
  });

  it('parses --mode=ci, --update-baseline, --quiet', () => {
    expect(parseArgs(['--mode=ci', '--update-baseline', '--quiet'])).toEqual({
      quiet: true,
      updateBaseline: true,
      mode: 'ci',
    });
  });

  it('rejects an unknown flag', () => {
    const result = parseArgs(['--bogus']);
    expect(result.error).toBeDefined();
  });

  it('ignores an unrecognized --mode value (stays cli)', () => {
    expect(parseArgs(['--mode=bogus']).mode).toBe('cli');
  });
});

describe('COMMON_EXON', () => {
  it('is non-empty and lowercase-safe (no authored regex hazard, plain substrings)', () => {
    expect(COMMON_EXON.length).toBeGreaterThan(10);
    for (const term of COMMON_EXON) expect(typeof term).toBe('string');
  });
});

describe('scanMarkdownFile + scanContentFile — end-to-end on a real fixture tree', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-currency-e2e-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('flags a markdown line presenting Supabase as current, skips exonerated lines', () => {
    const docsDir = path.join(tmpRoot, 'docs');
    fs.mkdirSync(docsDir, { recursive: true });
    const abs = path.join(docsDir, 'stack.md');
    fs.writeFileSync(
      abs,
      ['# Stack', '', 'We use Supabase for auth.', 'Supabase is being removed for Neon.'].join(
        '\n',
      ),
    );
    const hits = scanMarkdownFile(tmpRoot, abs);
    expect(hits.map((h) => h.ruleId)).toEqual(['supabase-as-current']);
    expect(hits[0]?.line).toBe(3);
  });

  it('flags a marketing-copy content .ts string literal, ignores the import line', () => {
    const contentDir = path.join(tmpRoot, 'apps/marketing/app/content');
    fs.mkdirSync(contentDir, { recursive: true });
    const abs = path.join(contentDir, 'sample.ts');
    fs.writeFileSync(
      abs,
      [
        "import { railwayLegacyAdapter } from 'railway-sdk';",
        '',
        'export const COPY = {',
        "  body: 'We use Supabase for auth today.',",
        '} as const;',
      ].join('\n'),
    );
    const hits = scanContentFile(tmpRoot, abs);
    expect(hits.map((h) => h.ruleId)).toEqual(['supabase-as-current']);
  });

  it('scanAll combines both surfaces and counts the files it walked', () => {
    const docsDir = path.join(tmpRoot, 'docs');
    const contentDir = path.join(tmpRoot, 'apps/marketing/app/content');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(contentDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, 'stack.md'), 'We use Supabase for auth.');
    fs.writeFileSync(
      path.join(contentDir, 'sample.ts'),
      "export const COPY = { body: 'Deploy to Railway today.' } as const;",
    );

    const { hits, markdownCount, tsCount } = scanAll(tmpRoot);
    expect(markdownCount).toBe(1);
    expect(tsCount).toBe(1);
    expect(hits.map((h) => h.ruleId).sort()).toEqual(['railway-as-current', 'supabase-as-current']);
  });
});
