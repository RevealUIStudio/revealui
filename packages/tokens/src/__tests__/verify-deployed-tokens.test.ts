import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const allowlistPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../scripts/verify-deployed-tokens.allowlist.json',
);

// The verifier is a dependency-free CJS script (Node CLI). Load it via
// createRequire so the same module the CI step runs is exercised here.
const require = createRequire(import.meta.url);
const verify = require('../../scripts/verify-deployed-tokens.cjs') as {
  fetchScoped: (
    url: string,
    init?: RequestInit,
    options?: {
      fetchImpl?: typeof fetch;
      maxRedirects?: number;
    },
  ) => Promise<{ response: Response; url: string; diagnostic: Record<string, unknown> }>;
  parseUrlTarget: (spec: string) => { fetchUrl: string; allowlistHost: string };
  verifyUrl: (
    pageUrl: string,
    canonicalTokens: Map<string, Set<string>>,
    canonicalFontNames: Set<string>,
    allowlistPath: string,
    options?: { fetchImpl?: typeof fetch; allowlistHost?: string },
  ) => Promise<{
    ok: boolean;
    parity: { missing: unknown[]; extra: Array<{ token: string }> };
    fontFailures: unknown[];
    assetFailures: unknown[];
  }>;
  verifyReachability: (
    url: string,
    options?: { fetchImpl?: typeof fetch },
  ) => Promise<{
    ok: boolean;
    cssBundleCount: number;
    transportFailures: Array<Record<string, unknown>>;
  }>;
  fetchDeployed: (
    url: string,
    options?: { fetchImpl?: typeof fetch },
  ) => Promise<{ css: string; transportFailures: Array<Record<string, unknown>> }>;
  defaultFetchAsset: (url: string) => Promise<boolean>;
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

describe('public host alias', () => {
  it('parses origin=public-host without rewriting the fetch URL', () => {
    expect(verify.parseUrlTarget('https://www.revealui.com')).toEqual({
      fetchUrl: 'https://www.revealui.com',
      allowlistHost: 'www.revealui.com',
    });
    expect(verify.parseUrlTarget('https://deploy.example/index.html=www.revealui.com')).toEqual({
      fetchUrl: 'https://deploy.example/index.html',
      allowlistHost: 'www.revealui.com',
    });
    expect(
      verify.parseUrlTarget('https://deploy.example/index.html=https://docs.revealui.com/docs'),
    ).toEqual({
      fetchUrl: 'https://deploy.example/index.html',
      allowlistHost: 'docs.revealui.com',
    });
    expect(() => verify.parseUrlTarget('https://deploy.example/?q=1=www.revealui.com')).toThrow(
      '--url alias must be <origin>=<public-host>',
    );
  });

  it('applies the public-host allowlist and the fetched CSP, and still fetches the deployment origin', async () => {
    const canonical = verify.extractTokenDecls(
      ":root{--rvui-font-sans:'Inter', system-ui, sans-serif}",
    );
    const html = [
      '<link rel="stylesheet" href="/app.css">',
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">',
    ].join('');
    const css =
      ":root{--rvui-font-sans:'Inter', system-ui, sans-serif}" +
      ":root{--rvui-font-sans:'Inter Variable', 'Inter', system-ui, sans-serif}" +
      "@font-face{font-family:'Inter Variable';src:url(data:font/woff2;base64,QQ)}";
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith('.css')) return new Response(css, { status: 200 });
      return new Response(html, {
        status: 200,
        headers: {
          'content-security-policy': "default-src 'self'; style-src 'self'; font-src 'self'",
        },
      });
    }) as typeof fetch;

    const wrongHost = await verify.verifyUrl(
      'https://deploy.example/',
      canonical,
      new Set(['--rvui-font-sans']),
      allowlistPath,
      { fetchImpl },
    );
    expect(wrongHost.ok).toBe(false);
    expect(wrongHost.parity.extra.map((extra) => extra.token)).toContain('--rvui-font-sans');

    const aliased = await verify.verifyUrl(
      'https://deploy.example/',
      canonical,
      new Set(['--rvui-font-sans']),
      allowlistPath,
      { fetchImpl, allowlistHost: 'www.revealui.com' },
    );
    expect(aliased.parity.extra).toHaveLength(0);
    expect(aliased.fontFailures).toHaveLength(0);
    expect(aliased.assetFailures).toHaveLength(0);
    expect(aliased.ok).toBe(true);
    for (const call of fetchImpl.mock.calls) {
      expect(String(call[0]).startsWith('https://deploy.example/')).toBe(true);
    }
  });

  it('still fails an extra value that the public host does not allow', async () => {
    const canonical = verify.extractTokenDecls(
      ":root{--rvui-font-sans:'Inter', system-ui, sans-serif;--rvui-radius-sm:6px}",
    );
    const css =
      ":root{--rvui-font-sans:'Inter Variable', 'Inter', system-ui, sans-serif;--rvui-radius-sm:6px;--rvui-radius-sm:99px}" +
      "@font-face{font-family:'Inter Variable';src:url(data:font/woff2;base64,QQ)}";
    const fetchImpl = vi.fn(async (url: string) =>
      String(url).endsWith('.css')
        ? new Response(css, { status: 200 })
        : new Response('<link rel="stylesheet" href="/app.css">', {
            status: 200,
            headers: {
              'content-security-policy': "default-src 'self'; style-src 'self'; font-src 'self'",
            },
          }),
    ) as typeof fetch;
    const result = await verify.verifyUrl(
      'https://deploy.example/',
      canonical,
      new Set(['--rvui-font-sans']),
      allowlistPath,
      { fetchImpl, allowlistHost: 'www.revealui.com' },
    );
    expect(result.ok).toBe(false);
    expect(result.parity.extra.map((extra) => extra.token)).toContain('--rvui-radius-sm');
    expect(result.parity.extra.map((extra) => extra.token)).not.toContain('--rvui-font-sans');
  });
});

