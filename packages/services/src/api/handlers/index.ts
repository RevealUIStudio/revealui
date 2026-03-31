/**
 * Stripe webhook and API handlers
 *
 * Split from the monolithic api/utils.ts into focused modules:
 * - subscription-handlers: Subscription lifecycle management
 * - invoice-handlers: Invoice payment events
 * - product-handlers: Product and price record management
 * - customer-handlers: Customer and billing management
 * - payment-handlers: Payment method and setup intent events
 * - payment-intent: Payment intent creation
 */

export {
  copyBillingDetailsToCustomer,
  createOrRetrieveCustomer,
  handleCustomerCreated,
  handleCustomerUpdated,
} from './customer-handlers.js';

export { handleInvoicePaymentFailed, handleInvoicePaymentSucceeded } from './invoice-handlers.js';
export {
  handlePaymentMethodAttached,
  handlePaymentMethodCreated,
  handlePaymentMethodDetached,
  handlePaymentMethodUpdated,
  handleSetupIntentFailed,
  handleSetupIntentSucceeded,
} from './payment-handlers.js';
export { createPaymentIntent } from './payment-intent.js';
export {
  toDateTime,
  upsertPriceRecord,
  upsertProductRecord,
  upsertRecord,
} from './product-handlers.js';
export {
  handleCheckoutSessionCompleted,
  handleCustomerSubscriptionCreated,
  handleCustomerSubscriptionDeleted,
  handleCustomerSubscriptionUpdated,
  handleSupabaseError,
  manageSubscriptionStatusChange,
} from './subscription-handlers.js';
