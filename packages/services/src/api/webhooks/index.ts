/**
 * @deprecated This Supabase-based webhook handler is legacy code.
 *
 * The production webhook handler is in apps/api/src/routes/webhooks.ts,
 * which uses NeonDB (Drizzle ORM) directly and handles all subscription
 * lifecycle events including disputes, refunds, and payment recovery.
 *
 * This file is retained for backward compatibility with any external
 * consumers of @revealui/services, but is NOT used by the API app.
 */

import { generateLicenseKey, type LicenseTier } from '@revealui/core/license';
import { logger } from '@revealui/core/utils/logger';
import { getClient } from '@revealui/db/client';
import { processedWebhookEvents } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { protectedStripe } from '../../stripe/stripeClient.js';
import { createServerClientFromRequest } from '../../supabase/index.js';
import {
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handlePaymentMethodAttached,
  manageSubscriptionStatusChange,
  upsertPriceRecord,
  upsertProductRecord,
} from '../utils.js';

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'price.created',
  'price.updated',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'payment_method.attached',
]);

/** Maximum webhook payload size (10 MB). Stripe payloads are tiny; this guards against DoS. */
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Resolve the webhook secret from environment variables.
 * Throws at startup/request time if no secret is configured, preventing
 * unsigned webhook acceptance.
 */
function getWebhookSecret(): string {
  const secret =
    (typeof import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE === 'string'
      ? import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE
      : undefined) ??
    (typeof import.meta.env.STRIPE_WEBHOOK_SECRET === 'string'
      ? import.meta.env.STRIPE_WEBHOOK_SECRET
      : undefined);

  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_LIVE must be configured. ' +
        'Refusing to process webhooks without signature verification.',
    );
  }

  return secret;
}

/**
 * Database-backed idempotency check. Prevents duplicate webhook processing
 * across Vercel cold starts, multi-region deployments, and server restarts.
 */
async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const db = getClient();
  const [existing] = await db
    .select({ id: processedWebhookEvents.id })
    .from(processedWebhookEvents)
    .where(eq(processedWebhookEvents.id, eventId))
    .limit(1);
  return !!existing;
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  const db = getClient();
  await db.insert(processedWebhookEvents).values({ id: eventId, eventType }).onConflictDoNothing();
}

