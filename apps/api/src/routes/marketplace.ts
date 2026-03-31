/**
 * MCP Marketplace Routes (Phase 5.5)
 *
 * Community developers publish MCP servers with a per-call price.
 * Callers invoke servers through this proxy, paying via x402 (USDC on Base).
 * RevealUI takes 20%; developer earns 80% (paid out via Stripe Connect batch).
 *
 * Routes:
 *   GET  /api/marketplace/servers              — list active servers (public)
 *   GET  /api/marketplace/servers/:id          — single server detail (public)
 *   POST /api/marketplace/servers              — publish a server (auth required)
 *   DELETE /api/marketplace/servers/:id        — unpublish own server (auth required)
 *   POST /api/marketplace/servers/:id/invoke   — call through marketplace (x402 payment)
 *   POST /api/marketplace/connect/onboard      — start Stripe Connect (auth required)
 *   GET  /api/marketplace/connect/return       — Stripe Connect callback landing page
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  marketplaceServers,
  marketplaceTransactions,
  type NewMarketplaceServer,
  type NewMarketplaceTransaction,
} from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, asc, eq, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { authMiddleware } from '../middleware/auth.js';
import { buildPaymentRequired, encodePaymentRequired, verifyPayment } from '../middleware/x402.js';

// =============================================================================
// Helpers
// =============================================================================

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const app = new OpenAPIHono<{ Variables: { user: UserContext | undefined } }>();

/** Generate a short marketplace ID: 'mcp_' + 12 random alphanumeric chars */
function generateServerId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'mcp_';
  const bytes = crypto.getRandomValues(new Uint8Array(24)); // extra bytes for rejection
  let i = 0;
  while (id.length < 16 && i < bytes.length) {
    const idx = bytes[i++] & 63; // 6-bit mask
    if (idx < chars.length) {
      id += chars[idx];
    }
  }
  // Fallback: if we somehow exhausted bytes (extremely unlikely), pad with rejection-free generation
  while (id.length < 16) {
    const [b] = crypto.getRandomValues(new Uint8Array(1));
    const idx = b & 63;
    if (idx < chars.length) id += chars[idx];
  }
  return id;
}

