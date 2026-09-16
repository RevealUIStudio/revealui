import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const UMAMI_URL = 'https://revealui-umami.fly.dev';
const UMAMI_WEBSITE_ID = 'ae84350d-1ea1-4515-b921-a6b14854d457';
const UMAMI_SEND_ENDPOINT = `${UMAMI_URL}/api/send`;

function makeListenerHub() {
  const listeners: Map<string, EventListenerOrEventListenerObject[]> = new Map();
  return {
    addEventListener(type: string, handler: EventListenerOrEventListenerObject) {
      const list = listeners.get(type) ?? [];
      list.push(handler);
      listeners.set(type, list);
    },
    dispatchEvent(event: Event) {
      const list = listeners.get(event.type) ?? [];
      for (const handler of list) {
        if (typeof handler === 'function') {
          handler(event);
        } else {
          handler.handleEvent(event);
        }
      }
      return true;
    },
  };
}

function makeDocumentStub(
  cookie = `revealui-cookie-consent=${encodeURIComponent(JSON.stringify({ analytics: true }))}`,
) {
  return {
    ...makeListenerHub(),
    referrer: 'https://news.example/article',
    title: 'Pricing | RevealUI',
    cookie,
  };
}

function makeWindowStub(overrides?: {
  href?: string;
  pathname?: string;
  search?: string;
  hostname?: string;
}) {
  const href =
    overrides?.href ??
    'https://revealui.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch';
  const url = new URL(href);
  const hub = makeListenerHub();
  const location = {
    href,
    pathname: overrides?.pathname ?? url.pathname,
    search: overrides?.search ?? url.search,
    hostname: overrides?.hostname ?? url.hostname,
  };
  const historyState = {
    pushState(_data: unknown, _unused: string, nextUrl?: string | URL | null) {
      if (typeof nextUrl === 'string') {
        const resolved = new URL(nextUrl, url.origin);
        location.href = resolved.href;
        location.pathname = resolved.pathname;
        location.search = resolved.search;
        location.hostname = resolved.hostname;
      }
    },
    replaceState(_data: unknown, _unused: string, nextUrl?: string | URL | null) {
      historyState.pushState(_data, _unused, nextUrl);
    },
  };
  return {
    ...hub,
    location,
    history: historyState,
    screen: { width: 1440, height: 900 },
    doNotTrack: undefined as string | undefined,
  };
}

function mockUmamiFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ cache: 'ok' }))));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function readFetchPayload(
  fetchMock: ReturnType<typeof vi.fn>,
  callIndex = 0,
): Promise<{ url: string; body: Record<string, unknown>; headers: HeadersInit }> {
  const [url, init] = fetchMock.mock.calls[callIndex] as [string, RequestInit];
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  return { url, body, headers: init.headers ?? {} };
}

function stubUmamiEnv(): void {
  vi.stubEnv('VITE_UMAMI_URL', UMAMI_URL);
  vi.stubEnv('VITE_UMAMI_WEBSITE_ID', UMAMI_WEBSITE_ID);
}

beforeEach(() => {
  const docStub = makeDocumentStub();
  vi.stubGlobal('document', docStub);
  vi.stubGlobal('navigator', {
    sendBeacon: vi.fn(() => true),
    doNotTrack: null,
  });
  vi.stubGlobal('window', {
    location: { href: 'https://revealui.com/' },
    doNotTrack: undefined,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('analytics sink', () => {
  it('is dormant when VITE_ANALYTICS_DOMAIN is unset', async () => {
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();
    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience: 'technical' } }),
    );
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it('sends an event when configured and the audience event fires', async () => {
    vi.stubEnv('VITE_ANALYTICS_DOMAIN', 'revealui.com');
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();

    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience: 'technical' } }),
    );

    expect(navigator.sendBeacon).toHaveBeenCalledOnce();

    const [, blob] = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Blob,
    ];
    const text = await blob.text();
    const payload = JSON.parse(text) as {
      name: string;
      domain: string;
      props: { audience: string };
    };

    expect(payload.name).toBe('Audience Selected');
    expect(payload.domain).toBe('revealui.com');
    expect(payload.props.audience).toBe('technical');
  });

  it('does not send without analytics consent', async () => {
    vi.stubEnv('VITE_ANALYTICS_DOMAIN', 'revealui.com');
    vi.stubGlobal('document', { ...document, cookie: '' });
    const { track } = await import('../lib/analytics');
    track('Audience Selected', { audience: 'technical' });
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });

  it('honors explicit analytics consent even when DNT is set', async () => {
    vi.stubEnv('VITE_ANALYTICS_DOMAIN', 'revealui.com');
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn(() => true),
      doNotTrack: '1',
    });

    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();

    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience: 'technical' } }),
    );

    expect(navigator.sendBeacon).toHaveBeenCalledOnce();
  });

  it('track() never throws even when sendBeacon throws', async () => {
    vi.stubEnv('VITE_ANALYTICS_DOMAIN', 'revealui.com');
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn(() => {
        throw new Error('beacon failed');
      }),
      doNotTrack: null,
    });

    const { track } = await import('../lib/analytics');

    expect(() => track('Test Event', { foo: 'bar' })).not.toThrow();
  });

  it('is idempotent: calling initAnalytics twice registers only one listener', async () => {
    vi.stubEnv('VITE_ANALYTICS_DOMAIN', 'revealui.com');
    const { initAnalytics } = await import('../lib/analytics');

    initAnalytics();
    initAnalytics();

    document.dispatchEvent(
      new CustomEvent('revealui:audience', { detail: { audience: 'non-technical' } }),
    );

    expect(navigator.sendBeacon).toHaveBeenCalledOnce();
  });
});

