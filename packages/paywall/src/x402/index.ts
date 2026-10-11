/**
 * @revealui/paywall/x402
 *
 * HTTP 402 Payment Required. Agent-to-agent payment negotiation.
 *
 * Enables automated payment flows where AI agents can negotiate access to
 * gated APIs by responding to 402 status codes with payment payloads:
 * https://x402.org
 *
 * Supports USDC on Base (EVM), verified via the Coinbase facilitator.
 *
 * Payment flow:
 *   1. Agent request arrives, quota exhausted
 *   2. Server: HTTP 402 + X-PAYMENT-REQUIRED: <base64 PaymentRequired>
 *   3. Agent: pays USDC on Base, signs proof
 *   4. Agent: retries with X-PAYMENT-PAYLOAD: <base64 PaymentPayload>
 *   5. Server: verifies proof, allows request
 *
 * This module is framework- and app-agnostic: it has no dependency on any
 * particular logger or metrics stack. Callers that want observability hook
 * in via the optional `X402VerifyHooks` parameter to `verifyPayment`.
 *
 * @packageDocumentation
 */

import { readPaymentClaim } from './settlement.js';

export type {
  NonceClaimDecision,
  NonceClaimStore,
  PaymentClaim,
  PaymentClaimResult,
  StoredSettlement,
} from './settlement.js';
export {
  createNonceClaimStore,
  decideNonceClaim,
  readPaymentClaim,
  settlementSupportsPayout,
} from './settlement.js';

// =============================================================================
// Minimal x402 protocol types (subset of @x402/core types we need)
// =============================================================================

export interface PaymentRequirementsV1 {
  scheme: string;
  network: string;
  maxAmountRequired: string; // USDC atomic units (6 decimals): 1000 = $0.001
  resource: string; // canonical URL of the resource being paid for
  description: string;
  mimeType: string;
  outputSchema: Record<string, unknown>;
  payTo: string; // receiving wallet address
  maxTimeoutSeconds: number;
  asset: string; // USDC contract address on the network
  extra: Record<string, unknown>;
}

export interface PaymentRequiredV1 {
  x402Version: 1;
  error?: string;
  accepts: PaymentRequirementsV1[];
}

export interface PaymentPayloadV1 {
  x402Version: 1;
  scheme: string;
  network: string;
  payload: Record<string, unknown>;
}

interface VerifyRequestBody {
  x402Version: 1;
  paymentPayload: PaymentPayloadV1;
  paymentRequirements: PaymentRequirementsV1;
}

interface VerifyResponseBody {
  isValid: boolean;
  invalidReason?: string;
}

interface SettleResponseBody {
  success?: boolean;
  errorReason?: string | null;
  transaction?: string;
  txHash?: string;
  payer?: string;
}

// =============================================================================
// USDC contract addresses
// =============================================================================

const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const USDC_ADDRESSES: Record<string, string> = {
  'evm:base': BASE_USDC_ADDRESS,
  'evm:base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// Default Coinbase-hosted facilitator (no API key required for public verify)
const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

// USDC has 6 decimal places: $0.001 = 1000 atomic units
const USDC_DECIMALS = 6;

/** Facilitator verify and settle calls share this timeout. */
const FACILITATOR_TIMEOUT_MS = 10_000;

// =============================================================================
// Config
// =============================================================================

export interface X402Config {
  enabled: boolean;
  receivingAddress: string;
  network: string; // e.g. 'evm:base' or 'evm:base-sepolia'
  pricePerTask: string; // human-readable USDC e.g. '0.001'
  usdcAsset: string;
  facilitatorUrl: string;
  maxTimeoutSeconds: number;
}

/**
 * Returns the currency-advertised label for a `*_payment_required_total`
 * counter. Always `'usdc-only'`, since USDC on Base is the sole settlement currency.
 */
export function getAdvertisedCurrencyLabel(): 'usdc-only' {
  return 'usdc-only';
}

/** Read x402 configuration from environment variables (lazy, never throws on missing). */
export function getX402Config(): X402Config {
  const network = process.env.X402_NETWORK ?? 'evm:base';
  return {
    enabled: process.env.X402_ENABLED === 'true',
    receivingAddress: process.env.X402_RECEIVING_ADDRESS ?? '',
    network,
    pricePerTask: process.env.X402_PRICE_PER_TASK ?? '0.001',
    usdcAsset: USDC_ADDRESSES[network] ?? BASE_USDC_ADDRESS,
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    maxTimeoutSeconds: 300,
  };
}

// =============================================================================
// Encoding / Decoding
// =============================================================================

/** Encode a PaymentRequired object as base64 for the X-PAYMENT-REQUIRED header. */
export function encodePaymentRequired(req: PaymentRequiredV1): string {
  return Buffer.from(JSON.stringify(req), 'utf-8').toString('base64');
}

/** Decode the X-PAYMENT-PAYLOAD header from a client request. */
function decodePaymentPayload(header: string): PaymentPayloadV1 | null {
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8');
    return JSON.parse(json) as PaymentPayloadV1;
  } catch {
    return null;
  }
}

