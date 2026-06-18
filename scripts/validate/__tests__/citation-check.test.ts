import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isExcludedDoc,
  isGatedDoc,
  isUncitedClaim,
  normClaim,
  parseCitation,
  parseLineSuffix,
  scan,
} from '../citation-check.ts';

describe('parseLineSuffix', () => {
  it('parses a single line', () => {
    expect(parseLineSuffix('42')).toEqual({ start: 42 });
  });
  it('parses a range', () => {
    expect(parseLineSuffix('10-20')).toEqual({ start: 10, end: 20 });
  });
  it('rejects non-numeric suffixes', () => {
    expect(parseLineSuffix('main')).toBeNull();
    expect(parseLineSuffix('')).toBeNull();
    expect(parseLineSuffix('10-')).toBeNull();
  });
});

describe('parseCitation', () => {
  it('accepts a path with a line range', () => {
    expect(parseCitation('packages/core/src/license.ts:96-119')).toEqual({
      file: 'packages/core/src/license.ts',
      start: 96,
      end: 119,
    });
  });
  it('accepts a path with a single line', () => {
    expect(parseCitation('apps/server/src/routes/webhooks.ts:875')).toEqual({
      file: 'apps/server/src/routes/webhooks.ts',
      start: 875,
      end: undefined,
    });
  });
  it('rejects a bare path with no line anchor', () => {
    // A bare path is a navigation link / mention, not a citation.
    expect(parseCitation('scripts/lib/md-links.ts')).toBeNull();
  });
  it('rejects prose / non-path inline code', () => {
    expect(parseCitation('useState')).toBeNull();
    expect(parseCitation('pnpm build')).toBeNull();
    expect(parseCitation('isLicensed()')).toBeNull();
  });
  it('rejects a bare filename with no directory', () => {
    expect(parseCitation('package.json')).toBeNull();
    expect(parseCitation('tsconfig.json:5')).toBeNull();
  });
  it('rejects external links and non-source extensions', () => {
    expect(parseCitation('https://example.com/x/y.ts')).toBeNull();
    expect(parseCitation('docs/guides/auth.md')).toBeNull();
  });
  it('keeps the line anchor and strips a trailing fragment', () => {
    expect(parseCitation('packages/core/src/x.ts:10#L10')).toEqual({
      file: 'packages/core/src/x.ts',
      start: 10,
      end: undefined,
    });
  });
  it('rejects a GitHub-style #Lxx anchor without a colon anchor', () => {
    expect(parseCitation('packages/core/src/x.ts#L10')).toBeNull();
  });
});

describe('isGatedDoc / isExcludedDoc', () => {
  it('gates repo, package, and app READMEs', () => {
    expect(isGatedDoc('README.md')).toBe(true);
    expect(isGatedDoc('packages/core/README.md')).toBe(true);
    expect(isGatedDoc('apps/server/README.md')).toBe(true);
  });
  it('does not gate a deep README', () => {
    expect(isGatedDoc('packages/core/src/README.md')).toBe(false);
  });
  it('gates the core technical docs + specs', () => {
    expect(isGatedDoc('docs/ARCHITECTURE.md')).toBe(true);
    expect(isGatedDoc('docs/guides/authentication.md')).toBe(true);
    expect(isGatedDoc('docs/api/rest-api/README.md')).toBe(true);
    expect(isGatedDoc('docs/specs/2026-05-18-phase.md')).toBe(true);
    expect(isGatedDoc('MASTER_SPEC.md')).toBe(true);
  });
  it('excludes non-code doc classes', () => {
    expect(isExcludedDoc('docs/decisions/2026-05-03-x.md')).toBe(true);
    expect(isExcludedDoc('docs/handoffs/archive/HANDOFF-x.md')).toBe(true);
    expect(isExcludedDoc('business/pitch.md')).toBe(true);
    expect(isExcludedDoc('CHANGELOG.md')).toBe(true);
    expect(isGatedDoc('docs/decisions/2026-05-03-x.md')).toBe(false);
  });
});

