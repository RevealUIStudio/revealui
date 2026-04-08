/**
 * Tavily Web Search Provider (P4-3)
 *
 * High-quality BYOK search backend using the Tavily Search API.
 * Tavily is optimised for LLM consumption — returns clean, summarised
 * content rather than raw HTML. Requires a Tavily API key.
 *
 * @see https://docs.tavily.com/docs/tavily-api/rest_api
 */

import type { WebSearchProvider, WebSearchResponse, WebSearchResult } from './types.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface TavilyResponse {
  results: TavilyResult[];
  query: string;
  answer?: string;
}

/** Approximate token count for a string (4 chars ≈ 1 token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Tavily search provider — BYOK, requires `TAVILY_API_KEY`.
 *
 * Tavily returns high-quality, LLM-optimised results with relevance scoring.
 * Register via `AgentConfig.webSearchProvider` to replace the default
 * DuckDuckGo backend.
 *
 * @example
 * ```typescript
 * import { TavilyProvider, createWebSearchTool } from '@revealui/ai'
 *
 * const tool = createWebSearchTool(new TavilyProvider(process.env.TAVILY_API_KEY!))
 * agent.config = { webSearchProvider: new TavilyProvider(key) }
 * ```
 */
export class TavilyProvider implements WebSearchProvider {
  readonly name = 'tavily';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('TavilyProvider: apiKey is required');
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number): Promise<WebSearchResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(TAVILY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          search_depth: 'basic',
          include_answer: false,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Tavily API request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TavilyResponse;

    const results: WebSearchResult[] = data.results.slice(0, maxResults).map((r) => ({
      title: r.title,
      link: r.url,
      snippet: r.content,
    }));

    const tokenCount = results.reduce(
      (acc, r) => acc + estimateTokens(r.title + r.link + r.snippet),
      0,
    );

    return { results, query, tokenCount };
  }
}
