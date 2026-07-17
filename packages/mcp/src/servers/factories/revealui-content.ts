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

import { createHash } from 'node:crypto';
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
import { z } from 'zod/v4';
import { type McpToolError, validateToolArgs } from '../../validate-tool-args.js';

// ---------------------------------------------------------------------------
// Governed-path seams (GAP-371 Phase 1)
// ---------------------------------------------------------------------------
//
// The stdio launcher constructs this factory with NO options and keeps the
// process-global `resolveCredentials()` (env / setCredentials) model — correct
// for a single-operator laptop. The governed HTTP mount (`/api/mcp`) instead
// injects a per-request `credentialsProvider` (returns the CALLER's own bearer
// token) and an `auditSink` (a receipt per tool call). When a
// `credentialsProvider` is present it is the SOLE credential source: the env
// fallback is never consulted on the governed path (invariant I-4).

/** Resolved REST credentials for one tool call. */
export interface ResolvedApiCredentials {
  apiUrl: string;
  apiKey: string;
}

/**
 * Per-request context handed to the governed seams. Derived from the MCP
 * request handler's `extra` (the transport threads `authInfo` from the
 * authenticated HTTP request; `sessionId` is the routing key). `undefined`
 * on the stdio path.
 */
export interface McpToolCallContext {
  authInfo?: unknown;
  sessionId?: string;
}

/**
 * Governed-path credential resolver. Returns the credentials to forward for a
 * single tool call — on the governed path, the caller's own bearer token so
 * the REST layer enforces `access.read` against the real user. May throw /
 * reject when no per-request credential exists; the call then fails closed.
 */
export type CredentialsProvider = (
  ctx: McpToolCallContext,
) => Promise<ResolvedApiCredentials> | ResolvedApiCredentials;

/** Terminal outcome of a governed tool call, as recorded in the receipt. */
export type McpToolAuditOutcome = 'invoked' | 'denied' | 'failed';

/**
 * A governed tool-call receipt. Raw arguments are NEVER included — only a
 * sha256 digest of the canonical JSON plus an allowlisted scalar subset
 * (`collection`, `site_id`) that is safe to store in the clear.
 */
export interface McpToolAuditRecord {
  outcome: McpToolAuditOutcome;
  tool: string;
  /** sha256 (hex) of the canonical JSON of the raw arguments. */
  argsDigest: string;
  /** Allowlisted non-secret identifiers pulled from the validated args. */
  scalars: Record<string, string>;
  durationMs: number;
  httpStatus?: number;
  /**
   * Why a call was denied, when `outcome === 'denied'`. `'authz'` for a
   * deny-by-default tool-permission miss (I-7); `'rate-limit'` when the
   * per-user quota is exhausted (I-8). Absent for a validation/unknown-tool
   * denial and for non-denied outcomes.
   */
  reason?: string;
  /** The MCP client that connected (from the `initialize` handshake). */
  clientInfo?: { name: string; version: string };
  context: McpToolCallContext;
}

/**
 * Governed-path audit sink. Resolves when the receipt is durably written;
 * rejects when the write failed. For a mutating tool a rejection fails the
 * call (fail-closed); for a read tool it degrades to log-and-continue.
 */
export type McpToolAuditSink = (record: McpToolAuditRecord) => Promise<void>;

/**
 * Deny-by-default per-tool authorization gate (GAP-371 Phase 2, I-7). Returns
 * true iff the identity threaded through `ctx.authInfo` may execute `toolName`
 * at its server-derived tier and role. Governs BOTH `tools/list` filtering and
 * `tools/call` execution — a tool absent from the list is still independently
 * denied on a direct call. Absent on the stdio path (every tool allowed).
 */
export type McpToolAuthorizer = (ctx: McpToolCallContext, toolName: string) => boolean;

/**
 * Per-call rate-limit gate (GAP-371 Phase 2, I-8). Consumed once per authorized
 * `tools/call`, keyed by the caller's user + tool with limits from the
 * server-derived tier. Returns false when the quota is exhausted. Absent on the
 * stdio path (unlimited). Never consumed for `tools/list` or for a denied call.
 */
export type McpToolRateLimiter = (
  ctx: McpToolCallContext,
  toolName: string,
) => Promise<boolean> | boolean;

/** One usage-meter event, emitted once per EXECUTED tool call (I-8 tail). */
export interface McpToolMeterEvent {
  tool: string;
  durationMs: number;
  /** True when the tool surfaced an error (bad args reaching the backend, throw, non-2xx). */
  errored: boolean;
}

