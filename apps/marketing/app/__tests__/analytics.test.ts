import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeDocumentStub() {
  const listeners: Map<string, EventListenerOrEventListenerObject[]> = new Map();
  return {
    referrer: '',
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

  it('does not send when DNT is enabled', async () => {
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

    expect(navigator.sendBeacon).not.toHaveBeenCalled();
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
