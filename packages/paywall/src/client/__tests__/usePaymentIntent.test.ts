/**
 * @vitest-environment jsdom
 */
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePaymentIntent } from '../usePaymentIntent.js';
import { mount } from './mount.js';

interface ProbeProps {
  endpoint?: string;
  subscriptionId?: string;
  amount?: number;
  currency?: string;
  fetchImpl?: typeof fetch;
  enabled?: boolean;
  tier?: 'pro' | 'max' | 'enterprise';
  acceptedSupportPolicyRevision?: string;
}

function Probe(props: ProbeProps) {
  const result = usePaymentIntent(props);
  return createElement(
    'p',
    null,
    `secret=${result.clientSecret ?? ''};loading=${String(result.loading)};error=${result.error?.message ?? ''}`,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('usePaymentIntent', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('exports a hook function', () => {
    expect(typeof usePaymentIntent).toBe('function');
  });

  it('defers intent creation until acceptance and clears the secret when disabled', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ clientSecret: 'pi_accepted' }));
    const view = await mount(createElement(Probe, { enabled: false, fetchImpl }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(view.host.textContent).toContain('secret=;loading=false');
    await view.rerender(
      createElement(Probe, {
        enabled: true,
        acceptedSupportPolicyRevision: '2026-10-04',
        fetchImpl,
      }),
    );
    await vi.waitFor(() => expect(view.host.textContent).toContain('secret=pi_accepted'));
    await view.rerender(createElement(Probe, { enabled: false, fetchImpl }));
    expect(view.host.textContent).toContain('secret=;loading=false');
    await view.unmount();
  });

  it('posts the explicitly accepted revision with the selected tier', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ clientSecret: 'pi_accepted' }));
    const view = await mount(
      createElement(Probe, {
        enabled: true,
        tier: 'max',
        acceptedSupportPolicyRevision: '2026-10-04',
        fetchImpl,
      }),
    );
    await vi.waitFor(() => expect(view.host.textContent).toContain('secret=pi_accepted'));
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/billing/payment-intent',
      expect.objectContaining({
        body: JSON.stringify({ tier: 'max', acceptedSupportPolicyRevision: '2026-10-04' }),
      }),
    );
    await view.unmount();
  });

  it('loads a client secret from the default endpoint', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ clientSecret: 'pi_secret_example' }));
    vi.stubGlobal('fetch', fetchImpl);

    const view = await mount(createElement(Probe, {}));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=pi_secret_example;loading=false;error=');
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/billing/payment-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    await view.unmount();
  });

  it('posts the buyer request to a custom endpoint', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ clientSecret: 'pi_custom' }));
    const view = await mount(
      createElement(Probe, {
        endpoint: '/api/billing/custom-intent',
        subscriptionId: 'sub_example',
        amount: 4900,
        currency: 'usd',
        fetchImpl,
      }),
    );
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=pi_custom;loading=false;error=');
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/billing/custom-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subscriptionId: 'sub_example',
        amount: 4900,
        currency: 'usd',
      }),
    });
    await view.unmount();
  });

  it('clears the secret when the payload omits one', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const view = await mount(createElement(Probe, { fetchImpl }));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=;loading=false;error=');
    });
    await view.unmount();
  });

  it('records a denial when the host rejects the request', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 402 }));
    const view = await mount(createElement(Probe, { fetchImpl }));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain(
        'secret=;loading=false;error=payment-intent failed (402)',
      );
    });
    await view.unmount();
  });

  it('records an Error thrown by the host', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const view = await mount(createElement(Probe, { fetchImpl }));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=;loading=false;error=network down');
    });
    await view.unmount();
  });

  it('wraps a non-Error failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw 'boom';
    });
    const view = await mount(createElement(Probe, { fetchImpl }));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=;loading=false;error=boom');
    });
    await view.unmount();
  });

  it('does not publish a result after unmount', async () => {
    let release: (response: Response) => void = () => {};
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const view = await mount(createElement(Probe, { fetchImpl }));
    expect(view.host.textContent).toContain('loading=true');
    await view.unmount();
    release(jsonResponse({ clientSecret: 'pi_late' }));
    await Promise.resolve();
    await Promise.resolve();
  });

  it('does not publish a thrown failure after unmount', async () => {
    let rejectFetch: (reason: unknown) => void = () => {};
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject;
        }),
    );
    const view = await mount(createElement(Probe, { fetchImpl }));
    await view.unmount();
    rejectFetch(new Error('late failure'));
    await Promise.resolve();
  });

  it('refetches when the subscription id changes', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { subscriptionId?: string };
      return jsonResponse({ clientSecret: body.subscriptionId ?? 'none' });
    });
    const view = await mount(createElement(Probe, { fetchImpl, subscriptionId: 'sub_first' }));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=sub_first');
    });
    await view.rerender(createElement(Probe, { fetchImpl, subscriptionId: 'sub_second' }));
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain('secret=sub_second;loading=false;error=');
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await view.unmount();
  });
});
