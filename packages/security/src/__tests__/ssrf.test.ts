import { describe, expect, it, vi } from 'vitest';
import {
  assertPublicUrl,
  createSafeFetch,
  isPrivateIp,
  isPrivateIpv4,
  isPrivateIpv6,
} from '../ssrf.js';

describe('isPrivateIpv4', () => {
  const privateIps = [
    '0.0.0.0',
    '0.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1', // CGN
    '127.0.0.1',
    '127.255.255.255',
    '169.254.1.1', // link-local
    '172.16.0.1',
    '172.31.255.255',
    '192.0.0.1', // IETF
    '192.0.2.1', // TEST-NET-1
    '192.168.0.1',
    '192.168.255.255',
    '198.18.0.1', // benchmarking
    '198.51.100.1', // TEST-NET-2
    '203.0.113.1', // TEST-NET-3
    '224.0.0.1', // multicast
    '239.255.255.255',
    '240.0.0.1', // reserved
    '255.255.255.255',
  ];

  const publicIps = [
    '1.1.1.1',
    '8.8.8.8',
    '93.184.216.34', // example.com
    '104.16.132.229', // cloudflare
    '172.15.255.255', // just below private range
    '172.32.0.0', // just above private range
    '198.17.255.255', // just below benchmarking
    '198.20.0.0', // just above benchmarking
    '223.255.255.255', // just below multicast
  ];

  for (const ip of privateIps) {
    it(`rejects private IP: ${ip}`, () => {
      expect(isPrivateIpv4(ip)).toBe(true);
    });
  }

  for (const ip of publicIps) {
    it(`allows public IP: ${ip}`, () => {
      expect(isPrivateIpv4(ip)).toBe(false);
    });
  }

  it('treats malformed IPs as private (fail-closed)', () => {
    expect(isPrivateIpv4('not-an-ip')).toBe(true);
    expect(isPrivateIpv4('256.1.2.3')).toBe(true);
    expect(isPrivateIpv4('1.2.3')).toBe(true);
    expect(isPrivateIpv4('')).toBe(true);
  });
});

describe('isPrivateIpv6', () => {
  const privateIps = [
    '::',
    '::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback (dotted)
    '::ffff:7f00:1', // IPv4-mapped loopback (hex form — bypassed the old regex)
    '::ffff:10.0.0.1', // IPv4-mapped private
    '::ffff:a9fe:1', // IPv4-mapped link-local 169.254.0.1 (hex form)
    '::ffff:192.168.1.1', // IPv4-mapped private
    'fe80::1', // link-local
    'fe80::abcd:1234:5678:9abc',
    'fc00::1', // ULA
    'fd00::1', // ULA
    'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'ff02::1', // multicast
    '2001:db8::1', // documentation
    '0100::1', // discard
  ];

  const publicIps = [
    '2001:4860:4860::8888', // Google DNS
    '2606:4700:4700::1111', // Cloudflare DNS
    '2001:0db9::1', // NOT documentation (db9, not db8)
  ];

  for (const ip of privateIps) {
    it(`rejects private IPv6: ${ip}`, () => {
      expect(isPrivateIpv6(ip)).toBe(true);
    });
  }

  for (const ip of publicIps) {
    it(`allows public IPv6: ${ip}`, () => {
      expect(isPrivateIpv6(ip)).toBe(false);
    });
  }
});

describe('isPrivateIp', () => {
  it('delegates IPv4', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('delegates IPv6', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('2001:4860:4860::8888')).toBe(false);
  });
});

describe('assertPublicUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(assertPublicUrl('ftp://example.com')).rejects.toThrow('disallowed protocol');
    await expect(assertPublicUrl('file:///etc/passwd')).rejects.toThrow('disallowed protocol');
    await expect(assertPublicUrl('javascript:alert(1)')).rejects.toThrow('SSRF');
  });

  it('rejects IP literal pointing to private range', async () => {
    await expect(assertPublicUrl('http://127.0.0.1/')).rejects.toThrow('private');
    await expect(assertPublicUrl('http://10.0.0.1:8080/path')).rejects.toThrow('private');
    await expect(assertPublicUrl('http://192.168.1.1/')).rejects.toThrow('private');
    await expect(assertPublicUrl('http://0.0.0.0/')).rejects.toThrow('private');
    await expect(assertPublicUrl('http://169.254.169.254/')).rejects.toThrow('private');
  });

  it('rejects IPv6 literal pointing to private range', async () => {
    await expect(assertPublicUrl('http://[::1]/')).rejects.toThrow('private');
    await expect(assertPublicUrl('http://[fc00::1]/')).rejects.toThrow('private');
  });

  it('allows public IP literals and returns them', async () => {
    await expect(assertPublicUrl('https://1.1.1.1/')).resolves.toEqual(['1.1.1.1']);
    await expect(assertPublicUrl('https://8.8.8.8/dns-query')).resolves.toEqual(['8.8.8.8']);
  });

  it('rejects invalid URLs', async () => {
    await expect(assertPublicUrl('not-a-url')).rejects.toThrow('invalid URL');
  });

  it('resolves real hostnames and allows public ones', async () => {
    // This test hits real DNS — skip if offline
    try {
      await assertPublicUrl('https://api.stripe.com/v1/charges');
    } catch (e) {
      // DNS failure in CI is not a test failure
      if ((e as Error).message.includes('SSRF')) {
        throw e; // actual SSRF rejection = bug
      }
    }
  });
});

