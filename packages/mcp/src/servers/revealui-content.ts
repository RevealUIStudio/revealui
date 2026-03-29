#!/usr/bin/env node

/**
 * RevealUI Content MCP Server
 *
 * Model Context Protocol server that gives AI agents read/write access to
 * RevealUI CMS content via the RevealUI REST API. Useful for agents that need
 * to query site data, list content, manage users, or inspect deployment state.
 *
 * Environment:
 *   REVEALUI_API_URL     — Base URL of the RevealUI API (e.g. https://api.mysite.com)
 *   REVEALUI_API_KEY     — API key for authenticating with the RevealUI API
 *
 * Tools:
 *   revealui_list_sites        — List all sites in the RevealUI instance
 *   revealui_list_content      — List content entries for a site and collection
 *   revealui_get_content       — Fetch a single content entry by ID
 *   revealui_list_users        — List users (admin only)
 *   revealui_site_stats        — Get user + content counts for a site
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '@revealui/core/observability/logger';
import { checkMcpLicense } from '../index.js';

// ---------------------------------------------------------------------------
// API helpers
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
) {
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
// Server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'revealui-content', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

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

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const apiUrl = process.env.REVEALUI_API_URL?.replace(/\/$/, '');
  const apiKey = process.env.REVEALUI_API_KEY;

  if (!(apiUrl && apiKey)) {
    return {
      content: [{ type: 'text', text: 'Error: REVEALUI_API_URL and REVEALUI_API_KEY must be set' }],
      isError: true,
    };
  }

  try {
    switch (request.params.name) {
      case 'revealui_list_sites': {
        const { limit = 20, page = 1 } = request.params.arguments as {
          limit?: number;
          page?: number;
        };
        const result = await apiGet(apiUrl, apiKey, '/api/sites', {
          limit: String(limit),
          page: String(page),
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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

        const result = await apiGet(apiUrl, apiKey, `/api/${collection}`, params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'revealui_get_content': {
        const { collection, id } = request.params.arguments as {
          collection: string;
          id: string;
        };
        const result = await apiGet(apiUrl, apiKey, `/api/${collection}/${id}`);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
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

        const result = await apiGet(apiUrl, apiKey, '/api/users', params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'revealui_site_stats': {
        const { site_id } = request.params.arguments as { site_id?: string };
        const params: Record<string, string> = {};
        if (site_id) params.siteId = site_id;

        const result = await apiGet(apiUrl, apiKey, '/api/health', params);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown tool: ${request.params.name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [
        { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
      ],
      isError: true,
    };
  }
});

async function main() {
  if (!(await checkMcpLicense())) {
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logger.error('RevealUI Content MCP error', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
