import type { Tool, ToolResult } from '@revealui/ai';
import { z } from 'zod/v4';

const WEB_FETCH_PARAMS = z.object({
  url: z.string().url().describe('The HTTP(S) URL to fetch.'),
});

const MAX_RESPONSE_CHARS = 100_000;
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Hostnames/ranges this tool refuses to fetch. This is a minimal, static
 * SSRF guard (no DNS resolution, no redirect-chain re-checking) appropriate
 * for a v0.1 scaffold running on Apify's own infrastructure -- it blocks the
 * obvious cloud-metadata and loopback/private targets an LLM-directed fetch
 * could otherwise be steered at. It is NOT a complete SSRF defense (e.g. DNS
 * rebinding is out of scope here); see the PR body's open design questions.
 */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1')
    return true;
  if (host === '169.254.169.254') return true; // cloud metadata endpoint
  if (host.endsWith('.internal') || host.endsWith('.local')) return true;
  if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
  if (host.startsWith('172.')) {
    const secondOctet = Number(host.split('.')[1]);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  return false;
}

export const webFetchTool: Tool = {
  name: 'web_fetch',
  label: 'Fetch a web page',
  description:
    'Fetch the text content of a public HTTP or HTTPS URL. Returns up to 100,000 characters of the response body. Does not follow redirects.',
  parameters: WEB_FETCH_PARAMS,
  async execute(rawParams: unknown): Promise<ToolResult> {
    const parsedParams = WEB_FETCH_PARAMS.safeParse(rawParams);
    if (!parsedParams.success) {
      return { success: false, error: `invalid params: ${parsedParams.error.message}` };
    }

    let url: URL;
    try {
      url = new URL(parsedParams.data.url);
    } catch {
      return { success: false, error: 'invalid URL' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { success: false, error: 'only http/https URLs are allowed' };
    }
    if (isBlockedHost(url.hostname)) {
      return {
        success: false,
        error: 'this host is not allowed (private, loopback, or internal address)',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
      if (response.status >= 300 && response.status < 400) {
        return { success: false, error: 'redirects are not followed (SSRF safety)' };
      }
      const text = await response.text();
      const truncated = text.length > MAX_RESPONSE_CHARS ? text.slice(0, MAX_RESPONSE_CHARS) : text;
      return {
        success: response.ok,
        content: truncated,
        data: { status: response.status, truncated: text.length > MAX_RESPONSE_CHARS },
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

/** Built-in tools this actor ships. Expanding the catalog is future work. */
export const BUILT_IN_TOOLS: Tool[] = [webFetchTool];

/** Filter the built-in tool catalog by the actor input's `toolAllowlist`.
 * Omitted allowlist = every built-in tool enabled. Empty array = no tools. */
export function selectTools(allowlist: string[] | undefined): Tool[] {
  if (!allowlist) return BUILT_IN_TOOLS;
  const allowed = new Set(allowlist);
  return BUILT_IN_TOOLS.filter((tool) => allowed.has(tool.name));
}
