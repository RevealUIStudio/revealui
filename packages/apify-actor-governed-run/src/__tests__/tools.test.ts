import { describe, expect, it, vi } from 'vitest';

// Guardrail-2 blocker 3 (revealui#2198 REQUEST-CHANGES): `isBlockedHost` did
// string equality/prefix matching on `url.hostname` with no DNS resolution,
// and never stripped the brackets WHATWG URL wraps around a literal IPv6
// host. The reviewer probed the guard directly and found 8 of 13 targets
// slipped through (IPv6 entirely unfiltered, a loopback/link-local/CGN
// address one hop past the single hardcoded value, and a public DNS name
// with a static A record pointed at the cloud metadata IP). The 13-target
// table below is the reviewer's reproduction, verbatim; every one of them
// must resolve to "blocked" after the fix (or the tool must be disabled).
//
// `169.254.169.254.nip.io` needs a real DNS query to resolve for real (nip.io
// wildcard-DNS's any `<ip>.nip.io` name to `<ip>`) -- mocked here so the test
// is deterministic and does not depend on network access in CI/sandboxes.
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (hostname: string, _options: unknown) => {
    if (hostname === '169.254.169.254.nip.io') {
      return [{ address: '169.254.169.254', family: 4 }];
    }
    throw new Error(`unexpected dns lookup in test for host: ${hostname}`);
  }),
}));

const { BUILT_IN_TOOLS, selectTools, webFetchTool } = await import('../agent/tools.js');

describe('selectTools', () => {
  it('returns all built-in tools when no allowlist is given', () => {
    expect(selectTools(undefined)).toEqual(BUILT_IN_TOOLS);
  });

  it('returns no tools for an empty allowlist', () => {
    expect(selectTools([])).toEqual([]);
  });

  it('filters to only the allowed tool names', () => {
    expect(selectTools(['web_fetch']).map((t) => t.name)).toEqual(['web_fetch']);
    expect(selectTools(['nonexistent'])).toEqual([]);
  });
});

describe('webFetchTool', () => {
  it('rejects an invalid URL', async () => {
    const result = await webFetchTool.execute({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-http(s) protocol', async () => {
    const result = await webFetchTool.execute({ url: 'file:///etc/passwd' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/http\/https/);
  });

  it('rejects malformed params', async () => {
    const result = await webFetchTool.execute({ notUrl: 'nope' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid params/);
  });

  describe("SSRF guard -- the reviewer's 13-target probe table (prove red)", () => {
    const mustBeBlocked: Array<[label: string, url: string]> = [
      ['IPv6 loopback (bracket-stripping bug: WHATWG URL yields "[::1]")', 'http://[::1]/'],
      ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/'],
      ['IPv4-mapped IPv6 cloud metadata address', 'http://[::ffff:a9fe:a9fe]/'],
      ['IPv6 unique local address (ULA, fc00::/7)', 'http://[fd00::1]/'],
      ['loopback range beyond the single hardcoded 127.0.0.1', 'http://127.0.0.2/'],
      ['link-local range beyond the single hardcoded metadata IP', 'http://169.254.169.253/'],
      ['carrier-grade NAT / cloud metadata range (100.64.0.0/10)', 'http://100.100.100.200/'],
      [
        'public DNS name with a static A record at the metadata IP',
        'http://169.254.169.254.nip.io/',
      ],
      ['decimal-encoded IPv4 (normalizes to the metadata IP)', 'http://2852039166/'],
      ['hex-encoded IPv4 (normalizes to loopback)', 'http://0x7f000001/'],
      ['short-form IPv4 (normalizes to loopback)', 'http://127.1/'],
      ['canonical loopback', 'http://127.0.0.1/'],
      ['canonical cloud metadata endpoint', 'http://169.254.169.254/'],
    ];

    it.each(mustBeBlocked)('blocks: %s (%s)', async (_label, url) => {
      const result = await webFetchTool.execute({ url });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
    });
  });

  it('rejects private RFC1918 ranges', async () => {
    for (const url of ['http://10.0.0.5/', 'http://192.168.1.1/', 'http://172.16.0.1/']) {
      const result = await webFetchTool.execute({ url });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
    }
  });

  it('rejects .internal and .local suffixed hostnames', async () => {
    for (const url of ['http://foo.internal/', 'http://bar.local/']) {
      const result = await webFetchTool.execute({ url });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
    }
  });
});
