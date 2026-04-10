/**
 * Critical admin Hooks Tests
 *
 * Tests for security-critical hooks:
 * - ensureFirstUserIsSuperAdmin: first-user bootstrap promotion
 * - revalidatePage: cache revalidation on page publish
 * - revalidateRedirects: redirect cache invalidation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/lib/access/permissions/roles';

// ─── Mock next/cache before any imports that use it ─────────────────────────
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

// ─── ensureFirstUserIsSuperAdmin ────────────────────────────────────────────

describe('ensureFirstUserIsSuperAdmin', () => {
  const mockFind = vi.fn();

  function makeReq() {
    return { revealui: { find: mockFind } } as never;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../ensureFirstUserIsSuperAdmin.js');
    return mod.ensureFirstUserIsSuperAdmin;
  }

  it('promotes first user to super-admin when no users exist', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const result = await hook({
      req: makeReq(),
      operation: 'create',
      value: [],
    });

    expect(result).toContain(Role.TenantSuperAdmin);
    expect(mockFind).toHaveBeenCalledWith({
      collection: 'users',
      limit: 1,
      depth: 0,
    });
  });

  it('preserves existing roles when promoting first user', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const result = await hook({
      req: makeReq(),
      operation: 'create',
      value: ['editor', 'viewer'],
    });

    expect(result).toContain('editor');
    expect(result).toContain('viewer');
    expect(result).toContain(Role.TenantSuperAdmin);
  });

  it('does NOT promote second user when users already exist', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({
      totalDocs: 1,
      docs: [{ id: 'existing-user' }],
    });

    const result = await hook({
      req: makeReq(),
      operation: 'create',
      value: ['editor'],
    });

    expect(result).toEqual(['editor']);
    expect(result).not.toContain(Role.TenantSuperAdmin);
  });

  it('does not duplicate super-admin role if already present', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const result = await hook({
      req: makeReq(),
      operation: 'create',
      value: [Role.TenantSuperAdmin],
    });

    expect(result).toEqual([Role.TenantSuperAdmin]);
    // Should not have duplicated it
    const superAdminCount = result?.filter((r: string) => r === Role.TenantSuperAdmin).length;
    expect(superAdminCount).toBe(1);
  });

  it('returns value unchanged on non-create operations', async () => {
    const hook = await loadHook();

    const result = await hook({
      req: makeReq(),
      operation: 'update',
      value: ['viewer'],
    });

    expect(result).toEqual(['viewer']);
    expect(mockFind).not.toHaveBeenCalled();
  });

  it('returns value unchanged when req.revealui is missing', async () => {
    const hook = await loadHook();

    const result = await hook({
      req: {} as never,
      operation: 'create',
      value: ['viewer'],
    });

    expect(result).toEqual(['viewer']);
  });

  it('handles undefined value by creating array with super-admin', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 0, docs: [] });

    const result = await hook({
      req: makeReq(),
      operation: 'create',
      value: undefined,
    });

    expect(result).toEqual([Role.TenantSuperAdmin]);
  });

  it('queries users collection with minimal depth and limit', async () => {
    const hook = await loadHook();
    mockFind.mockResolvedValue({ totalDocs: 3, docs: [{ id: '1' }] });

    await hook({
      req: makeReq(),
      operation: 'create',
      value: [],
    });

    expect(mockFind).toHaveBeenCalledWith({
      collection: 'users',
      limit: 1,
      depth: 0,
    });
  });
});

// ─── revalidatePage ─────────────────────────────────────────────────────────

describe('revalidatePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../revalidatePage.js');
    return mod.revalidatePage;
  }

  it('triggers revalidation for published pages with a slug', async () => {
    const revalidatePage = await loadHook();
    // We need to spy on the revalidate function to verify it gets called
    const revalidateMod = await import('../revalidate.js');
    const revalidateSpy = vi.spyOn(revalidateMod, 'revalidate').mockResolvedValue(undefined);

    const mockRevealUI = { logger: { info: vi.fn(), error: vi.fn() } };
    const doc = { id: 'page-1', _status: 'published', slug: 'about-us' };

    const result = revalidatePage({
      doc: doc as never,
      req: { revealui: mockRevealUI } as never,
    });

    expect(result).toEqual(doc);
    expect(revalidateSpy).toHaveBeenCalledWith({
      revealui: mockRevealUI,
      collection: 'pages',
      slug: 'about-us',
    });

    revalidateSpy.mockRestore();
  });

  it('does not trigger revalidation for draft pages', async () => {
    const revalidatePage = await loadHook();
    const revalidateMod = await import('../revalidate.js');
    const revalidateSpy = vi.spyOn(revalidateMod, 'revalidate').mockResolvedValue(undefined);

    const doc = { id: 'page-2', _status: 'draft', slug: 'unpublished-page' };

    const result = revalidatePage({
      doc: doc as never,
      req: { revealui: { logger: { info: vi.fn() } } } as never,
    });

    expect(result).toEqual(doc);
    expect(revalidateSpy).not.toHaveBeenCalled();

    revalidateSpy.mockRestore();
  });

  it('does not trigger revalidation when slug is missing', async () => {
    const revalidatePage = await loadHook();
    const revalidateMod = await import('../revalidate.js');
    const revalidateSpy = vi.spyOn(revalidateMod, 'revalidate').mockResolvedValue(undefined);

    const doc = { id: 'page-3', _status: 'published' };

    const result = revalidatePage({
      doc: doc as never,
      req: { revealui: { logger: { info: vi.fn() } } } as never,
    });

    expect(result).toEqual(doc);
    expect(revalidateSpy).not.toHaveBeenCalled();

    revalidateSpy.mockRestore();
  });

  it('does not trigger revalidation when revealui is missing', async () => {
    const revalidatePage = await loadHook();
    const revalidateMod = await import('../revalidate.js');
    const revalidateSpy = vi.spyOn(revalidateMod, 'revalidate').mockResolvedValue(undefined);

    const doc = { id: 'page-4', _status: 'published', slug: 'test' };

    const result = revalidatePage({
      doc: doc as never,
      req: {} as never,
    });

    expect(result).toEqual(doc);
    expect(revalidateSpy).not.toHaveBeenCalled();

    revalidateSpy.mockRestore();
  });

  it('always returns the doc regardless of status', async () => {
    const revalidatePage = await loadHook();

    const doc = { id: 'page-5', _status: 'archived', slug: 'old-page' };
    const result = revalidatePage({
      doc: doc as never,
      req: {} as never,
    });

    expect(result).toEqual(doc);
  });
});

// ─── revalidateRedirects ────────────────────────────────────────────────────

describe('revalidateRedirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function loadHook() {
    const mod = await import('../revalidateRedirects.js');
    return mod.revalidateRedirects;
  }

  it('calls revalidateTag to invalidate redirect cache', async () => {
    const { revalidateTag } = await import('next/cache');
    const hook = await loadHook();

    const doc = { id: 'redirect-1', from: '/old', to: '/new' };
    hook({ doc });

    expect(revalidateTag).toHaveBeenCalledWith('redirects', 'page');
  });

  it('returns the doc unchanged', async () => {
    const hook = await loadHook();
    const doc = { id: 'redirect-2', from: '/old', to: '/new' };

    const result = hook({ doc });

    expect(result).toEqual(doc);
  });

  it('logs the operation when context is provided', async () => {
    const hook = await loadHook();
    const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const doc = { id: 'redirect-3' };

    hook({
      doc,
      context: {
        revealui: { logger: mockLogger } as never,
        operation: 'create',
      },
    });

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('create'));
  });

  it('does not throw when context has no logger', async () => {
    const hook = await loadHook();
    const doc = { id: 'redirect-4' };

    expect(() => hook({ doc, context: {} })).not.toThrow();
  });

  it('does not throw when context is undefined', async () => {
    const hook = await loadHook();
    const doc = { id: 'redirect-5' };

    expect(() => hook({ doc })).not.toThrow();
  });

  it('invalidates cache on every call regardless of operation', async () => {
    const { revalidateTag } = await import('next/cache');
    const hook = await loadHook();

    hook({ doc: { id: '1' }, context: { operation: 'create' } });
    hook({ doc: { id: '2' }, context: { operation: 'update' } });
    hook({ doc: { id: '3' }, context: { operation: 'delete' } });

    expect(revalidateTag).toHaveBeenCalledTimes(3);
  });
});
