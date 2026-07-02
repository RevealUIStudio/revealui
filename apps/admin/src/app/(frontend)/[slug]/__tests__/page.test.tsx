/**
 * (frontend)/[slug] render-path auth tests (S2 + S1b).
 *
 * The CMS catch-all must:
 *  - refuse reserved auth-flow slugs without querying content (S1b);
 *  - validate the session server-side and scope visibility via `req` rather
 *    than `overrideAccess: true` (S2) — anonymous callers pass no `req` (so the
 *    collection's `authenticatedOrPublished` rule yields published-only) and
 *    never enable draft mode; authenticated callers pass `req.user` and may see
 *    drafts.
 *
 * No regex authored (fleet posture): assertions use equality + object shape.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFind = vi.fn();
const mockGetSession = vi.fn();
const mockDraftMode = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('next/headers', () => ({
  draftMode: () => mockDraftMode(),
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock('@/lib/utils/revealui-singleton', () => ({
  getRevealUIInstance: () => Promise.resolve({ find: mockFind }),
}));

// Trivial stand-ins for the render tree — the tests inspect the find() call,
// not the emitted markup.
vi.mock('@/lib/blocks/RenderBlocks', () => ({ RenderBlocks: () => null }));
vi.mock('@/lib/heros/RenderHero', () => ({ RenderHero: () => null }));
vi.mock('@/lib/components/RevealUIRedirects', () => ({ RevealUIRedirects: () => null }));
vi.mock('@/lib/cms/generateMeta', () => ({ generateMeta: () => ({}) }));
vi.mock('@revealui/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import Page from '../page';

function params(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe('(frontend)/[slug] — reserved auth slugs (S1b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    mockGetSession.mockResolvedValue(null);
    mockFind.mockResolvedValue({ docs: [] });
  });

  it.each([
    'login',
    'signup',
    'mfa',
    'rotate-password',
    'forgot-password',
    'reset-password',
    'setup',
  ])('does not query content for reserved slug %s', async (slug) => {
    await Page(params(slug));
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('does query content for an ordinary slug', async () => {
    mockFind.mockResolvedValueOnce({ docs: [{ id: '1', hero: null, layout: [] }] });
    await Page(params('about'));
    expect(mockFind).toHaveBeenCalledOnce();
  });
});

describe('(frontend)/[slug] — session-scoped visibility (S2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockResolvedValue({ docs: [{ id: '1', hero: null, layout: [] }] });
  });

  it('anonymous request passes no req and never enables draft (published-only)', async () => {
    mockGetSession.mockResolvedValue(null);
    mockDraftMode.mockResolvedValue({ isEnabled: true }); // even with the draft cookie set
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(opts.req).toBeUndefined();
    expect(opts.draft).toBe(false);
    // The vulnerable pattern is gone: no blanket access override.
    expect(opts.overrideAccess).toBeUndefined();
  });

  it('authenticated request passes req.user and honors draft mode', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u-1', email: 'admin@example.com', role: 'admin' },
      session: {},
    });
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as {
      req?: { user?: { id?: string } };
      draft?: boolean;
      overrideAccess?: boolean;
    };
    expect(opts.req?.user?.id).toBe('u-1');
    expect(opts.draft).toBe(true);
    expect(opts.overrideAccess).toBeUndefined();
  });

  it('authenticated request without draft cookie does not enable draft', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u-1', email: 'admin@example.com', role: 'admin' },
      session: {},
    });
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as { draft?: boolean };
    expect(opts.draft).toBe(false);
  });
});