// =============================================================================
// Payment requirement builder
// =============================================================================

/**
 * Convert a human-readable USDC amount (e.g. '0.001') to atomic units (e.g. '1000').
 * USDC has 6 decimal places.
 */
/**
 * Convert a human-readable USDC amount (e.g. '0.001') to atomic units (e.g. '1000').
 * USDC has 6 decimal places. Non-positive or non-numeric input falls back to 1000.
 */
export function toUsdcAtomicUnits(humanAmount: string): string {
  const amount = Number.parseFloat(humanAmount);
  if (!Number.isFinite(amount) || amount <= 0) return '1000'; // fallback: $0.001
  return String(Math.round(amount * 10 ** USDC_DECIMALS));
}

/**
 * Build a PaymentRequired object for a single agent task or marketplace call.
 *
 * Includes USDC on Base as the settlement method.
 *
 * @param resource    - Canonical URL of the endpoint being accessed
 * @param customPrice - Optional override for the USDC price (e.g. marketplace per-server pricing).
 *                      Defaults to X402_PRICE_PER_TASK env var ('0.001').
 */
export function buildPaymentRequired(resource: string, customPrice?: string): PaymentRequiredV1 {
  const config = getX402Config();
  const price = customPrice ?? config.pricePerTask;

  const accepts: PaymentRequirementsV1[] = [
    // USDC on Base (EVM)
    {
      scheme: 'exact',
      network: config.network,
      maxAmountRequired: toUsdcAtomicUnits(price),
      resource,
      description: `RevealUI agent task — ${price} USDC per call`,
      mimeType: 'application/json',
      outputSchema: {},
      payTo: config.receivingAddress,
      maxTimeoutSeconds: config.maxTimeoutSeconds,
      asset: config.usdcAsset,
      extra: { name: 'USDC', version: '2' },
    },
  ];

  return { x402Version: 1, accepts };
}

// =============================================================================
// Payment verification
// =============================================================================

/**
 * Observability hooks a caller can bind to its own logger/metrics stack.
 * All hooks are optional and no-op by default, so this module carries no
 * dependency on any particular logging or metrics implementation.
 */
export interface X402VerifyHooks {
  /** Called when the facilitator call itself fails (non-OK status or network error). */
  onFacilitatorWarn?: (message: string, meta: Record<string, unknown>) => void;
  /** Called once per dispatched verification (decode failures are not counted). */
  onVerified?: (route: string, durationMs: number, valid: boolean) => void;
}

/**
 * Verify a client's X-PAYMENT-PAYLOAD header value.
 *
 * Verifies the `exact` (EVM/USDC) scheme via the Coinbase facilitator.
 * Verification does not settle the authorization or consume its nonce.
 * Call `settlePayment` and persist the nonce before moving funds.
 *
 * @param payloadHeader - Raw base64 value from X-PAYMENT-PAYLOAD header
 * @param resource      - Canonical resource URL (must match what was sent in 402)
 * @param route         - Route label for metrics (e.g. 'a2a', 'marketplace')
 * @param hooks         - Optional observability hooks (see `X402VerifyHooks`)
 * @returns `{ valid: true }` or `{ valid: false, error: string }`
 */
export async function verifyPayment(
  payloadHeader: string,
  resource: string,
  route: string = 'unknown',
  hooks: X402VerifyHooks = {},
  customPrice?: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const config = getX402Config();

  const paymentPayload = decodePaymentPayload(payloadHeader);
  if (!paymentPayload) {
    return { valid: false, error: 'Could not decode X-PAYMENT-PAYLOAD (invalid base64 or JSON)' };
  }

  const start = Date.now();
  const result = await verifyEvmPayment(paymentPayload, resource, config, hooks, customPrice);
  hooks.onVerified?.(route, Date.now() - start, result.valid);
  return result;
}

/**
 * Verify a USDC payment via the Coinbase facilitator (EVM flow).
 */
