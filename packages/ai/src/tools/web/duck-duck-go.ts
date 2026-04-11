/**
 * DuckDuckGo Web Search Tool
 *
 * Uses the DuckDuckGo Instant Answer API (no API key required).
 * Returns structured results suitable for agent consumption.
 *
 * Part of the WebSearch skill family  -  see types.ts for the
 * WebSearchProvider interface used by future Tavily/Exa backends (P4-3).
 */

import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import type { WebSearchProvider, WebSearchResponse, WebSearchResult } from './types.js';

const DDG_API_URL = 'https://api.duckduckgo.com/';

// DuckDuckGo Instant Answer API uses PascalCase  -  must match the external shape exactly.
interface DdgRelatedTopic {
  Text?: string;
  FirstURL?: string;
  Topics?: unknown[];
}
interface DdgResponse {
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  RelatedTopics?: DdgRelatedTopic[];
}

/** Approximate token count for a string (4 chars ≈ 1 token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// Provider
// =============================================================================

/**
 * DuckDuckGo search provider  -  zero-config, no API key required.
 *
 * Uses the DuckDuckGo Instant Answer API to retrieve the abstract summary
 * and related topics for a query.
 */
export class DuckDuckGoProvider implements WebSearchProvider {
  readonly name = 'duckduckgo';

  async search(query: string, maxResults: number): Promise<WebSearchResponse> {
    const url = new URL(DDG_API_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('no_html', '1');
    url.searchParams.set('skip_disambig', '1');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!response.ok) {
      throw new Error(`DuckDuckGo API request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as DdgResponse;

    const results: WebSearchResult[] = [];

    // Add abstract if present
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.AbstractSource || query,
        link: data.AbstractURL,
        snippet: data.AbstractText,
      });
    }

    // Add related topics (skip category group entries that have nested Topics)
    for (const topic of data.RelatedTopics ?? []) {
      if (results.length >= maxResults) break;
      if (topic.Topics) continue; // category group  -  skip

      const text = topic.Text;
      const firstURL = topic.FirstURL;
      if (!(firstURL && text)) continue;

      const parts = text.split(' - ');
      results.push({
        title: parts[0]?.trim() ?? text,
        link: firstURL,
        snippet: text,
      });
    }

    const tokenCount = results.reduce(
      (acc, r) => acc + estimateTokens(r.title + r.link + r.snippet),
      0,
    );

    return { results, query, tokenCount };
  }
}

// =============================================================================
// Tool
// =============================================================================

const WebSearchParamsSchema = z.object({
  query: z.string().min(1).describe('The search query'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Maximum number of results to return (1–20, default 5)'),
});

/**
 * Factory that creates a `web_search` tool backed by any WebSearchProvider.
 *
 * The singleton `webSearchTool` uses DuckDuckGo. Pass a TavilyProvider or
 * ExaProvider here to get the same tool with a premium BYOK backend.
 *
 * @example
 * ```typescript
 * import { createWebSearchTool, TavilyProvider } from '@revealui/ai'
 *
 * const tool = createWebSearchTool(new TavilyProvider(apiKey))
 * agent.tools.push(tool)
 * ```
 */
export function createWebSearchTool(provider: WebSearchProvider): Tool {
  return {
    name: 'web_search',
    description: `Search the web using ${provider.name}. Returns titles, URLs, and snippets for the given query.`,
    parameters: WebSearchParamsSchema,

    async execute(params: unknown): Promise<ToolResult> {
      const { query, maxResults } = WebSearchParamsSchema.parse(params);

      try {
        const response = await provider.search(query, maxResults);

        if (response.results.length === 0) {
          return {
            success: true,
            data: {
              results: [],
              query,
              tokenCount: 0,
              message: 'No results found for this query.',
            },
            metadata: { tokensUsed: 0 },
          };
        }

        return {
          success: true,
          data: response,
          metadata: { tokensUsed: response.tokenCount },
        };
      } catch (error) {
        return {
          success: false,
          error: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },

    getMetadata() {
      return {
        category: 'web',
        version: '1.0.0',
        author: 'RevealUI',
      };
    },
  };
}

/**
 * Web search tool backed by DuckDuckGo (zero-config).
 *
 * Register this on any agent that needs live web access. Requires no
 * API key  -  backed by the DuckDuckGo Instant Answer API.
 *
 * @example
 * ```typescript
 * import { webSearchTool } from '@revealui/ai'
 *
 * agent.tools.push(webSearchTool)
 * // Agent can now call web_search({ query: '...', maxResults: 5 })
 * ```
 */
export const webSearchTool: Tool = {
  name: 'web_search',
  description:
    'Search the web using DuckDuckGo. Returns titles, URLs, and snippets for the given query. ' +
    'No API key required.',
  parameters: WebSearchParamsSchema,

  async execute(params: unknown): Promise<ToolResult> {
    const { query, maxResults } = WebSearchParamsSchema.parse(params);
    const provider = new DuckDuckGoProvider();

    try {
      const response = await provider.search(query, maxResults);

      if (response.results.length === 0) {
        return {
          success: true,
          data: {
            results: [],
            query,
            tokenCount: 0,
            message: 'No results found for this query.',
          },
          metadata: { tokensUsed: 0 },
        };
      }

      return {
        success: true,
        data: response,
        metadata: { tokensUsed: response.tokenCount },
      };
    } catch (error) {
      return {
        success: false,
        error: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  getMetadata() {
    return {
      category: 'web',
      version: '1.0.0',
      author: 'RevealUI',
    };
  },
};
