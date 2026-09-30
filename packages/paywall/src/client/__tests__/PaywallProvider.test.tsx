/**
 * @vitest-environment jsdom
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { createPaywall } from '../../core/paywall.js';
import { PaywallGate, PaywallProvider, usePaywall } from '../index.js';
import { mount, waitForText } from './mount.js';

const paywall = createPaywall();

describe('PaywallProvider', () => {
  it('renders children', () => {
    const html = renderToString(
      createElement(
        PaywallProvider,
        { paywall, resolveTier: async () => 'free' },
        createElement('div', null, 'hello'),
      ),
    );

    expect(html).toContain('hello');
  });

  it('provides default tier during SSR/initial render', () => {
    function TierDisplay() {
      const { tier, isLoading } = usePaywall();
      return createElement('span', { 'data-tier': tier, 'data-loading': String(isLoading) });
    }

    const html = renderToString(
      createElement(
        PaywallProvider,
        { paywall, resolveTier: async () => 'pro' },
        createElement(TierDisplay),
      ),
    );

    // Initial render: tier is the default ('free'), isLoading is true
    expect(html).toContain('data-tier="free"');
    expect(html).toContain('data-loading="true"');
  });
});

describe('usePaywall', () => {
  it('throws when used outside PaywallProvider', () => {
    function Orphan() {
      usePaywall();
      return null;
    }

    expect(() => {
      renderToString(createElement(Orphan));
    }).toThrow('usePaywall must be used within a <PaywallProvider>');
  });

  it('exposes the paywall instance', () => {
    let capturedPaywall: unknown = null;

    function Inspector() {
      const ctx = usePaywall();
      capturedPaywall = ctx.paywall;
      return null;
    }

    renderToString(
      createElement(
        PaywallProvider,
        { paywall, resolveTier: async () => 'free' },
        createElement(Inspector),
      ),
    );

    expect(capturedPaywall).toBe(paywall);
  });

  it('exposes a refetch function', () => {
    let capturedRefetch: unknown = null;

    function Inspector() {
      const ctx = usePaywall();
      capturedRefetch = ctx.refetch;
      return null;
    }

    renderToString(
      createElement(
        PaywallProvider,
        { paywall, resolveTier: async () => 'free' },
        createElement(Inspector),
      ),
    );

    expect(typeof capturedRefetch).toBe('function');
  });
});

describe('PaywallGate', () => {
  it('renders loading state during initial load', () => {
    const html = renderToString(
      createElement(
        PaywallProvider,
        { paywall, resolveTier: async () => 'pro' },
        createElement(
          PaywallGate,
          {
            feature: 'ai',
            loading: createElement('span', null, 'loading...'),
            fallback: createElement('span', null, 'upgrade'),
          },
          createElement('span', null, 'content'),
        ),
      ),
    );

    // During SSR, isLoading is true and features is null → should show loading
    expect(html).toContain('loading...');
    expect(html).not.toContain('content');
    expect(html).not.toContain('upgrade');
  });

  it('renders nothing when loading and no loading prop provided', () => {
    const html = renderToString(
      createElement(
        PaywallProvider,
        { paywall, resolveTier: async () => 'pro' },
        createElement(PaywallGate, { feature: 'ai' }, createElement('span', null, 'content')),
      ),
    );

    // No loading prop → renders nothing
    expect(html).not.toContain('content');
  });
});

function Status() {
  const { tier, features, isLoading, resolveError, refetch } = usePaywall();
  const ai = features ? String(Boolean(features.ai)) : 'null';
  const inference = features ? String(Boolean(features.aiInference)) : 'null';
  return createElement(
    'div',
    null,
    createElement(
      'p',
      null,
      `tier=${tier};loading=${String(isLoading)};error=${resolveError ?? 'none'};ai=${ai};inference=${inference}`,
    ),
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => {
          void refetch();
        },
      },
      'refetch',
    ),
  );
}

function gatedTree(resolveTier: () => Promise<string>, feature = 'ai') {
  return createElement(
    PaywallProvider,
    { paywall, resolveTier },
    createElement(Status),
    createElement(
      PaywallGate,
      {
        feature,
        loading: createElement('span', null, 'loading-gate'),
        fallback: createElement('span', null, 'denied-gate'),
      },
      createElement('span', null, 'allowed-gate'),
    ),
  );
}

describe('PaywallProvider runtime', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('resolves the tier and enables paid features', async () => {
    const view = await mount(gatedTree(async () => 'pro'));
    await waitForText(view.host, 'tier=pro;loading=false;error=none;ai=true;inference=false');
    expect(view.host.textContent).toContain('allowed-gate');
    expect(view.host.textContent).not.toContain('denied-gate');
    await view.unmount();
  });

  it('denies a feature that the resolved tier does not include', async () => {
    const view = await mount(gatedTree(async () => 'free'));
    await waitForText(view.host, 'tier=free;loading=false;error=none;ai=false;inference=false');
    expect(view.host.textContent).toContain('denied-gate');
    expect(view.host.textContent).not.toContain('allowed-gate');
    await view.unmount();
  });

  it('denies an unknown feature even after a successful resolve', async () => {
    const view = await mount(gatedTree(async () => 'enterprise', 'not-a-feature'));
    await waitForText(view.host, 'tier=enterprise;loading=false;error=none');
    expect(view.host.textContent).toContain('denied-gate');
    await view.unmount();
  });

  it('keeps the placeholder tier and denies access when auth is required', async () => {
    const view = await mount(
      gatedTree(async () => {
        throw Object.assign(new Error('auth'), { kind: 'auth-required' });
      }),
    );
    await waitForText(view.host, 'tier=free;loading=false;error=auth-required;ai=null');
    expect(view.host.textContent).toContain('denied-gate');
    expect(view.host.textContent).not.toContain('loading-gate');
    await view.unmount();
  });

  it('classifies an unavailable failure without inventing a free plan', async () => {
    const view = await mount(
      gatedTree(async () => {
        throw Object.assign(new Error('down'), { kind: 'unavailable' });
      }),
    );
    await waitForText(view.host, 'tier=free;loading=false;error=unavailable;ai=null');
    await view.unmount();
  });

  it('classifies auth failures from the error message', async () => {
    const view = await mount(
      gatedTree(async () => {
        throw new Error('auth-required');
      }),
    );
    await waitForText(view.host, 'error=auth-required');
    await view.unmount();

    const statusView = await mount(
      gatedTree(async () => {
        throw new Error('request failed 401');
      }),
    );
    await waitForText(statusView.host, 'error=auth-required');
    await statusView.unmount();
  });

  it('classifies a named resolve failure from its message when kind is absent', async () => {
    const named = new Error('session 401');
    named.name = 'LicenseResolveFailure';
    const view = await mount(
      gatedTree(async () => {
        throw named;
      }),
    );
    await waitForText(view.host, 'error=auth-required');
    await view.unmount();

    const unavailable = new Error('catalog down');
    unavailable.name = 'LicenseResolveFailure';
    const denied = await mount(
      gatedTree(async () => {
        throw unavailable;
      }),
    );
    await waitForText(denied.host, 'error=unavailable');
    await denied.unmount();
  });

  it('classifies non-object failures as unavailable', async () => {
    const view = await mount(
      gatedTree(async () => {
        throw 'offline';
      }),
    );
    await waitForText(view.host, 'error=unavailable');
    await view.unmount();

    const nullView = await mount(
      gatedTree(async () => {
        throw null;
      }),
    );
    await waitForText(nullView.host, 'error=unavailable');
    await nullView.unmount();
  });

  it('refetches after a failure and clears the error', async () => {
    let fail = true;
    const view = await mount(
      gatedTree(async () => {
        if (fail) throw Object.assign(new Error('down'), { kind: 'unavailable' });
        return 'max';
      }),
    );
    await waitForText(view.host, 'error=unavailable');
    fail = false;
    view.host.querySelector('button')?.click();
    await waitForText(view.host, 'tier=max;loading=false;error=none;ai=true;inference=true');
    expect(view.host.textContent).toContain('allowed-gate');
    await view.unmount();
  });

  it('marks loading again while a refetch is in flight', async () => {
    let release: (tier: string) => void = () => {};
    let calls = 0;
    const view = await mount(
      gatedTree(() => {
        calls += 1;
        if (calls === 1) return Promise.resolve('pro');
        return new Promise<string>((resolve) => {
          release = resolve;
        });
      }),
    );
    await waitForText(view.host, 'tier=pro;loading=false');
    view.host.querySelector('button')?.click();
    await waitForText(view.host, 'loading=true');
    release('enterprise');
    await waitForText(view.host, 'tier=enterprise;loading=false;error=none');
    await view.unmount();
  });
});
