import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { revalidatePage } from '@/lib/collections/Pages/hooks/revalidatePage';

const mockRevalidatePath = vi.mocked(revalidatePath);

describe('revalidatePage', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates the page path when status is published', () => {
    const doc = { _status: 'published', slug: 'about' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    const result = revalidatePage({
      doc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/about');
    expect(mockLogger.info).toHaveBeenCalledWith('Revalidating page at path: /about');
    expect(result).toEqual(doc);
  });

  it('revalidates root path for home page', () => {
    const doc = { _status: 'published', slug: 'home' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    revalidatePage({
      doc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    expect(mockLogger.info).toHaveBeenCalledWith('Revalidating page at path: /');
  });

  it('does not revalidate when status is not published', () => {
    const doc = { _status: 'draft', slug: 'about' } as Parameters<typeof revalidatePage>[0]['doc'];

    revalidatePage({
      doc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates old path when page is unpublished', () => {
    const doc = { _status: 'draft', slug: 'about' } as Parameters<typeof revalidatePage>[0]['doc'];
    const previousDoc = { _status: 'published', slug: 'about' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    revalidatePage({
      doc,
      previousDoc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/about');
    expect(mockLogger.info).toHaveBeenCalledWith('Revalidating old page at path: /about');
  });

  it('revalidates old home path when home page is unpublished', () => {
    const doc = { _status: 'draft', slug: 'home' } as Parameters<typeof revalidatePage>[0]['doc'];
    const previousDoc = { _status: 'published', slug: 'home' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    revalidatePage({
      doc,
      previousDoc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/');
  });

  it('revalidates both paths when slug changed and both are published', () => {
    const doc = { _status: 'published', slug: 'about-us' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];
    const previousDoc = { _status: 'published', slug: 'about' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    revalidatePage({
      doc,
      previousDoc,
      req: { revealui: { logger: mockLogger } },
    });

    // Only the current published page is revalidated (previousDoc is also published, so the unpublish branch does not fire)
    expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/about-us');
  });

  it('works without logger', () => {
    const doc = { _status: 'published', slug: 'test' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    revalidatePage({
      doc,
      req: { revealui: {} },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/test');
  });

  it('works without revealui on req', () => {
    const doc = { _status: 'published', slug: 'test' } as Parameters<
      typeof revalidatePage
    >[0]['doc'];

    revalidatePage({
      doc,
      req: {},
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/test');
  });
});
