/**
 * Governed MCP endpoint — `POST/GET/DELETE /api/mcp` (GAP-371 Phase 1).
 *
 * Mounts the existing `revealui-content` MCP server over Streamable HTTP behind
 * the same auth the rest of the API uses. An OpenCode (or any) MCP client is an
 * UNTRUSTED network caller: the only authority is the `rvui_dev_` bearer token
 * it presents, re-verified on every request by `authMiddleware`.
 *
 * Chain (in order):
 *   authMiddleware (bearer-first) → entitlementMiddleware → requireFeature('mcp')
 *   → session⇢user binding check → MCP Streamable HTTP handler.
 *
 * Identity threading (I-1 / I-4). The content factory is constructed with a
 * `credentialsProvider` that returns the CALLER's own token, forwarded to the
 * REST API so collection `access.read` enforces against the real user. There is
 * NO env-key fallback on this path: the provider throws if no per-request
 * credential exists, so an ambient `REVEALUI_API_KEY` can never grant access.
 *
 * Session binding (I-3). The MCP session id is routing state, never authority.
 * Each session id is bound to the user that created it; every later request
 * re-validates the token AND asserts it resolves to the bound user. A mismatch
 * is a 401 and terminates the session.
 *
 * Audit (I-5). Every tool call writes a hash-chained receipt via
 * `recordMcpToolAudit`. Mutating tools fail closed on an audit-write failure;
 * reads degrade. Phase 1 exposes read tools only, but the fail-closed branch is
 * wired so Phase 2 writes inherit it.
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { RESPONSE_ALREADY_SENT } from '@hono/node-server/utils/response';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { usageMeters } from '@revealui/db/schema';
import {
  DEFAULT_TIER_LIMITS,
  McpRateLimiter,
  type RateLimitConfig,
} from '@revealui/mcp/rate-limiter';
import {
  createRevealuiContentServer,
  type McpToolAuditRecord,
  type McpToolAuditSink,
  type McpToolCallContext,
  type McpToolMeterSink,
  type ResolvedApiCredentials,
} from '@revealui/mcp/revealui-content-factory';
import {
  createNodeStreamableHttpHandler,
  type StreamableHttpControl,
} from '@revealui/mcp/streamable-http';
import type { Handler, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { recordMcpToolAudit } from '../lib/mcp-audit.js';
import { authorizeMcpTool, type McpTier } from '../lib/mcp-tool-access.js';
import { MISSING_SELF_API_URL_MESSAGE, resolveSelfApiBaseUrl } from '../lib/self-api-url.js';
import { authMiddleware } from '../middleware/auth.js';
import { entitlementMiddleware, getEntitlementsFromContext } from '../middleware/entitlements.js';
import { requireFeature } from '../middleware/license.js';

// Re-export for callers/tests that already imported from this module path.
export { resolveSelfApiBaseUrl } from '../lib/self-api-url.js';

/**
 * Minimal structural mirror of the MCP SDK's `AuthInfo`. Defined locally so
 * apps/server does not take a direct dependency on `@modelcontextprotocol/sdk`
 * (a transitive-only dep under pnpm's strict layout). The transport reads
 * `req.auth` and threads it verbatim to the tool handler's `extra.authInfo`.
 */
interface McpAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  extra?: Record<string, unknown>;
}

/** The per-request identity we thread through the MCP `AuthInfo.extra`. */
interface McpAuthExtra extends Record<string, unknown> {
  userId: string;
  accountId: string | null;
  /** The user's role (`users.role`), for deny-by-default per-tool authz (I-7). */
  role: string;
  /** The account's server-derived tier, re-resolved per request (I-9). */
  tier: McpTier;
}

export interface McpEndpointConfig {
  /**
   * Base URL the governed tools call back into (this same API). The forwarded
   * REST request carries the caller's token, so identity reaches enforcement.
   * Defaults via {@link resolveSelfApiBaseUrl} (`REVEALUI_API_URL` first).
   */
  selfApiBaseUrl?: string;
  /** DNS-rebinding guard: allowed `Host` headers. Defaults from env. */
  allowedHosts?: string[];
  /** DNS-rebinding guard: allowed `Origin` headers. Defaults from env. */
  allowedOrigins?: string[];
  /**
   * Per-user + tier rate-limit config (I-8). Defaults to `DEFAULT_TIER_LIMITS`.
   * Injectable so tests can use tiny windows without hammering the real limits.
   */
  rateLimits?: Record<string, RateLimitConfig>;
  /** Max concurrent MCP sessions per user (I-10). Default: 8. Excess evicts LRU. */
  maxSessionsPerUser?: number;
  /** Idle session TTL in ms (I-10). Default: 24h. A session idle past this 401s. */
  idleSessionTtlMs?: number;
  /** Clock for session activity/TTL. Defaults to `Date.now`; injectable for tests. */
  now?: () => number;
}