export async function POST(request: Request): Promise<Response> {
  const supabase = createServerClientFromRequest(request);
  if (!supabase) {
    return new Response('Supabase client not available', { status: 500 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = getWebhookSecret();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Webhook secret not configured', { error: msg });
    return new Response('Webhook endpoint not configured', { status: 500 });
  }

  // Reject oversized payloads before reading into memory (DoS protection).
  // Content-Length is advisory; we still enforce after reading.
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) > MAX_BODY_BYTES) {
    return new Response('Payload too large', { status: 413 });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return new Response('Payload too large', { status: 413 });
  }

  const sig = request.headers.get('Stripe-Signature');

  if (!sig) {
    return new Response('Missing Stripe-Signature header', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = protectedStripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Webhook signature verification failed', {
      error: errorMessage,
    });
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Idempotency check: skip already-processed events
  if (await isEventAlreadyProcessed(event.id)) {
    logger.debug('Skipping duplicate webhook event', { eventId: event.id });
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  if (relevantEvents.has(event.type)) {
    try {
      // Mark event as processing BEFORE handling — prevents duplicate processing
      // on Stripe retries even if the handler throws below.
      await markEventProcessed(event.id, event.type);

      switch (event.type) {
        case 'product.created':
        case 'product.updated': {
          const product = event.data.object;
          if (product.object === 'product') {
            await upsertProductRecord(supabase, product);
          }
          break;
        }
        case 'price.created':
        case 'price.updated': {
          const price = event.data.object;
          if (price.object === 'price') {
            await upsertPriceRecord(supabase, price);
          }
          break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          if (subscription.object === 'subscription') {
            const customerId =
              typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer?.id;
            if (!customerId) {
              throw new Error('Subscription missing customer');
            }

            await manageSubscriptionStatusChange(
              subscription.id,
              customerId,
              event.type === 'customer.subscription.created',
              supabase,
            );

            // Flag license for revocation on subscription cancellation
            if (event.type === 'customer.subscription.deleted') {
              logger.info('Subscription deleted — license should be revoked', {
                customerId,
                subscriptionId: subscription.id,
              });
            }
          }
          break;
        }
        case 'checkout.session.completed': {
          const checkoutSession = event.data.object;
          if (checkoutSession.object === 'checkout.session') {
            const session = checkoutSession;
            if (session.mode === 'subscription' && session.subscription) {
              const subscriptionId =
                typeof session.subscription === 'string'
                  ? session.subscription
                  : session.subscription.id;
              const customerId =
                typeof session.customer === 'string' ? session.customer : session.customer?.id;
              if (subscriptionId && customerId) {
                await manageSubscriptionStatusChange(subscriptionId, customerId, true, supabase);

                // Retrieve the subscription to:
                //   (a) check if a license key was already generated (idempotency across retries)
                //   (b) get the actual price ID for authoritative tier resolution
                const subscription = await protectedStripe.subscriptions.retrieve(subscriptionId);

                if (subscription.metadata?.license_key) {
                  // Already generated — Stripe retried the webhook. Safe to skip.
                  logger.info('License key already present, skipping generation (idempotent)', {
                    customerId,
                    subscriptionId,
                  });
                } else {
                  const priceId = subscription.items.data[0]?.price?.id ?? null;
                  const tier = resolveTierFromMetadata(session.metadata, priceId);
                  const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;

                  if (!privateKey) {
                    // This is a configuration error, not a customer error.
                    // The subscription is active but no license can be issued.
                    logger.error(
                      'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not set — license not generated. ' +
                        'Manual intervention required.',
                      { customerId, subscriptionId, tier },
                    );
                  } else if (tier !== 'free') {
                    try {
                      const licenseKey = await generateLicenseKey({ tier, customerId }, privateKey);
                      await protectedStripe.subscriptions.update(subscriptionId, {
                        metadata: { license_key: licenseKey, license_tier: tier },
                      });
                      logger.info('License key generated for checkout', { tier, customerId });
                    } catch (licenseErr) {
                      logger.error(
                        'CRITICAL: License generation failed after successful checkout. ' +
                          'Manual intervention required.',
                        {
                          error: licenseErr instanceof Error ? licenseErr.message : 'Unknown error',
                          customerId,
                          subscriptionId,
                          tier,
                        },
                      );
                    }
                  }
                }

                logger.info('Subscription session completed');
              }
            }
          }
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoiceEvent = event as Stripe.Event & {
            data: { object: Stripe.Invoice };
            type: 'invoice.payment_succeeded';
          };
          await handleInvoicePaymentSucceeded(invoiceEvent, supabase);
          break;
        }
        case 'invoice.payment_failed': {
          const invoiceEvent = event as Stripe.Event & {
            data: { object: Stripe.Invoice };
            type: 'invoice.payment_failed';
          };
          await handleInvoicePaymentFailed(invoiceEvent, supabase);
          break;
        }
        case 'payment_method.attached': {
          const pmEvent = event as Stripe.Event & {
            data: { object: Stripe.PaymentMethod };
            type: 'payment_method.attached';
          };
          await handlePaymentMethodAttached(pmEvent, supabase);
          break;
        }
        default:
          throw new Error('Unhandled relevant event!');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Webhook handler error', { error: errorMessage });

      return new Response(
        `Webhook error: "Webhook handler failed. View logs." Error: ${errorMessage}`,
        {
          status: 400,
        },
      );
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

/**
 * Resolve license tier from the subscription's actual price ID and checkout metadata.
 *
 * Price ID takes precedence — it cannot be spoofed because it comes from
 * Stripe's own subscription record, not from client-supplied data.
 * Metadata is a fallback for products that predate the env-var tier mapping.
 */
function resolveTierFromMetadata(
  metadata: Record<string, string> | null | undefined,
  priceId?: string | null,
): LicenseTier {
  // Primary: validate against known price IDs from environment
  if (priceId) {
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
    const maxPriceId = process.env.STRIPE_MAX_PRICE_ID;
    const enterprisePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;
    if (proPriceId && priceId === proPriceId) return 'pro';
    if (maxPriceId && priceId === maxPriceId) return 'max';
    if (enterprisePriceId && priceId === enterprisePriceId) return 'enterprise';
  }
  // Fallback: metadata set server-side during checkout session creation (not customer-supplied)
  const tier = metadata?.tier;
  if (tier === 'enterprise') return 'enterprise';
  if (tier === 'max') return 'max';
  if (tier === 'pro') return 'pro';

  // No tier could be resolved — this is a configuration error.
  // Throw so Stripe retries (500) and the team can investigate.
  logger.error('Cannot resolve license tier — unknown price ID and no metadata', {
    priceId,
    metadata,
  });
  throw new Error(
    `Cannot resolve license tier: price ID "${priceId}" does not match any configured tier. ` +
      'Check STRIPE_PRO_PRICE_ID, STRIPE_MAX_PRICE_ID, and STRIPE_ENTERPRISE_PRICE_ID env vars.',
  );
}
