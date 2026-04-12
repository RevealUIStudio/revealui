/**
 * Web Search Types
 *
 * Shared types for web search tools and provider interface.
 * The WebSearchProvider interface enables swappable backends:
 * - DuckDuckGo (default, zero-config)  -  P3-1
 * - Tavily, Exa (BYOK)  -  P4-3
 */

export interface WebSearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface WebSearchResponse {
  results: WebSearchResult[];
  query: string;
  /** Approximate token count of the response content (chars / 4) */
  tokenCount: number;
}

/**
 * Interface for pluggable web search backends.
 *
 * DuckDuckGo is the default zero-config implementation.
 * Drop in Tavily or Exa by implementing this interface and registering
 * it via AgentConfig.webSearchProvider (Phase 4, P4-3).
 */
export interface WebSearchProvider {
  readonly name: string;
  search(query: string, maxResults: number): Promise<WebSearchResponse>;
}
