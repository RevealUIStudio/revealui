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

import { isFeatureEnabled } from '@revealui/core/features'
import { generateLicenseKey, resetLicenseState } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'
import { DrizzleAuditStore, getClient } from '@revealui/db'
import type { Database } from '@revealui/db/client'
import { licenses, processedWebhookEvents, users } from '@revealui/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import Stripe from 'stripe'

const app = new Hono()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(key)
}

function getWebhookSecret(): string {
  const secret = (
    process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET
  )?.trim()
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be configured')
  }
  return secret
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
    })
    return false // Not a duplicate — insert succeeded
  } catch (err) {
    // Unique constraint violation = already processed.
    // Check PostgreSQL error code '23505' (stable across all pg drivers) in addition
    // to the message, since NeonDB's HTTP driver may format the message differently.
    const pgCode = (err as { code?: string }).code
    if (pgCode === '23505' || (err instanceof Error && err.message.includes('duplicate key'))) {
      return true
    }
    // Any other DB error is unexpected — throw so the caller returns 500 to Stripe.
    // Stripe will retry the event, which is safe because our INSERT is idempotent.
    logger.error('Idempotency check failed — returning 500 to force Stripe retry', undefined, {
      eventId,
      error: err instanceof Error ? err.message : 'unknown',
    })
    throw err
  }
}

function resolveTier(
  metadata: Record<string, string> | null | undefined,
): 'pro' | 'max' | 'enterprise' {
  const tier = metadata?.tier
  if (tier === 'enterprise') return 'enterprise'
  if (tier === 'max') return 'max'
  // Log when falling back to 'pro' due to missing/unknown tier — operators must see this
  // so they can detect misconfigured Stripe metadata before a customer is silently downgraded.
  if (tier !== 'pro') {
    logger.error(
      'resolveTier: unknown or missing tier in Stripe metadata — defaulting to pro',
      undefined,
      {
        tier: tier ?? null,
        metadata: metadata ?? null,
      },
    )
  }
  return 'pro'
}

function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  return customer.id
}

function resolveSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null
  if (typeof subscription === 'string') return subscription
  return subscription.id
}

/**
 * Append a license lifecycle event to the audit log.
 *
 * Enterprise-only (auditLog feature flag). Fire-and-forget — errors are
 * swallowed so that audit failure never blocks the webhook response.
 */
function auditLicenseEvent(
  db: Database,
  eventType: string,
  severity: 'info' | 'warn' | 'critical',
  payload: Record<string, unknown>,
): void {
  if (!isFeatureEnabled('auditLog')) return
  new DrizzleAuditStore(db)
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
        error: err instanceof Error ? err.message : 'unknown',
      })
    })
}

/**
 * Look up user email by Stripe customer ID for sending notification emails.
 */
async function findUserEmailByCustomerId(db: Database, customerId: string): Promise<string | null> {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1)
  return user?.email ?? null
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
])

