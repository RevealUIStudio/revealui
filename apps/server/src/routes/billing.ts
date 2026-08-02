/**
 * Billing routes (barrel).
 * Implementation: ./billing/helpers.ts + ./billing/routes.ts
 */

export {
  assertLiveCatalogComplete,
  type EarlyAdopterConfig,
  resetLiveCatalogGateForTests,
} from './billing/helpers.js';
export { default } from './billing/routes.js';
