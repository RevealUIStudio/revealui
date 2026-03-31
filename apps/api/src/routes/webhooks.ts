/**
 * Stripe Webhook Handler — NeonDB-native
 *
 * Replaces the Supabase-dependent webhook in packages/services.
 * Writes license records to the NeonDB licenses table via Drizzle,
 * handles subscription lifecycle events, and triggers license revocation.
 *
 * Idempotency is DB-backed via processed_webhook_events table to prevent
 * duplicate processing across Vercel multi-region deployments.
 */

import { type FeatureFlags, getFeaturesForTier } from '@revealui/core/features';
import { generateLicenseKey, type LicenseTier, resetLicenseState } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { DrizzleAuditStore, getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  accounts,
  agentCreditBalance,
  licenses,
  processedWebhookEvents,
  users,
} from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import {
  provisionGitHubAccess,
  sendCancellationConfirmationEmail,
  sendDisputeLostEmail,
  sendDisputeReceivedEmail,
  sendGracePeriodStartedEmail,
  sendLicenseActivatedEmail,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendPaymentRecoveredEmail,
  sendPerpetualLicenseActivatedEmail,
  sendRefundProcessedEmail,
  sendTierFallbackAlert,
  sendTrialEndingEmail,
  sendWebhookFailureAlert,
} from '../lib/webhook-emails.js';
import { resetDbStatusCache } from '../middleware/license.js';

const app = new OpenAPIHono();

type HostedTier = 'free' | LicenseTier;
type DbExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

let cachedStripe: Stripe | undefined;
function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  cachedStripe = new Stripe(key, { maxNetworkRetries: 2 });
  return cachedStripe;
}

function getWebhookSecret(): string {
  const secret = (
    process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET
  )?.trim();
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be configured');
  }
  return secret;
}

/**
 * DB-backed idempotency check. Returns true if the event was already processed.
 * Uses INSERT with ON CONFLICT to atomically check + mark in one query.
 */
async function checkAndMarkProcessed(
  db: Database,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  try {
    await db.insert(processedWebhookEvents).values({
      id: eventId,
      eventType,
      processedAt: new Date(),
    });
    return false; // Not a duplicate — insert succeeded
  } catch (err) {
    // Unique constraint violation = already processed.
    // Check PostgreSQL error code '23505' (stable across all pg drivers) in addition
    // to the message, since NeonDB's HTTP driver may format the message differently.
    const pgCode = (err as { code?: string }).code;
    if (pgCode === '23505' || (err instanceof Error && err.message.includes('duplicate key'))) {
      return true;
    }
    // Any other DB error is unexpected — throw so the caller returns 500 to Stripe.
    // Stripe will retry the event, which is safe because our INSERT is idempotent.
    logger.error('Idempotency check failed — returning 500 to force Stripe retry', undefined, {
      eventId,
      detail: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}

/**
 * R5-C1 fix: retry idempotency marker cleanup with backoff.
 * If cleanup fails after retries, log at critical level so Stripe retries
 * don't silently skip the event.
 */
async function unmarkProcessed(db: Database, eventId: string): Promise<boolean> {
  const maxRetries = 3;
  const backoffMs = [100, 500, 1000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await db.delete(processedWebhookEvents).where(eq(processedWebhookEvents.id, eventId));
      return true;
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs[attempt]));
      } else {
        logger.error(
          'CRITICAL: Failed to clear webhook idempotency marker after all retries. ' +
            'Stripe retries for this event will be treated as duplicates. ' +
            'Manual intervention required: DELETE FROM processed_webhook_events WHERE id = ?',
          undefined,
          {
            eventId,
            detail: err instanceof Error ? err.message : 'unknown',
            retries: maxRetries,
          },
        );
        return false;
      }
    }
  }
  return false;
}

function resolveTier(
  metadata: Record<string, string> | null | undefined,
): 'pro' | 'max' | 'enterprise' {
  const tier = metadata?.tier;
  if (tier === 'pro') return 'pro';
  if (tier === 'max') return 'max';
  if (tier === 'enterprise') return 'enterprise';
  // ALERT: missing or unknown tier metadata — this indicates a Stripe product misconfiguration.
  // Reject the event so Stripe retries. Do NOT default to 'pro' — that gives away a paid tier.
  logger.error(
    'CRITICAL: resolveTier received unknown or missing tier in Stripe metadata. Webhook will fail and Stripe will retry. Investigate Stripe product/price metadata immediately.',
    undefined,
    {
      tier: tier ?? null,
      metadata: metadata ?? null,
    },
  );
  // Fire-and-forget alert to founder
  const alertEmail = process.env.REVEALUI_ALERT_EMAIL || 'founder@revealui.com';
  sendTierFallbackAlert(alertEmail, { tier: tier ?? null, metadata: metadata ?? null }).catch(
    (err) => {
      logger.error('Failed to send tier fallback alert', undefined, {
        detail: err instanceof Error ? err.message : 'unknown',
      });
    },
  );
  throw new Error(
    `Stripe metadata missing or invalid tier: ${tier ?? 'null'}. Fix product/price metadata in Stripe dashboard.`,
  );
}

function resolveOptionalTier(
  metadata: Record<string, string> | null | undefined,
): 'pro' | 'max' | 'enterprise' | undefined {
  const tier = metadata?.tier;
  if (tier === 'pro') return 'pro';
  if (tier === 'max') return 'max';
  if (tier === 'enterprise') return 'enterprise';
  if (tier) {
    logger.warn(
      'Stripe subscription metadata had an unknown tier during hosted status sync — preserving existing tier',
      {
        tier,
        metadata,
      },
    );
  }
  return undefined;
}

function coerceHostedTier(value: string | null | undefined): HostedTier | undefined {
  if (value === 'free' || value === 'pro' || value === 'max' || value === 'enterprise') {
    return value;
  }
  return undefined;
}

/** Known feature keys from {@link FeatureFlags}. Used to warn on unexpected keys. */
const KNOWN_FEATURE_KEYS = new Set<string>([
  'aiLocal',
  'ai',
  'aiMemory',
  'mcp',
  'payments',
  'multiTenant',
  'whiteLabel',
  'sso',
  'byokServerSide',
  'aiMultiProvider',
  'auditLog',
  'advancedSync',
  'dashboard',
  'customDomain',
  'analytics',
] satisfies (keyof FeatureFlags)[]);

function toFeatureRecord(features: object | null | undefined): Record<string, boolean> {
  if (!features) {
    return {};
  }

  const entries = Object.entries(features).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
  );

  for (const [key] of entries) {
    if (!KNOWN_FEATURE_KEYS.has(key)) {
      logger.warn('Unknown feature key encountered in toFeatureRecord', { key });
    }
  }

  return Object.fromEntries(entries);
}