/**
 * Usage-meter sink (GAP-371 Phase 2). Fired once per tool call that actually
 * executed (success or failure) — never for an authz/rate-limit denial, which
 * are audit events, not billable usage. Sink errors are swallowed: metering
 * must never break the underlying tool call. Billing and audit are separate
 * sinks by design.
 */
export type McpToolMeterSink = (
  ctx: McpToolCallContext,
  event: McpToolMeterEvent,
) => void | Promise<void>;

/** sha256 (hex) of the canonical JSON of an arbitrary argument object. */
function digestArgs(args: unknown): string {
  return createHash('sha256').update(canonicalJson(args)).digest('hex');
}

/**
 * Deterministic JSON with object keys sorted, so the digest of the same
 * logical arguments is stable regardless of key order. No regex; a manual
 * recursive serializer over the parsed value.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** Allowlisted, non-secret scalars safe to store in a receipt in the clear. */
const AUDIT_SCALAR_ALLOWLIST = ['collection', 'site_id'] as const;

function pickAuditScalars(args: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!args || typeof args !== 'object') return out;
  const record = args as Record<string, unknown>;
  for (const key of AUDIT_SCALAR_ALLOWLIST) {
    const raw = record[key];
    if (typeof raw === 'string' && raw.length > 0) out[key] = raw;
  }
  return out;
}

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
    throw new ApiRequestError(
      (body as { error?: string; message?: string }).error ??
        (body as { message?: string }).message ??
        `API ${res.status}`,
      res.status,
    );
  }
  return body;
}

// ---------------------------------------------------------------------------
// Tool argument schemas (Zod 4)
// ---------------------------------------------------------------------------

export const ListSitesArgsSchema = z
  .object({
    limit: z.number().optional(),
    page: z.number().optional(),
  })
  .strict();

export const ListContentArgsSchema = z
  .object({
    site_id: z.string().optional(),
    collection: z.string().min(1),
    limit: z.number().optional(),
    page: z.number().optional(),
    status: z.string().optional(),
  })
  .strict();

export const GetContentArgsSchema = z
  .object({
    collection: z.string().min(1),
    id: z.string().min(1),
  })
  .strict();

export const ListUsersArgsSchema = z
  .object({
    site_id: z.string().optional(),
    limit: z.number().optional(),
    page: z.number().optional(),
  })
  .strict();

export const SiteStatsArgsSchema = z
  .object({
    site_id: z.string().optional(),
  })
  .strict();

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

  /**
   * Governed-path (GAP-371) per-request credential resolver. When set, it is
   * the SOLE source of tool-call credentials — the `REVEALUI_API_KEY` /
   * `setCredentials()` fallback is never consulted (invariant I-4). Leave
   * unset for the stdio launcher to keep the process-global env-key model.
   */
  credentialsProvider?: CredentialsProvider;

  /**
   * Governed-path audit sink. When set, every `tools/call` produces a receipt
   * (invariant I-5). Mutating tools (see `mutatingTools`) fail closed if the
   * receipt cannot be written; read tools degrade to log-and-continue.
   */
  auditSink?: McpToolAuditSink;

  /**
   * Names of tools that mutate state and therefore require a durable receipt
   * BEFORE they run. Phase 1 exposes read tools only, so this is empty in
   * production; it exists so Phase 2 write tools inherit the fail-closed path
   * (and so the branch is testable now with a simulated mutating tool).
   */
  mutatingTools?: ReadonlySet<string>;

  /**
   * Governed-path deny-by-default per-tool authorization (I-7). When set, it
   * gates BOTH `tools/list` (advertised set) and `tools/call` (execution). A
   * tool the caller may not execute is neither listed nor callable. Leave unset
   * for the stdio launcher (no per-tool authz — the OS account is the boundary).
   */
  toolAuthorizer?: McpToolAuthorizer;

  /**
   * Governed-path per-call rate limiter (I-8). When set, an authorized
   * `tools/call` consumes one token; exhaustion yields a JSON-RPC error and a
   * `mcp:tool:denied` receipt with `reason: 'rate-limit'`. Unset → unlimited.
   */
  rateLimiter?: McpToolRateLimiter;

  /**
   * Governed-path usage-meter sink. When set, one meter event fires per
   * executed tool call (source `agent` downstream). Unset → no metering.
   */
  meterSink?: McpToolMeterSink;
}

