/**
 * Exa Web Search Provider (P4-3)
 *
 * Neural search backend using the Exa Search API.
 * Exa uses embeddings to find semantically relevant results, making it
 * especially good for research and complex queries. Requires an Exa API key.
 *
 * @see https://docs.exa.ai/reference/search
 */

import type { WebSearchProvider, WebSearchResponse, WebSearchResult } from './types.js';

const EXA_API_URL = 'https://api.exa.ai/search';

interface ExaResult {
  title: string;
  url: string;
  text?: string;
  highlights?: string[];
  score?: number;
}

interface ExaResponse {
  results: ExaResult[];
  requestId?: string;
}

/** Approximate token count for a string (4 chars ≈ 1 token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Exa neural search provider  -  BYOK, requires `EXA_API_KEY`.
 *
 * Exa uses embeddings to find semantically relevant results rather than
 * keyword matching. Best for research-oriented queries.
 *
 * Register via `AgentConfig.webSearchProvider` to replace the default
 * DuckDuckGo backend.
 *
 * @example
 * ```typescript
 * import { ExaProvider, createWebSearchTool } from '@revealui/ai'
 *
 * const tool = createWebSearchTool(new ExaProvider(process.env.EXA_API_KEY!))
 * agent.config = { webSearchProvider: new ExaProvider(key) }
 * ```
 */
export class ExaProvider implements WebSearchProvider {
  readonly name = 'exa';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('ExaProvider: apiKey is required');
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number): Promise<WebSearchResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(EXA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          query,
          num_results: maxResults,
          type: 'auto',
          contents: {
            text: { max_characters: 1000 },
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Exa API request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as ExaResponse;

    const results: WebSearchResult[] = data.results.slice(0, maxResults).map((r) => {
      const snippet = r.highlights?.join(' ') ?? r.text ?? '';
      return {
        title: r.title,
        link: r.url,
        snippet,
      };
    });

    const tokenCount = results.reduce(
      (acc, r) => acc + estimateTokens(r.title + r.link + r.snippet),
      0,
    );

    return { results, query, tokenCount };
  }
}
