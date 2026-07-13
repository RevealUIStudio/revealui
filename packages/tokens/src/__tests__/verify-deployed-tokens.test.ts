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
  extractFontFaceSrcUrls: (css: string) => Map<string, string[]>;
  checkFontAssetReachability: (
    fontDecls: Map<string, string[]>,
    fontFaceFamilies: Set<string>,
    fontFaceSrcUrls: Map<string, string[]>,
    pageOrigin: string,
    fetchAsset?: (absUrl: string) => Promise<boolean>,
  ) => Promise<Array<{ token: string; family: string; urls: string[] }>>;
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

describe('extractFontFaceSrcUrls', () => {
  it('collects url(...) tokens per family, lowercased key, source order preserved', () => {
    const css =
      "@font-face{font-family:'Inter Variable';src:url(/a.woff2) format('woff2-variations')}" +
      "@font-face{font-family:'Inter Variable';src:url(/b.woff2) format('woff2-variations')}";
    const map = verify.extractFontFaceSrcUrls(css);
    expect(map.get('inter variable')).toEqual(['/a.woff2', '/b.woff2']);
  });

  it('omits a family whose @font-face rule has no url() (nothing to verify)', () => {
    const css = "@font-face{font-family:'Local Only';src:local('Local Only')}";
    const map = verify.extractFontFaceSrcUrls(css);
    expect(map.has('local only')).toBe(false);
  });
});

describe('checkFontAssetReachability', () => {
  // Reproduces the marketing false pass: the deployed CSS is the exact
  // shape apps/marketing ships after its app-level override (fix/marketing
  // PR #1801) — the stack leads with 'Inter Variable', and an @font-face
  // rule registers that exact family name. checkFontResolvability (the
  // name-match check) would call this resolved. But the font FILE the rule
  // points to 404s in production (stale build hash, purged CDN, broken
  // asset pipeline) — the browser falls through the stack and system fonts
  // render, the identical visual defect docs.revealui.com failed on. A
  // text-only name match can never see this; only a live fetch can.
  it('reproduces the marketing false pass: name-matched @font-face whose file 404s still fails', async () => {
    const fontDecls = verify.extractFontDecls(
      ":root{--rvui-font-sans:'Inter Variable', 'Inter', system-ui, sans-serif}",
    );
    const fontFaceCss =
      "@font-face{font-family:'Inter Variable';src:url(/assets/inter-latin-BROKEN.woff2) format('woff2-variations')}";
    const fontFaceFamilies = verify.extractFontFaceFamilies(fontFaceCss);
    const fontFaceSrcUrls = verify.extractFontFaceSrcUrls(fontFaceCss);

    // Sanity check: the name-match check alone sees no problem here — this
    // is precisely why marketing passed while docs correctly failed.
    const nameMatchFailures = verify.checkFontResolvability(fontDecls, fontFaceFamilies, null, []);
    expect(nameMatchFailures).toHaveLength(0);

    const fetchAsset = async () => false; // every asset 404s
    const failures = await verify.checkFontAssetReachability(
      fontDecls,
      fontFaceFamilies,
      fontFaceSrcUrls,
      'https://www.revealui.com',
      fetchAsset,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      token: '--rvui-font-sans',
      family: 'Inter Variable',
      urls: ['/assets/inter-latin-BROKEN.woff2'],
    });
  });

  it('passes when the registered font file is actually reachable', async () => {
    const fontDecls = verify.extractFontDecls(
      ":root{--rvui-font-sans:'Inter Variable', 'Inter', system-ui, sans-serif}",
    );
    const fontFaceCss =
      "@font-face{font-family:'Inter Variable';src:url(/assets/inter-latin-OK.woff2) format('woff2-variations')}";
    const fontFaceFamilies = verify.extractFontFaceFamilies(fontFaceCss);
    const fontFaceSrcUrls = verify.extractFontFaceSrcUrls(fontFaceCss);

    const fetchAsset = async (absUrl: string) => absUrl.endsWith('inter-latin-OK.woff2');
    const failures = await verify.checkFontAssetReachability(
      fontDecls,
      fontFaceFamilies,
      fontFaceSrcUrls,
      'https://www.revealui.com',
      fetchAsset,
    );
    expect(failures).toHaveLength(0);
  });

  it('resolves the url against pageOrigin (root-relative deployed font paths)', async () => {
    const fontDecls = verify.extractFontDecls(":root{--rvui-font-sans:'Inter Variable'}");
    const fontFaceCss = "@font-face{font-family:'Inter Variable';src:url(/f.woff2)}";
    const fontFaceFamilies = verify.extractFontFaceFamilies(fontFaceCss);
    const fontFaceSrcUrls = verify.extractFontFaceSrcUrls(fontFaceCss);

    const seen: string[] = [];
    const fetchAsset = async (absUrl: string) => {
      seen.push(absUrl);
      return true;
    };
    await verify.checkFontAssetReachability(
      fontDecls,
      fontFaceFamilies,
      fontFaceSrcUrls,
      'https://docs.revealui.com',
      fetchAsset,
    );
    expect(seen).toEqual(['https://docs.revealui.com/f.woff2']);
  });

  it('treats a family with no parseable src url as nothing-to-verify, not a failure', async () => {
    const fontDecls = verify.extractFontDecls(":root{--rvui-font-sans:'Local Only'}");
    const fontFaceFamilies = verify.extractFontFaceFamilies(
      "@font-face{font-family:'Local Only';src:local('Local Only')}",
    );
    const fontFaceSrcUrls = new Map<string, string[]>(); // no urls captured for it
    const fetchAsset = async () => false;
    const failures = await verify.checkFontAssetReachability(
      fontDecls,
      fontFaceFamilies,
      fontFaceSrcUrls,
      'https://docs.revealui.com',
      fetchAsset,
    );
    expect(failures).toHaveLength(0);
  });

  it('checks each distinct family at most once per token (dedup across repeated urls)', async () => {
    const fontDecls = verify.extractFontDecls(
      ":root{--rvui-font-sans:'Inter Variable', 'Inter', system-ui, sans-serif}" +
        ":root{--rvui-font-sans:'Inter Variable', system-ui, sans-serif}",
    );
    const fontFaceCss = "@font-face{font-family:'Inter Variable';src:url(/f.woff2)}";
    const fontFaceFamilies = verify.extractFontFaceFamilies(fontFaceCss);
    const fontFaceSrcUrls = verify.extractFontFaceSrcUrls(fontFaceCss);

    let calls = 0;
    const fetchAsset = async () => {
      calls += 1;
      return true;
    };
    await verify.checkFontAssetReachability(
      fontDecls,
      fontFaceFamilies,
      fontFaceSrcUrls,
      'https://www.revealui.com',
      fetchAsset,
    );
    expect(calls).toBe(1);
  });
});
