import { lookup as dnsLookup } from 'node:dns/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

interface LookupHit {
  address: string;
  family: number;
}

interface RecordedRequest {
  hostname: string | undefined;
  servername: string | undefined;
  protocol: string | undefined;
  rejectUnauthorized: boolean | undefined;
  lookupResults: LookupHit[];
  invokeLookup: () => LookupHit[];
}

const netHarness = vi.hoisted(() => {
  const httpRequests: RecordedRequest[] = [];
  const httpsRequests: RecordedRequest[] = [];
  const response = {
    status: 200,
    body: 'ok',
    headers: {} as Record<string, string>,
  };

  function readLookup(
    lookup: (
      hostname: string,
      options: { all?: boolean },
      callback: (
        err: NodeJS.ErrnoException | null,
        address: string | LookupHit[],
        family?: number,
      ) => void,
    ) => void,
    hostname: string,
  ): LookupHit[] {
    let hits: LookupHit[] | undefined;
    lookup(hostname, { all: true }, (err, address) => {
      if (err) throw err;
      if (!Array.isArray(address)) {
        throw new Error('pinned lookup must answer with the full address list');
      }
      hits = address.map((entry) => ({ address: entry.address, family: entry.family }));
    });
    if (!hits) {
      throw new Error('pinned lookup must answer before returning');
    }
    return hits;
  }

  function record(sink: RecordedRequest[], rawOptions: unknown, callback: unknown) {
    const options = rawOptions as {
      hostname?: string;
      servername?: string;
      protocol?: string;
      rejectUnauthorized?: boolean;
      lookup?: (
        hostname: string,
        options: { all?: boolean },
        callback: (
          err: NodeJS.ErrnoException | null,
          address: string | LookupHit[],
          family?: number,
        ) => void,
      ) => void;
    };
    const invokeLookup = (): LookupHit[] => {
      if (typeof options.lookup !== 'function') return [];
      return readLookup(options.lookup, options.hostname ?? '');
    };
    const recorded: RecordedRequest = {
      hostname: options.hostname,
      servername: options.servername,
      protocol: options.protocol,
      rejectUnauthorized: options.rejectUnauthorized,
      lookupResults: invokeLookup(),
      invokeLookup,
    };
    sink.push(recorded);

    const listeners: Record<string, Array<(chunk?: Buffer) => void>> = {};
    const res = {
      statusCode: response.status,
      headers: { ...response.headers },
      on(event: string, handler: (chunk?: Buffer) => void) {
        const list = listeners[event] ?? [];
        list.push(handler);
        listeners[event] = list;
        return res;
      },
      resume() {
        return res;
      },
    };
    const body = response.body;
    return {
      on() {
        return this;
      },
      destroy() {},
      end() {
        if (typeof callback === 'function') {
          (callback as (value: typeof res) => void)(res);
        }
        for (const handler of listeners.data ?? []) handler(Buffer.from(body));
        for (const handler of listeners.end ?? []) handler();
      },
    };
  }

  return { httpRequests, httpsRequests, response, record };
});

vi.mock('node:http', async () => {
  const actual = await vi.importActual<typeof import('node:http')>('node:http');
  const request = (options: unknown, callback: unknown) =>
    netHarness.record(netHarness.httpRequests, options, callback);
  const mocked = { ...actual, request };
  return { ...mocked, default: mocked };
});

vi.mock('node:https', async () => {
  const actual = await vi.importActual<typeof import('node:https')>('node:https');
  const request = (options: unknown, callback: unknown) =>
    netHarness.record(netHarness.httpsRequests, options, callback);
  const mocked = { ...actual, request };
  return { ...mocked, default: mocked };
});

const { BUILT_IN_TOOLS, selectTools, webFetchTool } = await import('../agent/tools.js');

const defaultDns = vi.mocked(dnsLookup).getMockImplementation();

