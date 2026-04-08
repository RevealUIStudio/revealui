import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { revalidatePost } from '@/lib/collections/Posts/hooks/revalidatePost';

const mockRevalidatePath = vi.mocked(revalidatePath);

describe('revalidatePost', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates the post path when status is published', () => {
    const doc = { _status: 'published', slug: 'my-post' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];

    const result = revalidatePost({
      doc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/my-post');
    expect(mockLogger.info).toHaveBeenCalledWith('Revalidating post at path: /posts/my-post');
    expect(result).toEqual(doc);
  });

  it('does not revalidate when status is draft', () => {
    const doc = { _status: 'draft', slug: 'my-post' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];

    revalidatePost({
      doc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates old path when post is unpublished', () => {
    const doc = { _status: 'draft', slug: 'my-post' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];
    const previousDoc = { _status: 'published', slug: 'my-post' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];

    revalidatePost({
      doc,
      previousDoc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/my-post');
    expect(mockLogger.info).toHaveBeenCalledWith('Revalidating old post at path: /posts/my-post');
  });

  it('revalidates only new path when slug changed but both published', () => {
    const doc = { _status: 'published', slug: 'new-slug' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];
    const previousDoc = { _status: 'published', slug: 'old-slug' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];

    revalidatePost({
      doc,
      previousDoc,
      req: { revealui: { logger: mockLogger } },
    });

    // Only the current published path is revalidated; previousDoc is also published so the unpublish branch does not fire
    expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/new-slug');
  });

  it('does not revalidate when previousDoc was also draft', () => {
    const doc = { _status: 'draft', slug: 'my-post' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];
    const previousDoc = { _status: 'draft', slug: 'my-post' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];

    revalidatePost({
      doc,
      previousDoc,
      req: { revealui: { logger: mockLogger } },
    });

    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('works without logger', () => {
    const doc = { _status: 'published', slug: 'test' } as Parameters<
      typeof revalidatePost
    >[0]['doc'];

    revalidatePost({
      doc,
      req: {},
    });

    expect(mockRevalidatePath).toHaveBeenCalledWith('/posts/test');
  });
});
