/**
 * Tests for Tavily, Exa, and the createWebSearchTool factory.
 * All HTTP calls are mocked — no real network requests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWebSearchTool, DuckDuckGoProvider } from '../duck-duck-go.js';
import { ExaProvider } from '../exa.js';
import { TavilyProvider } from '../tavily.js';
import type { WebSearchProvider } from '../types.js';

// ---------------------------------------------------------------------------
// TavilyProvider
// ---------------------------------------------------------------------------

describe('TavilyProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws on missing API key', () => {
    expect(() => new TavilyProvider('')).toThrow('apiKey is required');
  });

  it('returns mapped results on success', async () => {
    const mockResponse = {
      results: [
        { title: 'Result 1', url: 'https://example.com/1', content: 'Snippet one' },
        { title: 'Result 2', url: 'https://example.com/2', content: 'Snippet two' },
      ],
      query: 'test query',
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const provider = new TavilyProvider('tavily-test-key');
    const result = await provider.search('test query', 5);

    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({
      title: 'Result 1',
      link: 'https://example.com/1',
      snippet: 'Snippet one',
    });
    expect(result.query).toBe('test query');
    expect(result.tokenCount).toBeGreaterThan(0);
  });

  it('sends Authorization header with Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [], query: 'q' }), { status: 200 }),
    );

    const provider = new TavilyProvider('my-tavily-key');
    await provider.search('q', 3);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer my-tavily-key');
  });

  it('throws on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const provider = new TavilyProvider('bad-key');
    await expect(provider.search('test', 5)).rejects.toThrow('Tavily API request failed: 401');
  });

  it('respects maxResults limit', async () => {
    const mockResponse = {
      results: Array.from({ length: 10 }, (_, i) => ({
        title: `Result ${i}`,
        url: `https://example.com/${i}`,
        content: `Snippet ${i}`,
      })),
      query: 'q',
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const provider = new TavilyProvider('key');
    const result = await provider.search('q', 3);
    expect(result.results).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// ExaProvider
// ---------------------------------------------------------------------------

describe('ExaProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws on missing API key', () => {
    expect(() => new ExaProvider('')).toThrow('apiKey is required');
  });

  it('returns mapped results using highlights when available', async () => {
    const mockResponse = {
      results: [
        {
          title: 'Exa Result',
          url: 'https://exa.example.com',
          highlights: ['First highlight', 'Second highlight'],
        },
      ],
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const provider = new ExaProvider('exa-test-key');
    const result = await provider.search('query', 5);

    expect(result.results[0].snippet).toBe('First highlight Second highlight');
    expect(result.results[0].link).toBe('https://exa.example.com');
  });

  it('falls back to text when highlights are absent', async () => {
    const mockResponse = {
      results: [{ title: 'T', url: 'https://x.com', text: 'Plain text content' }],
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const provider = new ExaProvider('exa-key');
    const result = await provider.search('q', 5);
    expect(result.results[0].snippet).toBe('Plain text content');
  });

  it('sends x-api-key header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    const provider = new ExaProvider('my-exa-key');
    await provider.search('q', 3);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('my-exa-key');
  });

  it('throws on non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

    const provider = new ExaProvider('bad-key');
    await expect(provider.search('q', 5)).rejects.toThrow('Exa API request failed: 403');
  });
});

// ---------------------------------------------------------------------------
// createWebSearchTool factory
// ---------------------------------------------------------------------------

describe('createWebSearchTool', () => {
  it('creates a tool with the provider name in the description', () => {
    const provider = new TavilyProvider('key');
    const tool = createWebSearchTool(provider);
    expect(tool.name).toBe('web_search');
    expect(tool.description).toContain('tavily');
  });

  it('delegates search to the given provider', async () => {
    const mockProvider: WebSearchProvider = {
      name: 'mock',
      search: vi.fn().mockResolvedValue({
        results: [{ title: 'T', link: 'https://t.com', snippet: 'S' }],
        query: 'hello',
        tokenCount: 10,
      }),
    };
    const tool = createWebSearchTool(mockProvider);
    const result = await tool.execute({ query: 'hello', maxResults: 5 });

    expect(result.success).toBe(true);
    expect(mockProvider.search).toHaveBeenCalledWith('hello', 5);
  });

  it('returns success:true with empty results message when no results found', async () => {
    const mockProvider: WebSearchProvider = {
      name: 'empty',
      search: vi.fn().mockResolvedValue({ results: [], query: 'q', tokenCount: 0 }),
    };
    const tool = createWebSearchTool(mockProvider);
    const result = await tool.execute({ query: 'q', maxResults: 5 });

    expect(result.success).toBe(true);
    expect((result.data as { message: string }).message).toContain('No results found');
  });

  it('returns success:false when provider throws', async () => {
    const mockProvider: WebSearchProvider = {
      name: 'bad',
      search: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    const tool = createWebSearchTool(mockProvider);
    const result = await tool.execute({ query: 'q', maxResults: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
  });

  it('uses DuckDuckGoProvider pattern for default webSearchTool', () => {
    // Verify the factory works with DuckDuckGo the same as the singleton
    const provider = new DuckDuckGoProvider();
    const tool = createWebSearchTool(provider);
    expect(tool.name).toBe('web_search');
    expect(tool.description).toContain('duckduckgo');
  });
});