/**
 * Extracts a period date from the first subscription item.
 *
 * **Stripe field guarantees (SDK v20+):**
 * - `subscription.items.data[0]` is guaranteed for active/trialing/past_due subscriptions
 *   but may be absent on incomplete or expired subscriptions without items.
 * - `current_period_start` and `current_period_end` are Unix timestamps (seconds)
 *   guaranteed to be present on each `SubscriptionItem` for active billing cycles.
 *   They may be absent on items that have not yet entered a billing period.
 *
 * **Returns `null` when:**
 * - The subscription has no items (e.g., incomplete setup or expanded object missing items).
 * - The requested field is not a number (unexpected API shape or future SDK change).
 *
 * **Null-safe usage:**
 * ```ts
 * const start = getSubscriptionPeriodDate(sub, 'current_period_start');
 * const end = getSubscriptionPeriodDate(sub, 'current_period_end');
 * // Always provide a fallback when persisting:
 * currentPeriodStart: start ?? new Date(),
 * currentPeriodEnd: end ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
 * ```
 */
function getSubscriptionPeriodDate(
  subscription: Stripe.Subscription,
  field: 'current_period_start' | 'current_period_end',
): Date | null {
  // Stripe SDK v20 moved period dates from Subscription to SubscriptionItem
  const item = subscription.items?.data?.[0];
  if (!item) return null;
  const value = item[field];
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id;
}

function resolveSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null;
  if (typeof subscription === 'string') return subscription;
  return subscription.id;
}

function getHostedLimitsForTier(tier: 'free' | 'pro' | 'max' | 'enterprise'): {
  maxSites?: number;
  maxUsers?: number;
  maxAgentTasks?: number;
} {
  if (tier === 'enterprise') return { maxAgentTasks: Number.MAX_SAFE_INTEGER };
  if (tier === 'max') return { maxSites: 15, maxUsers: 100, maxAgentTasks: 50_000 };
  if (tier === 'pro') return { maxSites: 5, maxUsers: 25, maxAgentTasks: 10_000 };
  return { maxSites: 1, maxUsers: 3, maxAgentTasks: 1_000 };
}

function buildAccountSlug(userId: string): string {
  return `acct-${userId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 32)}`;
}

async function ensureHostedAccount(
  tx: DbExecutor,
  userId: string,
  customerId: string,
): Promise<string | null> {
  const [membership] = await tx
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .limit(1);

  if (membership?.accountId) return membership.accountId;

  const [user] = await tx
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.id) return null;

  const accountId = crypto.randomUUID();
  const now = new Date();

  await tx.insert(accounts).values({
    id: accountId,
    name: `${user.name || 'RevealUI'} Workspace`,
    slug: `${buildAccountSlug(user.id)}-${accountId.slice(0, 8)}`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  await tx.insert(accountMemberships).values({
    id: crypto.randomUUID(),
    accountId,
    userId,
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  logger.info('Hosted billing account created from Stripe webhook', {
    accountId,
    userId,
    customerId,
  });

  return accountId;
}

async function resolveHostedAccountId(
  db: DbExecutor,
  customerId: string,
  userId?: string | null,
): Promise<string | null> {
  if (userId) {
    const accountId = await ensureHostedAccount(db, userId, customerId);
    if (accountId) return accountId;
  }

  const [subscription] = await db
    .select({ accountId: accountSubscriptions.accountId })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (subscription?.accountId) return subscription.accountId;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!user?.id) return null;
  return ensureHostedAccount(db, user.id, customerId);
}

async function syncHostedSubscriptionState(
  db: DbExecutor,
  params: {
    customerId: string;
    subscriptionId: string | null;
    userId?: string | null;
    tier?: 'free' | 'pro' | 'max' | 'enterprise' | null;
    status: string;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    graceUntil?: Date | null;
  },
): Promise<void> {
  const accountId = await resolveHostedAccountId(db, params.customerId, params.userId ?? null);
  if (!accountId) {
    logger.warn('Hosted entitlement sync skipped because no account could be resolved', {
      customerId: params.customerId,
      subscriptionId: params.subscriptionId,
      userId: params.userId ?? undefined,
    });
    return;
  }

  const now = new Date();
  const [existingSubscription] = await db
    .select({ id: accountSubscriptions.id, planId: accountSubscriptions.planId })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.accountId, accountId))
    .limit(1);

  const [existingEntitlement] = await db
    .select({ accountId: accountEntitlements.accountId, tier: accountEntitlements.tier })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);

  const resolvedTier: HostedTier =
    params.tier ??
    coerceHostedTier(existingEntitlement?.tier) ??
    coerceHostedTier(existingSubscription?.planId) ??
    'free';

  const subscriptionValues = {
    accountId,
    stripeCustomerId: params.customerId,
    stripeSubscriptionId: params.subscriptionId,
    planId: resolvedTier,
    status: params.status,
    currentPeriodStart: params.currentPeriodStart ?? null,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
    updatedAt: now,
  };

  if (existingSubscription?.id) {
    await db
      .update(accountSubscriptions)
      .set(subscriptionValues)
      .where(eq(accountSubscriptions.id, existingSubscription.id));
  } else {
    await db.insert(accountSubscriptions).values({
      id: crypto.randomUUID(),
      ...subscriptionValues,
      createdAt: now,
    });
  }

  const entitlementValues = {
    planId: resolvedTier,
    tier: resolvedTier,
    status: params.status,
    features: toFeatureRecord(getFeaturesForTier(resolvedTier)),
    limits: getHostedLimitsForTier(resolvedTier),
    meteringStatus:
      params.status === 'active' || params.status === 'trialing' ? 'active' : 'paused',
    graceUntil: params.graceUntil ?? null,
    updatedAt: now,
  };

  if (existingEntitlement?.accountId) {
    await db
      .update(accountEntitlements)
      .set(entitlementValues)
      .where(eq(accountEntitlements.accountId, accountId));
  } else {
    await db.insert(accountEntitlements).values({
      accountId,
      ...entitlementValues,
    });
  }
}

/**
 * Append a license lifecycle event to the audit log.
 *
 * License lifecycle events are always audited for compliance.
 * The isFeatureEnabled('auditLog') gate controls UI access to audit data,
 * not collection. Fire-and-forget — errors are swallowed so that audit
 * failure never blocks the webhook response.
 */
function auditLicenseEvent(
  db: Database | Parameters<Parameters<Database['transaction']>[0]>[0],
  eventType: string,
  severity: 'info' | 'warn' | 'critical',
  payload: Record<string, unknown>,
): void {
  new DrizzleAuditStore(db as Database)
    .append({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType,
      severity,
      agentId: 'system:stripe-webhook',
      payload,
      policyViolations: [],
    })
    .catch((err: unknown) => {
      logger.warn('Failed to write license audit entry', {
        eventType,
        detail: err instanceof Error ? err.message : 'unknown',
      });
    });
}

/**
 * Look up user email by Stripe customer ID for sending notification emails.
 */
async function findUserEmailByCustomerId(
  db: DbExecutor,
  customerId: string,
): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);
  return user?.email ?? null;
}

async function findHostedStatusByCustomerId(
  db: DbExecutor,
  customerId: string,
): Promise<string | null> {
  const [subscription] = await db
    .select({ accountId: accountSubscriptions.accountId })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (!subscription?.accountId) return null;

  const [entitlement] = await db
    .select({ status: accountEntitlements.status })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, subscription.accountId))
    .limit(1);

  return entitlement?.status ?? null;
}