afterEach(() => {
  if (defaultDns) vi.mocked(dnsLookup).mockImplementation(defaultDns);
  netHarness.httpRequests.length = 0;
  netHarness.httpsRequests.length = 0;
  netHarness.response.status = 200;
  netHarness.response.body = 'ok';
  netHarness.response.headers = {};
});

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
      // Guardrail-2 APPROVE-with-residuals on revealui#2202
      // (https://github.com/RevealUIStudio/revealui/pull/2202#issuecomment-5085198453):
      // two more IPv6 bypasses the 13-target probe above did not cover.
      ['IPv6 unspecified address (:: routes to localhost on Linux)', 'http://[::]/'],
      [
        'NAT64 well-known prefix (64:ff9b::/96) embedding the cloud metadata IPv4 address',
        'http://[64:ff9b::a9fe:a9fe]/',
      ],
    ];

    it.each(mustBeBlocked)('blocks: %s (%s)', async (_label, url) => {
      const result = await webFetchTool.execute({ url });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
    });
  });

  describe('SSRF guard -- confirmed-reachable addresses must not be over-blocked', () => {
    const mustStayReachable: Array<[label: string, ip: string]> = [
      ['just past the 172.16.0.0/12 private range', '172.32.0.1'],
      ['just past the 100.64.0.0/10 CGNAT range', '100.128.0.1'],
    ];

    it.each(mustStayReachable)('does not block: %s (%s)', async (_label, ip) => {
      const result = await webFetchTool.execute({ url: `http://${ip}/` });
      expect(netHarness.httpRequests).toHaveLength(1);
      expect(netHarness.httpRequests[0]?.lookupResults).toEqual([{ address: ip, family: 4 }]);
      expect(result.success).toBe(true);
      expect(result.content).toBe('ok');
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

  describe('SSRF guard: additional non-global IPv6 ranges', () => {
    const mustBeBlocked: Array<[label: string, url: string]> = [
      [
        'NAT64 local-use prefix (64:ff9b:1::/48) embedding a link-local IPv4 address',
        'http://[64:ff9b:1::169.254.169.254]/',
      ],
      [
        'NAT64 local-use prefix (64:ff9b:1::/48) with a public IPv4 in the low 32 bits',
        'http://[64:ff9b:1::8.8.8.8]/',
      ],
      ['multicast (ff00::/8)', 'http://[ff02::1]/'],
      ['documentation prefix (2001:db8::/32)', 'http://[2001:db8::1]/'],
      ['discard-only prefix (100::/64)', 'http://[100::1]/'],
      ['IPv4-compatible loopback (::a.b.c.d)', 'http://[::127.0.0.1]/'],
      ['IPv4-compatible private address (::a.b.c.d)', 'http://[::192.168.1.1]/'],
      ['6to4 (2002::/16) embedding a private IPv4 address', 'http://[2002:c0a8:101::]/'],
      ['6to4 (2002::/16) embedding a link-local IPv4 address', 'http://[2002:a9fe:a9fe::]/'],
    ];

    it.each(mustBeBlocked)('blocks: %s (%s)', async (_label, url) => {
      const result = await webFetchTool.execute({ url });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not allowed/);
    });

    const mustStayReachable: Array<[label: string, url: string]> = [
      ['global unicast outside the documentation prefix', 'http://[2001:db9::1]/'],
      ['6to4 embedding a public IPv4 address', 'http://[2002:808:808::]/'],
      ['IPv4-compatible form of a public IPv4 address', 'http://[::8.8.8.8]/'],
      ['NAT64 well-known prefix embedding a public IPv4 address', 'http://[64:ff9b::8.8.8.8]/'],
      ['address just outside the NAT64 local-use prefix', 'http://[64:ff9b:2::1]/'],
      ['address just outside the discard-only prefix', 'http://[100:0:0:1::]/'],
    ];

    it.each(mustStayReachable)('does not block: %s (%s)', async (_label, url) => {
      const result = await webFetchTool.execute({ url });
      const address = new URL(url).hostname.slice(1, -1);
      expect(netHarness.httpRequests).toHaveLength(1);
      expect(netHarness.httpRequests[0]?.lookupResults).toEqual([{ address, family: 6 }]);
      expect(result.success).toBe(true);
      expect(result.content).toBe('ok');
    });
  });

  it('refuses a name when any resolved address is blocked, and does not dial', async () => {
    vi.mocked(dnsLookup).mockImplementation(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ]);
    const result = await webFetchTool.execute({ url: 'http://mixed.example/' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed/);
    expect(netHarness.httpRequests).toHaveLength(0);
    expect(netHarness.httpsRequests).toHaveLength(0);
  });

  it('fails closed when resolution throws, and does not dial', async () => {
    const result = await webFetchTool.execute({ url: 'http://unresolved.example/' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not allowed/);
    expect(netHarness.httpRequests).toHaveLength(0);
  });

  it('does not follow a redirect response', async () => {
    netHarness.response.status = 302;
    netHarness.response.headers = { location: 'http://10.0.0.1/' };
    const result = await webFetchTool.execute({ url: 'http://172.32.0.1/start' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/redirects are not followed/);
    expect(netHarness.httpRequests).toHaveLength(1);
    expect(netHarness.httpsRequests).toHaveLength(0);
  });

  describe('DNS rebinding', () => {
    const publicAddress = '93.184.216.34';
    const privateAddress = '169.254.169.254';

    it.each([
      ['http://rebind.example/a', 'httpRequests', 'httpsRequests'],
      ['https://rebind.example/a', 'httpsRequests', 'httpRequests'],
    ] as const)(
      'pins %s to the first public answer when a later lookup is private',
      async (url, usedKey, unusedKey) => {
        let dnsCalls = 0;
        vi.mocked(dnsLookup).mockImplementation(async () => {
          dnsCalls += 1;
          if (dnsCalls === 1) return [{ address: publicAddress, family: 4 }];
          return [{ address: privateAddress, family: 4 }];
        });

        const result = await webFetchTool.execute({ url });
        const used = netHarness[usedKey];
        const recorded = used[0];

        expect(result.success).toBe(true);
        expect(result.content).toBe('ok');
        expect(used).toHaveLength(1);
        expect(netHarness[unusedKey]).toHaveLength(0);
        expect(recorded?.hostname).toBe('rebind.example');
        expect(recorded?.rejectUnauthorized).not.toBe(false);
        expect(recorded?.lookupResults).toEqual([{ address: publicAddress, family: 4 }]);
        expect(recorded?.invokeLookup()).toEqual([{ address: publicAddress, family: 4 }]);
        expect(dnsCalls).toBe(1);
        if (url.startsWith('https:')) {
          expect(recorded?.servername).toBe('rebind.example');
        }
      },
    );
  });
});
