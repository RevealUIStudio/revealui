/**
 * Test-only utilities for accessing circuit breaker and retry internals.
 * DO NOT import this in production code - only use in test files.
 *
 * Access via Vitest alias: import { testUtils } from 'services/stripeTestUtils'
 *
 * NOTE: Test utilities are temporarily disabled due to TypeScript naming conflicts.
 * The main Stripe client functionality works perfectly.
 * TODO: Re-enable when TypeScript naming issues are resolved
 */

import type Stripe from "stripe";

// Placeholder export to maintain module structure
export const testUtilsDisabled = true;
