/**
 * Billing routes (barrel).
 * Implementation: ./billing/helpers.ts + ./billing/routes.ts
 */

export {
  assertLiveCatalogComplete,
  type EarlyAdopterConfig,
  getEarlyAdopterDiscount,
  resetLiveCatalogGateForTests,
} from './billing/helpers.js';
export { default } from './billing/routes.js';