describe('Umami traffic sink', () => {
  function installUmamiStubs(options?: {
    cookie?: string;
    href?: string;
  }): ReturnType<typeof vi.fn> {
    vi.stubGlobal('document', makeDocumentStub(options?.cookie));
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn(() => true),
      doNotTrack: null,
      language: 'en-US',
    });
    vi.stubGlobal('window', makeWindowStub(options?.href ? { href: options.href } : undefined));
    return mockUmamiFetch();
  }

  it('is dormant when Umami env is unset', async () => {
    const fetchMock = installUmamiStubs();
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a consent-gated pageview to Studio Umami /api/send with UTM query', async () => {
    stubUmamiEnv();
    const fetchMock = installUmamiStubs();
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();

    expect(fetchMock).toHaveBeenCalledOnce();
    const { url, body, headers } = await readFetchPayload(fetchMock);
    expect(url).toBe(UMAMI_SEND_ENDPOINT);
    expect(body.type).toBe('event');
    const payload = body.payload as Record<string, unknown>;
    expect(payload.website).toBe(UMAMI_WEBSITE_ID);
    expect(payload.hostname).toBe('revealui.com');
    expect(payload.url).toBe('/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=launch');
    expect(payload.name).toBeUndefined();
    expect(payload.referrer).toBe('https://news.example/article');
    expect(payload.title).toBe('Pricing | RevealUI');
    expect(payload.language).toBe('en-US');
    expect(payload.screen).toBe('1440x900');
    const headerRecord = headers as Record<string, string>;
    expect(headerRecord['x-umami-website-id']).toBe(UMAMI_WEBSITE_ID);
    expect(headerRecord['x-umami-hostname']).toBe('revealui.com');
  });

  it('does not send a Umami pageview without analytics consent', async () => {
    stubUmamiEnv();
    const fetchMock = installUmamiStubs({ cookie: '' });
    const { initAnalytics, track } = await import('../lib/analytics');
    initAnalytics();
    track('Audience Selected', { audience: 'technical' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honors explicit analytics consent for Umami even when DNT is set', async () => {
    stubUmamiEnv();
    const fetchMock = installUmamiStubs();
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn(() => true),
      doNotTrack: '1',
      language: 'en-US',
    });
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not send a Umami pageview in the HIPAA profile', async () => {
    stubUmamiEnv();
    vi.stubEnv('VITE_COMPLIANCE_PROFILE', 'hipaa');
    const fetchMock = installUmamiStubs();
    const { initAnalytics, track } = await import('../lib/analytics');
    initAnalytics();
    track('Audience Selected', { audience: 'technical' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards custom track() events to Umami /api/send', async () => {
    stubUmamiEnv();
    const fetchMock = installUmamiStubs();
    const { track } = await import('../lib/analytics');
    track('Audience Selected', { audience: 'technical' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const { url, body } = await readFetchPayload(fetchMock);
    expect(url).toBe(UMAMI_SEND_ENDPOINT);
    const payload = body.payload as Record<string, unknown>;
    expect(payload.name).toBe('Audience Selected');
    expect(payload.website).toBe(UMAMI_WEBSITE_ID);
    expect(payload.data).toEqual({ audience: 'technical' });
  });

  it('sends a pageview after analytics consent is granted', async () => {
    stubUmamiEnv();
    const fetchMock = installUmamiStubs({ cookie: '' });
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal(
      'document',
      makeDocumentStub(
        `revealui-cookie-consent=${encodeURIComponent(JSON.stringify({ analytics: true }))}`,
      ),
    );
    window.dispatchEvent(
      new CustomEvent('revealui:cookie-consent', { detail: { analytics: true } }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const { url, body } = await readFetchPayload(fetchMock);
    expect(url).toBe(UMAMI_SEND_ENDPOINT);
    expect((body.payload as Record<string, unknown>).name).toBeUndefined();
  });

  it('sends a second pageview on SPA history.pushState', async () => {
    stubUmamiEnv();
    const fetchMock = installUmamiStubs({ href: 'https://revealui.com/' });
    const { initAnalytics } = await import('../lib/analytics');
    initAnalytics();
    expect(fetchMock).toHaveBeenCalledOnce();

    window.history.pushState(null, '', '/products');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = await readFetchPayload(fetchMock, 1);
    expect(second.url).toBe(UMAMI_SEND_ENDPOINT);
    expect((second.body.payload as Record<string, unknown>).url).toBe('/products');
  });

  it('does not load Vercel Web Analytics', async () => {
    const entry = readFileSync(path.resolve(process.cwd(), 'app/entry.client.tsx'), 'utf8');
    const pkg = readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8');
    expect(entry.includes('@vercel/analytics')).toBe(false);
    expect(pkg.includes('@vercel/analytics')).toBe(false);
  });
});

describe('marketing CSP allowlist for Studio Umami', () => {
  it('allows revealui-umami.fly.dev on script-src and connect-src and keeps Sentry ingest', () => {
    const vercel = JSON.parse(readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8')) as {
      headers?: Array<{ headers?: Array<{ key: string; value: string }> }>;
    };
    const csp = vercel.headers
      ?.flatMap((entry) => entry.headers ?? [])
      .find((header) => header.key === 'Content-Security-Policy')?.value;

    expect(csp).toBeDefined();
    const directives = (csp ?? '').split('; ');
    const scriptSrc = directives.find((directive) => directive.startsWith('script-src '));
    const connectSrc = directives.find((directive) => directive.startsWith('connect-src '));

    expect(scriptSrc?.includes(UMAMI_URL)).toBe(true);
    expect(connectSrc?.includes(UMAMI_URL)).toBe(true);
    expect(connectSrc?.includes('https://*.ingest.sentry.io')).toBe(true);
    expect(connectSrc?.includes('https://*.ingest.us.sentry.io')).toBe(true);
  });
});
