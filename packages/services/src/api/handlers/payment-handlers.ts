/**
 * Payment method and setup intent handlers for Stripe webhooks
 */

import { logger } from '@revealui/core/utils/logger';
import type Stripe from 'stripe';
import type { SupabaseClient } from '../../supabase/index.js';
import type { Database } from '../../supabase/types.js';
import type { ExtendedStripeWebhookEvent, StripeWebhookEvent } from '../types/stripe.js';
import { extractCustomerId, isStripePaymentMethod } from '../types/stripe.js';
import { copyBillingDetailsToCustomer } from './customer-handlers.js';
import { handleSupabaseError } from './subscription-handlers.js';

async function lookupUserByCustomerId(
  supabase: SupabaseClient<Database>,
  customerId: string,
): Promise<string> {
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!userData) {
    throw new Error('User not found for customer');
  }

  const userId = (userData as { id: string }).id;
  if (!userId) {
    throw new Error('User missing id');
  }

  return userId;
}

export const handlePaymentMethodAttached = async (
  event: StripeWebhookEvent<'payment_method.attached'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object;
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event');
  }

  const customerId = extractCustomerId(paymentMethod.customer);
  if (!customerId) {
    throw new Error('Payment method missing customer');
  }

  const userId = await lookupUserByCustomerId(supabase, customerId);

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handlePaymentMethodDetached = async (
  event: StripeWebhookEvent<'payment_method.detached'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object;
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event');
  }

  const customerId = extractCustomerId(paymentMethod.customer);
  if (!customerId) {
    throw new Error('Payment method missing customer');
  }

  const userId = await lookupUserByCustomerId(supabase, customerId);

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handlePaymentMethodCreated = async (
  event: ExtendedStripeWebhookEvent<'payment_method.created'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object;
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event');
  }

  const customerId = extractCustomerId(paymentMethod.customer);
  if (!customerId) {
    throw new Error('Payment method missing customer');
  }

  const userId = await lookupUserByCustomerId(supabase, customerId);

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handlePaymentMethodUpdated = async (
  event: StripeWebhookEvent<'payment_method.updated'>,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const paymentMethod = event.data.object;
  if (!isStripePaymentMethod(paymentMethod)) {
    throw new Error('Invalid payment method in event');
  }

  const customerId = extractCustomerId(paymentMethod.customer);
  if (!customerId) {
    throw new Error('Payment method missing customer');
  }

  const userId = await lookupUserByCustomerId(supabase, customerId);

  try {
    await copyBillingDetailsToCustomer(userId, paymentMethod, supabase);
  } catch (error) {
    if (error instanceof Error) {
      handleSupabaseError(error);
    } else {
      handleSupabaseError(new Error(String(error)));
    }
  }
};

export const handleSetupIntentSucceeded = (
  event: ExtendedStripeWebhookEvent<'setup_intent.succeeded'>,
  _supabase: SupabaseClient<Database>,
): void => {
  void _supabase;
  const setupIntent = event.data.object as Stripe.SetupIntent;
  const paymentMethodId =
    typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;

  if (!paymentMethodId) {
    throw new Error('Setup intent missing payment method');
  }

  logger.info('Setup intent succeeded', {
    setupIntentId: setupIntent.id,
    paymentMethodId,
  });
};

export const handleSetupIntentFailed = (
  event: ExtendedStripeWebhookEvent<'setup_intent.failed'>,
  _supabase: SupabaseClient<Database>,
): void => {
  void _supabase;
  const setupIntent = event.data.object as Stripe.SetupIntent;
  logger.error('Setup intent failed', {
    setupIntentId: setupIntent.id,
    error: setupIntent.last_setup_error,
  });
};