// ─── Webhook Endpoint ────────────────────────────────────────────────────────

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'payment_intent.payment_failed',
  'customer.subscription.trial_will_end',
  'charge.dispute.closed',
  'charge.dispute.created',
  'charge.refunded',
]);

const stripeWebhookRoute = createRoute({
  method: 'post',
  path: '/stripe',
  tags: ['webhooks'],
  summary: 'Stripe webhook handler',
  description:
    'Receives Stripe webhook events for subscription lifecycle, license management, disputes, and refunds. Requires raw body access for signature verification.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              id: z.string(),
              type: z.string(),
              data: z.object({ object: z.unknown() }),
              created: z.number(),
              livemode: z.boolean(),
            })
            .passthrough(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            received: z.literal(true),
            duplicate: z.boolean().optional(),
          }),
        },
      },
      description: 'Webhook event received and processed',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Missing signature or invalid webhook',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Webhook processing failed',
    },
    503: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Webhook service unavailable (Stripe env vars misconfigured)',
    },
  },
});

app.openapi(stripeWebhookRoute, async (c) => {
  let webhookSecret: string;
  let stripe: Stripe;
  try {
    webhookSecret = getWebhookSecret();
    stripe = getStripeClient();
  } catch (initErr) {
    const msg = initErr instanceof Error ? initErr.message : 'Unknown init error';
    logger.error('Webhook handler init failed — Stripe env vars may be misconfigured', undefined, {
      detail: msg,
      hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
      hasWebhookSecret: !!(
        process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET
      ),
    });
    return c.json({ error: 'Webhook service unavailable' }, 503);
  }

  const body = await c.req.text();
  const sig = c.req.header('Stripe-Signature');

  if (!sig) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400);
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Webhook signature verification failed', undefined, { detail: msg });
    return c.json({ error: 'Invalid webhook signature' }, 400);
  }

  if (!relevantEvents.has(event.type)) {
    return c.json({ received: true as const }, 200);
  }

  // NOTE: We intentionally do NOT enforce a timestamp freshness window here.
  // Replay attacks are prevented by DB-backed idempotency (processedWebhookEvents
  // table, INSERT ON CONFLICT) below. A timestamp window would incorrectly reject
  // Stripe's legitimate 72-hour retry delivery attempts, which carry the original
  // event timestamp. Stripe's own signature verification already enforces a 300s
  // tolerance during constructEventAsync above.

  const db = getClient();

  // DB-backed idempotency check
  if (await checkAndMarkProcessed(db, event.id, event.type)) {
    return c.json({ received: true as const, duplicate: true }, 200);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── One-time payments (perpetual licenses + credit bundles) ──────
        if (session.mode === 'payment') {
          // ── Credit bundle purchase ──────────────────────────────────────
          if (session.metadata?.credits_bundle) {
            const bundle = session.metadata.credits_bundle;
            const tasks = Number.parseInt(session.metadata.credits_tasks ?? '0', 10);
            const creditUserId = session.metadata.revealui_user_id ?? null;
            const creditCustomerId =
              typeof session.customer === 'string' ? session.customer : session.customer?.id;

            let resolvedCreditUserId = creditUserId;
            if (!resolvedCreditUserId && creditCustomerId) {
              const [u] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.stripeCustomerId, creditCustomerId))
                .limit(1);
              resolvedCreditUserId = u?.id ?? null;
            }

            if (!resolvedCreditUserId || tasks <= 0) {
              logger.error('Cannot process credit purchase — missing user or tasks', undefined, {
                bundle,
                tasks,
                sessionId: session.id,
              });
              break;
            }

            await db
              .insert(agentCreditBalance)
              .values({
                userId: resolvedCreditUserId,
                balance: tasks,
                totalPurchased: tasks,
              })
              .onConflictDoUpdate({
                target: agentCreditBalance.userId,
                set: {
                  balance: sql`${agentCreditBalance.balance} + ${tasks}`,
                  totalPurchased: sql`${agentCreditBalance.totalPurchased} + ${tasks}`,
                  updatedAt: new Date(),
                },
              });

            logger.info('Credit bundle purchased and credited', {
              bundle,
              tasks,
              userId: resolvedCreditUserId,
            });
            auditLicenseEvent(db, 'credits.purchased', 'info', {
              bundle,
              tasks,
              userId: resolvedCreditUserId,
            });

            break;
          }

          // ── Perpetual license ───────────────────────────────────────────
          // Only process as perpetual license if RevealUI tier metadata is present.
          // Other payment-mode checkouts (non-RevealUI products) are silently skipped.
          if (!session.metadata?.tier) break;

          const customerId = resolveCustomerId(session.customer);
          if (!customerId) {
            logger.error(
              'CRITICAL: Perpetual checkout completed but customerId is null — payment captured without license',
              undefined,
              { sessionId: session.id },
            );
            throw new Error(
              `Perpetual checkout completed but customerId is null (sessionId=${session.id})`,
            );
          }

          const tier = resolveTier(session.metadata);
          const githubUsername = session.metadata?.github_username ?? null;

          let resolvedUserId = session.metadata?.revealui_user_id ?? null;
          if (!resolvedUserId) {
            const [user] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.stripeCustomerId, customerId))
              .limit(1);
            resolvedUserId = user?.id ?? null;
          }

          if (!resolvedUserId) {
            logger.error('CRITICAL: Cannot resolve user for perpetual checkout', undefined, {
              customerId,
            });
            throw new Error(
              `Cannot resolve user for perpetual checkout (customerId=${customerId})`,
            );
          }

          const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
          if (!privateKey) {
            logger.error(
              'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — perpetual license not generated',
              undefined,
              { customerId, tier },
            );
            throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured');
          }

          const normalizedKey = privateKey.replace(/\\n/g, '\n');
          // null expiresInSeconds = no exp claim — perpetual license never expires
          const licenseKey = await generateLicenseKey(
            { tier, customerId, perpetual: true },
            normalizedKey,
            null,
          );

          // Support contract expires 1 year from purchase
          const supportExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          const licenseId = crypto.randomUUID();

          await db.transaction(async (tx) => {
            const [userRow] = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.stripeCustomerId, customerId))
              .limit(1);

            if (!userRow) {
              logger.error(
                'CRITICAL: Customer has no matching user in DB — perpetual license not created',
                undefined,
                { customerId },
              );
              // Throw 500 so Stripe retries — payment was captured but no license was issued.
              // Previously this returned silently (HTTP 200), causing Stripe to stop retrying
              // and the customer to never receive their license.
              throw new Error(`Cannot find user for perpetual license (customerId=${customerId})`);
            }

            await tx.insert(licenses).values({
              id: licenseId,
              userId: resolvedUserId,
              licenseKey,
              tier,
              subscriptionId: null,
              customerId,
              status: 'active',
              expiresAt: null,
              perpetual: true,
              supportExpiresAt,
              githubUsername,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          });

          resetLicenseState();
          resetDbStatusCache();

          logger.info('Perpetual license generated and stored', { tier, customerId, licenseId });
          auditLicenseEvent(db, 'license.perpetual.created', 'info', {
            licenseId,
            tier,
            customerId,
            userId: resolvedUserId,
            githubUsername,
          });

          // Best-effort: provision GitHub team access
          if (githubUsername) {
            provisionGitHubAccess(githubUsername, db).catch((err) => {
              logger.warn('Failed to provision GitHub team access', {
                githubUsername,
                detail: err instanceof Error ? err.message : 'unknown',
              });
            });
          }

          // Send perpetual license activation email
          const perpetualEmail =
            session.customer_email ?? (await findUserEmailByCustomerId(db, customerId));
          if (perpetualEmail) {
            sendPerpetualLicenseActivatedEmail(
              perpetualEmail,
              tier,
              supportExpiresAt,
              licenseKey,
            ).catch((err) => {
              logger.error('Failed to send perpetual license activation email', undefined, {
                detail: err instanceof Error ? err.message : 'unknown',
              });
            });
          }

          break;
        }

        // ── Subscription ──────────────────────────────────────────────────
        if (session.mode !== 'subscription' || !session.subscription) break;

        const customerId = resolveCustomerId(session.customer);
        const subscriptionId = resolveSubscriptionId(session.subscription);
        if (!(customerId && subscriptionId)) {
          logger.error(
            'CRITICAL: Subscription checkout completed but customerId/subscriptionId is null — payment captured without license',
            undefined,
            { sessionId: session.id },
          );
          throw new Error(
            `Subscription checkout completed but customerId/subscriptionId is null (sessionId=${session.id})`,
          );
        }

        const tier = resolveTier(session.metadata);
        const userId = session.metadata?.revealui_user_id ?? null;

        // Resolve userId from Stripe customer if not in metadata
        let resolvedUserId = userId;
        if (!resolvedUserId) {
          const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);
          resolvedUserId = user?.id ?? null;
        }

        if (!resolvedUserId) {
          logger.error('CRITICAL: Cannot resolve user for checkout', undefined, {
            customerId,
            subscriptionId,
          });
          // Return 500 so Stripe retries — a payment was captured but no license was issued.
          throw new Error(
            `Cannot resolve user for checkout session (customerId=${customerId}, subscriptionId=${subscriptionId})`,
          );
        }

        // Generate license key
        const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
        if (!privateKey) {
          logger.error(
            'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — license not generated',
            undefined,
            {
              customerId,
              subscriptionId,
              tier,
            },
          );
          // Return 500 so Stripe retries — a payment was captured but no license was issued.
          throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured');
        }

        // Unescape literal \n sequences — Vercel stores multi-line PEM keys
        // with \n escaped in the .env format; the runtime preserves the literal
        // \n chars, so we must convert them to real newlines for jose/importPKCS8.
        const normalizedKey = privateKey.replace(/\\n/g, '\n');
        const licenseKey = await generateLicenseKey({ tier, customerId }, normalizedKey);

        // Retrieve subscription to detect trialing state and trial_end date.
        // All new checkouts start as trialing (7-day trial configured in billing.ts).
        let checkoutSubscription: Stripe.Subscription;
        try {
          checkoutSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (err) {
          // Throw so Stripe retries the webhook — a payment was captured but we
          // cannot determine trialing vs active without the subscription object.
          logger.error(
            'Failed to retrieve subscription at checkout — returning 500 for retry',
            undefined,
            {
              subscriptionId,
              detail: err instanceof Error ? err.message : 'unknown',
            },
          );
          throw new Error(`Failed to retrieve subscription ${subscriptionId} at checkout`);
        }

        const isTrialing = checkoutSubscription.status === 'trialing';
        const licenseStatus = isTrialing ? 'trialing' : 'active';
        const licenseExpiresAt =
          isTrialing && checkoutSubscription.trial_end
            ? new Date(checkoutSubscription.trial_end * 1000)
            : null;

        // Store license in NeonDB (transactional)
        const licenseId = crypto.randomUUID();
        await db.transaction(async (tx) => {
          // Verify user exists before creating license
          const [userRow] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1);

          if (!userRow) {
            logger.error(
              'CRITICAL: Customer has no matching user in DB — subscription license not created',
              undefined,
              { customerId, subscriptionId },
            );
            // Throw 500 so Stripe retries — payment was captured but no license was issued.
            // Previously this returned silently (HTTP 200), causing Stripe to stop retrying
            // and the customer to never receive their license.
            throw new Error(
              `Cannot find user for subscription license (customerId=${customerId}, subscriptionId=${subscriptionId})`,
            );
          }

          await tx.insert(licenses).values({
            id: licenseId,
            userId: resolvedUserId,
            licenseKey,
            tier,
            subscriptionId,
            customerId,
            status: licenseStatus,
            expiresAt: licenseExpiresAt,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await syncHostedSubscriptionState(tx, {
            customerId,
            subscriptionId,
            userId: resolvedUserId,
            tier,
            status: licenseStatus,
            currentPeriodStart: checkoutSubscription
              ? getSubscriptionPeriodDate(checkoutSubscription, 'current_period_start')
              : null,
            currentPeriodEnd: checkoutSubscription
              ? (getSubscriptionPeriodDate(checkoutSubscription, 'current_period_end') ??
                licenseExpiresAt)
              : licenseExpiresAt,
            cancelAtPeriodEnd: checkoutSubscription?.cancel_at_period_end ?? false,
            graceUntil: licenseExpiresAt,
          });
        });

        // Invalidate in-process license cache so subsequent requests see the new tier
        resetLicenseState();
        resetDbStatusCache();

        // Best-effort: also store in Stripe subscription metadata for easy retrieval.
        // Non-critical — license is already persisted in NeonDB above.
        try {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: { license_key: licenseKey, license_tier: tier },
          });
        } catch (stripeErr) {
          logger.warn('Failed to write license key to Stripe subscription metadata', {
            subscriptionId,
            error: stripeErr instanceof Error ? stripeErr.message : 'unknown',
          });
        }

        // Best-effort: tag early adopter in Stripe customer metadata so their
        // lifetime discount is visible in the Stripe Dashboard and queryable later.
        const earlyAdopterEnd = process.env.REVEALUI_EARLY_ADOPTER_END;
        if (earlyAdopterEnd && new Date() < new Date(earlyAdopterEnd)) {
          try {
            await stripe.customers.update(customerId, {
              metadata: { earlyAdopter: 'true' },
            });
          } catch (earlyErr) {
            logger.warn('Failed to tag early adopter on Stripe customer', {
              customerId,
              error: earlyErr instanceof Error ? earlyErr.message : 'unknown',
            });
          }
        }

        logger.info('License generated and stored', { tier, customerId, licenseId });
        auditLicenseEvent(db, 'license.created', 'info', {
          licenseId,
          tier,
          customerId,
          subscriptionId,
          userId: resolvedUserId,
        });

        // Send license activation email
        const userEmail =
          session.customer_email ?? (await findUserEmailByCustomerId(db, customerId));
        if (userEmail) {
          sendLicenseActivatedEmail(userEmail, tier).catch((err) => {
            logger.error('Failed to send license activation email', undefined, {
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = resolveCustomerId(subscription.customer);
        if (!customerId) break;

        // Revoke license tied to this specific subscription — not all licenses for the customer.
        // Perpetual licenses (subscriptionId=null) and other subscriptions are left intact.
        await db.transaction(async (tx) => {
          await tx
            .update(licenses)
            .set({ status: 'revoked', updatedAt: new Date() })
            .where(
              and(
                eq(licenses.customerId, customerId),
                eq(licenses.subscriptionId, subscription.id),
              ),
            );

          await syncHostedSubscriptionState(tx, {
            customerId,
            subscriptionId: subscription.id,
            tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
            status: 'revoked',
            currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
            currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
          });
        });

        resetLicenseState();
        resetDbStatusCache();

        logger.info('License revoked on subscription deletion', {
          customerId,
          subscriptionId: subscription.id,
        });
        auditLicenseEvent(db, 'license.revoked', 'warn', {
          customerId,
          subscriptionId: subscription.id,
        });

        // Send cancellation confirmation email
        const cancelTier = resolveOptionalTier(subscription.metadata as Record<string, string>);
        const cancelEmail = await findUserEmailByCustomerId(db, customerId);
        if (cancelEmail) {
          sendCancellationConfirmationEmail(cancelEmail, cancelTier ?? 'pro').catch((err) => {
            logger.error('Failed to send cancellation confirmation email', undefined, {
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }

      case 'customer.deleted': {
        // Customer record deleted directly in Stripe (e.g., by an admin or via API).
        // Revoke all associated licenses immediately to prevent continued access.
        const customer = event.data.object as Stripe.Customer;
        const customerId = customer.id;

        await db.transaction(async (tx) => {
          await tx
            .update(licenses)
            .set({ status: 'revoked', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId));

          await syncHostedSubscriptionState(tx, {
            customerId,
            subscriptionId: null,
            status: 'revoked',
          });
        });

        resetLicenseState();
        resetDbStatusCache();

        logger.warn('License revoked: Stripe customer deleted', { customerId });
        auditLicenseEvent(db, 'license.revoked.customer_deleted', 'warn', { customerId });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = resolveCustomerId(subscription.customer);
        if (!customerId) break;

        // Wrap all DB mutations in a transaction to prevent races between concurrent
        // subscription.updated events (e.g., active → past_due → unpaid arriving simultaneously).
        // Emails are sent outside the transaction (fire-and-forget).
        let emailToSend: (() => void) | null = null;

        await db.transaction(async (tx) => {
          // If subscription went past_due or unpaid, degrade access.
          // past_due = grace period (customer retains access until period end).
          // unpaid = immediate block (Stripe exhausted retries).
          if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            const isPastDue = subscription.status === 'past_due';
            const entitlementStatus = isPastDue ? 'past_due' : 'expired';

            // Scope to this subscription — don't expire perpetual licenses or other subscriptions
            await tx
              .update(licenses)
              .set({ status: 'expired', updatedAt: new Date() })
              .where(
                and(
                  eq(licenses.customerId, customerId),
                  eq(licenses.subscriptionId, subscription.id),
                ),
              );

            await syncHostedSubscriptionState(tx, {
              customerId,
              subscriptionId: subscription.id,
              tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
              status: entitlementStatus,
              currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
              currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
              cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
              graceUntil: isPastDue
                ? getSubscriptionPeriodDate(subscription, 'current_period_end')
                : null,
            });

            logger.info(
              isPastDue
                ? 'License degraded to past_due with grace period'
                : 'License expired — subscription unpaid',
              {
                customerId,
                subscriptionStatus: subscription.status,
              },
            );
            resetLicenseState();
            resetDbStatusCache();
            auditLicenseEvent(tx, isPastDue ? 'license.grace_period' : 'license.expired', 'warn', {
              customerId,
              subscriptionId: subscription.id,
              subscriptionStatus: subscription.status,
            });

            // Defer email send until after transaction commits
            emailToSend = async () => {
              const email = await findUserEmailByCustomerId(db, customerId);
              if (email) {
                const graceEnd = isPastDue
                  ? getSubscriptionPeriodDate(subscription, 'current_period_end')
                  : null;
                const updatedTier =
                  resolveOptionalTier(subscription.metadata as Record<string, string>) ?? 'pro';
                const emailPromise = graceEnd
                  ? sendGracePeriodStartedEmail(email, graceEnd)
                  : sendPaymentFailedEmail(email, updatedTier);
                emailPromise.catch((err) => {
                  logger.error('Failed to send payment/grace period email', undefined, {
                    detail: err instanceof Error ? err.message : 'unknown',
                  });
                });
              }
            };
          }

          // If subscription is scheduled for cancellation at period end, stamp the license
          // expiry so it lapses correctly even if the subscription.deleted webhook is delayed
          // or missed. This is belt-and-suspenders alongside the subscription.deleted handler.
          if (
            subscription.status === 'active' &&
            subscription.cancel_at_period_end &&
            subscription.cancel_at
          ) {
            const cancelAt = new Date(subscription.cancel_at * 1000);
            await tx
              .update(licenses)
              .set({ expiresAt: cancelAt, updatedAt: new Date() })
              .where(
                and(
                  eq(licenses.customerId, customerId),
                  eq(licenses.subscriptionId, subscription.id),
                ),
              );

            resetLicenseState();
            resetDbStatusCache();
            logger.info('License expiry set for scheduled downgrade', {
              customerId,
              subscriptionId: subscription.id,
              expiresAt: cancelAt.toISOString(),
            });
            auditLicenseEvent(tx, 'license.expiry_scheduled', 'info', {
              customerId,
              subscriptionId: subscription.id,
              expiresAt: cancelAt.toISOString(),
            });

            await syncHostedSubscriptionState(tx, {
              customerId,
              subscriptionId: subscription.id,
              tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
              status: 'active',
              currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
              currentPeriodEnd:
                getSubscriptionPeriodDate(subscription, 'current_period_end') ?? cancelAt,
              cancelAtPeriodEnd: true,
              graceUntil: cancelAt,
            });
          }

          // If subscription is active (and not scheduled for cancellation), sync tier + status.
          if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
            const newTier = resolveTier(subscription.metadata as Record<string, string>);
            const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

            if (!privateKey) {
              logger.error(
                'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — license sync failed',
                undefined,
                { customerId, subscriptionId: subscription.id, tier: newTier },
              );
              throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured');
            }

            const normalizedKey = privateKey.replace(/\\n/g, '\n');
            const licenseKey = await generateLicenseKey(
              { tier: newTier, customerId },
              normalizedKey,
            );
            await tx
              .update(licenses)
              .set({ status: 'active', tier: newTier, licenseKey, updatedAt: new Date() })
              .where(
                and(
                  eq(licenses.customerId, customerId),
                  eq(licenses.subscriptionId, subscription.id),
                ),
              );

            await syncHostedSubscriptionState(tx, {
              customerId,
              subscriptionId: subscription.id,
              tier: newTier,
              status: 'active',
              currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
              currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
              cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
              graceUntil:
                subscription.cancel_at_period_end && subscription.cancel_at
                  ? new Date(subscription.cancel_at * 1000)
                  : null,
            });

            // Clear pending_change flag so the next upgrade/downgrade is unblocked
            if (subscription.metadata?.pending_change) {
              stripe.subscriptions
                .update(subscription.id, { metadata: { pending_change: '' } })
                .catch((err) => {
                  logger.warn('Failed to clear pending_change metadata', {
                    subscriptionId: subscription.id,
                    detail: err instanceof Error ? err.message : 'unknown',
                  });
                });
            }

            resetLicenseState();
            resetDbStatusCache();
            auditLicenseEvent(tx, 'license.reactivated', 'info', {
              customerId,
              subscriptionId: subscription.id,
              tier: newTier,
            });
          }

          // Handle terminal subscription states that aren't covered above
          if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
            await tx
              .update(licenses)
              .set({ status: 'revoked', updatedAt: new Date() })
              .where(
                and(
                  eq(licenses.customerId, customerId),
                  eq(licenses.subscriptionId, subscription.id),
                ),
              );

            await syncHostedSubscriptionState(tx, {
              customerId,
              subscriptionId: subscription.id,
              tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
              status: 'revoked',
              currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
              currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
              cancelAtPeriodEnd: false,
              graceUntil: null,
            });

            resetLicenseState();
            resetDbStatusCache();
            auditLicenseEvent(tx, `license.revoked.subscription_${subscription.status}`, 'warn', {
              customerId,
              subscriptionId: subscription.id,
              stripeStatus: subscription.status,
            });
          }

          if (subscription.status === 'incomplete') {
            logger.warn('Subscription in incomplete state — awaiting payment confirmation', {
              customerId,
              subscriptionId: subscription.id,
            });
          }

          // Handle trialing subscriptions — no license changes needed,
          // but sync state so the CMS dashboard shows trial status.
          if (subscription.status === 'trialing') {
            await syncHostedSubscriptionState(tx, {
              customerId,
              subscriptionId: subscription.id,
              tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
              status: 'trialing',
              currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
              currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
              cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
              graceUntil: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
            });
            logger.info('Subscription in trialing state — synced hosted state', {
              customerId,
              subscriptionId: subscription.id,
              trialEnd: subscription.trial_end,
            });
          }

          // Stripe paused subscriptions (payment collection paused by merchant).
          // Log for observability — license stays active during pause.
          if (subscription.status === 'paused') {
            logger.warn('Subscription paused — payment collection suspended', {
              customerId,
              subscriptionId: subscription.id,
            });
            await syncHostedSubscriptionState(tx, {
              customerId,
              subscriptionId: subscription.id,
              tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
              status: 'paused',
              currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
              currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
              cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
              graceUntil: null,
            });
          }
        }); // end transaction

        // Send deferred emails outside the transaction
        if (emailToSend) (emailToSend as () => void)();

        break;
      }

      case 'customer.subscription.created': {
        // Logged for observability; license generation happens on checkout.session.completed.
        // Use resolveOptionalTier — metadata may not be populated yet at creation time.
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = resolveCustomerId(subscription.customer);
        if (customerId) {
          await syncHostedSubscriptionState(db, {
            customerId,
            subscriptionId: subscription.id,
            tier: resolveOptionalTier(subscription.metadata as Record<string, string>),
            status: subscription.status,
            currentPeriodStart: getSubscriptionPeriodDate(subscription, 'current_period_start'),
            currentPeriodEnd: getSubscriptionPeriodDate(subscription, 'current_period_end'),
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
            graceUntil:
              subscription.status === 'trialing' && subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
          });
        }
        logger.info('Subscription created', {
          customerId,
          subscriptionId: subscription.id,
          status: subscription.status,
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        // Handle successful invoice payment:
        // 1. Send payment receipt email to customer (every payment)
        // 2. Re-activate license if it was expired/revoked (recovery)
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = resolveCustomerId(invoice.customer);
        if (!customerId) break;

        // Send payment receipt email for every successful invoice (not just recovery).
        // Fire-and-forget — receipt delivery must not block license recovery.
        if (invoice.amount_paid > 0) {
          const receiptEmail =
            invoice.customer_email ?? (await findUserEmailByCustomerId(db, customerId));
          if (receiptEmail) {
            // Resolve tier from the customer's license in DB (avoids invoice.subscription
            // which is not typed in Stripe SDK v20 — see existing comment at line 1124).
            let receiptTier = 'pro';
            const [licenseRow] = await db
              .select({ tier: licenses.tier })
              .from(licenses)
              .where(eq(licenses.customerId, customerId))
              .orderBy(desc(licenses.updatedAt))
              .limit(1);
            if (licenseRow?.tier) {
              receiptTier = licenseRow.tier;
            }

            const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : null;

            sendPaymentReceiptEmail(receiptEmail, {
              amountPaid: invoice.amount_paid,
              currency: invoice.currency,
              invoiceNumber: invoice.number ?? null,
              tier: receiptTier,
              periodEnd,
              invoiceUrl: invoice.hosted_invoice_url ?? null,
            }).catch((err) => {
              logger.error('Failed to send payment receipt email', undefined, {
                detail: err instanceof Error ? err.message : 'unknown',
              });
            });
          }
        }

        // Payment recovery — re-activate a license that was expired/revoked due to prior payment failure.
        // Only re-activate if the customer has an active subscription after payment.

        // Fetch the customer's active subscriptions to confirm payment actually restored access.
        // We don't read invoice.subscription directly — that field is not typed in this SDK version.
        let recoveredSubscription: Stripe.Subscription | null = null;
        try {
          const subList = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
          });
          recoveredSubscription = subList.data[0] ?? null;
        } catch (err) {
          logger.warn('Failed to list subscriptions for invoice.payment_succeeded', {
            customerId,
            detail: err instanceof Error ? err.message : 'unknown',
          });
          break;
        }

        if (!recoveredSubscription) break;

        const [existingLicense] = await db
          .select({ id: licenses.id, status: licenses.status })
          .from(licenses)
          .where(eq(licenses.customerId, customerId))
          .orderBy(desc(licenses.updatedAt))
          .limit(1);
        const hostedStatus = await findHostedStatusByCustomerId(db, customerId);

        // Use resolveOptionalTier with fallback — resolveTier would create an infinite retry loop
        // if the recovered subscription lacks tier metadata (e.g., pre-metadata subscription)
        const recoveredTier =
          resolveOptionalTier(recoveredSubscription.metadata as Record<string, string>) ?? 'pro';
        const shouldReactivateLegacyLicense =
          existingLicense?.status === 'expired' || existingLicense?.status === 'revoked';
        const shouldReactivateHosted = hostedStatus === 'expired' || hostedStatus === 'revoked';
        const shouldHealHostedState = hostedStatus === null;

        if (shouldReactivateLegacyLicense) {
          const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

          if (!privateKey) {
            logger.error(
              'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — payment recovery failed',
              undefined,
              { customerId, subscriptionId: recoveredSubscription.id, tier: recoveredTier },
            );
            throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured');
          }

          const normalizedKey = privateKey.replace(/\\n/g, '\n');
          const licenseKey = await generateLicenseKey(
            { tier: recoveredTier, customerId },
            normalizedKey,
          );
          // Scope to the recovered subscription — don't modify perpetual licenses
          const recoveryFilter = recoveredSubscription.id
            ? and(
                eq(licenses.customerId, customerId),
                eq(licenses.subscriptionId, recoveredSubscription.id),
              )
            : eq(licenses.customerId, customerId);
          await db
            .update(licenses)
            .set({ status: 'active', tier: recoveredTier, licenseKey, updatedAt: new Date() })
            .where(recoveryFilter);
        } else if (existingLicense && !shouldReactivateHosted && !shouldHealHostedState) {
          break;
        }

        if (
          !(
            shouldReactivateLegacyLicense ||
            shouldReactivateHosted ||
            shouldHealHostedState ||
            existingLicense
          )
        ) {
          break;
        }

        await syncHostedSubscriptionState(db, {
          customerId,
          subscriptionId: recoveredSubscription.id,
          tier: recoveredTier,
          status: 'active',
          currentPeriodStart: getSubscriptionPeriodDate(
            recoveredSubscription,
            'current_period_start',
          ),
          currentPeriodEnd: getSubscriptionPeriodDate(recoveredSubscription, 'current_period_end'),
          cancelAtPeriodEnd: recoveredSubscription.cancel_at_period_end ?? false,
          graceUntil: null,
        });

        resetLicenseState();
        resetDbStatusCache();

        logger.info('License re-activated after payment recovery', {
          customerId,
          subscriptionId: recoveredSubscription.id,
          tier: recoveredTier,
        });
        auditLicenseEvent(db, 'license.reactivated.payment_recovery', 'info', {
          customerId,
          subscriptionId: recoveredSubscription.id,
          tier: recoveredTier,
        });

        const recoveryEmail =
          invoice.customer_email ?? (await findUserEmailByCustomerId(db, customerId));
        if (recoveryEmail) {
          sendPaymentRecoveredEmail(recoveryEmail).catch((err) => {
            logger.error('Failed to send payment recovered email', undefined, {
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = resolveCustomerId(invoice.customer);
        if (!customerId) break;

        logger.warn('Invoice payment failed', {
          customerId,
          invoiceId: invoice.id,
          attemptCount: invoice.attempt_count,
        });

        // Resolve subscription ID from the invoice first — needed for scoped license updates.
        // Stripe SDK v20 moved subscription from invoice.subscription to
        // invoice.parent.subscription_details.subscription.
        const invoiceSubscription = invoice.parent?.subscription_details?.subscription ?? null;
        const subscriptionId =
          typeof invoiceSubscription === 'string'
            ? invoiceSubscription
            : typeof invoiceSubscription === 'object' && invoiceSubscription !== null
              ? invoiceSubscription.id
              : null;

        // Determine severity: past_due (1-2 failures) vs suspended (3+ failures).
        // past_due gets a grace period; suspended is immediate block.
        const isSuspended = invoice.attempt_count != null && invoice.attempt_count >= 3;
        const entitlementStatus = isSuspended ? 'expired' : 'past_due';

        if (isSuspended) {
          logger.error('Payment failed 3+ times — suspending subscription', undefined, {
            customerId,
            attemptCount: invoice.attempt_count,
          });

          // Scope to this subscription if known — don't expire perpetual licenses
          const licenseFilter = subscriptionId
            ? and(eq(licenses.customerId, customerId), eq(licenses.subscriptionId, subscriptionId))
            : eq(licenses.customerId, customerId);
          await db
            .update(licenses)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(licenseFilter);
        }

        // Grace period: customer retains access until the end of their billing period.
        // Only granted for initial failures (past_due). Suspended = immediate block.
        const graceUntil =
          !isSuspended && invoice.period_end ? new Date(invoice.period_end * 1000) : null;

        await syncHostedSubscriptionState(db, {
          customerId,
          subscriptionId,
          status: entitlementStatus,
          graceUntil,
        });

        // Reset caches for any payment failure — both grace period (past_due)
        // and suspension (expired) change the effective entitlement state.
        resetLicenseState();
        resetDbStatusCache();

        auditLicenseEvent(
          db,
          isSuspended ? 'license.suspended.payment_failed' : 'license.grace_period.payment_failed',
          isSuspended ? 'critical' : 'warn',
          {
            customerId,
            invoiceId: invoice.id,
            attemptCount: invoice.attempt_count,
            subscriptionId,
            graceUntil: graceUntil?.toISOString() ?? null,
          },
        );

        // Send payment failed email — tier not directly available on invoice,
        // so use the default (the template will show the correct tier label)
        const email = invoice.customer_email ?? (await findUserEmailByCustomerId(db, customerId));
        if (email) {
          sendPaymentFailedEmail(email).catch((err: unknown) => {
            logger.error('Failed to send payment failed email', undefined, {
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = resolveCustomerId(subscription.customer);
        if (!customerId) break;

        logger.info('Trial ending soon', {
          customerId,
          subscriptionId: subscription.id,
          trialEnd: subscription.trial_end,
        });

        // Send trial ending reminder email
        const email = await findUserEmailByCustomerId(db, customerId);
        if (email) {
          const trialTier =
            resolveOptionalTier(subscription.metadata as Record<string, string>) ?? 'pro';
          sendTrialEndingEmail(email, subscription.trial_end, trialTier).catch((err) => {
            logger.error('Failed to send trial ending email', undefined, {
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }

      case 'charge.dispute.closed': {
        // A dispute has been resolved. Handle both outcomes:
        // - lost: revoke the customer's license (chargeback returned to cardholder)
        // - won/warning_closed: restore any previously-revoked license
        const dispute = event.data.object as Stripe.Dispute;

        if (dispute.status === 'won' || dispute.status === 'warning_closed') {
          // Dispute resolved in our favor — restore the customer's license if it
          // was previously revoked due to a charge.dispute.created event.
          const wonChargeId =
            typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
          let wonCustomerId: string | null = null;
          try {
            const charge = await stripe.charges.retrieve(wonChargeId);
            wonCustomerId = resolveCustomerId(charge.customer);
          } catch (firstErr) {
            logger.warn('Charge retrieve failed for won dispute, retrying once', {
              chargeId: wonChargeId,
              disputeId: dispute.id,
              detail: firstErr instanceof Error ? firstErr.message : 'unknown',
            });
            // Retry once before giving up — a transient Stripe outage must not
            // silently drop license restoration for a customer who won their dispute.
            try {
              const charge = await stripe.charges.retrieve(wonChargeId);
              wonCustomerId = resolveCustomerId(charge.customer);
            } catch (retryErr) {
              logger.error('Charge retrieve failed after retry for won dispute', undefined, {
                chargeId: wonChargeId,
                disputeId: dispute.id,
                detail: retryErr instanceof Error ? retryErr.message : 'unknown',
              });
              // Record an audit trail so the operations team can manually restore this license.
              // Do NOT break silently — the audit entry ensures the failure is visible.
              auditLicenseEvent(db, 'license.restoration_failed.dispute_won', 'critical', {
                disputeId: dispute.id,
                chargeId: wonChargeId,
                reason: 'stripe_charge_retrieve_failed_after_retry',
                detail: retryErr instanceof Error ? retryErr.message : 'unknown',
              });
              break;
            }
          }

          if (wonCustomerId) {
            // Restore revoked licenses for this customer
            await db
              .update(licenses)
              .set({ status: 'active', updatedAt: new Date() })
              .where(and(eq(licenses.customerId, wonCustomerId), eq(licenses.status, 'revoked')));

            await syncHostedSubscriptionState(db, {
              customerId: wonCustomerId,
              subscriptionId: null,
              status: 'active',
            });

            resetLicenseState();
            resetDbStatusCache();

            logger.info('License restored: dispute won', {
              customerId: wonCustomerId,
              chargeId: wonChargeId,
              disputeId: dispute.id,
              disputeStatus: dispute.status,
            });
            auditLicenseEvent(db, 'license.restored.dispute_won', 'info', {
              customerId: wonCustomerId,
              chargeId: wonChargeId,
              disputeId: dispute.id,
            });
          }
          break;
        }

        if (dispute.status !== 'lost') break;

        // A chargeback was decided against us. Revoke the customer's license
        // immediately to prevent continued access after the disputed payment
        // is returned to the cardholder.
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;

        // Retrieve the charge to resolve the customer ID
        let disputeCustomerId: string | null = null;
        try {
          const charge = await stripe.charges.retrieve(chargeId);
          disputeCustomerId = resolveCustomerId(charge.customer);
        } catch (err) {
          logger.error('Failed to retrieve charge for lost dispute', undefined, {
            chargeId,
            disputeId: dispute.id,
            detail: err instanceof Error ? err.message : 'unknown',
          });
          // Throw so Stripe retries — lost-dispute revocation must not be silently skipped
          throw new Error(`Failed to retrieve charge ${chargeId} for dispute ${dispute.id}`);
        }

        if (!disputeCustomerId) {
          logger.warn('Dispute charge has no customer — cannot revoke license', {
            chargeId,
            disputeId: dispute.id,
          });
          break;
        }

        // Revoke all licenses for this customer
        await db
          .update(licenses)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(licenses.customerId, disputeCustomerId));

        await syncHostedSubscriptionState(db, {
          customerId: disputeCustomerId,
          subscriptionId: null,
          status: 'revoked',
        });

        resetLicenseState();
        resetDbStatusCache();

        logger.warn('License revoked: chargeback dispute lost', {
          customerId: disputeCustomerId,
          chargeId,
          disputeId: dispute.id,
          amount: dispute.amount,
        });
        auditLicenseEvent(db, 'license.revoked.chargeback', 'critical', {
          customerId: disputeCustomerId,
          chargeId,
          disputeId: dispute.id,
          amount: dispute.amount,
        });

        // Send notification email (best-effort)
        const disputeEmail = await findUserEmailByCustomerId(db, disputeCustomerId);
        if (disputeEmail) {
          sendDisputeLostEmail(disputeEmail).catch((err) => {
            logger.error('Failed to send dispute lost email', undefined, {
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logger.warn('Payment intent failed', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          lastPaymentError: paymentIntent.last_payment_error?.message ?? 'unknown',
        });
        // Stripe retries automatically per the retry schedule — no action required here.
        // Audit for ops visibility.
        auditLicenseEvent(db, 'payment.intent.failed', 'warn', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
        });
        break;
      }

      case 'charge.dispute.created': {
        // A dispute (chargeback) has been opened. Log it for monitoring.
        // We do not revoke the license here — wait for charge.dispute.closed with status 'lost'.
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id;
        logger.warn('Chargeback dispute opened', {
          disputeId: dispute.id,
          chargeId,
          amount: dispute.amount,
          reason: dispute.reason,
        });
        auditLicenseEvent(db, 'license.dispute.opened', 'warn', {
          disputeId: dispute.id,
          chargeId,
          amount: dispute.amount,
        });

        // Notify the customer that a dispute has been opened on their account
        let disputeCreatedCustomerId: string | null = null;
        try {
          const charge = await stripe.charges.retrieve(chargeId);
          disputeCreatedCustomerId = resolveCustomerId(charge.customer);
        } catch {
          // Best-effort — don't fail the webhook if we can't resolve the customer
        }
        if (disputeCreatedCustomerId) {
          const disputeEmail = await findUserEmailByCustomerId(db, disputeCreatedCustomerId);
          if (disputeEmail) {
            sendDisputeReceivedEmail(disputeEmail).catch((err) => {
              logger.error('Failed to send dispute received email', undefined, {
                detail: err instanceof Error ? err.message : 'unknown',
              });
            });
          }
        }
        break;
      }

      case 'charge.refunded': {
        // A charge has been refunded (partial or full). Revoke the customer's license
        // if the refund fully covers the amount — partial refunds leave access intact.
        const charge = event.data.object as Stripe.Charge;
        const customerId = resolveCustomerId(charge.customer);
        if (!customerId) break;

        const isFullRefund = charge.amount_refunded >= charge.amount;

        if (isFullRefund) {
          await db
            .update(licenses)
            .set({ status: 'revoked', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId));

          await syncHostedSubscriptionState(db, {
            customerId,
            subscriptionId: null,
            status: 'revoked',
          });

          resetLicenseState();
          resetDbStatusCache();

          logger.warn('License revoked: full refund issued', {
            customerId,
            chargeId: charge.id,
            amountRefunded: charge.amount_refunded,
            amount: charge.amount,
          });
          auditLicenseEvent(db, 'license.revoked.refund', 'warn', {
            customerId,
            chargeId: charge.id,
            amountRefunded: charge.amount_refunded,
            amount: charge.amount,
          });
        } else {
          logger.info('Partial refund issued — license retained', {
            customerId,
            chargeId: charge.id,
            amountRefunded: charge.amount_refunded,
            amount: charge.amount,
          });
        }

        // Notify customer about the refund (both full and partial)
        const refundEmail = charge.billing_details?.email ?? charge.receipt_email;
        if (refundEmail) {
          sendRefundProcessedEmail(refundEmail, {
            isFullRefund,
            amountRefunded: charge.amount_refunded,
            currency: charge.currency,
          }).catch((err) => {
            logger.warn('Failed to send refund notification email', {
              customerId,
              detail: err instanceof Error ? err.message : 'unknown',
            });
          });
        }
        break;
      }
    }
  } catch (err) {
    await unmarkProcessed(db, event.id);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Webhook handler error', undefined, { detail: msg, eventType: event.type });

    // Fire-and-forget alert to founder — critical for checkout failures where
    // customer has paid but license was not generated.
    const alertEmail = process.env.REVEALUI_ALERT_EMAIL || 'founder@revealui.com';
    sendWebhookFailureAlert(alertEmail, {
      eventId: event.id,
      eventType: event.type,
      error: msg,
      customerId: (() => {
        const obj = event.data.object;
        if ('customer' in obj && obj.customer) {
          return typeof obj.customer === 'string'
            ? obj.customer
            : typeof obj.customer === 'object' && 'id' in obj.customer
              ? obj.customer.id
              : undefined;
        }
        return undefined;
      })(),
    }).catch((alertErr) => {
      logger.error('Failed to send webhook failure alert', undefined, {
        error: alertErr instanceof Error ? alertErr.message : 'unknown',
      });
    });

    return c.json({ error: 'Webhook processing failed' }, 500);
  }

  return c.json({ received: true as const }, 200);
});

export default app;
