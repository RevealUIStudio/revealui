/**
 * Stripe Webhook Handler  -  NeonDB-native
 *
 * Replaces the Supabase-dependent webhook in packages/services.
 * Writes license records to the NeonDB licenses table via Drizzle,
 * handles subscription lifecycle events, and triggers license revocation.
 *
 * Idempotency is DB-backed via processed_webhook_events table to prevent
 * duplicate processing across Vercel multi-region deployments.
 */

import { ensureAccountOwnerPlatformAdmin } from '@revealui/auth/server';
import {
  coversRenewalBound,
  readLicenseExp,
  resetLicenseState,
  subscriptionExpBound,
  subscriptionLicenseExpiresInSeconds,
} from '@revealui/core/license';
import {
  canMintLicense,
  mintConfigMissingMessage,
  mintLicenseKey,
} from '@revealui/core/license/mint-client';
import { logger } from '@revealui/core/observability/logger';
import type { Database } from '@revealui/db/client';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  accounts,
  licenses,
  processedWebhookEvents,
  unreconciledWebhooks,
  users,
} from '@revealui/db/schema';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import type Stripe from 'stripe';
import { createAuditStore } from '../../lib/audit-signer.js';
import { capResourcesOnDowngrade, isDowngrade } from '../../lib/downgrade-cap.js';
import {
  buildHostedEntitlementValues,
  coerceHostedTier,
  type HostedTier,
} from '../../lib/hosted-entitlement.js';
import { assertSeatAvailable } from '../../lib/seat-count-guard.js';
import { getServices, type ProtectedStripe } from '../../lib/services-loader.js';
import { getHostedLimitsForTier } from '../../lib/tier-limits.js';
import { sendTierFallbackAlert } from '../../lib/webhook-emails.js';
import { resetDbStatusCache } from '../../middleware/license.js';

type DbExecutor = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * GAP-131: All Stripe access goes through the shared `protectedStripe`
 * wrapper from `@revealui/services` (DB-backed circuit breaker, retry,
 * single API-version pin). The wrapper's `.webhooks` getter exposes the
 * raw Stripe webhooks object for signature verification — that operation
 * is offline (HMAC verify) and does not need breaker protection.
 *
 * Lazy-loads the package per the optional-peer Pro boundary (8c19db537).
 * Throws when unavailable so the webhook handler can return 503.
 */
export async function getStripeClient(): Promise<ProtectedStripe> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  const services = await getServices();
  if (!services) {
    throw new Error('@revealui/services not installed');
  }
  return services.protectedStripe;
}

/**
 * Returns the active webhook secret pair for signature verification.
 *
 * `primary` is the current secret (must be set or boot fails).
 * `secondary` is an optional transitional secret that supports zero-downtime
 * webhook secret rotation: during a rotation window both secrets are valid
 * verifiers. The signature handler tries `primary` first, falls back to
 * `secondary` on auth-tag mismatch, and logs a warning when the fallback
 * succeeds so operators can confirm the rotation transition is in flight.
 *
 * Operator flow:
 *   1. Add new secret in Stripe Dashboard ("Roll secret"). Get the new value.
 *   2. Set `STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS` to the OLD secret value.
 *   3. Set `STRIPE_WEBHOOK_SECRET_LIVE` to the NEW secret value.
 *   4. Wait for the rotation overlap window (24h is Stripe's default).
 *   5. Unset `STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS`.
 */
export function getWebhookSecret(): { primary: string; secondary?: string } {
  const primary = (
    process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET
  )?.trim();
  if (!primary) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be configured');
  }
  const secondary = process.env.STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS?.trim() || undefined;
  return { primary, secondary };
}

/**
 * A 'processing' row older than this is treated as a crashed prior attempt and
 * may be reclaimed + retried. Must comfortably exceed the worst-case handler
 * runtime (Stripe API round-trips) so a slow-but-live attempt is never reclaimed
 * out from under itself, yet sit well under Stripe's ~72h retry horizon so a
 * crashed event is reclaimed on a later delivery.
 */
