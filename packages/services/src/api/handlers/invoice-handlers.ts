/**
 * Invoice event handlers for Stripe webhooks
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '../../supabase/index.js';
import type { Database } from '../../supabase/types.js';
import type { StripeWebhookEvent } from '../types/stripe.js';
import { extractCustomerId } from '../types/stripe.js';
import { handleSupabaseError, manageSubscriptionStatusChange } from './subscription-handlers.js';

export const handleInvoicePaymentSucceeded = async (
  event: StripeWebhookEvent<'invoice.payment_succeeded'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId = invoice.subscription
    ? typeof invoice.subscription === 'string'
      ? invoice.subscription
      : (invoice.subscription?.id ?? null)
    : null;
  const customerId = extractCustomerId(invoice.customer);

  if (!(subscriptionId && customerId)) {
    throw new Error('Invoice missing subscription or customer');
  }

  try {
    await manageSubscriptionStatusChange(subscriptionId, customerId, false, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export async function handleInvoicePaymentFailed(
  event: StripeWebhookEvent<'invoice.payment_failed'>,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };
  const subscriptionId = invoice.subscription
    ? typeof invoice.subscription === 'string'
      ? invoice.subscription
      : (invoice.subscription?.id ?? null)
    : null;
  const customerId = extractCustomerId(invoice.customer);

  if (!(subscriptionId && customerId)) {
    throw new Error('Invoice missing subscription or customer');
  }

  try {
    await manageSubscriptionStatusChange(subscriptionId, customerId, false, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
}
