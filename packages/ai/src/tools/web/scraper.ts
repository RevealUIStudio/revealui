/**
 * Web Scraper Tool
 *
 * Fetches a URL, extracts text via HtmlParser (no external deps),
 * and truncates to maxLength tokens with a helpful message.
 */

import { z } from 'zod/v4';
import { HtmlParser } from '../../ingestion/file-parsers.js';
import type { Tool, ToolResult } from '../base.js';

const ScraperParams = z.object({
  url: z.url(),
  maxLength: z.number().int().positive().default(4000),
});

const htmlParser = new HtmlParser();

/**
 * Returns true if the URL targets a private, loopback, or reserved address
 * that agents must not be allowed to fetch (SSRF protection).
 */
function isPrivateOrLoopbackUrl(urlString: string): boolean {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return true;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return true;
  }

  const host = url.hostname.toLowerCase();

  if (host === 'localhost' || host === '0.0.0.0') return true;
  if (host === '[::1]' || host === '::1') return true;

  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const [, aStr, bStr] = ipv4;
    const a = Number(aStr);
    const b = Number(bStr);
    if (a === 10) return true; // Class A private (RFC 1918)
    if (a === 127) return true; // Loopback
    if (a === 172 && b >= 16 && b <= 31) return true; // Class B private
    if (a === 192 && b === 168) return true; // Class C private
    if (a === 169 && b === 254) return true; // Link-local / AWS IMDS
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC 6598)
    if (a === 0) return true; // 0.x.x.x
  }

  return false;
}

export const webScraperTool: Tool = {
  name: 'web_scrape',
  description:
    'Fetch a URL and extract its text content. Use this to read web pages, documentation, or articles. For long documents, use document_summarize instead.',

  parameters: ScraperParams,

  async execute(params: unknown): Promise<ToolResult> {
    const start = Date.now();
    const parsed = ScraperParams.safeParse(params);
    if (!parsed.success) {
      return { success: false, error: `Invalid parameters: ${parsed.error.message}` };
    }

    const { url, maxLength } = parsed.data;
    const maxChars = maxLength * 4;

    if (isPrivateOrLoopbackUrl(url)) {
      return { success: false, error: 'URL targets a private or reserved address' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);

      let html: string;
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'RevealUI-Agent/1.0' },
        });
        clearTimeout(timer);

        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        html = await response.text();
      } finally {
        clearTimeout(timer);
      }

      const { text } = htmlParser.parse(html);
      const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;

      let content = text;
      let truncated = false;
      if (content.length > maxChars) {
        content =
          content.slice(0, maxChars) +
          ' [content truncated  -  use document_summarize for full content]';
        truncated = true;
      }

      return {
        success: true,
        data: { url, content, wordCount, truncated },
        metadata: { executionTime: Date.now() - start },
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { success: false, error: 'Request timed out after 10 seconds' };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};