async function verifyEvmPayment(
  paymentPayload: PaymentPayloadV1,
  resource: string,
  config: X402Config,
  hooks: X402VerifyHooks,
  customPrice?: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  // Rebuild the requirements so the facilitator can verify against them
  const requirements = buildPaymentRequired(resource, customPrice).accepts[0];
  if (!requirements) {
    return { valid: false, error: 'Internal: could not build payment requirements' };
  }

  const body: VerifyRequestBody = {
    x402Version: 1,
    paymentPayload,
    paymentRequirements: requirements,
  };

  try {
    const resp = await fetch(`${config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FACILITATOR_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => `HTTP ${resp.status}`);
      hooks.onFacilitatorWarn?.('x402 facilitator returned non-OK status', {
        status: resp.status,
        body: text.slice(0, 200),
      });
      return { valid: false, error: `Facilitator error: HTTP ${resp.status}` };
    }

    const result = (await resp.json()) as VerifyResponseBody;

    if (!result.isValid) {
      return { valid: false, error: result.invalidReason ?? 'Payment rejected by facilitator' };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    hooks.onFacilitatorWarn?.('x402 facilitator request failed', { error: message });
    return { valid: false, error: `Facilitator unreachable: ${message}` };
  }
}

export interface SettledPayment {
  ok: true;
  nonce: string;
  txHash: string;
  amount: string;
  payer: string;
}

export type SettlePaymentResult = SettledPayment | { ok: false; error: string };

/**
 * Settle a verified USDC authorization through the facilitator.
 *
 * Call this only after `verifyPayment` succeeds. A facilitator failure returns
 * `{ ok: false }` and does not produce a settlement the caller can pay out on.
 * The caller must persist `nonce` under a unique constraint before any payout.
 */
export async function settlePayment(
  payloadHeader: string,
  resource: string,
  route: string = 'unknown',
  hooks: X402VerifyHooks = {},
  customPrice?: string,
  nowMs: number = Date.now(),
): Promise<SettlePaymentResult> {
  const claim = readPaymentClaim(payloadHeader, nowMs);
  if (!claim.ok) return claim;

  if (customPrice && claim.claim.amount !== toUsdcAtomicUnits(customPrice)) {
    return { ok: false, error: 'Payment amount does not match the resource price' };
  }

  const config = getX402Config();
  const paymentPayload = decodePaymentPayload(payloadHeader);
  const requirements = buildPaymentRequired(resource, customPrice).accepts[0];
  if (!(paymentPayload && requirements)) {
    return { ok: false, error: 'Internal: could not build settlement request' };
  }

  const body: VerifyRequestBody = {
    x402Version: 1,
    paymentPayload,
    paymentRequirements: requirements,
  };

  try {
    const resp = await fetch(`${config.facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FACILITATOR_TIMEOUT_MS),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => `HTTP ${resp.status}`);
      hooks.onFacilitatorWarn?.('x402 facilitator settle returned non-OK status', {
        status: resp.status,
        route,
        body: text.slice(0, 200),
      });
      return { ok: false, error: `Facilitator error: HTTP ${resp.status}` };
    }

    const result = (await resp.json()) as SettleResponseBody;
    const txHash = result.transaction ?? result.txHash;
    if (result.success !== true || !txHash) {
      return {
        ok: false,
        error: result.errorReason ?? 'Payment was not settled by the facilitator',
      };
    }

    return {
      ok: true,
      nonce: claim.claim.nonce,
      txHash,
      amount: claim.claim.amount,
      payer: result.payer && result.payer.trim().length > 0 ? result.payer : claim.claim.payer,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    hooks.onFacilitatorWarn?.('x402 facilitator settle request failed', { error: message, route });
    return { ok: false, error: `Facilitator unreachable: ${message}` };
  }
}

// =============================================================================
// Well-known payment methods payload
// =============================================================================

/**
 * Build the /.well-known/payment-methods.json payload.
 * Returns null when x402 is disabled.
 */
export function buildPaymentMethods(baseUrl: string): Record<string, unknown> | null {
  const config = getX402Config();
  if (!(config.enabled && config.receivingAddress)) return null;

  const accepts: Record<string, unknown>[] = [
    {
      scheme: 'exact',
      network: config.network,
      maxAmountRequired: toUsdcAtomicUnits(config.pricePerTask),
      resource: `${baseUrl}/api/agent-stream`,
      description: `RevealUI agent task — ${config.pricePerTask} USDC per call`,
      mimeType: 'application/json',
      payTo: config.receivingAddress,
      maxTimeoutSeconds: config.maxTimeoutSeconds,
      asset: config.usdcAsset,
      extra: { name: 'USDC', version: '2' },
    },
  ];

  return { version: '1.0', accepts };
}
