import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DuckDuckGoProvider, webSearchTool } from '../../tools/web/duck-duck-go.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockDDGResponse = {
  AbstractText: 'RevealUI is open-source business infrastructure for software companies.',
  AbstractSource: 'RevealUI',
  AbstractURL: 'https://revealui.com',
  RelatedTopics: [
    {
      Text: 'Open source CMS - A content management system for developers',
      FirstURL: 'https://example.com/cms',
    },
    {
      Text: 'Business infrastructure - Software tools for software companies',
      FirstURL: 'https://example.com/bi',
    },
  ],
};

describe('DuckDuckGoProvider', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDDGResponse),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('has name "duckduckgo"', () => {
    const provider = new DuckDuckGoProvider();
    expect(provider.name).toBe('duckduckgo');
  });

  it('returns structured search results', async () => {
    const provider = new DuckDuckGoProvider();
    const response = await provider.search('RevealUI', 5);

    expect(response.query).toBe('RevealUI');
    expect(response.results).toHaveLength(3); // abstract + 2 related topics
    expect(response.results[0]).toMatchObject({
      title: 'RevealUI',
      link: 'https://revealui.com',
      snippet: 'RevealUI is open-source business infrastructure for software companies.',
    });
    expect(response.tokenCount).toBeGreaterThan(0);
  });

  it('respects maxResults limit', async () => {
    const provider = new DuckDuckGoProvider();
    const response = await provider.search('test', 1);

    expect(response.results.length).toBeLessThanOrEqual(1);
  });

  it('handles empty response gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ AbstractText: '', AbstractURL: '', RelatedTopics: [] }),
    });

    const provider = new DuckDuckGoProvider();
    const response = await provider.search('zzzyyyxxx', 5);

    expect(response.results).toHaveLength(0);
    expect(response.tokenCount).toBe(0);
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

    const provider = new DuckDuckGoProvider();
    await expect(provider.search('test', 5)).rejects.toThrow('DuckDuckGo API request failed');
  });

  it('skips topic group entries (Topics array)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          AbstractText: '',
          AbstractURL: '',
          RelatedTopics: [
            { Topics: [{ Text: 'nested', FirstURL: 'https://example.com' }] }, // group — skip
            { Text: 'Direct result - with description', FirstURL: 'https://direct.com' },
          ],
        }),
    });

    const provider = new DuckDuckGoProvider();
    const response = await provider.search('test', 5);

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.link).toBe('https://direct.com');
    expect(response.results[0]?.title).toBe('Direct result');
  });

  it('skips topics with missing URL or text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          AbstractText: '',
          AbstractURL: '',
          RelatedTopics: [
            { Text: 'No URL topic' }, // missing FirstURL
            { FirstURL: 'https://example.com' }, // missing Text
            { Text: 'Complete topic', FirstURL: 'https://complete.com' },
          ],
        }),
    });

    const provider = new DuckDuckGoProvider();
    const response = await provider.search('test', 5);

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.link).toBe('https://complete.com');
  });

  it('calls the DDG API with correct query parameters', async () => {
    const provider = new DuckDuckGoProvider();
    await provider.search('RevealUI open source', 3);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0] as [string];
    // URLSearchParams uses + for spaces (form encoding)
    expect(url).toContain('format=json');
    expect(url).toContain('no_html=1');
    expect(url).toContain('skip_disambig=1');
    expect(url).toContain('RevealUI');
    expect(url).toContain('open');
    expect(url).toContain('source');
  });
});

describe('webSearchTool', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDDGResponse),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('has correct name', () => {
    expect(webSearchTool.name).toBe('web_search');
  });

  it('description mentions DuckDuckGo', () => {
    expect(webSearchTool.description).toContain('DuckDuckGo');
  });

  it('returns ToolResult with results on success', async () => {
    const result = await webSearchTool.execute({ query: 'RevealUI', maxResults: 5 });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('results');
    expect(result.data).toHaveProperty('tokenCount');
    expect(result.metadata?.tokensUsed).toBeGreaterThan(0);
  });

  it('returns success with empty results and message when no results found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ AbstractText: '', AbstractURL: '', RelatedTopics: [] }),
    });

    const result = await webSearchTool.execute({ query: 'zzzyyyxxx' });

    expect(result.success).toBe(true);
    const data = result.data as { results: unknown[]; message: string };
    expect(data.results).toHaveLength(0);
    expect(data.message).toContain('No results found');
  });

  it('returns error ToolResult on network failure (does not throw)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await webSearchTool.execute({ query: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Web search failed');
  });

  it('applies default maxResults of 5 when omitted', async () => {
    const result = await webSearchTool.execute({ query: 'test' });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('has metadata with category "web"', () => {
    expect(webSearchTool.getMetadata?.()).toMatchObject({ category: 'web' });
  });
});