describe('isUncitedClaim', () => {
  it('flags a code-behaviour claim with no citation', () => {
    expect(isUncitedClaim('The router enforces SSR boundaries.', false)).toBe(true);
  });
  it('does not flag a claim that carries a citation', () => {
    expect(isUncitedClaim('The router enforces SSR boundaries.', true)).toBe(false);
  });
  it('does not flag headings, blockquotes, or table rows', () => {
    expect(isUncitedClaim('## Authentication enforces sessions', false)).toBe(false);
    expect(isUncitedClaim('> auth enforced in core', false)).toBe(false);
    expect(isUncitedClaim('| enforced in core | yes |', false)).toBe(false);
  });
  it('exonerates example / roadmap lines', () => {
    expect(isUncitedClaim('For example, the gateway enforces nothing.', false)).toBe(false);
    expect(isUncitedClaim('SSO enforced in core (planned).', false)).toBe(false);
  });
  it('ignores prose with no claim token', () => {
    expect(isUncitedClaim('RevealUI is an agentic business runtime.', false)).toBe(false);
  });
  it('does not flag re-prefixed words like "revalidates"', () => {
    expect(isUncitedClaim('- **Purpose**: Revalidates product pages', false)).toBe(false);
  });
});

describe('normClaim', () => {
  it('is stable across leading/trailing/collapsed whitespace', () => {
    expect(normClaim('README.md', '  The   X enforces Y. ')).toBe(
      normClaim('README.md', 'The X enforces Y.'),
    );
  });
});

describe('scan (integration)', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'citation-check-'));
    fs.mkdirSync(path.join(tmp, 'pkg'), { recursive: true });
    // A 30-line source file the citations resolve against.
    fs.writeFileSync(
      path.join(tmp, 'pkg', 'a.ts'),
      Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n'),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('reports missing + out-of-range citations and one uncited claim', () => {
    fs.writeFileSync(
      path.join(tmp, 'README.md'),
      [
        '# Demo',
        'Resolved in `pkg/a.ts:5-10`.',
        'Missing `pkg/ghost.ts:1`.',
        'Out of range `pkg/a.ts:999`.',
        'The router enforces SSR boundaries.',
      ].join('\n'),
    );

    const result = scan(tmp, path.dirname(tmp), 'revealui', false);

    expect(result.gated).toBe(1);
    const kinds = result.validity.map((v) => v.kind).sort();
    expect(kinds).toEqual(['missing', 'out-of-range']);
    // The valid `pkg/a.ts:5-10` citation produces no error.
    expect(result.validity.some((v) => v.citation.includes(':5-10'))).toBe(false);
    // Only the uncited claim line is a coverage gap (cited lines are exonerated).
    expect(result.coverage).toHaveLength(1);
    expect(result.coverage[0].excerpt).toContain('enforces');
  });

  it('only checks validity outside gated docs under scope=all', () => {
    fs.writeFileSync(path.join(tmp, 'notes.md'), 'See `pkg/ghost.ts:1`.');

    // notes.md is not gated → skipped entirely in gated scope.
    expect(scan(tmp, path.dirname(tmp), 'revealui', false).validity).toHaveLength(0);
    // …but validated under scope=all.
    const all = scan(tmp, path.dirname(tmp), 'revealui', true);
    expect(all.validity).toHaveLength(1);
    expect(all.validity[0].kind).toBe('missing');
  });

  it('skips YAML frontmatter and fenced code when detecting claims', () => {
    fs.writeFileSync(
      path.join(tmp, 'README.md'),
      [
        '---',
        'description: "Implements circuit breaker and enforces limits."',
        '---',
        '# Demo',
        '```ts',
        'The walker enforces things here.',
        '```',
        'The router enforces SSR boundaries.',
      ].join('\n'),
    );
    const result = scan(tmp, path.dirname(tmp), 'revealui', false);
    expect(result.coverage).toHaveLength(1);
    expect(result.coverage[0].excerpt).toContain('router enforces');
  });
});