app.post('/stripe', async (c) => {
  const webhookSecret = getWebhookSecret()
  const stripe = getStripeClient()

  const body = await c.req.text()
  const sig = c.req.header('Stripe-Signature')

  if (!sig) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400)
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook signature verification failed', undefined, { detail: msg })
    return c.json({ error: 'Invalid webhook signature' }, 400)
  }

  if (!relevantEvents.has(event.type)) {
    return c.json({ received: true }, 200)
  }

  // NOTE: We intentionally do NOT enforce a timestamp freshness window here.
  // Replay attacks are prevented by DB-backed idempotency (processedWebhookEvents
  // table, INSERT ON CONFLICT) below. A timestamp window would incorrectly reject
  // Stripe's legitimate 72-hour retry delivery attempts, which carry the original
  // event timestamp. Stripe's own signature verification already enforces a 300s
  // tolerance during constructEvent above.

  const db = getClient()

  // DB-backed idempotency check
  if (await checkAndMarkProcessed(db, event.id, event.type)) {
    return c.json({ received: true, duplicate: true }, 200)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // ── Perpetual (one-time payment) ──────────────────────────────────
        if (session.mode === 'payment') {
          // Only process as perpetual license if RevealUI tier metadata is present.
          // Other payment-mode checkouts (non-RevealUI products) are silently skipped.
          if (!session.metadata?.tier) break

          const customerId = resolveCustomerId(session.customer)
          if (!customerId) break

          const tier = resolveTier(session.metadata)
          const githubUsername = session.metadata?.github_username ?? null

          let resolvedUserId = session.metadata?.revealui_user_id ?? null
          if (!resolvedUserId) {
            const [user] = await db
              .select({ id: users.id })
              .from(users)
              .where(eq(users.stripeCustomerId, customerId))
              .limit(1)
            resolvedUserId = user?.id ?? null
          }

          if (!resolvedUserId) {
            logger.error('CRITICAL: Cannot resolve user for perpetual checkout', undefined, {
              customerId,
            })
            throw new Error(`Cannot resolve user for perpetual checkout (customerId=${customerId})`)
          }

          const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY
          if (!privateKey) {
            logger.error(
              'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — perpetual license not generated',
              undefined,
              { customerId, tier },
            )
            throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured')
          }

          const normalizedKey = privateKey.replace(/\\n/g, '\n')
          // null expiresInSeconds = no exp claim — perpetual license never expires
          const licenseKey = await generateLicenseKey(
            { tier, customerId, perpetual: true },
            normalizedKey,
            null,
          )

          // Support contract expires 1 year from purchase
          const supportExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          const licenseId = crypto.randomUUID()

          await db.transaction(async (tx) => {
            const [userRow] = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.stripeCustomerId, customerId))
              .limit(1)

            if (!userRow) {
              logger.error(
                'Customer has no matching user in DB — perpetual license not created',
                undefined,
                { customerId },
              )
              return
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
            })
          })

          resetLicenseState()

          logger.info('Perpetual license generated and stored', { tier, customerId, licenseId })
          auditLicenseEvent(db, 'license.perpetual.created', 'info', {
            licenseId,
            tier,
            customerId,
            userId: resolvedUserId,
            githubUsername,
          })

          // Best-effort: provision GitHub team access
          if (githubUsername) {
            provisionGitHubAccess(githubUsername).catch((err) => {
              logger.warn('Failed to provision GitHub team access', {
                githubUsername,
                error: err instanceof Error ? err.message : 'unknown',
              })
            })
          }

          // Send perpetual license activation email
          const perpetualEmail =
            session.customer_email ?? (await findUserEmailByCustomerId(db, customerId))
          if (perpetualEmail) {
            sendPerpetualLicenseActivatedEmail(perpetualEmail, tier, supportExpiresAt).catch(
              (err) => {
                logger.warn('Failed to send perpetual license activation email', {
                  error: err instanceof Error ? err.message : 'unknown',
                })
              },
            )
          }

          break
        }

        // ── Subscription ──────────────────────────────────────────────────
        if (session.mode !== 'subscription' || !session.subscription) break

        const customerId = resolveCustomerId(session.customer)
        const subscriptionId = resolveSubscriptionId(session.subscription)
        if (!(customerId && subscriptionId)) break

        const tier = resolveTier(session.metadata)
        const userId = session.metadata?.revealui_user_id ?? null

        // Resolve userId from Stripe customer if not in metadata
        let resolvedUserId = userId
        if (!resolvedUserId) {
          const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1)
          resolvedUserId = user?.id ?? null
        }

        if (!resolvedUserId) {
          logger.error('CRITICAL: Cannot resolve user for checkout', undefined, {
            customerId,
            subscriptionId,
          })
          // Return 500 so Stripe retries — a payment was captured but no license was issued.
          throw new Error(
            `Cannot resolve user for checkout session (customerId=${customerId}, subscriptionId=${subscriptionId})`,
          )
        }

        // Generate license key
        const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY
        if (!privateKey) {
          logger.error(
            'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — license not generated',
            undefined,
            {
              customerId,
              subscriptionId,
              tier,
            },
          )
          // Return 500 so Stripe retries — a payment was captured but no license was issued.
          throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured')
        }

        // Unescape literal \n sequences — Vercel stores multi-line PEM keys
        // with \n escaped in the .env format; the runtime preserves the literal
        // \n chars, so we must convert them to real newlines for jose/importPKCS8.
        const normalizedKey = privateKey.replace(/\\n/g, '\n')
        const licenseKey = await generateLicenseKey({ tier, customerId }, normalizedKey)

        // Retrieve subscription to detect trialing state and trial_end date.
        // All new checkouts start as trialing (7-day trial configured in billing.ts).
        let checkoutSubscription: Stripe.Subscription | null = null
        try {
          checkoutSubscription = await stripe.subscriptions.retrieve(subscriptionId)
        } catch (err) {
          logger.warn('Failed to retrieve subscription status at checkout — defaulting to active', {
            subscriptionId,
            error: err instanceof Error ? err.message : 'unknown',
          })
        }

        const isTrialing = checkoutSubscription?.status === 'trialing'
        const licenseStatus = isTrialing ? 'trialing' : 'active'
        const licenseExpiresAt =
          isTrialing && checkoutSubscription?.trial_end
            ? new Date(checkoutSubscription.trial_end * 1000)
            : null

        // Store license in NeonDB (transactional)
        const licenseId = crypto.randomUUID()
        await db.transaction(async (tx) => {
          // Verify user exists before creating license
          const [userRow] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1)

          if (!userRow) {
            logger.error('Customer has no matching user in DB — license not created', undefined, {
              customerId,
              subscriptionId,
            })
            return
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
          })
        })

        // Invalidate in-process license cache so subsequent requests see the new tier
        resetLicenseState()

        // Best-effort: also store in Stripe subscription metadata for easy retrieval.
        // Non-critical — license is already persisted in NeonDB above.
        try {
          await stripe.subscriptions.update(subscriptionId, {
            metadata: { license_key: licenseKey, license_tier: tier },
          })
        } catch (stripeErr) {
          logger.warn('Failed to write license key to Stripe subscription metadata', {
            subscriptionId,
            error: stripeErr instanceof Error ? stripeErr.message : 'unknown',
          })
        }

        logger.info('License generated and stored', { tier, customerId, licenseId })
        auditLicenseEvent(db, 'license.created', 'info', {
          licenseId,
          tier,
          customerId,
          subscriptionId,
          userId: resolvedUserId,
        })

        // Send license activation email
        const userEmail =
          session.customer_email ?? (await findUserEmailByCustomerId(db, customerId))
        if (userEmail) {
          sendLicenseActivatedEmail(userEmail, tier).catch((err) => {
            logger.warn('Failed to send license activation email', {
              error: err instanceof Error ? err.message : 'unknown',
            })
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)
        if (!customerId) break

        // Revoke all licenses for this customer
        await db
          .update(licenses)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(licenses.customerId, customerId))

        resetLicenseState()

        logger.info('License revoked on subscription deletion', {
          customerId,
          subscriptionId: subscription.id,
        })
        auditLicenseEvent(db, 'license.revoked', 'warn', {
          customerId,
          subscriptionId: subscription.id,
        })
        break
      }

      case 'customer.deleted': {
        // Customer record deleted directly in Stripe (e.g., by an admin or via API).
        // Revoke all associated licenses immediately to prevent continued access.
        const customer = event.data.object as Stripe.Customer
        const customerId = customer.id

        await db
          .update(licenses)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(licenses.customerId, customerId))

        resetLicenseState()

        logger.warn('License revoked: Stripe customer deleted', { customerId })
        auditLicenseEvent(db, 'license.revoked.customer_deleted', 'warn', { customerId })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)
        if (!customerId) break

        // If subscription went past_due or unpaid, mark license as expired
        if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          await db
            .update(licenses)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))

          logger.info('License expired due to payment failure', {
            customerId,
            subscriptionStatus: subscription.status,
          })
          resetLicenseState()
          auditLicenseEvent(db, 'license.expired', 'warn', {
            customerId,
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
          })

          // Send payment failed email
          const email = await findUserEmailByCustomerId(db, customerId)
          if (email) {
            sendPaymentFailedEmail(email).catch((err) => {
              logger.warn('Failed to send payment failed email', {
                error: err instanceof Error ? err.message : 'unknown',
              })
            })
          }
        }

        // If subscription is scheduled for cancellation at period end, stamp the license
        // expiry so it lapses correctly even if the subscription.deleted webhook is delayed
        // or missed. This is belt-and-suspenders alongside the subscription.deleted handler.
        if (
          subscription.status === 'active' &&
          subscription.cancel_at_period_end &&
          subscription.cancel_at
        ) {
          const cancelAt = new Date(subscription.cancel_at * 1000)
          await db
            .update(licenses)
            .set({ expiresAt: cancelAt, updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))

          resetLicenseState()
          logger.info('License expiry set for scheduled downgrade', {
            customerId,
            subscriptionId: subscription.id,
            expiresAt: cancelAt.toISOString(),
          })
          auditLicenseEvent(db, 'license.expiry_scheduled', 'info', {
            customerId,
            subscriptionId: subscription.id,
            expiresAt: cancelAt.toISOString(),
          })
        }

        // If subscription is active, sync tier + status (covers reactivations and tier upgrades).
        if (subscription.status === 'active') {
          const newTier = resolveTier(subscription.metadata as Record<string, string>)
          const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY

          if (!privateKey) {
            logger.error(
              'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — license sync failed',
              undefined,
              { customerId, subscriptionId: subscription.id, tier: newTier },
            )
            throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured')
          }

          const normalizedKey = privateKey.replace(/\\n/g, '\n')
          const licenseKey = await generateLicenseKey({ tier: newTier, customerId }, normalizedKey)
          await db
            .update(licenses)
            .set({ status: 'active', tier: newTier, licenseKey, updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))

          resetLicenseState()
          auditLicenseEvent(db, 'license.reactivated', 'info', {
            customerId,
            subscriptionId: subscription.id,
            tier: newTier,
          })
        }
        break
      }

      case 'customer.subscription.created': {
        // Logged for observability; license generation happens on checkout.session.completed
        const subscription = event.data.object as Stripe.Subscription
        logger.info('Subscription created', {
          customerId: resolveCustomerId(subscription.customer),
          subscriptionId: subscription.id,
          status: subscription.status,
        })
        break
      }

      case 'invoice.payment_succeeded': {
        // Payment recovery — re-activate a license that was expired/revoked due to prior payment failure.
        // Only re-activate if the customer has an active subscription after payment.
        const invoice = event.data.object as Stripe.Invoice
        const customerId = resolveCustomerId(invoice.customer)
        if (!customerId) break

        // Fetch the customer's active subscriptions to confirm payment actually restored access.
        // We don't read invoice.subscription directly — that field is not typed in this SDK version.
        let recoveredSubscription: Stripe.Subscription | null = null
        try {
          const subList = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
          })
          recoveredSubscription = subList.data[0] ?? null
        } catch (err) {
          logger.warn('Failed to list subscriptions for invoice.payment_succeeded', {
            customerId,
            error: err instanceof Error ? err.message : 'unknown',
          })
          break
        }

        if (!recoveredSubscription) break

        const [existingLicense] = await db
          .select({ id: licenses.id, status: licenses.status })
          .from(licenses)
          .where(eq(licenses.customerId, customerId))
          .orderBy(desc(licenses.updatedAt))
          .limit(1)

        if (!existingLicense) break

        // Only re-activate if license was expired/revoked due to payment failure
        if (existingLicense.status !== 'expired' && existingLicense.status !== 'revoked') break

        const recoveredTier = resolveTier(recoveredSubscription.metadata as Record<string, string>)
        const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY

        if (!privateKey) {
          logger.error(
            'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — payment recovery failed',
            undefined,
            { customerId, subscriptionId: recoveredSubscription.id, tier: recoveredTier },
          )
          throw new Error('REVEALUI_LICENSE_PRIVATE_KEY not configured')
        }

        const normalizedKey = privateKey.replace(/\\n/g, '\n')
        const licenseKey = await generateLicenseKey(
          { tier: recoveredTier, customerId },
          normalizedKey,
        )
        await db
          .update(licenses)
          .set({ status: 'active', tier: recoveredTier, licenseKey, updatedAt: new Date() })
          .where(eq(licenses.customerId, customerId))

        resetLicenseState()

        logger.info('License re-activated after payment recovery', {
          customerId,
          subscriptionId: recoveredSubscription.id,
          tier: recoveredTier,
        })
        auditLicenseEvent(db, 'license.reactivated.payment_recovery', 'info', {
          customerId,
          subscriptionId: recoveredSubscription.id,
          tier: recoveredTier,
        })

        const recoveryEmail =
          invoice.customer_email ?? (await findUserEmailByCustomerId(db, customerId))
        if (recoveryEmail) {
          sendPaymentRecoveredEmail(recoveryEmail).catch((err) => {
            logger.warn('Failed to send payment recovered email', {
              error: err instanceof Error ? err.message : 'unknown',
            })
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = resolveCustomerId(invoice.customer)
        if (!customerId) break

        logger.warn('Invoice payment failed', {
          customerId,
          invoiceId: invoice.id,
          attemptCount: invoice.attempt_count,
        })

        // Send payment failed email
        const email = invoice.customer_email ?? (await findUserEmailByCustomerId(db, customerId))
        if (email) {
          sendPaymentFailedEmail(email).catch((err) => {
            logger.warn('Failed to send payment failed email', {
              error: err instanceof Error ? err.message : 'unknown',
            })
          })
        }
        break
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)
        if (!customerId) break

        logger.info('Trial ending soon', {
          customerId,
          subscriptionId: subscription.id,
          trialEnd: subscription.trial_end,
        })

        // Send trial ending reminder email
        const email = await findUserEmailByCustomerId(db, customerId)
        if (email) {
          sendTrialEndingEmail(email, subscription.trial_end).catch((err) => {
            logger.warn('Failed to send trial ending email', {
              error: err instanceof Error ? err.message : 'unknown',
            })
          })
        }
        break
      }

      case 'charge.dispute.closed': {
        // A dispute has been resolved. Only revoke the license if the dispute
        // was lost — won/warning_closed disputes leave the payment intact.
        const dispute = event.data.object as Stripe.Dispute
        if (dispute.status !== 'lost') break

        // A chargeback was decided against us. Revoke the customer's license
        // immediately to prevent continued access after the disputed payment
        // is returned to the cardholder.
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id

        // Retrieve the charge to resolve the customer ID
        let disputeCustomerId: string | null = null
        try {
          const charge = await stripe.charges.retrieve(chargeId)
          disputeCustomerId = resolveCustomerId(charge.customer)
        } catch (err) {
          logger.error('Failed to retrieve charge for lost dispute', undefined, {
            chargeId,
            disputeId: dispute.id,
            error: err instanceof Error ? err.message : 'unknown',
          })
          break
        }

        if (!disputeCustomerId) {
          logger.warn('Dispute charge has no customer — cannot revoke license', {
            chargeId,
            disputeId: dispute.id,
          })
          break
        }

        // Revoke all licenses for this customer
        await db
          .update(licenses)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(licenses.customerId, disputeCustomerId))

        resetLicenseState()

        logger.warn('License revoked: chargeback dispute lost', {
          customerId: disputeCustomerId,
          chargeId,
          disputeId: dispute.id,
          amount: dispute.amount,
        })
        auditLicenseEvent(db, 'license.revoked.chargeback', 'critical', {
          customerId: disputeCustomerId,
          chargeId,
          disputeId: dispute.id,
          amount: dispute.amount,
        })

        // Send notification email (best-effort)
        const disputeEmail = await findUserEmailByCustomerId(db, disputeCustomerId)
        if (disputeEmail) {
          sendDisputeLostEmail(disputeEmail).catch((err) => {
            logger.warn('Failed to send dispute lost email', {
              error: err instanceof Error ? err.message : 'unknown',
            })
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        logger.warn('Payment intent failed', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          lastPaymentError: paymentIntent.last_payment_error?.message ?? 'unknown',
        })
        // Stripe retries automatically per the retry schedule — no action required here.
        // Audit for ops visibility.
        auditLicenseEvent(db, 'payment.intent.failed', 'warn', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
        })
        break
      }

      case 'charge.dispute.created': {
        // A dispute (chargeback) has been opened. Log it for monitoring.
        // We do not revoke the license here — wait for charge.dispute.closed with status 'lost'.
        const dispute = event.data.object as Stripe.Dispute
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
        logger.warn('Chargeback dispute opened', {
          disputeId: dispute.id,
          chargeId,
          amount: dispute.amount,
          reason: dispute.reason,
        })
        auditLicenseEvent(db, 'license.dispute.opened', 'warn', {
          disputeId: dispute.id,
          chargeId,
          amount: dispute.amount,
        })
        break
      }

      case 'charge.refunded': {
        // A charge has been refunded (partial or full). Revoke the customer's license
        // if the refund fully covers the amount — partial refunds leave access intact.
        const charge = event.data.object as Stripe.Charge
        const customerId = resolveCustomerId(charge.customer)
        if (!customerId) break

        const isFullRefund = charge.amount_refunded >= charge.amount

        if (isFullRefund) {
          await db
            .update(licenses)
            .set({ status: 'revoked', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))

          resetLicenseState()

          logger.warn('License revoked: full refund issued', {
            customerId,
            chargeId: charge.id,
            amountRefunded: charge.amount_refunded,
            amount: charge.amount,
          })
          auditLicenseEvent(db, 'license.revoked.refund', 'warn', {
            customerId,
            chargeId: charge.id,
            amountRefunded: charge.amount_refunded,
            amount: charge.amount,
          })
        } else {
          logger.info('Partial refund issued — license retained', {
            customerId,
            chargeId: charge.id,
            amountRefunded: charge.amount_refunded,
            amount: charge.amount,
          })
        }
        break
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook handler error', undefined, { detail: msg, eventType: event.type })
    return c.json({ error: 'Webhook processing failed' }, 500)
  }

  return c.json({ received: true }, 200)
})