describe('createSafeFetch', () => {
  const stubDispatcher = async (): Promise<unknown> => ({ stub: true });

  it('rejects a private/metadata target before opening a connection', async () => {
    const baseFetch = vi.fn();
    const safeFetch = createSafeFetch({
      baseFetch: baseFetch as unknown as typeof fetch,
      dispatcherFactory: stubDispatcher,
    });
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow('SSRF');
    await expect(safeFetch('http://127.0.0.1/')).rejects.toThrow('SSRF');
    await expect(safeFetch('http://[::1]/')).rejects.toThrow('SSRF');
    expect(baseFetch).not.toHaveBeenCalled();
  });

  it('dials a public target with the pinned dispatcher and manual redirect', async () => {
    const dispatcher = { sentinel: true };
    const okResponse = new Response('ok', { status: 200 });
    const baseFetch = vi.fn().mockResolvedValue(okResponse);
    const safeFetch = createSafeFetch({
      baseFetch: baseFetch as unknown as typeof fetch,
      dispatcherFactory: async () => dispatcher,
    });

    const res = await safeFetch('https://1.1.1.1/path');

    expect(res).toBe(okResponse);
    expect(baseFetch).toHaveBeenCalledTimes(1);
    const init = baseFetch.mock.calls[0]?.[1] as RequestInit & { dispatcher: unknown };
    expect(init.redirect).toBe('manual');
    expect(init.dispatcher).toBe(dispatcher);
  });

  it('refuses to follow redirects (SSRF-guard bypass)', async () => {
    const redirect = new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/' },
    });
    const baseFetch = vi.fn().mockResolvedValue(redirect);
    const safeFetch = createSafeFetch({
      baseFetch: baseFetch as unknown as typeof fetch,
      dispatcherFactory: stubDispatcher,
    });
    await expect(safeFetch('https://1.1.1.1/')).rejects.toThrow('refusing to follow redirect');
  });

  // GAP-455. A dispatcher that cannot be built used to surface as a bare
  // TypeError with no `cause` and no `code` — indistinguishable from a network
  // fault. A "worker unreachable" alarm was actually this, and it took four
  // rounds and three production deploys to tell the two apart.
  describe('when the connection guard cannot be built', () => {
    it('reports a guard failure, not something that looks like a network fault', async () => {
      const baseFetch = vi.fn();
      const safeFetch = createSafeFetch({
        baseFetch: baseFetch as unknown as typeof fetch,
        dispatcherFactory: async () => {
          throw new TypeError('Agent is not a constructor');
        },
      });

      await expect(safeFetch('https://1.1.1.1/')).rejects.toThrow('SSRF:');
      // Fails CLOSED: the request must not proceed unpinned.
      expect(baseFetch).not.toHaveBeenCalled();
    });

    it('does not leak the target into the guard-failure message', async () => {
      const safeFetch = createSafeFetch({
        baseFetch: vi.fn() as unknown as typeof fetch,
        dispatcherFactory: async () => {
          throw new TypeError('boom');
        },
      });

      const err = await safeFetch('https://1.1.1.1/secret-path').catch((e: Error) => e);
      expect(err.message.startsWith('SSRF: connection guard unavailable')).toBe(true);
      expect(err.message).not.toContain('1.1.1.1');
      expect(err.message).not.toContain('secret-path');
    });

    it('retries construction instead of caching the rejection forever', async () => {
      let attempts = 0;
      const dispatcher = { sentinel: true };
      const baseFetch = vi.fn(async () => new Response('ok', { status: 200 }));

      const safeFetch = createSafeFetch({
        baseFetch: baseFetch as unknown as typeof fetch,
        dispatcherFactory: async () => {
          attempts += 1;
          if (attempts === 1) throw new TypeError('transient');
          return dispatcher;
        },
      });

      await expect(safeFetch('https://1.1.1.1/')).rejects.toThrow('SSRF:');
      // Second call must rebuild. Memoizing the rejected promise previously
      // poisoned every later call for the life of the process.
      await expect(safeFetch('https://1.1.1.1/')).resolves.toBeDefined();
      expect(attempts).toBe(2);
    });
  });
});
