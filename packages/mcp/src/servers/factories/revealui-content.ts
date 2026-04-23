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
 * Resources (Stage 4.1 + 4.2): every CollectionConfig with `mcpResource !==
 * false` is surfaced as an MCP resource under `revealui-content://<slug>/
 * <id>`. The factory resolves the effective set via three tiers:
 *
 *   1. Injected `collectionsProvider` — in-process consumers (admin, agent
 *      runtime) pass a function that reads directly from the admin registry.
 *   2. HTTP introspection — fetches `${REVEALUI_API_URL}/api/mcp/collections`
 *      with the configured API key. Used by out-of-process consumers that
 *      can reach a running admin.
 *   3. Curated fallback — `posts`, `pages`, `products`, `media` with
 *      well-known title fields. Used when neither 1 nor 2 is available
 *      (airgapped dev, admin offline, credentials missing).
 *
 * Credentials are supplied by the hypervisor (or HTTP launcher wrapper)
 * via `setCredentials()`. Falls back to `REVEALUI_API_URL` +
 * `REVEALUI_API_KEY` env vars when no override is set.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  type CallToolRequest,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  type ReadResourceRequest,
  ReadResourceRequestSchema,
  type Resource,
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

function resolveCredentials(): { apiUrl?: string; apiKey?: string } {
  const apiUrl = (_credentialOverrides.REVEALUI_API_URL ?? process.env.REVEALUI_API_URL)?.replace(
    /\/$/,
    '',
  );
  const apiKey = _credentialOverrides.REVEALUI_API_KEY ?? process.env.REVEALUI_API_KEY;
  return { apiUrl, apiKey };
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
// Resource catalog (Stage 4.1 + 4.2)
// ---------------------------------------------------------------------------

/**
 * MCP-facing summary of a content collection. Wire-compatible with the shape
 * returned by `GET /api/mcp/collections` on the admin app.
 */
export interface CollectionMcpSummary {
  /** Collection slug. */
  slug: string;
  /** Human-readable singular label (e.g. `Post`). */
  label: string;
  /** Human-readable plural label, when known. */
  labelPlural?: string;
  /**
   * Resolved MCP-resource flag. Only collections with `mcpResource: true`
   * are surfaced as resources.
   */
  mcpResource: boolean;
}

/**
 * Injection point for in-process consumers. Returning `null` signals the
 * factory to try the next tier (HTTP, then curated).
 */
export type CollectionsProvider = () => Promise<CollectionMcpSummary[] | null>;

export interface CreateRevealuiContentServerOptions {
  /**
   * Optional provider used to resolve the list of collections exposed as
   * MCP resources. When provided, skips HTTP introspection. In-process
   * admin or agent-runtime consumers wire this to read the registry
   * directly; out-of-process subprocess consumers leave it unset.
   */
  collectionsProvider?: CollectionsProvider;
}

/**
 * Curated fallback used when neither an injected provider nor HTTP
 * introspection is available. These four collections exist in every admin
 * instance shipped today and have stable well-known title fields.
 */
const CURATED_FALLBACK: ReadonlyArray<CollectionMcpSummary> = [
  { slug: 'posts', label: 'Post', labelPlural: 'Posts', mcpResource: true },
  { slug: 'pages', label: 'Page', labelPlural: 'Pages', mcpResource: true },
  { slug: 'products', label: 'Product', labelPlural: 'Products', mcpResource: true },
  { slug: 'media', label: 'Media', mcpResource: true },
];

/**
 * Well-known title-field overrides by slug. Collections listed here pick
 * their title from the named field; unknown collections fall back to a
 * cascade (`title` → `name` → `filename` → `label` → id).
 */
const TITLE_FIELD_OVERRIDES: Record<string, string> = {
  posts: 'title',
  pages: 'title',
  products: 'name',
  media: 'filename',
};

const TITLE_FIELD_CASCADE = ['title', 'name', 'filename', 'label'] as const;

/** URI scheme for Stage 4.1. Stage 4.2 leaves this stable; a `revealui://
 *  <tenant>/<collection>/<id>` variant is parked for a future design call. */
const RESOURCE_URI_PREFIX = 'revealui-content://';

/** Max rows per collection surfaced in a single `resources/list` response. */
const DEFAULT_RESOURCE_PAGE_SIZE = 50;

interface ContentRow extends Record<string, unknown> {
  id: string | number;
}

interface ContentListResponse {
  docs?: ContentRow[];
  data?: ContentRow[];
  items?: ContentRow[];
}

/** Extract rows from one of several shapes the RevealUI content API uses. */
function extractDocs(body: unknown): ContentRow[] {
  if (!body || typeof body !== 'object') return [];
  const b = body as ContentListResponse & { data?: ContentRow[] | { docs?: ContentRow[] } };
  if (Array.isArray(b.docs)) return b.docs;
  if (Array.isArray(b.items)) return b.items;
  if (Array.isArray(b.data)) return b.data;
  if (b.data && typeof b.data === 'object' && Array.isArray((b.data as { docs?: unknown }).docs)) {
    return (b.data as { docs: ContentRow[] }).docs;
  }
  return [];
}

function pickTitle(row: ContentRow, collectionSlug: string): string {
  const override = TITLE_FIELD_OVERRIDES[collectionSlug];
  if (override) {
    const raw = row[override];
    if (typeof raw === 'string' && raw.length > 0) return raw;
  }
  for (const field of TITLE_FIELD_CASCADE) {
    const raw = row[field];
    if (typeof raw === 'string' && raw.length > 0) return raw;
  }
  return String(row.id);
}

function resourceForRow(summary: CollectionMcpSummary, row: ContentRow): Resource {
  const id = String(row.id);
  const description = summary.labelPlural ?? `${summary.label} collection`;
  return {
    uri: `${RESOURCE_URI_PREFIX}${summary.slug}/${id}`,
    name: `${summary.slug}/${pickTitle(row, summary.slug)}`,
    description: `${description} (id: ${id})`,
    mimeType: 'application/json',
  };
}

function parseResourceUri(uri: string): { collection: string; id: string } | null {
  if (!uri.startsWith(RESOURCE_URI_PREFIX)) return null;
  const rest = uri.slice(RESOURCE_URI_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash < 1 || slash === rest.length - 1) return null;
  const collection = rest.slice(0, slash);
  const id = rest.slice(slash + 1);
  if (!/^[a-z][a-z0-9-]*$/.test(collection)) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return null;
  return { collection, id };
}

/**
 * Fetch collection summaries from the admin introspection endpoint.
 * Returns `null` on any failure (network, non-200, malformed body) —
 * callers fall back to the curated set.
 */
async function fetchCollectionsFromAdmin(
  apiUrl: string,
  apiKey: string,
): Promise<CollectionMcpSummary[] | null> {
  try {
    const res = await fetch(`${apiUrl}/api/mcp/collections`, {
      headers: apiHeaders(apiKey),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { collections?: unknown };
    if (!Array.isArray(body.collections)) return null;
    const out: CollectionMcpSummary[] = [];
    for (const raw of body.collections) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Partial<CollectionMcpSummary>;
      if (typeof r.slug !== 'string' || r.slug.length === 0) continue;
      if (typeof r.label !== 'string' || r.label.length === 0) continue;
      if (typeof r.mcpResource !== 'boolean') continue;
      out.push({
        slug: r.slug,
        label: r.label,
        labelPlural: typeof r.labelPlural === 'string' ? r.labelPlural : undefined,
        mcpResource: r.mcpResource,
      });
    }
    return out;
    // empty-catch-ok: network/auth/schema errors fall back to curated set
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh `revealui-content` MCP Server instance. Safe to call
 * multiple times — each call returns an independent Server with its own
 * request handlers registered. Dual-mode launchers (stdio, Streamable HTTP)
 * consume this factory; the factory itself is transport-agnostic.
 */
export function createRevealuiContentServer(options?: CreateRevealuiContentServerOptions): Server {
  const server = new Server(
    { name: 'revealui-content', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  // Per-server memoization: resolve the effective collection set once and
  // reuse across `resources/list` + `resources/read` for the lifetime of the
  // server instance. Avoids double-fetching on every read.
  let cachedCollections: CollectionMcpSummary[] | null = null;

  async function resolveCollections(): Promise<CollectionMcpSummary[]> {
    if (cachedCollections) return cachedCollections;

    // Tier 1: injected provider (in-process consumers).
    if (options?.collectionsProvider) {
      const fromProvider = await options.collectionsProvider().catch(() => null);
      if (fromProvider) {
        cachedCollections = fromProvider.filter((c) => c.mcpResource);
        return cachedCollections;
      }
    }

    // Tier 2: HTTP introspection against admin.
    const { apiUrl, apiKey } = resolveCredentials();
    if (apiUrl && apiKey) {
      const fromHttp = await fetchCollectionsFromAdmin(apiUrl, apiKey);
      if (fromHttp) {
        cachedCollections = fromHttp.filter((c) => c.mcpResource);
        return cachedCollections;
      }
    }

    // Tier 3: curated fallback.
    cachedCollections = [...CURATED_FALLBACK];
    return cachedCollections;
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  // -------------------------------------------------------------------------
  // Resources (Stage 4.1 + 4.2)
  // -------------------------------------------------------------------------

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const { apiUrl, apiKey } = resolveCredentials();
    if (!(apiUrl && apiKey)) {
      // Without credentials the server can't enumerate rows; advertise an
      // empty list rather than erroring — clients still see the resources
      // capability and can retry once creds are set.
      return { resources: [] };
    }

    const collections = await resolveCollections();
    const resources: Resource[] = [];
    for (const collection of collections) {
      try {
        const body = await apiGet(apiUrl, apiKey, `/api/${collection.slug}`, {
          limit: String(DEFAULT_RESOURCE_PAGE_SIZE),
          page: '1',
        });
        for (const row of extractDocs(body)) {
          resources.push(resourceForRow(collection, row));
        }
      } catch {
        // empty-catch-ok: an unavailable collection shouldn't blank-out the entire resource list
      }
    }
    return { resources };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const parsed = parseResourceUri(request.params.uri);
    if (!parsed) {
      throw new Error(
        `Unknown resource URI (expected ${RESOURCE_URI_PREFIX}<collection>/<id>): ${request.params.uri}`,
      );
    }
    const collections = await resolveCollections();
    const collection = collections.find((c) => c.slug === parsed.collection);
    if (!collection) {
      throw new Error(`Collection is not exposed as a resource: ${parsed.collection}`);
    }

    const { apiUrl, apiKey } = resolveCredentials();
    if (!(apiUrl && apiKey)) {
      throw new Error('REVEALUI_API_URL and REVEALUI_API_KEY must be set');
    }

    const row = await apiGet(apiUrl, apiKey, `/api/${parsed.collection}/${parsed.id}`);
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'application/json',
          text: JSON.stringify(row, null, 2),
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const startTime = Date.now();
    const toolName = request.params.name;

    const { apiUrl, apiKey } = resolveCredentials();

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
