/**
 * Unit tests for markdown utilities
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMarkdownCache,
  clearMarkdownCacheEntry,
  getMarkdownCacheStats,
  loadMarkdownFile,
  renderMarkdown,
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

  it('should refetch when cached entry expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-14T06:00:00.000Z'));

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('# Old Content', { status: 200 }))
      .mockResolvedValueOnce(new Response('# Fresh Content', { status: 200 }));

    const first = await loadMarkdownFile('/docs/test.md');
    expect(first).toBe('# Old Content');
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-03-14T06:05:01.000Z'));

    const second = await loadMarkdownFile('/docs/test.md');
    expect(second).toBe('# Fresh Content');
    expect(fetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe('renderMarkdown', () => {
  it('renders inline code without code-block highlighting', () => {
    render(renderMarkdown('Use `pnpm install` to install dependencies.'));

    const code = screen.getByText('pnpm install');
    expect(code.tagName).toBe('CODE');
    expect(code).not.toHaveClass('code-block');
  });

  it('renders JSON code blocks with token classes', () => {
    render(renderMarkdown('```json\n{"name":"revealui","enabled":true,"count":42}\n```'));

    expect(screen.getByText('"name"')).toHaveClass('token-property');
    expect(screen.getByText('"revealui"')).toHaveClass('token-string');
    expect(screen.getByText('true')).toHaveClass('token-keyword');
    expect(screen.getByText('42')).toHaveClass('token-number');
  });

  it('renders shell code blocks with keyword, property, string, number, and comment tokens', () => {
    render(renderMarkdown('```bash\npnpm --filter docs test "$HOME" 42 # run docs tests\n```'));

    expect(screen.getByText('pnpm')).toHaveClass('token-keyword');
    expect(screen.getByText('--filter')).toHaveClass('token-property');
    expect(screen.getByText('"$HOME"')).toHaveClass('token-string');
    expect(screen.getByText('42')).toHaveClass('token-number');
    expect(screen.getByText('# run docs tests')).toHaveClass('token-comment');
  });

  it('renders markup code blocks with tag and attribute tokens', () => {
    render(renderMarkdown('```html\n<div class="hero">Docs</div>\n```'));

    expect(screen.getAllByText('<div')[0]).toHaveClass('token-tag');
    expect(
      screen.getByText((content, element) => {
        return content === 'class' && element?.classList.contains('token-attr') === true;
      }),
    ).toHaveClass('token-attr');
    expect(screen.getByText('"hero"')).toHaveClass('token-string');
    expect(screen.getAllByText('>')[0]).toHaveClass('token-tag');
    expect(screen.getByText('</div')).toHaveClass('token-tag');
  });

  it('renders script-like code blocks with keyword, string, number, and comment tokens', () => {
    render(renderMarkdown("```ts\nconst port = 3000 // docs server\nconsole.log('ready')\n```"));

    expect(screen.getByText('const')).toHaveClass('token-keyword');
    expect(screen.getByText('3000')).toHaveClass('token-number');
    expect(screen.getByText("'ready'")).toHaveClass('token-string');
    expect(screen.getByText('// docs server')).toHaveClass('token-comment');
  });

  it('renders unknown language code blocks as plain lines', () => {
    render(renderMarkdown('```mermaid\ngraph TD\n```'));

    const code = screen.getByText('graph TD').closest('code');
    expect(code).toHaveClass('code-block', 'language-mermaid');
    expect(screen.queryByText('graph TD', { selector: '.token-keyword' })).toBeNull();
  });
});