const DEFAULT_MAX_SESSIONS_PER_USER = 8;
const DEFAULT_IDLE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Per-session state kept by the mount: the bound identity (I-3) + activity (I-10). */
interface SessionState {
  userId: string;
  accountId: string | null;
  createdAt: number;
  lastActivityAt: number;
}

function splitEnvList(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
}

function bearerFromHeader(header: string | undefined): string | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  const token = header.slice(7);
  return token.startsWith('rvui_dev_') ? token : undefined;
}

/** Pull the identity we threaded onto `AuthInfo.extra` back out of a call ctx. */
function extraFromContext(ctx: McpToolCallContext): McpAuthExtra | undefined {
  const info = ctx.authInfo as McpAuthInfo | undefined;
  const extra = info?.extra as Partial<McpAuthExtra> | undefined;
  if (!extra || typeof extra.userId !== 'string') return undefined;
  return {
    userId: extra.userId,
    accountId: extra.accountId ?? null,
    role: typeof extra.role === 'string' ? extra.role : 'viewer',
    tier: (extra.tier as McpTier | undefined) ?? 'free',
  };
}

export interface McpEndpointParts {
  /** Chain to run before the handler: auth → entitlements → mcp feature gate. */
  middlewares: MiddlewareHandler[];
  /** The Streamable-HTTP bridge handler (session binding + identity threading). */
  handle: Handler;
}

/**
 * Build the governed endpoint's middleware chain + handler. Kept separate from
 * mounting so it can be bound to an EXACT path (`/api/mcp`) on the main app
 * without shadowing the sibling `/api/mcp/usage` route.
 */
