/**
 * Unit tests for markdown utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMarkdownCache,
  clearMarkdownCacheEntry,
  getMarkdownCacheStats,
  loadMarkdownFile,
} from '../../app/utils/markdown';

// Mock fetch globally
global.fetch = vi.fn();

describe('loadMarkdownFile', () => {
  beforeEach(() => {
    clearMarkdownCache();
    vi.clearAllMocks();
  });

  it('should load and cache markdown file', async () => {
    const mockContent = '# Test Content';
    const mockResponse = new Response(mockContent, { status: 200 });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    const content = await loadMarkdownFile('/docs/test.md');

    expect(fetch).toHaveBeenCalledWith('/docs/test.md');
    expect(content).toBe(mockContent);
  });

  it('should use cache on second call', async () => {
    const mockContent = '# Test Content';
    const mockResponse = new Response(mockContent, { status: 200 });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    // First call
    await loadMarkdownFile('/docs/test.md');
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    const content = await loadMarkdownFile('/docs/test.md');
    expect(fetch).toHaveBeenCalledTimes(1); // Still 1, cache used
    expect(content).toBe(mockContent);
  });

  it('should normalize paths', async () => {
    const mockContent = '# Test';
    const mockResponse = new Response(mockContent, { status: 200 });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    // Path without leading slash should be normalized
    await loadMarkdownFile('docs/test.md');

    expect(fetch).toHaveBeenCalledWith('/docs/test.md');
  });

  it('should throw error on failed fetch', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

    await expect(loadMarkdownFile('/docs/test.md')).rejects.toThrow();
  });

  it('should throw error on non-ok response', async () => {
    const mockResponse = new Response('Not Found', { status: 404 });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await expect(loadMarkdownFile('/docs/test.md')).rejects.toThrow('404');
  });

  it('should bypass cache when useCache is false', async () => {
    const mockContent = '# Test Content';

    // Use mockImplementation to create a fresh Response for each call
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response(mockContent, { status: 200 })),
    );

    // First call
    await loadMarkdownFile('/docs/test.md', true);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call without cache
    await loadMarkdownFile('/docs/test.md', false);
    expect(fetch).toHaveBeenCalledTimes(2); // Called again
  });
});

describe('cache management', () => {
  beforeEach(() => {
    clearMarkdownCache();
    vi.clearAllMocks();
  });

  it('should clear all cache', async () => {
    // Use mockImplementation to create a fresh Response for each call
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('# Content', { status: 200 })),
    );

    await loadMarkdownFile('/docs/test.md');
    expect(getMarkdownCacheStats().size).toBe(1);

    clearMarkdownCache();
    expect(getMarkdownCacheStats().size).toBe(0);
  });

  it('should clear specific cache entry', async () => {
    // Use mockImplementation to create a fresh Response for each call
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('# Content', { status: 200 })),
    );

    await loadMarkdownFile('/docs/test1.md');
    await loadMarkdownFile('/docs/test2.md');
    expect(getMarkdownCacheStats().size).toBe(2);

    clearMarkdownCacheEntry('/docs/test1.md');
    const stats = getMarkdownCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.entries[0].path).toBe('/docs/test2.md');
  });

  it('should provide cache statistics', async () => {
    const mockResponse = new Response('# Content', { status: 200 });

    vi.mocked(fetch).mockResolvedValue(mockResponse);

    await loadMarkdownFile('/docs/test.md');

    const stats = getMarkdownCacheStats();
    expect(stats.size).toBe(1);
    expect(stats.entries).toHaveLength(1);
    expect(stats.entries[0].path).toBe('/docs/test.md');
    expect(stats.entries[0].age).toBeGreaterThanOrEqual(0);
  });
});
