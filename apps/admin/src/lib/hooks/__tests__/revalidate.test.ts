/**
 * Tests for the revalidate utility
 *
 * Sends a POST to the revalidate API endpoint to trigger ISR regeneration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/config', () => ({
  default: {
    reveal: {
      get secret() {
        return process.env.REVEALUI_SECRET ?? '';
      },
      get publicServerURL() {
        return process.env.REVEALUI_PUBLIC_SERVER_URL ?? '';
      },
    },
  },
}));

const originalEnv = { ...process.env };

describe('revalidate', () => {
  const mockLogger = { info: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REVEALUI_PUBLIC_SERVER_URL = 'https://admin.example.com';
    process.env.REVEALUI_SECRET = 'test-secret';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  async function loadFn() {
    const mod = await import('../revalidate.js');
    return mod.revalidate;
  }

  it('sends POST with collection, slug, and secret header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const revalidate = await loadFn();
    await revalidate({
      collection: 'pages',
      slug: 'hello-world',
      revealui: { logger: mockLogger } as never,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://admin.example.com/api/revalidate',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-revalidate-secret': 'test-secret',
        },
        body: JSON.stringify({ collection: 'pages', slug: 'hello-world' }),
      }),
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Successfully revalidated page 'hello-world'"),
    );
  });

  it('logs error when response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const revalidate = await loadFn();
    await revalidate({
      collection: 'posts',
      slug: 'broken',
      revealui: { logger: mockLogger } as never,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('500'));
  });

  it('logs error when fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
    vi.stubGlobal('fetch', mockFetch);

    const revalidate = await loadFn();
    await revalidate({
      collection: 'pages',
      slug: 'test',
      revealui: { logger: mockLogger } as never,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Network timeout'));
  });

  it('uses empty string when REVEALUI_SECRET is not set', async () => {
    delete process.env.REVEALUI_SECRET;
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const revalidate = await loadFn();
    await revalidate({
      collection: 'pages',
      slug: 'test',
      revealui: { logger: mockLogger } as never,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-revalidate-secret': '',
        }),
      }),
    );
  });
});