export function buildMcpEndpoint(config: McpEndpointConfig = {}): McpEndpointParts {
  const selfApiBaseUrl = resolveSelfApiBaseUrl(config.selfApiBaseUrl);
  const allowedHosts = config.allowedHosts ?? splitEnvList(process.env.REVEALUI_MCP_ALLOWED_HOSTS);
  const allowedOrigins =
    config.allowedOrigins ?? splitEnvList(process.env.REVEALUI_MCP_ALLOWED_ORIGINS);
  const maxSessionsPerUser = config.maxSessionsPerUser ?? DEFAULT_MAX_SESSIONS_PER_USER;
  const idleSessionTtlMs = config.idleSessionTtlMs ?? DEFAULT_IDLE_SESSION_TTL_MS;
  const clock = config.now ?? Date.now;

  // sessionId → the identity + activity of the session (I-3 binding, I-10 caps).
  const sessionBindings = new Map<string, SessionState>();

  // Shared per-user + tier rate limiter (I-8). One fixed-window store for the
  // life of the mount; keyed `${userId}:${tool}` with limits from the tier.
  const rateLimiter = new McpRateLimiter({ limits: config.rateLimits ?? DEFAULT_TIER_LIMITS });

  // Control surface over the handler's live session map (set in onControl,
  // below, during handler construction — before any request runs).
  let control: StreamableHttpControl | null = null;

  // Evict the least-recently-active sessions of a user once over the cap (I-10),
  // never the session just created. Deletes the binding first (idempotent) then
  // tears down the transport.
  function enforceSessionCap(userId: string, keepSessionId: string): void {
    const owned = [...sessionBindings.entries()].filter(([, s]) => s.userId === userId);
    if (owned.length <= maxSessionsPerUser) return;
    const evictable = owned
      .filter(([sid]) => sid !== keepSessionId)
      .sort((a, b) => a[1].lastActivityAt - b[1].lastActivityAt);
    let over = owned.length - maxSessionsPerUser;
    for (const [sid] of evictable) {
      if (over <= 0) break;
      sessionBindings.delete(sid);
      if (control?.hasSession(sid)) void control.terminateSession(sid).catch(() => undefined);
      over -= 1;
    }
  }

  // The credentialsProvider is the SOLE credential source on this path (I-4).
  const credentialsProvider = (ctx: McpToolCallContext): ResolvedApiCredentials => {
    const info = ctx.authInfo as McpAuthInfo | undefined;
    const token = info?.token;
    if (!token) {
      throw new Error('governed MCP endpoint: no per-request credential — refusing tool call');
    }
    if (!selfApiBaseUrl) {
      throw new Error(MISSING_SELF_API_URL_MESSAGE);
    }
    return { apiUrl: selfApiBaseUrl, apiKey: token };
  };

  const auditSink: McpToolAuditSink = async (record: McpToolAuditRecord): Promise<void> => {
    const identity = extraFromContext(record.context);
    if (!identity) {
      // Only reachable if the mount failed to thread identity — treat as a
      // hard audit failure so a mutating tool fails closed.
      throw new Error('governed MCP audit: request identity missing');
    }
    await recordMcpToolAudit({
      outcome: record.outcome,
      clientName: record.clientInfo?.name ?? 'unknown',
      sessionId: record.context.sessionId,
      userId: identity.userId,
      accountId: identity.accountId,
      tool: record.tool,
      argsDigest: record.argsDigest,
      scalars: record.scalars,
      durationMs: record.durationMs,
      httpStatus: record.httpStatus,
      reason: record.reason,
    });
  };

  // Deny-by-default per-tool authz (I-7): resolve the caller's role + tier from
  // the threaded identity, then apply the role+tier policy. No identity → deny.
  const toolAuthorizer = (ctx: McpToolCallContext, toolName: string): boolean => {
    const identity = extraFromContext(ctx);
    if (!identity) return false;
    return authorizeMcpTool({ role: identity.role, tier: identity.tier }, toolName);
  };

  // Per-user + tier rate limit (I-8): key by user + tool, limits from the tier.
  const rateLimit = async (ctx: McpToolCallContext, toolName: string): Promise<boolean> => {
    const identity = extraFromContext(ctx);
    if (!identity) return false;
    const result = await rateLimiter.check(`${identity.userId}:${toolName}`, identity.tier);
    return result.allowed;
  };

  // One `usage_meters` row per executed tool call, `source: 'agent'` (§5.5 tail).
  // Account-scoped (FK); a caller with no account has no billable usage row.
  const meterSink: McpToolMeterSink = async (ctx, event): Promise<void> => {
    const identity = extraFromContext(ctx);
    if (!identity?.accountId) return;
    const now = new Date();
    await getClient()
      .insert(usageMeters)
      .values({
        id: randomUUID(),
        accountId: identity.accountId,
        meterName: 'mcp.tool.call',
        quantity: 1,
        periodStart: now,
        source: 'agent',
        idempotencyKey: `mcp:${randomUUID()}`,
        durationMs: event.durationMs,
        errored: event.errored,
      });
  };

  const handler = createNodeStreamableHttpHandler({
    createServer: () =>
      createRevealuiContentServer({
        credentialsProvider,
        auditSink,
        toolAuthorizer,
        rateLimiter: rateLimit,
        meterSink,
        // Phase 1 exposes read tools only. The set is empty in production; the
        // fail-closed branch it feeds is exercised by the invariant tests.
        mutatingTools: new Set<string>(),
      }),
    enableJsonResponse: true,
    allowedHosts,
    allowedOrigins,
    onControl: (c) => {
      control = c;
    },
    onSessionInitialized: (id, req) => {
      // Bind the new session to the identity of the request that created it,
      // read off the AuthInfo the mount threaded onto `req.auth` (I-3). Tied to
      // this exact request, so it is race-free under concurrent initializes.
      const auth = (req as { auth?: McpAuthInfo }).auth;
      const extra = auth?.extra as Partial<McpAuthExtra> | undefined;
      if (extra && typeof extra.userId === 'string') {
        const now = clock();
        sessionBindings.set(id, {
          userId: extra.userId,
          accountId: extra.accountId ?? null,
          createdAt: now,
          lastActivityAt: now,
        });
        // Bound the per-user concurrent-session count (I-10).
        enforceSessionCap(extra.userId, id);
      }
    },
    onSessionClosed: (id) => {
      sessionBindings.delete(id);
    },
  });

  // Self-contained chain: authMiddleware (required) sets the user, then
  // entitlements are re-resolved against that user, then the mcp feature gate.
  const middlewares: MiddlewareHandler[] = [
    authMiddleware({ required: true }),
    entitlementMiddleware(),
    requireFeature('mcp', { mode: 'entitlements' }),
  ];

  const handle: Handler = async (c) => {
    const bindings = c.env as { incoming?: IncomingMessage; outgoing?: ServerResponse };
    const incoming = bindings.incoming;
    const outgoing = bindings.outgoing;
    if (!(incoming && outgoing)) {
      return c.json(
        {
          jsonrpc: '2.0',
          error: { code: -32000, message: 'MCP endpoint requires a Node HTTP server' },
          id: null,
        },
        500,
      );
    }

    const user = c.get('user') as { id: string; role?: string } | undefined;
    const token = bearerFromHeader(c.req.header('Authorization'));
    if (!(user && token)) {
      // authMiddleware(required) should have 401'd already; belt-and-braces.
      return c.json(
        { jsonrpc: '2.0', error: { code: -32001, message: 'Authentication required' }, id: null },
        401,
      );
    }
    // Tier + account are re-derived server-side every request (I-9): a
    // client-supplied tier/tenant field can never influence the decision.
    const entitlements = getEntitlementsFromContext(c);
    const identity: McpAuthExtra = {
      userId: user.id,
      accountId: entitlements.accountId,
      role: user.role ?? 'viewer',
      tier: entitlements.tier,
    };

    const sessionId = c.req.header('Mcp-Session-Id');
    if (sessionId) {
      const bound = sessionBindings.get(sessionId);
      if (bound) {
        if (bound.userId !== user.id) {
          // I-3: a valid token for a DIFFERENT user on an existing session. The
          // session id is not authority — reject and terminate it.
          sessionBindings.delete(sessionId);
          if (control?.hasSession(sessionId)) {
            await control.terminateSession(sessionId).catch(() => undefined);
          }
          return c.json(
            {
              jsonrpc: '2.0',
              error: { code: -32001, message: 'Session identity mismatch' },
              id: null,
            },
            401,
          );
        }
        // I-10: a session idle past the TTL no longer accepts requests.
        const now = clock();
        if (now - bound.lastActivityAt > idleSessionTtlMs) {
          sessionBindings.delete(sessionId);
          if (control?.hasSession(sessionId)) {
            await control.terminateSession(sessionId).catch(() => undefined);
          }
          return c.json(
            { jsonrpc: '2.0', error: { code: -32001, message: 'Session expired' }, id: null },
            401,
          );
        }
        bound.lastActivityAt = now;
      }
    }

    // Thread the verified identity to the MCP tool handler via AuthInfo.
    const authInfo: McpAuthInfo = {
      token,
      clientId: user.id,
      scopes: [],
      extra: identity satisfies McpAuthExtra,
    };
    (incoming as IncomingMessage & { auth?: McpAuthInfo }).auth = authInfo;

    // Parse the body web-side and pass it through the bridge. Middleware on
    // the real server ahead of this route can claim the raw Node stream, in
    // which case the handler's raw read sees an empty body and rejects every
    // Initialize with "Session ID required" (GAP-371 Phase 4 live catch).
    const parsedBody =
      c.req.method === 'POST' ? await c.req.json().catch(() => undefined) : undefined;

    try {
      await handler(incoming, outgoing, parsedBody);
    } catch (err) {
      logger.error('[/api/mcp] handler error', {
        error: err instanceof Error ? err.message : String(err),
      });
      if (!outgoing.headersSent) {
        outgoing.statusCode = 500;
        outgoing.setHeader('content-type', 'application/json');
        outgoing.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Internal error' },
            id: null,
          }),
        );
      }
      return RESPONSE_ALREADY_SENT;
    }

    // The session⇢user binding for a freshly-created session is set in the
    // handler's `onSessionInitialized` callback above (race-free, tied to this
    // request). Nothing to do here on the success path.
    return RESPONSE_ALREADY_SENT;
  };

  return { middlewares, handle };
}

/**
 * Mount the governed endpoint on the main app at the EXACT path `/api/mcp`
 * (POST for JSON-RPC, GET for SSE, DELETE to end a session). Binding the exact
 * path leaves the sibling `/api/mcp/usage` route untouched.
 */
// biome-ignore lint/suspicious/noExplicitAny: accept any Hono/OpenAPIHono instance regardless of its Env/Schema generics
export function mountMcpEndpoint(app: Hono<any, any, any>, config: McpEndpointConfig = {}): void {
  const { middlewares, handle } = buildMcpEndpoint(config);
  for (const mw of middlewares) app.use('/api/mcp', mw);
  app.all('/api/mcp', handle);
}

/**
 * Standalone Hono app whose root path IS the governed endpoint. Used by tests
 * that serve the endpoint directly on an ephemeral port.
 */
export function createMcpEndpointApp(config: McpEndpointConfig = {}): Hono {
  const { middlewares, handle } = buildMcpEndpoint(config);
  const app = new Hono();
  for (const mw of middlewares) app.use('/', mw);
  app.all('/', handle);
  return app;
}
