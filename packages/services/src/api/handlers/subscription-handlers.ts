/**
 * Subscription event handlers for Stripe webhooks.
 *
 * @deprecated These handlers use Supabase and are NOT used by the API app.
 * The production webhook handler is in apps/api/src/routes/webhooks.ts,
 * which uses NeonDB (Drizzle ORM) directly.
 */

import { logger } from '@revealui/core/utils/logger';
import type Stripe from 'stripe';
import { protectedStripe } from '../../stripe/stripeClient.js';
import type { SupabaseClient } from '../../supabase/index.js';
import type { Database } from '../../supabase/types.js';
import type { StripeWebhookEvent } from '../types/stripe.js';
import { extractCustomerId } from '../types/stripe.js';

export const manageSubscriptionStatusChange = async (
  subscriptionId: string,
  customerId: string | number,
  createAction = false,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const { data: customerData, error: noCustomerError } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', String(customerId))
    .single();
  if (noCustomerError) throw noCustomerError;

  const { id: uuid } = customerData;

  const subscription = await protectedStripe.subscriptions.retrieve(subscriptionId);
  const typedSubscription = subscription as Stripe.Subscription & {
    current_period_start: number;
    current_period_end: number;
  };
  const subscriptionData: Database['public']['Tables']['subscriptions']['Insert'] = {
    id: typedSubscription.id,
    user_id: uuid,
    metadata: typedSubscription.metadata,
    status: typedSubscription.status,
    price_id: typedSubscription.items.data[0]?.price?.id || null,
    stripe_subscription_id: typedSubscription.id,
  };

  const { error } = await supabase.from('subscriptions').upsert([subscriptionData]);
  if (error) throw error;
  logger.info('Inserted/updated subscription', {
    subscriptionId: typedSubscription.id,
    userId: uuid,
  });

  if (createAction && typedSubscription.default_payment_method && uuid) {
    // Payment method update logic would go here
  }
};

export const handleCheckoutSessionCompleted = async (
  event: StripeWebhookEvent<'checkout.session.completed'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const checkoutSession = event.data.object;
  const subscriptionId =
    typeof checkoutSession.subscription === 'string'
      ? checkoutSession.subscription
      : checkoutSession.subscription?.id;
  const customerId = extractCustomerId(checkoutSession.customer);

  if (!(subscriptionId && customerId)) {
    throw new Error('Checkout session missing subscription or customer');
  }

  try {
    await manageSubscriptionStatusChange(subscriptionId, customerId, true, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handleCustomerSubscriptionDeleted = async (
  event: StripeWebhookEvent<'customer.subscription.deleted'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const subscription = event.data.object;
  const customerId = extractCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error('Subscription missing customer');
  }

  try {
    await manageSubscriptionStatusChange(subscription.id, customerId, false, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handleCustomerSubscriptionCreated = async (
  event: StripeWebhookEvent<'customer.subscription.created'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const subscription = event.data.object;
  const customerId = extractCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error('Subscription missing customer');
  }

  try {
    await manageSubscriptionStatusChange(subscription.id, customerId, true, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handleCustomerSubscriptionUpdated = async (
  event: StripeWebhookEvent<'customer.subscription.updated'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const subscription = event.data.object;
  const customerId = extractCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error('Subscription missing customer');
  }

  try {
    await manageSubscriptionStatusChange(subscription.id, customerId, false, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handleSupabaseError = (error: Error): void => {
  logger.error('Supabase error', { error });
};