describe('deployed verifier transport', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('drops credentials when a redirect leaves the origin and never sends the retired edge header', async () => {
    const previous = process.env.REVEALUI_CRON_EDGE_KEY;
    process.env.REVEALUI_CRON_EDGE_KEY = 'super-secret';
    const scriptPath = require.resolve('../../scripts/verify-deployed-tokens.cjs');
    delete require.cache[scriptPath];
    const fresh = require(scriptPath) as typeof verify;
    const requests: Array<{ url: string; authorization: string | null; edge: string | null }> = [];
    try {
      const fetchImpl = vi.fn(async (url, init) => {
        const headers = new Headers(init?.headers);
        requests.push({
          url: String(url),
          authorization: headers.get('authorization'),
          edge: headers.get('x-revealui-cron-key'),
        });
        expect(init?.redirect).toBe('manual');
        return requests.length === 1
          ? new Response(null, {
              status: 302,
              headers: { location: 'https://fonts.example.test/font.woff2' },
            })
          : new Response('font', { status: 200 });
      }) as typeof fetch;
      await fresh.fetchScoped(
        'https://www.revealui.com/font.woff2',
        {
          headers: {
            authorization: 'Bearer fixture-key',
            'x-revealui-cron-key': 'caller-key',
          },
        },
        { fetchImpl },
      );
      expect(requests.map((r) => r.authorization)).toEqual(['Bearer fixture-key', null]);
      expect(requests.map((r) => r.edge)).toEqual([null, null]);
    } finally {
      if (previous === undefined) delete process.env.REVEALUI_CRON_EDGE_KEY;
      else process.env.REVEALUI_CRON_EDGE_KEY = previous;
      delete require.cache[scriptPath];
    }
  });
  it('drops credentials on a scheme change, a sibling host, and a lookalike host', async () => {
    const authorizations: Array<string | null> = [];
    const targets = [
      'https://docs.revealui.com/a',
      'http://docs.revealui.com/b',
      'https://revealui.com.attacker.test/c',
    ];
    const fetchImpl = vi.fn(async (_url, init) => {
      authorizations.push(new Headers(init?.headers).get('authorization'));
      const target = targets.shift();
      return target
        ? new Response(null, { status: 307, headers: { location: target } })
        : new Response('ok');
    }) as typeof fetch;
    await verify.fetchScoped(
      'https://revealui.com/',
      { headers: { authorization: 'Bearer fixture-key', 'x-revealui-cron-key': 'caller-key' } },
      { fetchImpl },
    );
    expect(authorizations).toEqual(['Bearer fixture-key', null, null, null]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    for (const call of fetchImpl.mock.calls) {
      expect(new Headers(call[1]?.headers).has('x-revealui-cron-key')).toBe(false);
    }
  });
  it('bounds redirect loops and rejects malformed or absent locations', async () => {
    const loop = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: '/again' } }),
    ) as typeof fetch;
    await expect(
      verify.fetchScoped('https://docs.revealui.com/', {}, { fetchImpl: loop, maxRedirects: 2 }),
    ).rejects.toThrow('Redirect limit exceeded');
    expect(loop).toHaveBeenCalledTimes(3);
    await expect(
      verify.fetchScoped(
        'https://docs.revealui.com/',
        {},
        {
          fetchImpl: vi.fn(async () => new Response(null, { status: 302 })) as typeof fetch,
        },
      ),
    ).rejects.toThrow('Redirect missing Location');
    await expect(
      verify.fetchScoped(
        'https://docs.revealui.com/',
        {},
        {
          fetchImpl: vi.fn(
            async () => new Response(null, { status: 302, headers: { location: 'https://[' } }),
          ) as typeof fetch,
        },
      ),
    ).rejects.toThrow('Invalid redirect Location');
  });
  it('reports challenge metadata without response bodies or query strings', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('DO NOT LOG BODY', {
          status: 403,
          headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'runner-ray' },
        }),
    ) as typeof fetch;
    const error = await verify
      .fetchDeployed('https://www.revealui.com/?sensitive=query', { fetchImpl })
      .catch((e) => e);
    expect(error.transport).toMatchObject({
      status: 403,
      cfMitigated: 'challenge',
      cfRay: 'runner-ray',
      origin: 'https://www.revealui.com',
    });
    expect(error.message).not.toContain('sensitive=query');
    expect(error.message).not.toContain('DO NOT LOG BODY');
    expect(JSON.stringify(error.transport)).not.toContain('edgeKey');
  });
  it('redacts credential material reflected in a challenge ray or a redirected origin', async () => {
    const secret = 'fixture-key';
    const challenged = await verify.fetchScoped(
      'https://www.revealui.com/?sensitive=query',
      { headers: { authorization: secret, 'x-revealui-cron-key': 'caller-key' } },
      {
        fetchImpl: vi.fn(async (_url, init) => {
          expect(new Headers(init?.headers).has('x-revealui-cron-key')).toBe(false);
          expect(new Headers(init?.headers).get('authorization')).toBe(secret);
          return new Response('DO NOT LOG BODY', {
            status: 403,
            headers: { 'cf-mitigated': 'challenge', 'cf-ray': `${secret}-ray` },
          });
        }) as typeof fetch,
      },
    );
    expect(challenged.diagnostic).toMatchObject({
      status: 403,
      cfMitigated: 'challenge',
      cfRay: '[redacted]-ray',
    });
    expect(JSON.stringify(challenged.diagnostic)).not.toContain(secret);

    const fetchImpl = vi.fn(async (url, init) => {
      if (String(url).includes('www.revealui.com')) {
        expect(new Headers(init?.headers).get('authorization')).toBe(secret);
        return new Response(null, {
          status: 302,
          headers: { location: `https://${secret}.example.com/private?secret=query` },
        });
      }
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      throw new Error('PRIVATE BODY');
    }) as typeof fetch;
    const error = await verify
      .fetchScoped(
        'https://www.revealui.com/',
        { headers: { authorization: secret } },
        { fetchImpl },
      )
      .catch((e) => e);
    expect(error.transport.origin).toBe('https://[redacted].example.com');
    expect(JSON.stringify(error.transport)).not.toContain(secret);
    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain('private');
    expect(error.message).not.toContain('secret=query');
    expect(error.message).not.toContain('PRIVATE BODY');
  });
  it('reachability preflight succeeds publicly without token parity', async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      expect(new Headers(init?.headers).has('x-revealui-cron-key')).toBe(false);
      expect(new Headers(init?.headers).has('authorization')).toBe(false);
      return new Response('<html><style>:root{--rvui-old:obsolete}</style></html>');
    }) as typeof fetch;
    expect(
      await verify.verifyReachability('https://www.revealui.com/', { fetchImpl }),
    ).toMatchObject({ ok: true, transportFailures: [] });
  });
  it('CSS access failures remain transport failures instead of being silently discarded', async () => {
    const fetchImpl = vi.fn(async (url) =>
      String(url).endsWith('.css')
        ? new Response('challenge', {
            status: 403,
            headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'css-ray' },
          })
        : new Response('<link rel="stylesheet" href="/assets/app.css">'),
    ) as typeof fetch;
    const result = await verify.fetchDeployed('https://docs.revealui.com/', { fetchImpl });
    expect(result.transportFailures).toEqual([
      expect.objectContaining({
        status: 403,
        cfMitigated: 'challenge',
        cfRay: 'css-ray',
        origin: 'https://docs.revealui.com',
      }),
    ]);
  });
  it('preflight ignores old asset damage and reports page challenges before mutation', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('<link rel="stylesheet" href="/missing.css">'),
    ) as typeof fetch;
    expect(
      await verify.verifyReachability('https://www.revealui.com/', { fetchImpl }),
    ).toMatchObject({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const blocked = await verify.verifyReachability('https://www.revealui.com/', {
      fetchImpl: vi.fn(
        async () =>
          new Response('challenge', {
            status: 403,
            headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'runner-ray' },
          }),
      ) as typeof fetch,
    });
    expect(blocked).toMatchObject({
      ok: false,
      transportFailures: [
        expect.objectContaining({
          status: 403,
          cfRay: 'runner-ray',
          origin: 'https://www.revealui.com',
        }),
      ],
    });
  });
  it('asset HEAD fallback uses the same scoped transport for GET', async () => {
    const methods: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        methods.push(init.method);
        expect(init.redirect).toBe('manual');
        return new Response(null, { status: init.method === 'HEAD' ? 405 : 200 });
      }),
    );
    expect(await verify.defaultFetchAsset('https://fonts.example.test/a.woff2')).toBe(true);
    expect(methods).toEqual(['HEAD', 'GET']);
  });
});
