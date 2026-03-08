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

import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db'
import {
  marketplaceServers,
  marketplaceTransactions,
  type NewMarketplaceServer,
  type NewMarketplaceTransaction,
} from '@revealui/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import Stripe from 'stripe'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth.js'
import { buildPaymentRequired, encodePaymentRequired, verifyPayment } from '../middleware/x402.js'

// =============================================================================
// Helpers
// =============================================================================

interface UserContext {
  id: string
  email: string | null
  name: string
  role: string
}

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables`
const app = new Hono<{ Variables: { user: UserContext | undefined } }>()

/** Generate a short marketplace ID: 'mcp_' + 12 random alphanumeric chars */
function generateServerId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'mcp_'
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  for (const byte of bytes) {
    id += chars[byte % chars.length]
  }
  return id
}

/** Return the base URL of this API from a raw Request. */
function getBaseUrl(req: Request): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${url.host}`
}

/**
 * SSRF guard: validate that a developer-supplied MCP server URL is safe to proxy.
 * Blocks loopback, link-local, private RFC-1918 ranges, and non-HTTP(S) schemes.
 */
function assertUrlSafe(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('Invalid URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) URLs are allowed')
  }

  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed in production')
  }

  const h = parsed.hostname.toLowerCase()
  const blocked =
    h === 'localhost' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    /^127\./.test(h) ||
    /^169\.254\./.test(h) || // link-local / AWS metadata
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^fd[0-9a-f]{2}:/i.test(h) || // IPv6 ULA
    /^fc[0-9a-f]{2}:/i.test(h)

  if (blocked) {
    throw new Error('URL resolves to a private or reserved address')
  }
}

/**
 * Compute marketplace revenue split for a given price.
 * Returns human-readable USDC strings (6 decimal places max).
 */
function computeSplit(priceUsdc: string): {
  platformFee: string
  developerAmount: string
} {
  const price = Number.parseFloat(priceUsdc)
  const fee = Math.round(price * 0.2 * 1_000_000) / 1_000_000
  const developer = Math.round((price - fee) * 1_000_000) / 1_000_000
  return {
    platformFee: fee.toFixed(6).replace(/\.?0+$/, '') || '0',
    developerAmount: developer.toFixed(6).replace(/\.?0+$/, '') || '0',
  }
}

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured')
  return new Stripe(key)
}

// =============================================================================
// Input schemas
// =============================================================================

const VALID_CATEGORIES = ['coding', 'data', 'productivity', 'analysis', 'writing', 'other'] as const

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
})

// =============================================================================
// Public discovery endpoints
// =============================================================================

/** GET /api/marketplace/servers — list all active servers */
app.get('/servers', async (c) => {
  const db = getClient()

  const category = c.req.query('category')
  const rawLimit = Number(c.req.query('limit') ?? 50)
  const rawOffset = Number(c.req.query('offset') ?? 0)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 50
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0

  const conditions = [eq(marketplaceServers.status, 'active')]
  if (category && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    conditions.push(eq(marketplaceServers.category, category))
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
    .offset(offset)

  return c.json({ servers: rows, limit, offset })
})

/** GET /api/marketplace/servers/:id — single server detail */
app.get('/servers/:id', async (c) => {
  const id = c.req.param('id')
  if (!/^mcp_[\w]{12}$/.test(id)) {
    return c.json({ error: 'Invalid server ID' }, 400)
  }

  const db = getClient()
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
    .limit(1)

  if (!row) return c.json({ error: 'Server not found' }, 404)
  if (row.status !== 'active') return c.json({ error: 'Server not available' }, 404)

  return c.json({ server: row })
})

// =============================================================================
// Publish / manage — auth required
// =============================================================================

/** POST /api/marketplace/servers — publish a new MCP server */
app.post('/servers', authMiddleware({ required: true }), async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = PublishServerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', issues: parsed.error.issues }, 400)
  }

  const data = parsed.data

  // SSRF guard — validate developer-supplied URL before storing
  try {
    assertUrlSafe(data.url)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Invalid URL' }, 422)
  }

  const id = generateServerId()
  const now = new Date()

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
  }

  const db = getClient()
  const [created] = await db.insert(marketplaceServers).values(newServer).returning()

  logger.info('Marketplace server published', { serverId: id, developerId: user.id })

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
  )
})