// ─── Email Templates ─────────────────────────────────────────────────────────
// These are imported dynamically to avoid coupling the webhook handler
// to the CMS email system at the module level. On Vercel serverless,
// the API and CMS run as separate deployments — the email system may
// not be available. Emails are fire-and-forget with error logging.

function tierLabel(tier: string): string {
  if (tier === 'enterprise') return 'Enterprise'
  if (tier === 'max') return 'Max'
  return 'Pro'
}

async function sendLicenseActivatedEmail(to: string, tier: string): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  const label = tierLabel(tier)
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} license is active`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>License Activated</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Your License is Active</h1>
          <p>Your RevealUI <strong>${label}</strong> license has been activated.</p>
          <p>You now have access to all ${label} features including${tier === 'enterprise' ? ' multi-tenant architecture, white-label branding, SSO, and' : tier === 'max' ? ' AI memory, BYOK server-side, multi-provider AI, audit log, and' : ''} AI agents, advanced sync, and built-in payments.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/admin" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If you have questions, reply to this email or contact ${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI ${label} license is now active. Go to your dashboard to explore your new features.`,
  })
}

async function sendPaymentFailedEmail(to: string): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  const portalUrl = `${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/account/billing`
  await sendEmail({
    to,
    subject: 'Action required: RevealUI payment failed',
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Payment Failed</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626;">Payment Failed</h1>
          <p>We were unable to process your RevealUI subscription payment. Your Pro features may be restricted until payment is resolved.</p>
          <p>Please update your payment method to continue using Pro features:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Update Payment Method
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If you believe this is an error, contact ${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI subscription payment failed. Please update your payment method at ${portalUrl} to continue using Pro features.`,
  })
}

async function sendTrialEndingEmail(to: string, trialEnd: number | null): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  const endDate = trialEnd
    ? new Date(trialEnd * 1000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'soon'
  const portalUrl = `${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/account/billing`
  await sendEmail({
    to,
    subject: 'Your RevealUI Pro trial ends soon',
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Trial Ending</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Your Trial Ends ${endDate}</h1>
          <p>Your RevealUI Pro free trial is ending ${endDate}. After the trial, your subscription will automatically continue at $49/month.</p>
          <p>If you'd like to continue with Pro features, no action is needed — your subscription will start automatically.</p>
          <p>If you'd like to cancel or change your plan, you can do so from your billing page:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Manage Subscription
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Questions? Contact ${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI Pro trial ends ${endDate}. Your subscription will automatically continue at $49/month. Manage your subscription at ${portalUrl}.`,
  })
}

async function sendPaymentRecoveredEmail(to: string): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  const portalUrl = `${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/account/billing`
  await sendEmail({
    to,
    subject: 'Your RevealUI access has been restored',
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Access Restored</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #16a34a;">Payment Received — Access Restored</h1>
          <p>Your RevealUI subscription payment was successfully processed. Your Pro access has been fully restored.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Billing
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If you have questions, contact ${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI payment was received and your access has been restored. Manage your subscription at ${portalUrl}.`,
  })
}

/**
 * Provisions GitHub team membership for a perpetual license holder.
 * Adds the user to RevealUIStudio/revealui-pro-customers so they can access
 * the private Pro packages repo.
 *
 * Requires REVEALUI_GITHUB_TOKEN (fine-grained PAT with org:write:members scope).
 * Best-effort — failure is logged but does not block license activation.
 */
async function provisionGitHubAccess(githubUsername: string): Promise<void> {
  const token = process.env.REVEALUI_GITHUB_TOKEN
  if (!token) {
    logger.warn('REVEALUI_GITHUB_TOKEN not configured — skipping GitHub team provisioning', {
      githubUsername,
    })
    return
  }

  const response = await fetch(
    `https://api.github.com/orgs/RevealUIStudio/teams/revealui-pro-customers/memberships/${githubUsername}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'RevealUI-License-Server/1.0',
      },
      body: JSON.stringify({ role: 'member' }),
    },
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`GitHub API error: ${response.status} ${body}`)
  }

  logger.info('GitHub team access provisioned', { githubUsername })
}