/** Return the base URL of this API from a raw Request. */
function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${url.host}`;
}

/** Check if hostname is in the 172.16.0.0/12 private range (172.16–172.31) */
function isPrivate172(h: string): boolean {
  if (!h.startsWith('172.')) return false;
  const second = parseInt(h.split('.')[1] ?? '', 10);
  return second >= 16 && second <= 31;
}

/**
 * SSRF guard: validate that a developer-supplied MCP server URL is safe to proxy.
 * Blocks loopback, link-local, private RFC-1918 ranges, and non-HTTP(S) schemes.
 */
function assertUrlSafe(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed');
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed in production');
  }

  const h = parsed.hostname.toLowerCase();
  const blocked =
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('127.') ||
    h.startsWith('169.254.') || // link-local / AWS metadata
    h.startsWith('10.') ||
    isPrivate172(h) ||
    h.startsWith('192.168.') ||
    h.startsWith('fd') || // IPv6 ULA
    h.startsWith('fc');

  if (blocked) {
    throw new Error('URL resolves to a private or reserved address');
  }
}

/**
 * Compute marketplace revenue split for a given price.
 * Returns human-readable USDC strings (6 decimal places max).
 */
function computeSplit(priceUsdc: string): {
  platformFee: string;
  developerAmount: string;
} {
  const price = Number.parseFloat(priceUsdc);
  const fee = Math.round(price * 0.2 * 1_000_000) / 1_000_000;
  const developer = Math.round((price - fee) * 1_000_000) / 1_000_000;
  return {
    platformFee: fee.toFixed(6).replace(/\.?0+$/, '') || '0',
    developerAmount: developer.toFixed(6).replace(/\.?0+$/, '') || '0',
  };
}

let cachedStripe: Stripe | undefined;
function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  cachedStripe = new Stripe(key, { maxNetworkRetries: 2 });
  return cachedStripe;
}

// =============================================================================
// Input schemas
// =============================================================================

const VALID_CATEGORIES = [
  'coding',
  'data',
  'productivity',
  'analysis',
  'writing',
  'other',
] as const;

const PublishServerSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().min(10).max(500),
  url: z.string().url(),
  category: z.enum(VALID_CATEGORIES).optional().default('other'),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  pricePerCallUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'Must be a valid USDC amount (e.g. "0.001")')
    .optional()
    .default('0.001'),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

// =============================================================================
// Public discovery endpoints
// =============================================================================

/** GET /api/marketplace/servers — list all active servers */
app.openapi(
  createRoute({
    method: 'get',
    path: '/servers',
    tags: ['marketplace'],
    summary: 'List active marketplace servers',
    request: {
      query: z.object({
        category: z.enum(VALID_CATEGORIES).optional(),
        limit: z.string().optional(),
        offset: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              servers: z.array(z.unknown()),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
        description: 'List of active servers',
      },
    },
  }),
  async (c) => {
    const db = getClient();

    const query = c.req.valid('query');
    const category = query.category;
    const rawLimit = Number(query.limit ?? 50);
    const rawOffset = Number(query.offset ?? 0);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

    const conditions = [eq(marketplaceServers.status, 'active')];
    if (category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      conditions.push(eq(marketplaceServers.category, category));
    }

    const rows = await db
      .select({
        id: marketplaceServers.id,
        name: marketplaceServers.name,
        description: marketplaceServers.description,
        category: marketplaceServers.category,
        tags: marketplaceServers.tags,
        pricePerCallUsdc: marketplaceServers.pricePerCallUsdc,
        callCount: marketplaceServers.callCount,
        createdAt: marketplaceServers.createdAt,
      })
      .from(marketplaceServers)
      .where(and(...conditions))
      .orderBy(asc(marketplaceServers.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ servers: rows, limit, offset });
  },
);

/** GET /api/marketplace/servers/:id — single server detail */
app.openapi(
  createRoute({
    method: 'get',
    path: '/servers/{id}',
    tags: ['marketplace'],
    summary: 'Get single server detail',
    request: {
      params: z.object({
        id: z.string().regex(/^mcp_[\w]{12}$/),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ server: z.unknown() }),
          },
        },
        description: 'Server detail',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Invalid server ID',
      },
      404: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Server not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const { id } = c.req.valid('param');

    const db = getClient();
    const [row] = await db
      .select({
        id: marketplaceServers.id,
        name: marketplaceServers.name,
        description: marketplaceServers.description,
        category: marketplaceServers.category,
        tags: marketplaceServers.tags,
        pricePerCallUsdc: marketplaceServers.pricePerCallUsdc,
        callCount: marketplaceServers.callCount,
        status: marketplaceServers.status,
        metadata: marketplaceServers.metadata,
        createdAt: marketplaceServers.createdAt,
      })
      .from(marketplaceServers)
      .where(eq(marketplaceServers.id, id))
      .limit(1);

    if (!row) throw new HTTPException(404, { message: 'Server not found' });
    if (row.status !== 'active') throw new HTTPException(404, { message: 'Server not available' });

    return c.json({ server: row });
  },
);

// =============================================================================
// Publish / manage — auth required
// =============================================================================

/** POST /api/marketplace/servers — publish a new MCP server */
app.openapi(
  createRoute({
    method: 'post',
    path: '/servers',
    tags: ['marketplace'],
    summary: 'Publish a new MCP server',
    request: {
      body: {
        content: {
          'application/json': {
            schema: PublishServerSchema,
          },
        },
      },
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ server: z.unknown() }),
          },
        },
        description: 'Server published',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string(), issues: z.unknown().optional() }),
          },
        },
        description: 'Invalid request',
      },
      401: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Unauthorized',
      },
      422: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Invalid URL',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const data = c.req.valid('json');

    // SSRF guard — validate developer-supplied URL before storing
    try {
      assertUrlSafe(data.url);
    } catch (err) {
      throw new HTTPException(422, { message: err instanceof Error ? err.message : 'Invalid URL' });
    }

    const id = generateServerId();
    const now = new Date();

    const newServer: NewMarketplaceServer = {
      id,
      name: data.name,
      description: data.description,
      url: data.url,
      category: data.category,
      tags: data.tags,
      pricePerCallUsdc: data.pricePerCallUsdc,
      developerId: user.id,
      status: 'active',
      callCount: 0,
      metadata: data.metadata as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
    };

    const db = getClient();
    const [created] = await db.insert(marketplaceServers).values(newServer).returning();

    logger.info('Marketplace server published', { serverId: id, developerId: user.id });

    return c.json(
      {
        server: {
          id: created.id,
          name: created.name,
          description: created.description,
          category: created.category,
          tags: created.tags,
          pricePerCallUsdc: created.pricePerCallUsdc,
          status: created.status,
          callCount: created.callCount,
          createdAt: created.createdAt,
        },
      },
      201,
    );
  },
);

/** DELETE /api/marketplace/servers/:id — unpublish own server */
app.openapi(
  createRoute({
    method: 'delete',
    path: '/servers/{id}',
    tags: ['marketplace'],
    summary: 'Unpublish own server',
    request: {
      params: z.object({
        id: z.string().regex(/^mcp_[\w]{12}$/),
      }),
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: 'Server unpublished',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Invalid server ID',
      },
      401: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Forbidden',
      },
      404: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Server not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id } = c.req.valid('param');

    const db = getClient();
    const [existing] = await db
      .select({ developerId: marketplaceServers.developerId })
      .from(marketplaceServers)
      .where(eq(marketplaceServers.id, id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: 'Server not found' });

    // Only the developer who published it (or an admin) can unpublish
    if (existing.developerId !== user.id && user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    await db
      .update(marketplaceServers)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(marketplaceServers.id, id));

    logger.info('Marketplace server unpublished', { serverId: id, by: user.id });
    return c.json({ success: true });
  },
);

// =============================================================================
// Invoke — x402 payment gate + HTTP proxy
// =============================================================================

/**
 * POST /api/marketplace/servers/:id/invoke
 *
 * Payment flow:
 *   1. No X-PAYMENT-PAYLOAD → return 402 with server's price requirements
 *   2. X-PAYMENT-PAYLOAD present → verify with x402 facilitator
 *   3. Payment valid → proxy JSON-RPC request to the MCP server
 *   4. Record transaction; fire Stripe transfer if developer has Connect account
 */
app.openapi(
  createRoute({
    method: 'post',
    path: '/servers/{id}/invoke',
    tags: ['marketplace'],
    summary: 'Invoke an MCP server via marketplace proxy (x402 payment)',
    request: {
      params: z.object({
        id: z.string().regex(/^mcp_[\w]{12}$/),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.unknown(),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.unknown(),
          },
        },
        description: 'Proxied response from MCP server',
      },
      400: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Invalid request',
      },
      402: {
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
              x402Version: z.number().optional(),
              accepts: z.unknown().optional(),
            }),
          },
        },
        description: 'Payment required',
      },
      404: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Server not found',
      },
      502: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Upstream server unavailable',
      },
    },
  }),
  async (c) => {
    const { id } = c.req.valid('param');

    const db = getClient();
    const [server] = await db
      .select()
      .from(marketplaceServers)
      .where(and(eq(marketplaceServers.id, id), eq(marketplaceServers.status, 'active')))
      .limit(1);

    if (!server) throw new HTTPException(404, { message: 'Server not found or unavailable' });

    // Build canonical resource URL for this server's invoke endpoint
    const baseUrl = getBaseUrl(c.req.raw);
    const resource = `${baseUrl}/api/marketplace/servers/${id}/invoke`;

    // ─── x402 payment gate ─────────────────────────────────────────────────────

    const paymentHeader = c.req.header('X-PAYMENT-PAYLOAD');

    if (!paymentHeader) {
      // No payment — return 402 with server-specific price requirements
      const paymentRequired = buildPaymentRequired(resource, server.pricePerCallUsdc);
      const encoded = encodePaymentRequired(paymentRequired);
      return c.json(
        {
          error: 'Payment required',
          x402Version: 1,
          accepts: paymentRequired.accepts,
        },
        402,
        { 'X-PAYMENT-REQUIRED': encoded },
      );
    }

    // Verify the payment proof against the facilitator
    const verification = await verifyPayment(paymentHeader, resource);
    if (!verification.valid) {
      return c.json({ error: `Payment verification failed: ${verification.error}` }, 402);
    }

    // ─── Proxy the MCP request ─────────────────────────────────────────────────

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new HTTPException(400, { message: 'Invalid JSON body' });
    }

    // Record transaction as pending before the call
    const split = computeSplit(server.pricePerCallUsdc);
    const txId = crypto.randomUUID();
    const callerId = (c.get('user') as UserContext | undefined)?.id ?? null;

    const newTx: NewMarketplaceTransaction = {
      id: txId,
      serverId: id,
      callerId,
      amountUsdc: server.pricePerCallUsdc,
      platformFeeUsdc: split.platformFee,
      developerAmountUsdc: split.developerAmount,
      paymentMethod: 'x402',
      status: 'pending',
      metadata: {},
      createdAt: new Date(),
    };

    try {
      await db.insert(marketplaceTransactions).values(newTx);
    } catch (err) {
      logger.warn('Failed to record marketplace transaction (pre-call)', {
        txId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Proxy the request to the MCP server with a 30-second timeout
    let proxyResponse: Response;
    try {
      proxyResponse = await fetch(server.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Forward A2A agent ID if present
          ...(c.req.header('X-Agent-ID')
            ? { 'X-Agent-ID': c.req.header('X-Agent-ID') as string }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      // Server unreachable or timed out — mark transaction failed (awaited, not fire-and-forget)
      try {
        await db
          .update(marketplaceTransactions)
          .set({ status: 'failed' })
          .where(eq(marketplaceTransactions.id, txId));
      } catch (dbErr) {
        logger.error(
          'Failed to mark marketplace transaction as failed',
          dbErr instanceof Error ? dbErr : undefined,
          { txId },
        );
      }

      logger.error('Marketplace server proxy failed', err instanceof Error ? err : undefined, {
        serverId: id,
      });
      throw new HTTPException(502, { message: 'Upstream server unavailable' });
    }

    let responseBody: unknown;
    try {
      responseBody = await proxyResponse.json();
    } catch {
      responseBody = null;
    }

    const callSucceeded = proxyResponse.ok;

    // ─── Post-call bookkeeping ────────────────────────────────────────────────
    // DB updates are awaited (not fire-and-forget) to ensure consistency.
    // Stripe transfer is outside the DB write so a transfer failure doesn't
    // roll back the transaction status update.
    try {
      // Update transaction status + increment call count atomically
      await db
        .update(marketplaceTransactions)
        .set({ status: callSucceeded ? 'completed' : 'failed' })
        .where(eq(marketplaceTransactions.id, txId));

      if (callSucceeded) {
        await db
          .update(marketplaceServers)
          .set({
            callCount: sql`${marketplaceServers.callCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(marketplaceServers.id, id));
      }
    } catch (err) {
      logger.error(
        'Marketplace post-call DB update failed — ledger may be inconsistent',
        err instanceof Error ? err : undefined,
        { txId, serverId: id },
      );
    }

    // Stripe transfer is best-effort — failures are logged at error level for admin review
    try {
      if (callSucceeded && server.stripeAccountId) {
        const developerCents = Math.round(Number.parseFloat(split.developerAmount) * 100);
        if (developerCents >= 50) {
          const stripe = getStripeClient();
          const transfer = await stripe.transfers.create({
            amount: developerCents,
            currency: 'usd',
            destination: server.stripeAccountId,
            metadata: {
              marketplace_server_id: id,
              transaction_id: txId,
            },
          });
          await db
            .update(marketplaceTransactions)
            .set({ stripeTransferId: transfer.id })
            .where(eq(marketplaceTransactions.id, txId));
        }
      }
    } catch (err) {
      logger.error(
        'Marketplace Stripe transfer failed — manual payout required',
        err instanceof Error ? err : undefined,
        { txId, serverId: id, stripeAccountId: server.stripeAccountId },
      );
    }

    return c.json(responseBody, proxyResponse.status as 200);
  },
);

