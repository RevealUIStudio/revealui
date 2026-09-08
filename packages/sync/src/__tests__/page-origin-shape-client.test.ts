import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ELECTRIC_INITIAL_OFFSET,
  fetchPageOriginShape,
  resolvePageOriginShapeUrl,
} from '../page-origin-shape-client.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('resolvePageOriginShapeUrl', () => {
  it('builds an absolute same-origin URL when proxyBaseUrl is blank', () => {
    const url = resolvePageOriginShapeUrl('', '/api/shapes/kg-nodes');

    expect(() => new URL(url)).not.toThrow();
    const parsed = new URL(url);
    expect(parsed.origin).toBe(window.location.origin);
    expect(parsed.pathname).toBe('/api/shapes/kg-nodes');
    expect(parsed.origin.length).toBeGreaterThan(0);
  });

  it('treats whitespace-only and relative bases as missing (Electric new URL has no base)', () => {
    const fromWhitespace = resolvePageOriginShapeUrl('   ', '/api/shapes/kg-edges');
    const fromRelative = resolvePageOriginShapeUrl('/admin', '/api/shapes/kg-edge-episodes');

    expect(() => new URL(fromWhitespace)).not.toThrow();
    expect(() => new URL(fromRelative)).not.toThrow();
    expect(new URL(fromWhitespace).href).toBe(`${window.location.origin}/api/shapes/kg-edges`);
    expect(new URL(fromRelative).href).toBe(
      `${window.location.origin}/api/shapes/kg-edge-episodes`,
    );
  });

  it('honors an explicit absolute proxy base', () => {
    const url = resolvePageOriginShapeUrl('https://admin.example.com', '/api/shapes/kg-nodes');

    expect(url).toBe('https://admin.example.com/api/shapes/kg-nodes');
  });
});

describe('fetchPageOriginShape', () => {
  function stubFetch(): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('[]', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function requestedUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
    const input = fetchMock.mock.calls[0]?.[0];
    if (input instanceof URL) return input;
    return new URL(String(input));
  }

  it('sends offset=-1 when Electric omitted offset', async () => {
    const fetchMock = stubFetch();

    await fetchPageOriginShape(`${window.location.origin}/api/shapes/kg-nodes`);

    const url = requestedUrl(fetchMock);
    expect(url.searchParams.get('offset')).toBe(ELECTRIC_INITIAL_OFFSET);
    expect(url.searchParams.get('offset')?.length).toBeGreaterThan(0);
  });

  it('never forwards a blank offset', async () => {
    const fetchMock = stubFetch();

    await fetchPageOriginShape(`${window.location.origin}/api/shapes/kg-nodes?offset=`);

    expect(requestedUrl(fetchMock).searchParams.get('offset')).toBe(ELECTRIC_INITIAL_OFFSET);
  });

  it('keeps a real Electric log offset', async () => {
    const fetchMock = stubFetch();

    await fetchPageOriginShape(`${window.location.origin}/api/shapes/kg-nodes?offset=26800584_4`);

    expect(requestedUrl(fetchMock).searchParams.get('offset')).toBe('26800584_4');
  });
});
