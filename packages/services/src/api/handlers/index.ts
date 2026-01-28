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
  handleCheckoutSessionCompleted,
  handleCustomerSubscriptionCreated,
  handleCustomerSubscriptionDeleted,
  handleCustomerSubscriptionUpdated,
  handleSupabaseError,
  manageSubscriptionStatusChange,
} from './subscription-handlers'

export { handleInvoicePaymentFailed, handleInvoicePaymentSucceeded } from './invoice-handlers'

export { toDateTime, upsertPriceRecord, upsertProductRecord, upsertRecord } from './product-handlers'

export {
  copyBillingDetailsToCustomer,
  createOrRetrieveCustomer,
  handleCustomerCreated,
  handleCustomerUpdated,
} from './customer-handlers'

export {
  handlePaymentMethodAttached,
  handlePaymentMethodCreated,
  handlePaymentMethodDetached,
  handlePaymentMethodUpdated,
  handleSetupIntentFailed,
  handleSetupIntentSucceeded,
} from './payment-handlers'

export { createPaymentIntent } from './payment-intent'