export const WEBHOOK_RECLAIM_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export type ClaimResult = 'claimed' | 'duplicate';

/**
 * Claim a Stripe event for processing (claim/complete idempotency).
 *
 * - New event → insert a 'processing' row → 'claimed'.
 * - Existing 'completed' → genuine duplicate → 'duplicate'.
 * - Existing 'processing' + recent → another delivery is in flight → 'duplicate'
 *   (don't double-process concurrently; a later retry reclaims it if it crashed).
 * - Existing 'processing' + stale (older than the reclaim window) → the prior
 *   attempt crashed before completing → atomically re-claim → 'claimed'.
 *
 * Replaces the legacy mark-first design, where an uncaught crash/timeout after
 * the marker INSERT but before side effects left a permanent dedup marker that
 * silently dropped a paid event. Pairs with markCompleted() and idempotent
 * side-effect handlers so a reclaimed reprocess never double-issues.
 */
export async function claimEvent(
  db: Database,
  eventId: string,
  eventType: string,
): Promise<ClaimResult> {
  const now = new Date();
  try {
    await db.insert(processedWebhookEvents).values({
      id: eventId,
      eventType,
      status: 'processing',
      claimedAt: now,
      processedAt: now,
    });
    return 'claimed';
  } catch (err) {
    // Check PostgreSQL '23505' (stable across drivers) plus the message, since
    // NeonDB's HTTP driver formats messages differently. Drizzle wraps driver
    // errors  -  check both err and err.cause.
    const pgCode =
      (err as { code?: string }).code ?? (err as { cause?: { code?: string } }).cause?.code;
    const errMsg = err instanceof Error ? err.message : '';
    const causeMsg =
      (err as { cause?: Error }).cause instanceof Error
        ? (err as { cause: Error }).cause.message
        : '';
    const isConflict =
      pgCode === '23505' || errMsg.includes('duplicate key') || causeMsg.includes('duplicate key');
    if (!isConflict) {
      // Unexpected DB error  -  throw so the caller returns 500 and Stripe retries.
      logger.error('Idempotency claim failed  -  returning 500 to force Stripe retry', undefined, {
        eventId,
        detail: errMsg || 'unknown',
      });
      throw err;
    }

    // A row already exists  -  decide based on its state.
    const [existing] = await db
      .select({
        status: processedWebhookEvents.status,
        claimedAt: processedWebhookEvents.claimedAt,
      })
      .from(processedWebhookEvents)
      .where(eq(processedWebhookEvents.id, eventId))
      .limit(1);

    if (!existing || existing.status === 'completed') {
      return 'duplicate';
    }

    const staleBefore = new Date(now.getTime() - WEBHOOK_RECLAIM_WINDOW_MS);
    if (existing.claimedAt > staleBefore) {
      // Recent 'processing'  -  another delivery is in flight; don't reprocess now.
      return 'duplicate';
    }

    // Stale 'processing'  -  the prior attempt crashed. Atomically reclaim so
    // only one concurrent delivery wins the conditional update.
    const reclaimed = await db
      .update(processedWebhookEvents)
      .set({ claimedAt: now })
      .where(
        and(
          eq(processedWebhookEvents.id, eventId),
          eq(processedWebhookEvents.status, 'processing'),
          lt(processedWebhookEvents.claimedAt, staleBefore),
        ),
      )
      .returning();

    if (reclaimed.length > 0) {
      logger.warn('Reclaimed a stale in-progress webhook (prior attempt likely crashed)', {
        eventId,
        eventType,
      });
      return 'claimed';
    }
    // Another instance reclaimed it first.
    return 'duplicate';
  }
}

/**
 * Mark a claimed event 'completed' once ALL side effects have run. Until this
 * commits, the row stays 'processing' and an uncaught crash/timeout leaves it
 * reclaimable rather than a permanent dedup marker.
 */
