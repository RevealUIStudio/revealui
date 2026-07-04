/**
 * (frontend)/[slug] render-path auth tests (S1b + S2 + role-gate).
 *
 * The CMS catch-all must:
 *  - refuse reserved auth-flow slugs without querying content, and 404 them
 *    (via notFound()) rather than route through the allow-all redirects
 *    collection (S1b);
 *  - validate the session server-side and scope visibility via `req` rather
 *    than `overrideAccess: true` (S2), AND gate draft/unpublished visibility on
 *    an ADMIN role — a non-admin (public-signup `user`) session must NOT see
 *    drafts, and an anonymous OR non-admin caller passes a truthy user-LESS
 *    `req` ({}) so the collection's `authenticatedOrPublished` rule yields
 *    published-only (NOT deny-all: an `undefined` req would trip find()'s
 *    `if (!req) return false` and 404 every public page).
 *
 * No regex authored (fleet posture): assertions use equality + object shape.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFind = vi.fn();
const mockGetSession = vi.fn();
const mockDraftMode = vi.fn();
const mockNotFound = vi.fn(() => {
  // next/navigation notFound() throws to unwind rendering.
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('next/headers', () => ({
  draftMode: () => mockDraftMode(),
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

vi.mock('@/lib/utils/revealui-singleton', () => ({
  getRevealUIInstance: () => Promise.resolve({ find: mockFind }),
}));

// request-context helper depends on @revealui/security; stub it to a fixed
// context so the render path stays a pure unit test.
vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: 'test-ua', ipAddress: undefined }),
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

import Page, { generateMetadata } from '../page';

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
  ])('404s a reserved slug %s without querying content', async (slug) => {
    // notFound() throws — the reserved slug never reaches the content query
    // nor the allow-all redirects collection.
    await expect(Page(params(slug))).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalledOnce();
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('does query content for an ordinary slug', async () => {
    mockFind.mockResolvedValueOnce({ docs: [{ id: '1', hero: null, layout: [] }] });
    await Page(params('about'));
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledOnce();
  });
});

describe('(frontend)/[slug] — role-gated visibility (S2 + role-gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockResolvedValue({ docs: [{ id: '1', hero: null, layout: [] }] });
  });

  it('anonymous request passes a user-less req and never enables draft (published-only, not deny-all)', async () => {
    mockGetSession.mockResolvedValue(null);
    mockDraftMode.mockResolvedValue({ isEnabled: true }); // even with the draft cookie set
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as Record<string, unknown>;
    // Truthy user-LESS req — NOT undefined (which would deny-all in find()).
    expect(opts.req).toEqual({});
    expect((opts.req as { user?: unknown }).user).toBeUndefined();
    expect(opts.draft).toBe(false);
    // The vulnerable pattern is gone: no blanket access override.
    expect(opts.overrideAccess).toBeUndefined();
  });

  it('non-admin (public-signup user) session gets NO drafts and a user-less req', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u-2', email: 'user@example.com', role: 'user' },
      session: {},
    });
    mockDraftMode.mockResolvedValue({ isEnabled: true }); // draft cookie present
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as {
      req?: { user?: unknown };
      draft?: boolean;
      overrideAccess?: boolean;
    };
    // A role-`user` session is NOT admin → no user on req → published-only.
    expect(opts.req).toEqual({});
    expect(opts.req?.user).toBeUndefined();
    expect(opts.draft).toBe(false);
    expect(opts.overrideAccess).toBeUndefined();
  });

  it('admin session passes req.user and honors draft mode', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u-1', email: 'admin@example.com', role: 'admin' },
      session: {},
    });
    mockDraftMode.mockResolvedValue({ isEnabled: true });
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as {
      req?: { user?: { id?: string; roles?: string[] } };
      draft?: boolean;
      overrideAccess?: boolean;
    };
    expect(opts.req?.user?.id).toBe('u-1');
    expect(opts.req?.user?.roles).toEqual(['admin']);
    expect(opts.draft).toBe(true);
    expect(opts.overrideAccess).toBeUndefined();
  });

  it('admin session without draft cookie does not enable draft', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u-1', email: 'admin@example.com', role: 'admin' },
      session: {},
    });
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    await Page(params('about'));
    const opts = mockFind.mock.calls[0]?.[0] as { draft?: boolean };
    expect(opts.draft).toBe(false);
  });

  it('binds the session to request context (getSession receives a context arg)', async () => {
    mockGetSession.mockResolvedValue(null);
    mockDraftMode.mockResolvedValue({ isEnabled: false });
    await Page(params('about'));
    // Render path passes (headers, requestContext) like the sibling API routes.
    expect(mockGetSession).toHaveBeenCalledOnce();
    const secondArg = mockGetSession.mock.calls[0]?.[1] as { userAgent?: string } | undefined;
    expect(secondArg?.userAgent).toBe('test-ua');
  });
});

describe('(frontend)/[slug] — generateMetadata reserved slugs', () => {
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
  ])('does not query content from generateMetadata for reserved slug %s', async (slug) => {
    // The reserved-slug guard lives in queryPageBySlug, the shared entry point
    // for both Page() and generateMetadata(), so the metadata path must skip
    // the content query too — a future refactor moving the guard back into
    // Page() would re-open reserved-slug metadata queries; this pins it.
    await generateMetadata(params(slug));
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('queries content from generateMetadata for an ordinary slug', async () => {
    mockFind.mockResolvedValueOnce({ docs: [{ id: '1', hero: null, layout: [] }] });
    await generateMetadata(params('ordinary-meta'));
    expect(mockFind).toHaveBeenCalledOnce();
  });
});
