/**
 * Factory for the `revealui-content` MCP server.
 *
 * Dual-mode template (Stage 1 PR-1.2 of the MCP v1 plan): this module owns
 * the Server construction + request-handler wiring, decoupled from any
 * transport. The stdio launcher at `./revealui-content.ts` and a future HTTP
 * launcher both consume `createRevealuiContentServer()` to ensure a single
 * source of truth for the tool surface.
 *
 * Tools exposed:
 *   revealui_list_sites         — list all sites in the RevealUI instance
 *   revealui_list_content       — list content entries for a site/collection
 *   revealui_get_content        — fetch a single content entry by ID
 *   revealui_list_users         — list users (admin only)
 *   revealui_site_stats         — per-site user + content counts
 *
 * Credentials are supplied by the hypervisor (or HTTP launcher wrapper)
 * via `setCredentials()`. Falls back to `REVEALUI_API_URL` +
 * `REVEALUI_API_KEY` env vars when no override is set.
 *
 * This file is the template 12 remaining first-party servers will follow:
 *   1. Extract a `create<Name>Server()` factory here
 *   2. Make `<name>.ts` a thin stdio launcher that consumes the factory
 *   3. Consumers (admin, agent runtime) import the factory directly for
 *      HTTP hosting via `createNodeStreamableHttpHandler`.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

// ---------------------------------------------------------------------------
// Credential overrides (set by hypervisor / HTTP launcher)
// ---------------------------------------------------------------------------

let _credentialOverrides: Record<string, string> = {};

/**
 * Set credential overrides for this server. Called by the hypervisor with
 * resolved tenant credentials (or by an HTTP launcher before handing the
 * server to the handler).
 *
 * Credentials set here are process-global (module-level state). Multi-tenant
 * HTTP deployments that need per-session credentials should either:
 *   (a) instantiate the server inside `createServer` per call, passing the
 *       credentials into closure scope, OR
 *   (b) use the hypervisor's tenant-scoped credential resolver.
 */
export function setCredentials(creds: Record<string, string>): void {
  _credentialOverrides = creds;
}

// ---------------------------------------------------------------------------
// API helpers (shared across tool handlers)
// ---------------------------------------------------------------------------

function apiHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'RevealUI-MCP/1.0',
  };
}

async function apiGet(
  baseUrl: string,
  apiKey: string,
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: apiHeaders(apiKey) });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      (body as { error?: string; message?: string }).error ??
        (body as { message?: string }).message ??
        `API ${res.status}`,
    );
  }
  return body;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: 'revealui_list_sites',
    description: 'List all sites registered in the RevealUI instance.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results to return (default: 20)', default: 20 },
        page: {
          type: 'number',
          description: 'Page number for pagination (default: 1)',
          default: 1,
        },
      },
    },
  },
  {
    name: 'revealui_list_content',
    description:
      'List content entries for a site from a given collection (e.g. posts, pages, products).',
    inputSchema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'Site ID to query content from' },
        collection: {
          type: 'string',
          description: 'Collection slug (e.g. "posts", "pages", "products")',
        },
        limit: { type: 'number', description: 'Max results (default: 20)', default: 20 },
        page: { type: 'number', description: 'Page number (default: 1)', default: 1 },
        status: { type: 'string', description: 'Filter by status: published, draft, archived' },
      },
      required: ['collection'],
    },
  },
  {
    name: 'revealui_get_content',
    description: 'Fetch a single content entry by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection slug (e.g. "posts")' },
        id: { type: 'string', description: 'Content entry ID' },
      },
      required: ['collection', 'id'],
    },
  },
  {
    name: 'revealui_list_users',
    description:
      'List users registered in RevealUI. Requires admin API key. ' +
      'Returns email, role, and account status.',
    inputSchema: {
      type: 'object',
      properties: {
        site_id: { type: 'string', description: 'Filter users by site ID' },
        limit: { type: 'number', description: 'Max results (default: 20)', default: 20 },
        page: { type: 'number', description: 'Page number (default: 1)', default: 1 },
      },
    },
  },
  {
    name: 'revealui_site_stats',
    description:
      'Get aggregate stats for a RevealUI site: user count, content count per collection, and license tier.',
    inputSchema: {
      type: 'object',
      properties: {
        site_id: {
          type: 'string',
          description: 'Site ID to fetch stats for (omit for global stats)',
        },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh `revealui-content` MCP Server instance. Safe to call
 * multiple times — each call returns an independent Server with its own
 * request handlers registered. Dual-mode launchers (stdio, Streamable HTTP)
 * consume this factory; the factory itself is transport-agnostic.
 */
export function createRevealuiContentServer(): Server {
  const server = new Server(
    { name: 'revealui-content', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const startTime = Date.now();
    const toolName = request.params.name;

    const apiUrl = (_credentialOverrides.REVEALUI_API_URL ?? process.env.REVEALUI_API_URL)?.replace(
      /\/$/,
      '',
    );
    const apiKey = _credentialOverrides.REVEALUI_API_KEY ?? process.env.REVEALUI_API_KEY;

    if (!(apiUrl && apiKey)) {
      return {
        content: [
          { type: 'text', text: 'Error: REVEALUI_API_URL and REVEALUI_API_KEY must be set' },
        ],
        isError: true,
      };
    }

    try {
      let data: unknown;

      switch (toolName) {
        case 'revealui_list_sites': {
          const { limit = 20, page = 1 } = request.params.arguments as {
            limit?: number;
            page?: number;
          };
          data = await apiGet(apiUrl, apiKey, '/api/sites', {
            limit: String(limit),
            page: String(page),
          });
          break;
        }

        case 'revealui_list_content': {
          const {
            site_id,
            collection,
            limit = 20,
            page = 1,
            status,
          } = request.params.arguments as {
            site_id?: string;
            collection: string;
            limit?: number;
            page?: number;
            status?: string;
          };
          const params: Record<string, string> = {
            limit: String(limit),
            page: String(page),
          };
          if (site_id) params.siteId = site_id;
          if (status) params.status = status;

          data = await apiGet(apiUrl, apiKey, `/api/${collection}`, params);
          break;
        }

        case 'revealui_get_content': {
          const { collection, id } = request.params.arguments as {
            collection: string;
            id: string;
          };
          data = await apiGet(apiUrl, apiKey, `/api/${collection}/${id}`);
          break;
        }

        case 'revealui_list_users': {
          const {
            site_id,
            limit = 20,
            page = 1,
          } = request.params.arguments as {
            site_id?: string;
            limit?: number;
            page?: number;
          };
          const params: Record<string, string> = {
            limit: String(limit),
            page: String(page),
          };
          if (site_id) params.siteId = site_id;

          data = await apiGet(apiUrl, apiKey, '/api/users', params);
          break;
        }

        case 'revealui_site_stats': {
          const { site_id } = request.params.arguments as { site_id?: string };
          const params: Record<string, string> = {};
          if (site_id) params.siteId = site_id;

          data = await apiGet(apiUrl, apiKey, '/api/health', params);
          break;
        }

        default:
          return {
            content: [{ type: 'text', text: `Error: Unknown tool: ${toolName}` }],
            isError: true,
          };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                data,
                _meta: {
                  durationMs: Date.now() - startTime,
                  server: 'revealui-content',
                  tool: toolName,
                  timestamp: new Date().toISOString(),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }
  });

  return server;
}