/** DELETE /api/marketplace/servers/:id — unpublish own server */
app.delete('/servers/:id', authMiddleware({ required: true }), async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const id = c.req.param('id')
  if (!/^mcp_[\w]{12}$/.test(id)) {
    return c.json({ error: 'Invalid server ID' }, 400)
  }

  const db = getClient()
  const [existing] = await db
    .select({ developerId: marketplaceServers.developerId })
    .from(marketplaceServers)
    .where(eq(marketplaceServers.id, id))
    .limit(1)

  if (!existing) return c.json({ error: 'Server not found' }, 404)

  // Only the developer who published it (or an admin) can unpublish
  if (existing.developerId !== user.id && user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  await db
    .update(marketplaceServers)
    .set({ status: 'suspended', updatedAt: new Date() })
    .where(eq(marketplaceServers.id, id))

  logger.info('Marketplace server unpublished', { serverId: id, by: user.id })
  return c.json({ success: true })
})

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
app.post('/servers/:id/invoke', async (c) => {
  const id = c.req.param('id')
  if (!/^mcp_[\w]{12}$/.test(id)) {
    return c.json({ error: 'Invalid server ID' }, 400)
  }

  const db = getClient()
  const [server] = await db
    .select()
    .from(marketplaceServers)
    .where(and(eq(marketplaceServers.id, id), eq(marketplaceServers.status, 'active')))
    .limit(1)

  if (!server) return c.json({ error: 'Server not found or unavailable' }, 404)

  // Build canonical resource URL for this server's invoke endpoint
  const baseUrl = getBaseUrl(c.req.raw)
  const resource = `${baseUrl}/api/marketplace/servers/${id}/invoke`

  // ─── x402 payment gate ─────────────────────────────────────────────────────

  const paymentHeader = c.req.header('X-PAYMENT-PAYLOAD')

  if (!paymentHeader) {
    // No payment — return 402 with server-specific price requirements
    const paymentRequired = buildPaymentRequired(resource, server.pricePerCallUsdc)
    const encoded = encodePaymentRequired(paymentRequired)
    return c.json(
      {
        error: 'Payment required',
        x402Version: 1,
        accepts: paymentRequired.accepts,
      },
      402,
      { 'X-PAYMENT-REQUIRED': encoded },
    )
  }

  // Verify the payment proof against the facilitator
  const verification = await verifyPayment(paymentHeader, resource)
  if (!verification.valid) {
    return c.json({ error: `Payment verification failed: ${verification.error}` }, 402)
  }

  // ─── Proxy the MCP request ─────────────────────────────────────────────────

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Record transaction as pending before the call
  const split = computeSplit(server.pricePerCallUsdc)
  const txId = crypto.randomUUID()
  const callerId = (c.get('user') as UserContext | undefined)?.id ?? null

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
  }

  try {
    await db.insert(marketplaceTransactions).values(newTx)
  } catch (err) {
    logger.warn('Failed to record marketplace transaction (pre-call)', {
      txId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Proxy the request to the MCP server with a 30-second timeout
  let proxyResponse: Response
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
    })
  } catch (err) {
    // Server unreachable or timed out — mark transaction failed
    void db
      .update(marketplaceTransactions)
      .set({ status: 'failed' })
      .where(eq(marketplaceTransactions.id, txId))
      .catch((err: unknown) => {
        logger.warn('Failed to mark marketplace transaction as failed', {
          txId,
          error: err instanceof Error ? err.message : String(err),
        })
      })

    logger.warn('Marketplace server proxy failed', {
      serverId: id,
      error: err instanceof Error ? err.message : String(err),
    })
    return c.json({ error: 'Upstream server unavailable' }, 502)
  }

  let responseBody: unknown
  try {
    responseBody = await proxyResponse.json()
  } catch {
    responseBody = null
  }

  const callSucceeded = proxyResponse.ok

  // ─── Post-call bookkeeping (fire-and-forget) ───────────────────────────────
  void (async () => {
    try {
      // Update transaction status + increment call count
      await Promise.all([
        db
          .update(marketplaceTransactions)
          .set({ status: callSucceeded ? 'completed' : 'failed' })
          .where(eq(marketplaceTransactions.id, txId)),
        callSucceeded
          ? db
              .update(marketplaceServers)
              .set({ callCount: sql`${marketplaceServers.callCount} + 1`, updatedAt: new Date() })
              .where(eq(marketplaceServers.id, id))
          : Promise.resolve(),
      ])

      // Initiate Stripe transfer if developer has a Connect account.
      // Transfers are batched — only initiated when the accumulated earnings
      // for this server reach ≥ $1.00 USD (Stripe minimum transfer is $0.50).
      // This is a best-effort fire-and-forget; failures are logged, not fatal.
      if (callSucceeded && server.stripeAccountId) {
        const developerCents = Math.round(Number.parseFloat(split.developerAmount) * 100)
        if (developerCents >= 50) {
          // >= $0.50 USD equivalent
          const stripe = getStripeClient()
          const transfer = await stripe.transfers.create({
            amount: developerCents,
            currency: 'usd',
            destination: server.stripeAccountId,
            metadata: {
              marketplace_server_id: id,
              transaction_id: txId,
            },
          })
          await db
            .update(marketplaceTransactions)
            .set({ stripeTransferId: transfer.id })
            .where(eq(marketplaceTransactions.id, txId))
        }
      }
    } catch (err) {
      logger.warn('Marketplace post-call bookkeeping failed', {
        txId,
        serverId: id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  })()

  return c.json(responseBody, proxyResponse.status as 200)
})

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
app.post('/connect/onboard', authMiddleware({ required: true }), async (c) => {
  const user = c.get('user')
  if (!user) return c.json({ error: 'Unauthorized' }, 401)

  const returnBase =
    process.env.MARKETPLACE_CONNECT_RETURN_URL ?? process.env.CMS_URL ?? 'https://cms.revealui.com'

  const stripe = getStripeClient()
  const db = getClient()

  // Check if developer already has a server with a Connect account
  const [existing] = await db
    .select({ stripeAccountId: marketplaceServers.stripeAccountId })
    .from(marketplaceServers)
    .where(
      and(eq(marketplaceServers.developerId, user.id), eq(marketplaceServers.status, 'active')),
    )
    .limit(1)

  let stripeAccountId = existing?.stripeAccountId

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
    })
    stripeAccountId = account.id

    // Store the account ID on all this developer's active servers
    await db
      .update(marketplaceServers)
      .set({ stripeAccountId, updatedAt: new Date() })
      .where(
        and(eq(marketplaceServers.developerId, user.id), eq(marketplaceServers.status, 'active')),
      )
  }

  // Generate a fresh Account Link (these expire after ~5 minutes)
  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: `${returnBase}/account/marketplace/connect/refresh`,
    return_url: `${returnBase}/account/marketplace/connect/return`,
    type: 'account_onboarding',
  })

  logger.info('Stripe Connect onboarding link created', {
    developerId: user.id,
    stripeAccountId,
  })

  return c.json({ url: accountLink.url, stripeAccountId })
})

/**
 * GET /api/marketplace/connect/return
 *
 * Landing page after Stripe Connect onboarding completes or is cancelled.
 * Stripe redirects here; the client reads the query params and redirects
 * the user appropriately (this endpoint just confirms the flow completed).
 */
app.get('/connect/return', authMiddleware({ required: true }), (c) => {
  return c.json({
    success: true,
    message: 'Stripe Connect onboarding complete. Your account is being verified.',
  })
})

export default app