export async function markCompleted(db: Database, eventId: string): Promise<void> {
  await db
    .update(processedWebhookEvents)
    .set({ status: 'completed', processedAt: new Date() })
    .where(eq(processedWebhookEvents.id, eventId));
}

/**
 * R5-C1 fix: retry idempotency marker cleanup with backoff.
 * If cleanup fails after retries, log at critical level so Stripe retries
 * don't silently skip the event.
 */
export async function unmarkProcessed(db: Database, eventId: string): Promise<boolean> {
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

export function resolveTier(
  metadata: Record<string, string> | null | undefined,
): 'pro' | 'max' | 'enterprise' {
  const tier = metadata?.tier;
  if (tier === 'pro') return 'pro';
  if (tier === 'max') return 'max';
  if (tier === 'enterprise') return 'enterprise';
  // ALERT: missing or unknown tier metadata  -  this indicates a Stripe product misconfiguration.
  // Reject the event so Stripe retries. Do NOT default to 'pro'  -  that gives away a paid tier.
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

export function resolveOptionalTier(
  metadata: Record<string, string> | null | undefined,
  context?: string,
): 'pro' | 'max' | 'enterprise' | undefined {
  const tier = metadata?.tier;
  if (tier === 'pro') return 'pro';
  if (tier === 'max') return 'max';
  if (tier === 'enterprise') return 'enterprise';
  if (tier) {
    logger.warn(
      'Stripe subscription metadata had an unknown tier during hosted status sync  -  preserving existing tier',
      {
        tier,
        metadata,
        context,
      },
    );
  } else if (metadata) {
    // Metadata exists but tier key is absent  -  Stripe product misconfiguration.
    // F3: an unresolvable tier is NOT defaulted. syncHostedSubscriptionState
    // skips the entitlement write, logs at ERROR, and records an
    // `entitlement.unresolved-tier` row for the drainer. Nothing defaults to pro.
    logger.warn('Stripe metadata missing tier key  -  entitlement write will be skipped', {
      metadataKeys: Object.keys(metadata),
      context,
    });
  }
  return undefined;
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
export function getSubscriptionPeriodDate(
  subscription: Stripe.Subscription,
  field: 'current_period_start' | 'current_period_end',
): Date | null {
  // Stripe SDK v20 moved period dates from Subscription to SubscriptionItem
  const item = subscription.items?.data?.[0];
  if (!item) return null;
  const value = item[field];
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

/** Narrows a stored `licenses.tier` string to the mintable license tiers. */
export function asMintableTier(value: string): 'pro' | 'max' | 'enterprise' | null {
  return value === 'pro' || value === 'max' || value === 'enterprise' ? value : null;
}

/**
 * GAP-287 PR-2 renewal cadence. On `invoice.payment_succeeded` for a healthy,
 * already-active hosted subscription license, advances the key's `exp` to the
 * new billing period (`period_end + RENEWAL_SLACK`). A period-bound token would
 * otherwise lapse mid-subscription: the renewal invoice is the billing-cycle
 * signal that must extend it.
 *
 * Idempotent, extending the WH-2 anti-churn discipline into the exp dimension:
 * re-mint IFF the stored key's exp is below the new bound, SKIP otherwise — so a
 * duplicate/retried delivery re-derives the same decision and does nothing. Only
 * touches an ACTIVE row scoped to this (customer, subscription); perpetual rows
 * carry a null `subscriptionId` and never match, so they are untouched. The
 * row's stored tier is authoritative here — a renewal never changes tier. No-op
 * when the private key is unset (the checkout/recovery paths already surface
 * that as a loud CRITICAL) or no matching active row exists.
 */
export async function remintSubscriptionLicenseOnRenewal(
  db: Database,
  params: {
    customerId: string;
    subscriptionId: string;
    periodEnd: Date;
    eventCreatedSeconds: number;
  },
): Promise<void> {
  const filter = and(
    eq(licenses.customerId, params.customerId),
    eq(licenses.subscriptionId, params.subscriptionId),
    isNull(licenses.deletedAt),
  );

  const [row] = await db
    .select({ status: licenses.status, tier: licenses.tier, licenseKey: licenses.licenseKey })
    .from(licenses)
    .where(filter)
    .limit(1);
  if (row?.status !== 'active') return;

  const tier = asMintableTier(row.tier);
  if (!tier) return;

  // Idempotency pin (the WH-2 property, now covering renewals): skip when the
  // stored key's exp already reaches the new bound, within the 1s flooring
  // tolerance documented on coversRenewalBound (fast-follow, #1978 verdict).
  const newBound = subscriptionExpBound(params.periodEnd);
  const storedExp = await readLicenseExp(row.licenseKey);
  if (coversRenewalBound(storedExp, newBound)) return;

  if (!canMintLicense()) {
    logger.error(`CRITICAL: ${mintConfigMissingMessage()}  -  renewal re-mint skipped`, undefined, {
      customerId: params.customerId,
      subscriptionId: params.subscriptionId,
    });
    return;
  }

  // GAP-260 P4-3: mintLicenseKey routes to license-signer when
  // REVEALUI_LICENSE_SIGN_VIA_SIGNER is set; otherwise local private key.
  const licenseKey = await mintLicenseKey({
    tier,
    customerId: params.customerId,
    expiresInSeconds: subscriptionLicenseExpiresInSeconds(params.periodEnd),
  });

  // WH-3-shaped monotonic guard: a stale (out-of-order) invoice must not clobber
  // newer state. When the row's updatedAt is already at/after this event, the
  // write affects 0 rows and the newer key stands.
  await db
    .update(licenses)
    .set({ licenseKey, updatedAt: new Date() })
    .where(and(filter, lt(licenses.updatedAt, new Date((params.eventCreatedSeconds + 1) * 1000))));

  resetLicenseState();
  resetDbStatusCache();
  logger.info('License re-minted on renewal — exp advanced to new billing period', {
    customerId: params.customerId,
    subscriptionId: params.subscriptionId,
  });
}

export function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id;
}

export function resolveSubscriptionId(
  subscription: string | Stripe.Subscription | null,
): string | null {
  if (!subscription) return null;
  if (typeof subscription === 'string') return subscription;
  return subscription.id;
}

export function buildAccountSlug(userId: string): string {
  const lower = userId.toLowerCase();
  const chars: string[] = [];
  let lastWasDash = false;
  for (let i = 0; i < lower.length; i++) {
    const code = lower.charCodeAt(i);
    const isAlphaNum =
      (code >= 97 && code <= 122) || // a-z
      (code >= 48 && code <= 57); // 0-9
    if (isAlphaNum) {
      chars.push(lower[i]);
      lastWasDash = false;
    } else if (!lastWasDash && chars.length > 0) {
      chars.push('-');
      lastWasDash = true;
    }
  }
  // Trim trailing dash
  const slug = lastWasDash ? chars.slice(0, -1).join('') : chars.join('');
  return `acct-${slug.slice(0, 32)}`;
}

export async function ensureHostedAccount(
  tx: DbExecutor,
  userId: string,
  customerId: string,
  maxUsers?: number | null,
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

  await assertSeatAvailable(tx, accountId, maxUsers ?? null);
  await tx.insert(accountMemberships).values({
    id: crypto.randomUUID(),
    accountId,
    userId,
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Account owner → platform shell admin (not super-admin). Same rule as
  // signup personal-account provision (packages/auth platform-roles).
  await ensureAccountOwnerPlatformAdmin(tx as Database, userId);

  logger.info('Hosted billing account created from Stripe webhook', {
    accountId,
    userId,
    customerId,
  });

  return accountId;
}

export async function resolveHostedAccountId(
  db: DbExecutor,
  customerId: string,
  userId?: string | null,
  maxUsers?: number | null,
): Promise<string | null> {
  if (userId) {
    const accountId = await ensureHostedAccount(db, userId, customerId, maxUsers);
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
  return ensureHostedAccount(db, user.id, customerId, maxUsers);
}

/**
 * Sync hosted subscription and entitlement state in the database.
 *
 * This function performs multiple DB writes (account resolution/creation,
 * subscription upsert, entitlement upsert). When called inside a
 * db.transaction() callback, all writes are atomic. When called with a
 * bare db client (NeonDB HTTP), the writes are NOT atomic  -  callers in
 * that scenario rely on Stripe's idempotent webhook retries to converge
 * state after partial failures.
 */
export async function syncHostedSubscriptionState(
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
    /** WH-3: Stripe event creation timestamp (`event.created`). When provided,
     *  each table's UPDATE is guarded per-row with
     *  `WHERE last_event_at IS NULL OR last_event_at < eventTimestamp` so an
     *  out-of-order delivery cannot overwrite state written by a newer event.
     *  The comparison is event-to-event (both sides are Stripe timestamps), not
     *  wall-clock-to-event; `updated_at` stays bookkeeping-only. Callers that
     *  omit this keep unconditional-apply behavior. */
    eventTimestamp?: Date;
    /** Stripe billing mode of the event. Prevents test-era rows granting live access. */
    mode: 'live' | 'test';
  },
): Promise<void> {
  const maxUsers = params.tier ? (getHostedLimitsForTier(params.tier).maxUsers ?? null) : null;
  const accountId = await resolveHostedAccountId(
    db,
    params.customerId,
    params.userId ?? null,
    maxUsers,
  );
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
    .select({
      id: accountSubscriptions.id,
      planId: accountSubscriptions.planId,
      lastEventAt: accountSubscriptions.lastEventAt,
    })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.accountId, accountId))
    .limit(1);

  const [existingEntitlement] = await db
    .select({
      accountId: accountEntitlements.accountId,
      tier: accountEntitlements.tier,
      lastEventAt: accountEntitlements.lastEventAt,
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);

  // F3 (D4): resolve the tier WITHOUT a 'free' fallback. A null result means no
  // caller-supplied tier and no existing entitlement/subscription tier, i.e. the
  // tier is unknown. Writing 'free' from that ignorance is a silent downgrade;
  // the entitlement write below is skipped and alerted instead.
  const resolvedTier =
    params.tier ??
    coerceHostedTier(existingEntitlement?.tier) ??
    coerceHostedTier(existingSubscription?.planId) ??
    null;

  // The subscription row is not the access gate; keep the prior 'free' fallback
  // so an unknown-tier subscription is still recorded for the reconcile cron.
  const subscriptionTier: HostedTier = resolvedTier ?? 'free';

  const subscriptionValues = {
    accountId,
    stripeCustomerId: params.customerId,
    stripeSubscriptionId: params.subscriptionId,
    planId: subscriptionTier,
    status: params.status,
    currentPeriodStart: params.currentPeriodStart ?? null,
    currentPeriodEnd: params.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? false,
    mode: params.mode,
    lastEventAt: params.eventTimestamp ?? null,
    updatedAt: now,
  };

  // F2 (D2): the staleness guard is per-table and event-to-event. A skipped
  // subscription UPDATE must NOT skip the entitlement write, so each table
  // guards and reports independently (no shared early return). NULL last_event_at
  // always passes; a strictly-older event is skipped for that row only.
  if (existingSubscription?.id) {
    const subWhere = params.eventTimestamp
      ? and(
          eq(accountSubscriptions.id, existingSubscription.id),
          or(
            isNull(accountSubscriptions.lastEventAt),
            lt(accountSubscriptions.lastEventAt, params.eventTimestamp),
          ),
        )
      : eq(accountSubscriptions.id, existingSubscription.id);

    const subResult = await db.update(accountSubscriptions).set(subscriptionValues).where(subWhere);

    if (params.eventTimestamp && (subResult as { rowCount?: number }).rowCount === 0) {
      logger.info('Stale webhook skipped for accountSubscriptions — newer state already applied', {
        accountId,
        subscriptionId: params.subscriptionId,
        eventTimestamp: params.eventTimestamp.toISOString(),
      });
    }
  } else {
    // INSERT-when-missing runs regardless of the guard.
    await db.insert(accountSubscriptions).values({
      id: crypto.randomUUID(),
      ...subscriptionValues,
      createdAt: now,
    });
  }

  // F3 (D4): never write a 'free' entitlement from ignorance. When the tier is
  // unknown, skip the entitlement write entirely, log at ERROR, and record an
  // idempotent unreconciled-webhook row (retries collide on the synthetic
  // event_id) so the drainer/owner can reconcile. Explicit downgrade paths pass
  // a concrete status against an existing tier, so they resolve above and are
  // unaffected.
  if (resolvedTier === null) {
    logger.error(
      'Hosted entitlement write skipped: tier unresolvable (no event tier, no existing entitlement/subscription tier) — refusing to write a free entitlement from ignorance',
      undefined,
      {
        accountId,
        customerId: params.customerId,
        subscriptionId: params.subscriptionId,
        status: params.status,
      },
    );
    try {
      await db
        .insert(unreconciledWebhooks)
        .values({
          eventId: `entitlement-unresolved-tier:${accountId}`,
          eventType: 'entitlement.unresolved-tier',
          customerId: params.customerId,
          stripeObjectId: params.subscriptionId ?? null,
          objectType: 'subscription',
          errorTrace:
            `Entitlement tier unresolvable for account ${accountId} ` +
            `(customer ${params.customerId}, status ${params.status}): no tier on the webhook, ` +
            'entitlement, or subscription. Entitlement write skipped to avoid a silent downgrade ' +
            'to free. Remedy: fix the Stripe product/price tier metadata and resend the event.',
        })
        .onConflictDoNothing();
    } catch (insertErr) {
      logger.error('Failed to record unresolved-tier entitlement for reconciliation', undefined, {
        accountId,
        detail: insertErr instanceof Error ? insertErr.message : 'unknown',
      });
    }
    return;
  }

  // Shared with the entitlement-consistency reconciler (lib/hosted-entitlement.ts)
  // so a healed row and a webhook-written row can never grant different features
  // for the same tier.
  const entitlementValues = buildHostedEntitlementValues({
    tier: resolvedTier,
    status: params.status,
    mode: params.mode,
    graceUntil: params.graceUntil ?? null,
    lastEventAt: params.eventTimestamp ?? null,
    now,
    source: 'stripe',
  });

  let entitlementApplied = false;
  if (existingEntitlement?.accountId) {
    const entWhere = params.eventTimestamp
      ? and(
          eq(accountEntitlements.accountId, accountId),
          or(
            isNull(accountEntitlements.lastEventAt),
            lt(accountEntitlements.lastEventAt, params.eventTimestamp),
          ),
        )
      : eq(accountEntitlements.accountId, accountId);

    const entResult = await db.update(accountEntitlements).set(entitlementValues).where(entWhere);
    if (params.eventTimestamp && (entResult as { rowCount?: number }).rowCount === 0) {
      logger.info('Stale webhook skipped for accountEntitlements — newer state already applied', {
        accountId,
        subscriptionId: params.subscriptionId,
        eventTimestamp: params.eventTimestamp.toISOString(),
      });
    } else {
      entitlementApplied = true;
    }
  } else {
    // INSERT-when-missing runs regardless of the guard.
    await db.insert(accountEntitlements).values({
      accountId,
      ...entitlementValues,
    });
    entitlementApplied = true;
  }

  // GAP-105 M-03: Proactive resource capping on downgrade. Gated on an applied
  // entitlement write so a stale-skipped downgrade event never caps resources.
  const oldTier = (existingEntitlement?.tier as 'free' | 'pro' | 'max' | 'enterprise') ?? 'free';
  if (entitlementApplied && isDowngrade(oldTier, resolvedTier)) {
    // GAP-141 resilience: try/catch around cap so a transient throw (DB blip,
    // network glitch) does NOT propagate up. The entitlement upsert above has
    // ALREADY committed when the cap runs — propagating an error would cause
    // the calling saga to compensate the entitlement (roll tier back to old),
    // which is the wrong rollback semantics. The customer's billing state IS
    // the new tier; what failed is the resource cleanup. Next sync (Stripe
    // retry / GAP-142 15-min cron / admin re-trigger) re-runs idempotently
    // and the cap converges. v0.4.x follow-up (GAP-141 Phase 1): hoist into a
    // saga step so failures land in unreconciledWebhooks for drainer pickup.
    try {
      const capResult = await capResourcesOnDowngrade(db, accountId, oldTier, resolvedTier);
      if (capResult.capped) {
        logger.info('Downgrade resource capping applied', {
          accountId,
          oldTier,
          newTier: resolvedTier,
          sitesArchived: capResult.sitesArchived,
          membershipsRevoked: capResult.membershipsRevoked,
        });
      }
    } catch (capErr) {
      logger.error(
        'Downgrade resource capping failed; entitlement advanced but resources NOT capped. Convergence relies on next sync (Stripe retry / GAP-142 reconciliation cron / admin re-trigger).',
        capErr instanceof Error ? capErr : new Error(String(capErr)),
        {
          accountId,
          oldTier,
          newTier: resolvedTier,
          // searchable tag for ops alarms in log aggregation
          alertTag: 'cap.failed',
        },
      );
    }
  }
}

/**
 * Append a license lifecycle event to the audit log.
 *
 * License lifecycle events are always audited for compliance.
 * The isFeatureEnabled('auditLog') gate controls UI access to audit data,
 * not collection. Fire-and-forget  -  errors are swallowed so that audit
 * failure never blocks the webhook response.
 */
export function auditLicenseEvent(
  db: Database | Parameters<Parameters<Database['transaction']>[0]>[0],
  eventType: string,
  severity: 'info' | 'warn' | 'critical',
  payload: Record<string, unknown>,
): void {
  createAuditStore(db as Database)
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
export async function findUserEmailByCustomerId(
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

export async function findHostedStatusByCustomerId(
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

/**
 * Resolve the Stripe subscription ID backing a charge, via the
 * Charge → Invoice → Subscription chain. Returns null when the charge is not
 * invoice-backed (a one-time perpetual or credit-bundle purchase) or the chain
 * cannot be resolved. Used to scope refund / chargeback license revocation to
 * the affected subscription instead of revoking every license the customer
 * holds.
 *
 * charge.invoice exists at runtime for invoice-backed charges but is not in the
 * SDK type — cast through unknown to read it (same SDK-typing gap as elsewhere
 * in this file). Stripe SDK v20 moved the subscription field to
 * invoice.parent.subscription_details.subscription.
 */
export async function resolveSubscriptionIdFromCharge(
  stripe: ProtectedStripe,
  charge: Stripe.Charge,
): Promise<string | null> {
  const chargeInvoice = (charge as unknown as { invoice?: string | { id: string } | null }).invoice;
  const invoiceId = typeof chargeInvoice === 'string' ? chargeInvoice : (chargeInvoice?.id ?? null);
  if (!invoiceId) return null;
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId);
    const field = invoice.parent?.subscription_details?.subscription;
    return typeof field === 'string' ? field : (field?.id ?? null);
  } catch (err) {
    logger.warn('Failed to resolve subscription from charge invoice', {
      chargeId: charge.id,
      invoiceId,
      detail: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}
