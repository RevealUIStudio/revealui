/**
 * x402 Native Payment Middleware Utilities (Phase 5.2)
 *
 * Implements HTTP-native micropayments via the x402 protocol:
 * https://x402.org
 *
 * When an agent task quota is exhausted, instead of hard-blocking with 429,
 * this module returns HTTP 402 Payment Required with an x402 PaymentRequired
 * header. The calling agent can pay per-task in USDC on Base and retry with
 * a signed payment proof in the X-PAYMENT-PAYLOAD header.
 *
 * Payment flow:
 *   1. Agent request arrives → quota exhausted
 *   2. Server: HTTP 402 + X-PAYMENT-REQUIRED: <base64 PaymentRequired>
 *   3. Agent: pays USDC on Base, signs proof
 *   4. Agent: retries with X-PAYMENT-PAYLOAD: <base64 PaymentPayload>
 *   5. Server: verifies proof via Coinbase facilitator → allows request
 *
 * Gated behind X402_ENABLED env var (defaults to false). Ship the code,
 * activate when a USDC receiving wallet is configured.
 *
 * Note: @coinbase/x402 is installed as a dependency (for future CDP auth).
 * Core protocol is implemented with plain fetch + Buffer base64 to avoid
 * importing @x402/core (a transitive dep, not directly resolvable).
 */

import { logger } from '@revealui/core/observability/logger'

// =============================================================================
// Minimal x402 protocol types (subset of @x402/core types we need)
// =============================================================================

interface PaymentRequirementsV1 {
  scheme: string
  network: string
  maxAmountRequired: string // USDC atomic units (6 decimals): 1000 = $0.001
  resource: string // canonical URL of the resource being paid for
  description: string
  mimeType: string
  outputSchema: Record<string, unknown>
  payTo: string // receiving wallet address
  maxTimeoutSeconds: number
  asset: string // USDC contract address on the network
  extra: Record<string, unknown>
}

interface PaymentRequiredV1 {
  x402Version: 1
  error?: string
  accepts: PaymentRequirementsV1[]
}

interface PaymentPayloadV1 {
  x402Version: 1
  scheme: string
  network: string
  payload: Record<string, unknown>
}

interface VerifyRequestBody {
  x402Version: 1
  paymentPayload: PaymentPayloadV1
  paymentRequirements: PaymentRequirementsV1
}

interface VerifyResponseBody {
  isValid: boolean
  invalidReason?: string
}

// =============================================================================
// USDC contract addresses
// =============================================================================

const USDC_ADDRESSES: Record<string, string> = {
  'evm:base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'evm:base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

// Default Coinbase-hosted facilitator (no API key required for public verify)
const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator'

// USDC has 6 decimal places: $0.001 = 1000 atomic units
const USDC_DECIMALS = 6

// =============================================================================
// Config
// =============================================================================

export interface X402Config {
  enabled: boolean
  receivingAddress: string
  network: string // e.g. 'evm:base' or 'evm:base-sepolia'
  pricePerTask: string // human-readable USDC e.g. '0.001'
  usdcAsset: string
  facilitatorUrl: string
  maxTimeoutSeconds: number
}

/** Read x402 configuration from environment variables (lazy — never throws on missing). */
export function getX402Config(): X402Config {
  const network = process.env.X402_NETWORK ?? 'evm:base'
  return {
    enabled: process.env.X402_ENABLED === 'true',
    receivingAddress: process.env.X402_RECEIVING_ADDRESS ?? '',
    network,
    pricePerTask: process.env.X402_PRICE_PER_TASK ?? '0.001',
    usdcAsset: USDC_ADDRESSES[network] ?? USDC_ADDRESSES['evm:base'],
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    maxTimeoutSeconds: 300,
  }
}

// =============================================================================
// Encoding / Decoding
// =============================================================================

/** Encode a PaymentRequired object as base64 for the X-PAYMENT-REQUIRED header. */
export function encodePaymentRequired(req: PaymentRequiredV1): string {
  return Buffer.from(JSON.stringify(req), 'utf-8').toString('base64')
}

/** Decode the X-PAYMENT-PAYLOAD header from a client request. */
function decodePaymentPayload(header: string): PaymentPayloadV1 | null {
  try {
    const json = Buffer.from(header, 'base64').toString('utf-8')
    return JSON.parse(json) as PaymentPayloadV1
  } catch {
    return null
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
  const amount = Number.parseFloat(humanAmount)
  if (!Number.isFinite(amount) || amount <= 0) return '1000' // fallback: $0.001
  return String(Math.round(amount * 10 ** USDC_DECIMALS))
}

/**
 * Build a PaymentRequired object for a single agent task.
 *
 * @param resource - Canonical URL of the endpoint being accessed
 *                   (e.g. 'https://api.revealui.com/api/agent-stream')
 */
export function buildPaymentRequired(resource: string): PaymentRequiredV1 {
  const config = getX402Config()
  const requirements: PaymentRequirementsV1 = {
    scheme: 'exact',
    network: config.network,
    maxAmountRequired: toAtomicUnits(config.pricePerTask),
    resource,
    description: `RevealUI agent task — ${config.pricePerTask} USDC per call`,
    mimeType: 'application/json',
    outputSchema: {},
    payTo: config.receivingAddress,
    maxTimeoutSeconds: config.maxTimeoutSeconds,
    asset: config.usdcAsset,
    extra: { name: 'USDC', version: '2' },
  }
  return { x402Version: 1, accepts: [requirements] }
}

// =============================================================================
// Payment verification
// =============================================================================

/**
 * Verify a client's X-PAYMENT-PAYLOAD header value against the Coinbase facilitator.
 *
 * @param payloadHeader - Raw base64 value from X-PAYMENT-PAYLOAD header
 * @param resource      - Canonical resource URL (must match what was sent in 402)
 * @returns `{ valid: true }` or `{ valid: false, error: string }`
 */
export async function verifyPayment(
  payloadHeader: string,
  resource: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const config = getX402Config()

  const paymentPayload = decodePaymentPayload(payloadHeader)
  if (!paymentPayload) {
    return { valid: false, error: 'Could not decode X-PAYMENT-PAYLOAD (invalid base64 or JSON)' }
  }

  // Rebuild the requirements so the facilitator can verify against them
  const requirements = buildPaymentRequired(resource).accepts[0]
  if (!requirements) {
    return { valid: false, error: 'Internal: could not build payment requirements' }
  }

  const body: VerifyRequestBody = {
    x402Version: 1,
    paymentPayload,
    paymentRequirements: requirements,
  }

  try {
    const resp = await fetch(`${config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000), // 10-second facilitator timeout
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => `HTTP ${resp.status}`)
      logger.warn('x402 facilitator returned non-OK status', {
        status: resp.status,
        body: text.slice(0, 200),
      })
      return { valid: false, error: `Facilitator error: HTTP ${resp.status}` }
    }

    const result = (await resp.json()) as VerifyResponseBody

    if (!result.isValid) {
      return { valid: false, error: result.invalidReason ?? 'Payment rejected by facilitator' }
    }

    return { valid: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logger.warn('x402 facilitator request failed', { error: message })
    return { valid: false, error: `Facilitator unreachable: ${message}` }
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
  const config = getX402Config()
  if (!(config.enabled && config.receivingAddress)) return null

  return {
    version: '1.0',
    accepts: [
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
    ],
  }
}