async function sendPerpetualLicenseActivatedEmail(
  to: string,
  tier: string,
  supportExpiresAt: Date,
): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  const label = tierLabel(tier)
  const supportExpiry = supportExpiresAt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const portalUrl = `${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/account/billing`
  await sendEmail({
    to,
    subject: `Your RevealUI ${label} Perpetual License is ready`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Perpetual License Activated</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Your Perpetual License is Active</h1>
          <p>Thank you for purchasing RevealUI <strong>${label} Perpetual</strong>. Your license never expires.</p>
          <p>Your purchase includes <strong>1 year of support</strong> (until ${supportExpiry}). You'll receive a reminder 30 days before it lapses.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Your License
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">Questions? Reply to this email or contact ${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI ${label} Perpetual License is now active. The license never expires. Your 1-year support contract runs until ${supportExpiry}. View your license at ${portalUrl}.`,
  })
}

async function sendDisputeLostEmail(to: string): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  const portalUrl = `${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/account/billing`
  await sendEmail({
    to,
    subject: 'Your RevealUI license has been suspended',
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>License Suspended</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc2626;">License Suspended</h1>
          <p>Your RevealUI Pro/Enterprise license has been suspended following a chargeback decision on a recent payment.</p>
          <p>To restore access, please contact us at <a href="mailto:${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}">${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'}</a> to resolve the dispute and arrange a new payment.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Manage Billing
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If you believe this is an error, please reply to this email immediately.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI Pro/Enterprise license has been suspended following a chargeback decision. Contact ${process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com'} to resolve this. Manage your billing at ${portalUrl}.`,
  })
}

export default app
