/**
 * x402 Native Payment Middleware Utilities (Phase 5.2)
 *
 * Implements HTTP-native micropayments via the x402 protocol:
 * https://x402.org
 *
 * Supports two payment methods:
 *   1. USDC on Base (EVM)  -  verified via Coinbase facilitator
 *   2. RVUI on Solana  -  verified on-chain via Token-2022 transfer inspection
 *
 * Payment flow:
 *   1. Agent request arrives → quota exhausted
 *   2. Server: HTTP 402 + X-PAYMENT-REQUIRED: <base64 PaymentRequired>
 *   3. Agent: pays USDC on Base OR RVUI on Solana, signs proof
 *   4. Agent: retries with X-PAYMENT-PAYLOAD: <base64 PaymentPayload>
 *   5. Server: verifies proof → allows request
 *
 * Gated behind X402_ENABLED env var (defaults to false). Ship the code,
 * activate when a USDC receiving wallet is configured.
 *
 * RVUI payments are additionally gated behind RVUI_PAYMENTS_ENABLED and subject
 * to anti-manipulation safeguards (TWAP pricing, rate limits, circuit breaker).
 */

import { RVUI_MINT_ADDRESSES, RVUI_TOKEN_CONFIG, type SolanaNetwork } from '@revealui/contracts';
import { logger } from '@revealui/core/observability/logger';

// =============================================================================
// Minimal x402 protocol types (subset of @x402/core types we need)
// =============================================================================

