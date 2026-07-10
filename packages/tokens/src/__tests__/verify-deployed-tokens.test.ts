import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

// The verifier is a dependency-free CJS script (Node CLI). Load it via
// createRequire so the same module the CI step runs is exercised here.
const require = createRequire(import.meta.url);
const verify = require('../../scripts/verify-deployed-tokens.cjs') as {
  normalizeValue: (v: string) => string;
  extractTokenDecls: (css: string) => Map<string, Set<string>>;
  extractFontDecls: (css: string) => Map<string, string[]>;
  extractFontFaceFamilies: (css: string) => Set<string>;
  namedFamilies: (stack: string) => string[];
  parseCsp: (header: string | null) => Map<string, string[]> | null;
  hostMatchesSource: (host: string, src: string) => boolean;
  cspAllows: (csp: Map<string, string[]> | null, host: string, kind: string) => boolean;
  compareTokens: (
    canonical: Map<string, Set<string>>,
    deployed: Map<string, Set<string>>,
    allowlist: Map<string, Set<string>>,
  ) => { missing: unknown[]; extra: unknown[] };
  checkFontResolvability: (
    fontDecls: Map<string, string[]>,
    fontFaceFamilies: Set<string>,
    csp: Map<string, string[]> | null,
    externalFontRefs: Array<{ host: string; kind: string }>,
  ) => Array<{ token: string; stacks: unknown[] }>;
};

describe('normalizeValue', () => {
  it('rewrites oklch percent-lightness to decimal', () => {
    expect(verify.normalizeValue('oklch(58% .15 240)')).toBe(
      verify.normalizeValue('oklch(0.58 0.150 240)'),
    );
  });

  it('rewrites ms durations to seconds', () => {
    expect(verify.normalizeValue('120ms')).toBe(verify.normalizeValue('.12s'));
    expect(verify.normalizeValue('350ms')).toBe('0.35s');
  });

  it('canonicalizes leading zeros and trailing zeros', () => {
    expect(verify.normalizeValue('0.150')).toBe('0.15');
    expect(verify.normalizeValue('.5')).toBe('0.5');
    expect(verify.normalizeValue('1.000')).toBe('1');
  });

  it('is quote-style insensitive', () => {
    expect(verify.normalizeValue('"Inter", sans-serif')).toBe(
      verify.normalizeValue("'Inter', sans-serif"),
    );
  });

  it('collapses whitespace and normalizes the oklch alpha slash', () => {
    expect(verify.normalizeValue('oklch(0.58 0.150 240 / 0.16)')).toBe(
      verify.normalizeValue('oklch(58% .15 240/.16)'),
    );
  });

  it('normalizes multi-space oklch(1.000 0     0) to oklch(1 0 0)', () => {
    expect(verify.normalizeValue('oklch(1.000 0     0)')).toBe('oklch(1 0 0)');
  });
});

describe('extractTokenDecls', () => {
  it('extracts --rvui-* declarations, ignoring comments and non-rvui props', () => {
    const css = `
      /* --rvui-fake: nope; a comment */
      :root {
        --rvui-radius-sm: 6px;
        --background: var(--rvui-surface-0);
        --rvui-duration-fast: 120ms;
      }`;
    const map = verify.extractTokenDecls(css);
    expect([...map.keys()].sort()).toEqual(['--rvui-duration-fast', '--rvui-radius-sm']);
    expect(map.get('--rvui-duration-fast')).toEqual(new Set(['0.12s']));
  });

  it('collects multiple distinct values per token across theme scopes', () => {
    const css = `
      :root { --rvui-brand: oklch(0.58 0.150 240); }
      [data-theme="light"] { --rvui-brand: oklch(0.36 0.190 240); }`;
    const map = verify.extractTokenDecls(css);
    expect(map.get('--rvui-brand')?.size).toBe(2);
  });
});

describe('compareTokens', () => {
  const canonical = verify.extractTokenDecls(
    ':root{--rvui-brand:oklch(0.58 0.150 240);--rvui-radius-sm:6px;}',
  );

  it('passes when the deployed CSS matches canonical numerically (minified)', () => {
    const deployed = verify.extractTokenDecls(
      ':root{--rvui-brand:oklch(58% .15 240);--rvui-radius-sm:6px}',
    );
    const res = verify.compareTokens(canonical, deployed, new Map());
    expect(res.missing).toHaveLength(0);
    expect(res.extra).toHaveLength(0);
  });

  it('reports a missing canonical token', () => {
    const deployed = verify.extractTokenDecls(':root{--rvui-brand:oklch(58% .15 240)}');
    const res = verify.compareTokens(canonical, deployed, new Map());
    expect(res.missing).toHaveLength(1);
  });

  it('fails an un-allowlisted extra value but passes an allowlisted one', () => {
    const deployed = verify.extractTokenDecls(
      ':root{--rvui-brand:oklch(58% .15 240);--rvui-radius-sm:6px;--rvui-radius-sm:8px}',
    );
    const failing = verify.compareTokens(canonical, deployed, new Map());
    expect(failing.extra).toHaveLength(1);

    const allow = new Map([['--rvui-radius-sm', new Set([verify.normalizeValue('8px')])]]);
    const passing = verify.compareTokens(canonical, deployed, allow);
    expect(passing.extra).toHaveLength(0);
  });
});

