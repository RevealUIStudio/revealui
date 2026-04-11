/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dispatchUpgradeEvent,
  UPGRADE_EVENT_NAME,
  type UpgradeEventDetail,
  upgradeAwareFetch,
} from '../upgrade-aware-fetch.js';

describe('UPGRADE_EVENT_NAME', () => {
  it('has the expected value', () => {
    expect(UPGRADE_EVENT_NAME).toBe('revealui:upgrade-required');
  });
});

describe('dispatchUpgradeEvent', () => {
  it('dispatches a CustomEvent on window', () => {
    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    dispatchUpgradeEvent({ status: 402, feature: 'ai' });

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ status: 402, feature: 'ai' });

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('works without a feature name', () => {
    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    dispatchUpgradeEvent({ status: 503 });

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ status: 503 });

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('is a no-op when window is undefined', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error  -  testing SSR path
    delete globalThis.window;

    // Should not throw
    dispatchUpgradeEvent({ status: 402 });

    globalThis.window = originalWindow;
  });
});

describe('upgradeAwareFetch', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the response for non-paywall status codes', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    const res = await upgradeAwareFetch('/api/data');

    expect(res).toBe(mockResponse);
    expect(res.status).toBe(200);
    expect(events).toHaveLength(0);

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('dispatches upgrade event on 402 response', async () => {
    const mockResponse = new Response('Payment Required', {
      status: 402,
      headers: { 'x-paywall-feature': 'ai' },
    });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    const res = await upgradeAwareFetch('/api/ai/tasks');

    expect(res).toBe(mockResponse);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ status: 402, feature: 'ai' });

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('dispatches upgrade event on 503 response', async () => {
    const mockResponse = new Response('Service Unavailable', {
      status: 503,
      headers: { 'x-revealui-feature': 'sync' },
    });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    const res = await upgradeAwareFetch('/api/sync');

    expect(res).toBe(mockResponse);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ status: 503, feature: 'sync' });

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('reads feature from x-revealui-feature header as fallback', async () => {
    const mockResponse = new Response('Payment Required', {
      status: 402,
      headers: { 'x-revealui-feature': 'mcp' },
    });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    await upgradeAwareFetch('/api/mcp');

    expect(events[0].detail.feature).toBe('mcp');

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('prefers x-paywall-feature over x-revealui-feature', async () => {
    const mockResponse = new Response('Payment Required', {
      status: 402,
      headers: {
        'x-paywall-feature': 'ai',
        'x-revealui-feature': 'mcp',
      },
    });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    await upgradeAwareFetch('/api/ai');

    expect(events[0].detail.feature).toBe('ai');

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('sets feature to undefined when no header is present', async () => {
    const mockResponse = new Response('Payment Required', { status: 402 });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const events: CustomEvent<UpgradeEventDetail>[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent<UpgradeEventDetail>);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    await upgradeAwareFetch('/api/something');

    expect(events[0].detail.feature).toBeUndefined();

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });

  it('passes through RequestInit options to fetch', async () => {
    const mockResponse = new Response('OK', { status: 200 });
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

    const init: RequestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: true }),
    };

    await upgradeAwareFetch('/api/action', init);

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/action', init);
  });

  it('does not dispatch for other 4xx/5xx status codes', async () => {
    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener(UPGRADE_EVENT_NAME, handler);

    for (const status of [400, 401, 403, 404, 500, 502, 504]) {
      const mockResponse = new Response('Error', { status });
      vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse);

      await upgradeAwareFetch('/api/test');
    }

    expect(events).toHaveLength(0);

    window.removeEventListener(UPGRADE_EVENT_NAME, handler);
  });
});