interface PaymentRequirementsV1 {
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

interface PaymentRequiredV1 {
  x402Version: 1;
  error?: string;
  accepts: PaymentRequirementsV1[];
}

interface PaymentPayloadV1 {
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

// =============================================================================
// USDC contract addresses
// =============================================================================

const USDC_ADDRESSES: Record<string, string> = {
  'evm:base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'evm:base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

// RVUI mint addresses (Token-2022 on Solana)
const RVUI_ADDRESSES: Record<string, string> = {
  'solana:devnet': RVUI_MINT_ADDRESSES.devnet,
  'solana:mainnet-beta': RVUI_MINT_ADDRESSES['mainnet-beta'],
};

// Default Coinbase-hosted facilitator (no API key required for public verify)
const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

// USDC has 6 decimal places: $0.001 = 1000 atomic units
const USDC_DECIMALS = 6;

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
  /** Whether RVUI payments on Solana are accepted. */
  rvuiEnabled: boolean;
  /** Solana wallet address to receive RVUI payments. */
  rvuiReceivingAddress: string;
  /** Solana network for RVUI verification. */
  rvuiNetwork: string; // e.g. 'solana:devnet'
  /** RVUI mint address for the active network. */
  rvuiAsset: string;
}

/** Read x402 configuration from environment variables (lazy  -  never throws on missing). */
export function getX402Config(): X402Config {
  const network = process.env.X402_NETWORK ?? 'evm:base';
  const solanaNetwork = (process.env.SOLANA_NETWORK as SolanaNetwork) ?? 'devnet';
  const rvuiNetworkKey = `solana:${solanaNetwork}`;
  return {
    enabled: process.env.X402_ENABLED === 'true',
    receivingAddress: process.env.X402_RECEIVING_ADDRESS ?? '',
    network,
    pricePerTask: process.env.X402_PRICE_PER_TASK ?? '0.001',
    usdcAsset: USDC_ADDRESSES[network] ?? USDC_ADDRESSES['evm:base'],
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    maxTimeoutSeconds: 300,
    rvuiEnabled: process.env.RVUI_PAYMENTS_ENABLED === 'true',
    rvuiReceivingAddress: process.env.RVUI_RECEIVING_WALLET ?? '',
    rvuiNetwork: rvuiNetworkKey,
    rvuiAsset: RVUI_ADDRESSES[rvuiNetworkKey] ?? '',
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
function toAtomicUnits(humanAmount: string): string {
  const amount = Number.parseFloat(humanAmount);
  if (!Number.isFinite(amount) || amount <= 0) return '1000'; // fallback: $0.001
  return String(Math.round(amount * 10 ** USDC_DECIMALS));
}

/**
 * Convert a human-readable RVUI amount to atomic units (6 decimals, same as USDC).
 */
function toRvuiAtomicUnits(humanAmount: string): string {
  const amount = Number.parseFloat(humanAmount);
  if (!Number.isFinite(amount) || amount <= 0) return '1000';
  return String(Math.round(amount * 10 ** RVUI_TOKEN_CONFIG.decimals));
}

/**
 * Build a PaymentRequired object for a single agent task or marketplace call.
 *
 * Includes USDC on Base as the primary method. If RVUI payments are enabled,
 * includes RVUI on Solana as a second accepted method (with discount applied).
 *
 * @param resource    - Canonical URL of the endpoint being accessed
 * @param customPrice - Optional override for the USDC price (e.g. marketplace per-server pricing).
 *                      Defaults to X402_PRICE_PER_TASK env var ('0.001').
 */
export function buildPaymentRequired(resource: string, customPrice?: string): PaymentRequiredV1 {
  const config = getX402Config();
  const price = customPrice ?? config.pricePerTask;

  const accepts: PaymentRequirementsV1[] = [
    // Primary: USDC on Base (EVM)
    {
      scheme: 'exact',
      network: config.network,
      maxAmountRequired: toAtomicUnits(price),
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

  // Secondary: RVUI on Solana (with 20% discount for agent tasks per white paper Section 6.3)
  if (config.rvuiEnabled && config.rvuiReceivingAddress && config.rvuiAsset) {
    const rvuiDiscountRate = 0.2; // 20% discount for AI credits / agent tasks
    const discountedPrice = String(Number.parseFloat(price) * (1 - rvuiDiscountRate));
    accepts.push({
      scheme: 'solana-spl',
      network: config.rvuiNetwork,
      maxAmountRequired: toRvuiAtomicUnits(discountedPrice),
      resource,
      description: `RevealUI agent task — ${discountedPrice} USD in RVC (20% discount)`,
      mimeType: 'application/json',
      outputSchema: {},
      payTo: config.rvuiReceivingAddress,
      maxTimeoutSeconds: config.maxTimeoutSeconds,
      asset: config.rvuiAsset,
      extra: { name: 'RVC', version: '1', discount: '20%' },
    });
  }

  return { x402Version: 1, accepts };
}

// =============================================================================
// Payment verification
// =============================================================================

/**
 * Per-call context required to fully verify RVUI payments.
 *
 * The RVUI safeguards pipeline (replay protection, single-payment cap,
 * wallet rate limit, monthly discount cap, TWAP circuit breaker) keys
 * on `userId` (the FK on `revealcoinPayments`) and `amountUsd` (the
 * negotiated USD price the agent agreed to pay, post-discount).
 *
 * USDC verification ignores this context — Coinbase's facilitator
 * handles its own replay protection. Callers can omit it for USDC-only
 * paths; the RVUI dispatch fails-closed when context is missing.
 */
export interface PaymentContext {
  userId: string;
  amountUsd: string;
}

/**
 * Verify a client's X-PAYMENT-PAYLOAD header value.
 *
 * Dispatches to the appropriate verifier based on the payment scheme:
 * - `exact` (EVM/USDC) → Coinbase facilitator (replay protection in-house)
 * - `solana-spl` (Solana/RVUI) → on-chain Token-2022 transfer verification +
 *   the RVUI safeguards pipeline (`validatePayment` + `recordPayment`).
 *   Requires `context` to be passed; fails-closed when missing.
 *
 * @param payloadHeader - Raw base64 value from X-PAYMENT-PAYLOAD header
 * @param resource      - Canonical resource URL (must match what was sent in 402)
 * @param context       - Required for RVUI/solana-spl scheme; optional for USDC
 * @returns `{ valid: true }` or `{ valid: false, error: string }`
 */
export async function verifyPayment(
  payloadHeader: string,
  resource: string,
  context?: PaymentContext,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const config = getX402Config();

  const paymentPayload = decodePaymentPayload(payloadHeader);
  if (!paymentPayload) {
    return { valid: false, error: 'Could not decode X-PAYMENT-PAYLOAD (invalid base64 or JSON)' };
  }

  // Dispatch based on payment scheme
  if (paymentPayload.scheme === 'solana-spl') {
    return verifySolanaPayment(paymentPayload, config, context);
  }

  // Default: EVM/USDC via Coinbase facilitator (handles replay in-house;
  // PaymentContext is unused on this path).
  return verifyEvmPayment(paymentPayload, resource, config);
}

/**
 * Verify an RVUI payment on Solana by inspecting the on-chain transaction
 * AND running the safeguards pipeline (GAP-159 wiring).
 */
async function verifySolanaPayment(
  paymentPayload: PaymentPayloadV1,
  config: X402Config,
  context: PaymentContext | undefined,
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (!config.rvuiEnabled) {
    return { valid: false, error: 'RVUI payments are not enabled on this server' };
  }

  if (!(context && context.userId)) {
    return {
      valid: false,
      error: 'RVUI payments require an authenticated user (PaymentContext.userId missing)',
    };
  }

  const txSignature = paymentPayload.payload.txSignature;
  if (typeof txSignature !== 'string' || !txSignature) {
    return { valid: false, error: 'Missing txSignature in payment payload' };
  }

  const expectedAmount = paymentPayload.payload.amount;
  if (typeof expectedAmount !== 'string') {
    return { valid: false, error: 'Missing amount in payment payload' };
  }

  // Dynamic import: @revealui/services is a Pro package  -  only load when RVUI payments are active
  const { verifyRvuiPayment } = await import('@revealui/services/revealcoin');
  return verifyRvuiPayment(txSignature, BigInt(expectedAmount), config.rvuiReceivingAddress, {
    userId: context.userId,
    amountUsd: context.amountUsd,
  });
}

/**
 * Verify a USDC payment via the Coinbase facilitator (original EVM flow).
 */
async function verifyEvmPayment(
  paymentPayload: PaymentPayloadV1,
  resource: string,
  config: X402Config,
): Promise<{ valid: true } | { valid: false; error: string }> {
  // Rebuild the requirements so the facilitator can verify against them
  const requirements = buildPaymentRequired(resource).accepts[0];
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
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => `HTTP ${resp.status}`);
      logger.warn('x402 facilitator returned non-OK status', {
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
    logger.warn('x402 facilitator request failed', { error: message });
    return { valid: false, error: `Facilitator unreachable: ${message}` };
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
      maxAmountRequired: toAtomicUnits(config.pricePerTask),
      resource: `${baseUrl}/api/agent-stream`,
      description: `RevealUI agent task — ${config.pricePerTask} USDC per call`,
      mimeType: 'application/json',
      payTo: config.receivingAddress,
      maxTimeoutSeconds: config.maxTimeoutSeconds,
      asset: config.usdcAsset,
      extra: { name: 'USDC', version: '2' },
    },
  ];

  if (config.rvuiEnabled && config.rvuiReceivingAddress && config.rvuiAsset) {
    const rvuiDiscountRate = 0.2;
    const discountedPrice = String(Number.parseFloat(config.pricePerTask) * (1 - rvuiDiscountRate));
    accepts.push({
      scheme: 'solana-spl',
      network: config.rvuiNetwork,
      maxAmountRequired: toRvuiAtomicUnits(discountedPrice),
      resource: `${baseUrl}/api/agent-stream`,
      description: `RevealUI agent task — ${discountedPrice} USD in RVC (20% discount)`,
      mimeType: 'application/json',
      payTo: config.rvuiReceivingAddress,
      maxTimeoutSeconds: config.maxTimeoutSeconds,
      asset: config.rvuiAsset,
      extra: { name: 'RVC', version: '1', discount: '20%' },
    });
  }

  return { version: '1.0', accepts };
}