describe('namedFamilies', () => {
  it('drops generics and keeps the brand faces in order', () => {
    expect(verify.namedFamilies("'Inter Variable', 'Inter', system-ui, sans-serif")).toEqual([
      'Inter Variable',
      'Inter',
    ]);
  });
});

describe('CSP', () => {
  it('treats an absent header as permitted', () => {
    expect(verify.cspAllows(null, 'fonts.googleapis.com', 'style')).toBe(true);
  });

  it('permits a host explicitly listed in style-src', () => {
    const csp = verify.parseCsp(
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com",
    );
    expect(verify.cspAllows(csp, 'fonts.googleapis.com', 'style')).toBe(true);
    expect(verify.cspAllows(csp, 'fonts.gstatic.com', 'font')).toBe(true);
  });

  it('blocks a host not listed (Google Fonts under a self-only policy)', () => {
    const csp = verify.parseCsp("default-src 'self'; style-src 'self'; font-src 'self'");
    expect(verify.cspAllows(csp, 'fonts.googleapis.com', 'style')).toBe(false);
    expect(verify.cspAllows(csp, 'fonts.gstatic.com', 'font')).toBe(false);
  });

  it('matches wildcard host sources', () => {
    const csp = verify.parseCsp('font-src *.gstatic.com');
    expect(verify.cspAllows(csp, 'fonts.gstatic.com', 'font')).toBe(true);
  });
});

describe('checkFontResolvability', () => {
  const selfHostedFontFace = verify.extractFontFaceFamilies(
    "@font-face{font-family:'Inter Variable';src:url(/inter.woff2)}@font-face{font-family:'Inter Tight Variable';src:url(/it.woff2)}@font-face{font-family:'JetBrains Mono Variable';src:url(/jbm.woff2)}",
  );

  it("reproduces today's bug: stacks say Inter, @font-face registers Inter Variable, CSP blocks Google → FAIL", () => {
    // Deployed prod (pre-fix): tokens still say 'Inter', only "Inter Variable"
    // is registered, and CSP blocks the Google Fonts <link> the page uses.
    const fontDecls = verify.extractFontDecls(
      ":root{--rvui-font-sans:'Inter', system-ui, sans-serif;--rvui-font-display:'Inter Tight', 'Inter', system-ui, sans-serif;--rvui-font-mono:'JetBrains Mono', 'Fira Code', ui-monospace, monospace}",
    );
    const csp = verify.parseCsp("default-src 'self'; style-src 'self'; font-src 'self'");
    const externalRefs = [{ host: 'fonts.googleapis.com', kind: 'style' }];
    const failures = verify.checkFontResolvability(
      fontDecls,
      selfHostedFontFace,
      csp,
      externalRefs,
    );
    // All three font tokens fail — none of Inter / Inter Tight / JetBrains Mono
    // is registered (only the "* Variable" faces are), and Google is blocked.
    expect(failures.map((f) => f.token).sort()).toEqual([
      '--rvui-font-display',
      '--rvui-font-mono',
      '--rvui-font-sans',
    ]);
  });

  it('passes once the app override leads the stack with the registered Variable faces', () => {
    // Post-fix: the app redeclares each token; the canonical 'Inter' stack is
    // still in the bundle (overridden, never painted), but the override stack
    // resolves via @font-face, so each token passes.
    const fontDecls = verify.extractFontDecls(
      ":root{--rvui-font-sans:'Inter', system-ui, sans-serif}" +
        ":root{--rvui-font-sans:'Inter Variable', 'Inter', system-ui, sans-serif}",
    );
    const csp = verify.parseCsp("default-src 'self'; style-src 'self'; font-src 'self'");
    const failures = verify.checkFontResolvability(fontDecls, selfHostedFontFace, csp, []);
    expect(failures).toHaveLength(0);
  });

  it('resolves via a CSP-permitted external font host when no @font-face matches', () => {
    const fontDecls = verify.extractFontDecls(
      ":root{--rvui-font-sans:'Inter', system-ui, sans-serif}",
    );
    const csp = verify.parseCsp(
      "style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com",
    );
    const externalRefs = [
      { host: 'fonts.googleapis.com', kind: 'style' },
      { host: 'fonts.gstatic.com', kind: 'font' },
    ];
    const failures = verify.checkFontResolvability(fontDecls, new Set(), csp, externalRefs);
    expect(failures).toHaveLength(0);
  });
});
