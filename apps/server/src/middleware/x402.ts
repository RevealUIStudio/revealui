/**
 * x402 Native Payment Middleware (Phase 5.2) — RevealUI server glue.
 *
 * The reusable x402 protocol logic (config reading, payload encode/decode,
 * payment-required builders, and facilitator verification) lives in
 * `@revealui/paywall/x402`, published as part of the MIT `@revealui/paywall`
 * package. This file is the thin app-specific layer that wires the RevealUI
 * structured logger and Prometheus-style metrics into payment verification.
 *
 * Payment flow:
 *   1. Agent request arrives, quota exhausted
 *   2. Server: HTTP 402 + X-PAYMENT-REQUIRED: <base64 PaymentRequired>
 *   3. Agent: pays USDC on Base, signs proof
 *   4. Agent: retries with X-PAYMENT-PAYLOAD: <base64 PaymentPayload>
 *   5. Server: verifies proof, allows request
 *
 * Gated behind X402_ENABLED env var (defaults to false). Ship the code,
 * activate when a USDC receiving wallet is configured.
 */

import { logger } from '@revealui/core/observability/logger';
import { trackX402PaymentVerify } from '@revealui/core/observability/metrics';
import {
  buildPaymentMethods,
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
  verifyPayment as verifyPaymentCore,
} from '@revealui/paywall/x402';

export type { X402Config } from '@revealui/paywall/x402';
export {
  buildPaymentMethods,
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
};

/**
 * Verify a client's X-PAYMENT-PAYLOAD header value.
 *
 * Thin wrapper around `@revealui/paywall/x402`'s `verifyPayment`: binds the
 * RevealUI logger + `x402_payment_verify_total`/`x402_payment_verify_duration_seconds`
 * metrics as observability hooks. Decode failures (malformed base64) are not
 * counted, matching the package's own contract.
 *
 * @param payloadHeader - Raw base64 value from X-PAYMENT-PAYLOAD header
 * @param resource      - Canonical resource URL (must match what was sent in 402)
 * @param route         - Route label for metrics (e.g. 'a2a', 'marketplace')
 * @returns `{ valid: true }` or `{ valid: false, error: string }`
 */
export async function verifyPayment(
  payloadHeader: string,
  resource: string,
  route: string = 'unknown',
): Promise<{ valid: true } | { valid: false; error: string }> {
  return verifyPaymentCore(payloadHeader, resource, route, {
    onFacilitatorWarn: (message, meta) => logger.warn(message, meta),
    onVerified: (verifiedRoute, durationMs, valid) =>
      trackX402PaymentVerify(verifiedRoute, 'exact', valid ? 'valid' : 'invalid', durationMs),
  });
}