/** Error carrying the upstream HTTP status, for audit `httpStatus`. */
class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
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

  server.setRequestHandler(ListToolsRequestSchema, async (_request, extra) => {
    const authorizer = options?.toolAuthorizer;
    if (!authorizer) return { tools: TOOLS };
    // Filtered discovery (I-7): advertise only tools this caller may execute.
    // This is UX; execution authz below is the security control — a tool hidden
    // here is still independently denied on a direct `tools/call`.
    const ctx: McpToolCallContext = {
      authInfo: (extra as { authInfo?: unknown } | undefined)?.authInfo,
      sessionId: (extra as { sessionId?: string } | undefined)?.sessionId,
    };
    return { tools: TOOLS.filter((tool) => authorizer(ctx, tool.name)) };
  });

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

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest, extra) => {
    const startTime = Date.now();
    const toolName = request.params.name;
    const rawArgs = request.params.arguments;
    const ctx: McpToolCallContext = {
      authInfo: (extra as { authInfo?: unknown } | undefined)?.authInfo,
      sessionId: (extra as { sessionId?: string } | undefined)?.sessionId,
    };
    const auditSink = options?.auditSink;
    const mutating = options?.mutatingTools?.has(toolName) ?? false;

    // Write a receipt for this call. Returns whether the write succeeded; the
    // sink itself classifies + logs a failure, so callers only decide between
    // fail-closed (mutations) and degrade (reads). No-op when no sink is wired
    // (the stdio path).
    async function writeReceipt(
      outcome: McpToolAuditOutcome,
      opts?: { httpStatus?: number; reason?: string },
    ): Promise<boolean> {
      if (!auditSink) return true;
      const client = server.getClientVersion();
      const record: McpToolAuditRecord = {
        outcome,
        tool: toolName,
        argsDigest: digestArgs(rawArgs ?? null),
        scalars: pickAuditScalars(rawArgs),
        durationMs: Date.now() - startTime,
        httpStatus: opts?.httpStatus,
        reason: opts?.reason,
        clientInfo: client ? { name: client.name, version: client.version } : undefined,
        context: ctx,
      };
      try {
        await auditSink(record);
        return true;
      } catch {
        return false;
      }
    }

    // A call rejected before it executes (unknown tool, invalid args, authz or
    // rate-limit denial). Records a `denied` receipt (best-effort — a denial
    // that mutates nothing degrades like a read) and returns the client error.
    async function denied(response: McpToolError, reason?: string): Promise<McpToolError> {
      await writeReceipt('denied', reason ? { reason } : undefined);
      return response;
    }

    // Deny-by-default collection allowlist. The content tools interpolate the
    // `collection` arg into `/api/<collection>`, so a free-string collection
    // would let one tool reach another tool's endpoint (e.g. `/api/users`,
    // bypassing the admin gate on `revealui_list_users`). A collection outside
    // the RESOLVED exposed set is denied before any REST call — the backend is
    // never reached for an unexposed collection.
    async function denyIfCollectionNotExposed(collection: string): Promise<McpToolError | null> {
      const exposed = await resolveCollections();
      const slugs = new Set(exposed.map((c) => c.slug));
      if (slugs.has(collection)) return null;
      return denied(
        {
          content: [{ type: 'text', text: `Error: collection is not exposed: ${collection}` }],
          isError: true,
        },
        'collection-not-exposed',
      );
    }

    // Emit one usage-meter event for a call that actually executed. Swallows
    // sink errors so metering can never break the tool call.
    async function fireMeter(errored: boolean): Promise<void> {
      if (!options?.meterSink) return;
      try {
        await options.meterSink(ctx, {
          tool: toolName,
          durationMs: Date.now() - startTime,
          errored,
        });
      } catch {
        // empty-catch-ok: metering is best-effort and must not affect the call
      }
    }

    // Deny-by-default per-tool authorization (I-7). Runs before credentials are
    // resolved, so an unauthorized caller never triggers a credential lookup or
    // a REST call. A tool hidden from `tools/list` is still denied here.
    if (options?.toolAuthorizer && !options.toolAuthorizer(ctx, toolName)) {
      return denied(
        {
          content: [{ type: 'text', text: `Error: not authorized to call tool: ${toolName}` }],
          isError: true,
        },
        'authz',
      );
    }

    // Per-user + tier rate limit (I-8). Consumed only for an authorized call,
    // before any credential resolution or execution. A denial is audited with
    // `reason: 'rate-limit'` and never meters (a rejected call is not usage).
    if (options?.rateLimiter) {
      const allowed = await options.rateLimiter(ctx, toolName);
      if (!allowed) {
        return denied(
          {
            content: [{ type: 'text', text: `Error: rate limit exceeded for tool: ${toolName}` }],
            isError: true,
          },
          'rate-limit',
        );
      }
    }

    // Resolve credentials. Governed path: the injected provider is the sole
    // source and may throw when no per-request credential exists (I-4). Env
    // path is unchanged for stdio.
    let apiUrl: string;
    let apiKey: string;
    try {
      if (options?.credentialsProvider) {
        const resolved = await options.credentialsProvider(ctx);
        apiUrl = resolved.apiUrl;
        apiKey = resolved.apiKey;
      } else {
        const resolved = resolveCredentials();
        if (!(resolved.apiUrl && resolved.apiKey)) {
          return {
            content: [
              { type: 'text', text: 'Error: REVEALUI_API_URL and REVEALUI_API_KEY must be set' },
            ],
            isError: true,
          };
        }
        apiUrl = resolved.apiUrl;
        apiKey = resolved.apiKey;
      }
    } catch (err) {
      await writeReceipt('failed');
      return {
        content: [
          { type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` },
        ],
        isError: true,
      };
    }

    // Fail-closed for mutations: the receipt is written BEFORE the tool runs,
    // so a state change can never happen without a durable record of it. If
    // the write fails, refuse the call — nothing executes.
    if (mutating) {
      const recorded = await writeReceipt('invoked');
      if (!recorded) {
        return {
          content: [{ type: 'text', text: 'Error: audit log unavailable; mutating tool refused' }],
          isError: true,
        };
      }
    }

    try {
      let data: unknown;

      switch (toolName) {
        case 'revealui_list_sites': {
          const parsed = validateToolArgs(ListSitesArgsSchema, rawArgs, toolName);
          if (!parsed.ok) return denied(parsed.error);
          const { limit = 20, page = 1 } = parsed.value;
          data = await apiGet(apiUrl, apiKey, '/api/sites', {
            limit: String(limit),
            page: String(page),
          });
          break;
        }

        case 'revealui_list_content': {
          const parsed = validateToolArgs(ListContentArgsSchema, rawArgs, toolName);
          if (!parsed.ok) return denied(parsed.error);
          const { site_id, collection, limit = 20, page = 1, status } = parsed.value;
          const notExposed = await denyIfCollectionNotExposed(collection);
          if (notExposed) return notExposed;
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
          const parsed = validateToolArgs(GetContentArgsSchema, rawArgs, toolName);
          if (!parsed.ok) return denied(parsed.error);
          const { collection, id } = parsed.value;
          const notExposed = await denyIfCollectionNotExposed(collection);
          if (notExposed) return notExposed;
          data = await apiGet(apiUrl, apiKey, `/api/${collection}/${id}`);
          break;
        }

        case 'revealui_list_users': {
          const parsed = validateToolArgs(ListUsersArgsSchema, rawArgs, toolName);
          if (!parsed.ok) return denied(parsed.error);
          const { site_id, limit = 20, page = 1 } = parsed.value;
          const params: Record<string, string> = {
            limit: String(limit),
            page: String(page),
          };
          if (site_id) params.siteId = site_id;

          data = await apiGet(apiUrl, apiKey, '/api/users', params);
          break;
        }

        case 'revealui_site_stats': {
          const parsed = validateToolArgs(SiteStatsArgsSchema, rawArgs, toolName);
          if (!parsed.ok) return denied(parsed.error);
          const { site_id } = parsed.value;
          const params: Record<string, string> = {};
          if (site_id) params.siteId = site_id;

          data = await apiGet(apiUrl, apiKey, '/api/health', params);
          break;
        }

        default:
          return denied({
            content: [{ type: 'text', text: `Error: Unknown tool: ${toolName}` }],
            isError: true,
          });
      }

      // Read tools record the receipt AFTER a successful call and degrade on a
      // write failure (the data is already fetched; the sink logs + marks the
      // degraded write). Mutations already recorded their receipt above.
      if (!mutating) await writeReceipt('invoked');
      await fireMeter(false);

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
      const httpStatus = err instanceof ApiRequestError ? err.status : undefined;
      await writeReceipt('failed', { httpStatus });
      await fireMeter(true);
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
