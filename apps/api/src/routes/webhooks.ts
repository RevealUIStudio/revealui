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
import { eq } from 'drizzle-orm'
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
    // Unique constraint violation = already processed
    if (err instanceof Error && err.message.includes('duplicate key')) {
      return true
    }
    // For any other DB error, log and allow processing (fail open for webhooks)
    logger.warn('Idempotency check failed, allowing event processing', {
      eventId,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return false
  }
}

function resolveTier(metadata: Record<string, string> | null | undefined): 'pro' | 'enterprise' {
  const tier = metadata?.tier
  if (tier === 'enterprise') return 'enterprise'
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
  'invoice.payment_failed',
  'customer.subscription.trial_will_end',
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

  const db = getClient()

  // DB-backed idempotency check
  if (await checkAndMarkProcessed(db, event.id, event.type)) {
    return c.json({ received: true, duplicate: true }, 200)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
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
          break
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
          break
        }

        // Unescape literal \n sequences — Vercel stores multi-line PEM keys
        // with \n escaped in the .env format; the runtime preserves the literal
        // \n chars, so we must convert them to real newlines for jose/importPKCS8.
        const normalizedKey = privateKey.replace(/\\n/g, '\n')
        const licenseKey = await generateLicenseKey({ tier, customerId }, normalizedKey)

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
            status: 'active',
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

        // If subscription is active, sync tier + status (covers reactivations and tier upgrades).
        if (subscription.status === 'active') {
          const newTier = resolveTier(subscription.metadata as Record<string, string>)
          const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY

          if (privateKey) {
            const normalizedKey = privateKey.replace(/\\n/g, '\n')
            const licenseKey = await generateLicenseKey(
              { tier: newTier, customerId },
              normalizedKey,
            )
            await db
              .update(licenses)
              .set({ status: 'active', tier: newTier, licenseKey, updatedAt: new Date() })
              .where(eq(licenses.customerId, customerId))
          } else {
            await db
              .update(licenses)
              .set({ status: 'active', tier: newTier, updatedAt: new Date() })
              .where(eq(licenses.customerId, customerId))
          }

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

async function sendLicenseActivatedEmail(to: string, tier: string): Promise<void> {
  const { sendEmail } = await import('../lib/email.js')
  await sendEmail({
    to,
    subject: `Your RevealUI ${tier === 'enterprise' ? 'Enterprise' : 'Pro'} license is active`,
    html: `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>License Activated</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Your License is Active</h1>
          <p>Your RevealUI <strong>${tier === 'enterprise' ? 'Enterprise' : 'Pro'}</strong> license has been activated.</p>
          <p>You now have access to all ${tier === 'enterprise' ? 'Enterprise' : 'Pro'} features including${tier === 'enterprise' ? ' multi-tenant architecture, white-label branding, SSO, and' : ''} AI agents, advanced sync, and built-in payments.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://cms.revealui.com'}/admin" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">If you have questions, reply to this email or contact founder@revealui.com.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI ${tier === 'enterprise' ? 'Enterprise' : 'Pro'} license is now active. Go to your dashboard to explore your new features.`,
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
          <p style="color: #666; font-size: 14px;">If you believe this is an error, contact founder@revealui.com.</p>
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
          <p style="color: #666; font-size: 14px;">Questions? Contact founder@revealui.com.</p>
        </body>
      </html>
    `,
    text: `Your RevealUI Pro trial ends ${endDate}. Your subscription will automatically continue at $49/month. Manage your subscription at ${portalUrl}.`,
  })
}

export default app
