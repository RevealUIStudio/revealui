/**
 * API Utilities - Re-exports from focused handler modules
 *
 * This file preserves backward compatibility. New code should import
 * directly from the focused modules in ./handlers/ instead.
 *
 * @see ./handlers/subscription-handlers.ts
 * @see ./handlers/invoice-handlers.ts
 * @see ./handlers/product-handlers.ts
 * @see ./handlers/customer-handlers.ts
 * @see ./handlers/payment-handlers.ts
 * @see ./handlers/payment-intent.ts
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerClient } from '../supabase/index.js';

interface Context {
  req: IncomingMessage;
  res: ServerResponse;
}
export function createClient(context: Context): ReturnType<typeof createServerClient> {
  return createServerClient(context);
}

export const getURL = (): string => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  let url = path.resolve(dirname);
  url = url.includes('http') ? url : `https://${url}`;
  url = url.charAt(url.length - 1) === '/' ? url : `${url}/`;
  return url;
};

// Re-export all handlers for backward compatibility
export {
  copyBillingDetailsToCustomer,
  createOrRetrieveCustomer,
  createPaymentIntent,
  handleCheckoutSessionCompleted,
  handleCustomerCreated,
  handleCustomerSubscriptionCreated,
  handleCustomerSubscriptionDeleted,
  handleCustomerSubscriptionUpdated,
  handleCustomerUpdated,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  handlePaymentMethodAttached,
  handlePaymentMethodCreated,
  handlePaymentMethodDetached,
  handlePaymentMethodUpdated,
  handleSetupIntentFailed,
  handleSetupIntentSucceeded,
  handleSupabaseError,
  manageSubscriptionStatusChange,
  toDateTime,
  upsertPriceRecord,
  upsertProductRecord,
  upsertRecord,
} from './handlers/index.js';

// Re-export createStripeCustomer locally since it references RevealRequest
import type { RevealRequest } from '@revealui/core';
import { logger } from '@revealui/core/utils/logger';
import { protectedStripe } from '../stripe/stripeClient.js';

interface CreateStripeCustomerParams {
  req: RevealRequest;
  data: {
    email?: string;
    stripeCustomerID?: string;
    [key: string]: unknown;
  };
  operation: string;
}

export const createStripeCustomer = async ({
  req,
  data,
  operation,
}: CreateStripeCustomerParams): Promise<typeof data> => {
  const revealuiInstance = req.revealui;
  if (operation === 'create' && !data.stripeCustomerID && typeof data.email === 'string') {
    try {
      const existingCustomer = await protectedStripe.customers.list({
        email: data.email,
        limit: 1,
      });

      if (existingCustomer.data.length > 0 && existingCustomer.data[0]) {
        return {
          ...data,
          stripeCustomerID: existingCustomer.data[0].id,
        };
      }

      const customer = await protectedStripe.customers.create({
        email: data.email,
      });

      return {
        ...data,
        stripeCustomerID: customer.id,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (revealuiInstance?.logger) {
        revealuiInstance.logger.error(`Error creating Stripe customer: ${errorMessage}`);
      } else {
        logger.error('Error creating Stripe customer', { error: errorMessage });
      }
    }
  }

  return data;
};
