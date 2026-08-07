/**
 * Harness hook receipts ingest (GAP-381 Phase A).
 *
 *   POST /api/harness/receipts  — batch ingest of spool records
 *   GET  /api/harness/policy-snapshot — current policy document (advisory until signed)
 *
 * Chain: authMiddleware → requireDeviceToken → per-token rate limit →
 * requireFeature('mcp') → handler.
 *
 * Trust (design I-1 / I-2):
 *   - Authorization identity is the device-token user only.
 *   - Cookie sessions are rejected on this route (no cookie fallthrough).
 *   - Editor identity fields (email, etc.) are display metadata only.
 *
 * Retention (design §8 D-A proposal for owner countersign via merge):
 *   Rows use shared `audit_log` retention (GDPR export/delete with the account).
 *   No separate harness store.
 */

import { createHash } from 'node:crypto';
import { checkRateLimit } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import type { Handler, MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { recordHarnessHookAudit } from '../lib/harness-receipt-audit.js';
import { authMiddleware } from '../middleware/auth.js';
import { entitlementMiddleware, getEntitlementsFromContext } from '../middleware/entitlements.js';
import { requireFeature } from '../middleware/license.js';

const SOURCES = new Set(['cursor', 'claude-code', 'vscode', 'opencode', 'grok']);
const KINDS = new Set([
  'session-start',
  'session-end',
  'pre-tool',
  'post-tool',
  'pre-shell',
  'post-shell',
  'pre-mcp',
  'post-mcp',
  'file-edit',
  'prompt-submit',
  'stop',
]);
const TIERS = new Set(['enforced', 'advisory']);
const DECISIONS = new Set(['allow', 'deny', 'ask', 'none']);

/** Per-token ingest budget (I-7). Tunable via env for tests. */
const RECEIPT_RATE_MAX = Number(process.env.HARNESS_RECEIPT_RATE_MAX) || 120;
const RECEIPT_RATE_WINDOW_MS = Number(process.env.HARNESS_RECEIPT_RATE_WINDOW_MS) || 60_000;
const MAX_BATCH = 50;

interface ApiAuthUser {
  id: string;
  role?: string;
  email?: string;
}

interface DeviceSession {
  id?: string;
  deviceAuth?: boolean;
}

/**
 * Reject cookie/session auth on this route. Only `rvui_dev_` device tokens
 * (auth middleware sets session.deviceAuth) may ingest receipts (I-2).
 */
export const requireDeviceToken: MiddlewareHandler = async (c, next) => {
  const user = c.get('user') as ApiAuthUser | undefined;
  const session = c.get('session') as DeviceSession | undefined;
  if (!user?.id) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  if (!session?.deviceAuth) {
    throw new HTTPException(401, {
      message: 'Device token required (rvui_dev_ Bearer); cookie sessions are not accepted',
    });
  }
  await next();
};

/** Per-user rate limit after identity is known (I-7). */
export const harnessReceiptRateLimit: MiddlewareHandler = async (c, next) => {
  const user = c.get('user') as ApiAuthUser | undefined;
  const key = `harness-receipts:${user?.id ?? 'anon'}`;
  try {
    const result = await checkRateLimit(key, {
      maxAttempts: RECEIPT_RATE_MAX,
      windowMs: RECEIPT_RATE_WINDOW_MS,
    });
    c.header('X-RateLimit-Limit', String(RECEIPT_RATE_MAX));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.resetAt));
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
      c.header('Retry-After', String(retryAfter));
      throw new HTTPException(429, { message: 'Too many harness receipt requests' });
    }
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    // Fail closed on storage errors for this governance path.
    logger.error('harness receipt rate limit storage failure', { error: String(error) });
    throw new HTTPException(503, { message: 'Rate limit unavailable' });
  }
  await next();
};

interface ReceiptBody {
  source?: unknown;
  kind?: unknown;
  enforcementTier?: unknown;
  decision?: unknown;
  toolName?: unknown;
  identity?: {
    conversationId?: unknown;
    generationId?: unknown;
    modelId?: unknown;
  };
  raw?: unknown;
  /** Client may send precomputed digest; otherwise we hash a safe subset. */
  rawDigest?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function digestRaw(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  try {
    const json = JSON.stringify(raw);
    return createHash('sha256').update(json).digest('hex');
  } catch {
    return undefined;
  }
}

/** Pull display-only email from raw without treating it as identity. */
function displayEmailFromRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  return asString(o.user_email) ?? asString(o.userEmail) ?? asString(o.email);
}