// =============================================================================
// Stripe Connect — developer onboarding
// =============================================================================

/**
 * POST /api/marketplace/connect/onboard
 *
 * Creates or retrieves a Stripe Connect Express account for the authenticated
 * developer, then returns an Account Link URL for onboarding.
 *
 * The developer is redirected back to MARKETPLACE_CONNECT_RETURN_URL after
 * completing or aborting the Stripe hosted onboarding flow.
 */
app.openapi(
  createRoute({
    method: 'post',
    path: '/connect/onboard',
    tags: ['marketplace'],
    summary: 'Start Stripe Connect onboarding for developer',
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              url: z.string(),
              stripeAccountId: z.string(),
            }),
          },
        },
        description: 'Onboarding link created',
      },
      401: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Unauthorized',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const returnBase =
      process.env.MARKETPLACE_CONNECT_RETURN_URL ??
      process.env.CMS_URL ??
      'https://cms.revealui.com';

    const stripe = getStripeClient();
    const db = getClient();

    // Check if developer already has a server with a Connect account
    const [existing] = await db
      .select({ stripeAccountId: marketplaceServers.stripeAccountId })
      .from(marketplaceServers)
      .where(
        and(eq(marketplaceServers.developerId, user.id), eq(marketplaceServers.status, 'active')),
      )
      .limit(1);

    let stripeAccountId = existing?.stripeAccountId;

    // Create a new Express account if the developer doesn't have one
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          revealui_user_id: user.id,
        },
      });
      stripeAccountId = account.id;

      // Store the account ID on all this developer's active servers
      await db
        .update(marketplaceServers)
        .set({ stripeAccountId, updatedAt: new Date() })
        .where(
          and(eq(marketplaceServers.developerId, user.id), eq(marketplaceServers.status, 'active')),
        );
    }

    // Generate a fresh Account Link (these expire after ~5 minutes)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${returnBase}/account/marketplace/connect/refresh`,
      return_url: `${returnBase}/account/marketplace/connect/return`,
      type: 'account_onboarding',
    });

    logger.info('Stripe Connect onboarding link created', {
      developerId: user.id,
      stripeAccountId,
    });

    return c.json({ url: accountLink.url, stripeAccountId });
  },
);

/**
 * GET /api/marketplace/connect/return
 *
 * Landing page after Stripe Connect onboarding completes or is cancelled.
 * Stripe redirects here; the client reads the query params and redirects
 * the user appropriately (this endpoint just confirms the flow completed).
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/connect/return',
    tags: ['marketplace'],
    summary: 'Stripe Connect onboarding return callback',
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              message: z.string(),
            }),
          },
        },
        description: 'Onboarding flow completed',
      },
    },
  }),
  (c) => {
    return c.json({
      success: true,
      message: 'Stripe Connect onboarding complete. Your account is being verified.',
    });
  },
);

export default app;