export async function handleReceiptsPost(
  user: ApiAuthUser,
  accountId: string | null,
  body: unknown,
): Promise<{ accepted: number; ids: string[] }> {
  const items: ReceiptBody[] = Array.isArray(body)
    ? (body as ReceiptBody[])
    : body && typeof body === 'object' && Array.isArray((body as { receipts?: unknown }).receipts)
      ? (body as { receipts: ReceiptBody[] }).receipts
      : body && typeof body === 'object'
        ? [body as ReceiptBody]
        : [];

  if (items.length === 0) {
    throw new HTTPException(400, { message: 'Expected a receipt object or { receipts: [] }' });
  }
  if (items.length > MAX_BATCH) {
    throw new HTTPException(400, { message: `Batch size exceeds max ${MAX_BATCH}` });
  }

  const ids: string[] = [];
  for (const item of items) {
    const source = asString(item.source);
    const kind = asString(item.kind);
    const tier = asString(item.enforcementTier) ?? 'advisory';
    if (!(source && SOURCES.has(source))) {
      throw new HTTPException(400, { message: `Invalid source: ${String(item.source)}` });
    }
    if (!(kind && KINDS.has(kind))) {
      throw new HTTPException(400, { message: `Invalid kind: ${String(item.kind)}` });
    }
    if (!TIERS.has(tier)) {
      throw new HTTPException(400, { message: `Invalid enforcementTier: ${tier}` });
    }
    // I-5: never accept client claim of enforced without signature verification.
    // Until policy-snapshot crypto lands, force advisory on ingest storage.
    const enforcementTier: 'enforced' | 'advisory' =
      tier === 'enforced' ? 'advisory' : (tier as 'advisory');

    const decision = asString(item.decision);
    if (decision !== undefined && !DECISIONS.has(decision)) {
      throw new HTTPException(400, { message: `Invalid decision: ${decision}` });
    }

    const identity = item.identity && typeof item.identity === 'object' ? item.identity : {};
    const rawDigest = asString(item.rawDigest) ?? digestRaw(item.raw);

    const id = await recordHarnessHookAudit({
      userId: user.id,
      accountId,
      source,
      kind,
      enforcementTier,
      decision,
      toolName: asString(item.toolName),
      conversationId: asString(identity.conversationId),
      generationId: asString(identity.generationId),
      modelId: asString(identity.modelId),
      rawDigest,
      displayEmail: displayEmailFromRaw(item.raw),
    });
    ids.push(id);
  }

  return { accepted: ids.length, ids };
}

export const postReceiptsHandler: Handler = async (c) => {
  const user = c.get('user') as ApiAuthUser | undefined;
  if (!user?.id) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  const entitlements = getEntitlementsFromContext(c);
  const accountId = entitlements?.accountId ?? null;
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  }
  const result = await handleReceiptsPost(user, accountId, body);
  return c.json({ success: true, ...result }, 201);
};

/**
 * Policy snapshot for offline hook evaluation. Structure-only / advisory
 * until a signing primitive lands in @revealui/security (I-5).
 */
export const getPolicySnapshotHandler: Handler = async (c) => {
  return c.json({
    version: 1,
    keyId: 'unsigned-structure-only',
    signature: 'unsigned',
    issuedAt: new Date().toISOString(),
    enforcementTier: 'advisory' as const,
    rules: [] as const,
    note: 'Structure-only snapshot; cryptographic enforcement is not available yet',
  });
};

/** Pure route app (auth applied by mountHarnessReceipts). */
export function createHarnessReceiptsApp(): Hono {
  const app = new Hono();
  app.post('/receipts', postReceiptsHandler);
  app.get('/policy-snapshot', getPolicySnapshotHandler);
  return app;
}

/**
 * Mount under /api/harness and /api/v1/harness with the governed chain.
 * App typing matches mountMcpEndpoint (OpenAPIHono is not Hono&lt;BlankEnv&gt;).
 */
// biome-ignore lint/suspicious/noExplicitAny: same as mountMcpEndpoint — OpenAPIHono Env vs Hono BlankEnv
export function mountHarnessReceipts(app: Hono<any, any, any>): void {
  const chain: MiddlewareHandler[] = [
    authMiddleware({ required: true }),
    requireDeviceToken,
    harnessReceiptRateLimit,
    entitlementMiddleware(),
    requireFeature('mcp', { mode: 'entitlements' }),
  ];

  const receipts = createHarnessReceiptsApp();

  for (const prefix of ['/api/harness', '/api/v1/harness'] as const) {
    for (const mw of chain) {
      app.use(`${prefix}/*`, mw);
    }
    app.route(prefix, receipts);
  }
}
