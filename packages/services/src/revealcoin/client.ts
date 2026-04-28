/**
 * RevealCoin RPC Client
 *
 * Provides balance queries and payment verification for RevealCoin (RVUI)
 * on the Solana blockchain. Uses circuit breaker + retry pattern mirroring
 * the Stripe client in packages/services/src/stripe/stripeClient.ts.
 */

import { RVUI_MINT_ADDRESSES, RVUI_TOKEN_CONFIG, RVUI_TOKEN_PROGRAM } from '@revealui/contracts';
import { createLogger } from '@revealui/core/observability/logger';
import {
  trackX402SafeguardRejection,
  type X402SafeguardRejectionReason,
} from '@revealui/core/observability/metrics';
import { address, createSolanaRpc, signature } from '@solana/kit';
import { DbCircuitBreaker } from '../stripe/db-circuit-breaker.js';
import { getRevealCoinConfig, resolveRpcUrl } from './config.js';

/** Map a safeguards.ts free-text rejection reason to a stable metric label. */
function classifySafeguardReason(reason: string | undefined): X402SafeguardRejectionReason {
  if (!reason) return 'unknown';
  const lower = reason.toLowerCase();
  if (lower.includes('signature already used')) return 'duplicate-tx';
  if (lower.includes('volatility') || lower.includes('circuit breaker')) return 'circuit-breaker';
  if (lower.includes('exceeds maximum')) return 'single-payment-cap';
  if (lower.includes('rate limit')) return 'wallet-rate-limit';
  if (lower.includes('discount cap')) return 'discount-cap';
  return 'unknown';
}

const logger = createLogger({ service: 'RevealCoin' });

// =============================================================================
// Circuit Breaker (DB-backed, shared across API instances)
// =============================================================================

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  successThreshold: 2,
};

const solanaCircuitBreaker = new DbCircuitBreaker('solana-rpc', {
  failureThreshold: CIRCUIT_BREAKER_CONFIG.failureThreshold,
  successThreshold: CIRCUIT_BREAKER_CONFIG.successThreshold,
  resetTimeout: CIRCUIT_BREAKER_CONFIG.resetTimeout,
});

// =============================================================================
// Retry Configuration
// =============================================================================

const RETRY_CONFIG = {
  maxAttempts: 3,
  backoff: [200, 500, 1000],
  timeout: 15_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Solana RPC timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

// =============================================================================
// Resilient RPC Wrapper
// =============================================================================

async function callWithResilience<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  if (await solanaCircuitBreaker.isOpen()) {
    logger.error('Solana RPC circuit breaker is OPEN', undefined, {
      operation: operationName,
      state: 'open',
    });
    throw new Error('Solana RPC circuit breaker is OPEN. Service unavailable.');
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      const result = await withTimeout(operation(), RETRY_CONFIG.timeout);
      await solanaCircuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;

      const isRetryable =
        error instanceof Error &&
        (error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('429') ||
          error.message.includes('503'));

      if (!isRetryable) {
        await solanaCircuitBreaker.recordFailure();
        logger.error(
          `${operationName} failed (non-retryable)`,
          error instanceof Error ? error : new Error(String(error)),
          { operation: operationName, attempt: attempt + 1 },
        );
        throw error;
      }

      logger.warn(`${operationName} failed (retryable), retrying...`, {
        operation: operationName,
        attempt: attempt + 1,
        error: error instanceof Error ? error.message : String(error),
      });

      if (attempt < RETRY_CONFIG.maxAttempts - 1) {
        const backoffMs =
          RETRY_CONFIG.backoff[attempt] ??
          RETRY_CONFIG.backoff[RETRY_CONFIG.backoff.length - 1] ??
          1000;
        await sleep(backoffMs);
      }
    }
  }

  await solanaCircuitBreaker.recordFailure();
  throw lastError instanceof Error
    ? new Error(
        `${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts: ${lastError.message}`,
      )
    : new Error(`${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts`);
}

// =============================================================================
// Connection Management
// =============================================================================

let _rpc: ReturnType<typeof createSolanaRpc> | null = null;
let _rpcUrl: string | null = null;

function getRpc(): ReturnType<typeof createSolanaRpc> {
  const rpcUrl = resolveRpcUrl();
  if (_rpc && _rpcUrl === rpcUrl) return _rpc;
  _rpc = createSolanaRpc(rpcUrl);
  _rpcUrl = rpcUrl;
  return _rpc;
}

// =============================================================================
// Public API
// =============================================================================

export interface RvuiBalance {
  /** Raw token amount (with decimals). */
  raw: bigint;
  /** Human-readable balance (e.g., "1,234.56"). */
  formatted: string;
  /** Balance as a plain number (may lose precision for very large amounts). */
  uiAmount: number;
}

/**
 * Get the RVUI balance for a wallet address.
 *
 * Queries the Token-2022 Associated Token Account for the RVUI mint.
 * Returns zero balance if the ATA does not exist (wallet has never held RVUI).
 */
export async function getRvuiBalance(walletAddress: string): Promise<RvuiBalance> {
  return callWithResilience(async () => {
    const rpc = getRpc();
    const config = getRevealCoinConfig();
    const mintAddress = RVUI_MINT_ADDRESSES[config.network];
    if (!mintAddress) {
      throw new Error(`RVUI not deployed on ${config.network}`);
    }

    const wallet = address(walletAddress);
    const mint = address(mintAddress);

    const response = await rpc
      .getTokenAccountsByOwner(
        wallet,
        { mint },
        { encoding: 'jsonParsed', commitment: config.queryCommitment },
      )
      .send();

    if (response.value.length === 0) {
      return { raw: 0n, formatted: '0', uiAmount: 0 };
    }

    const firstAccount = response.value[0];
    if (!firstAccount) {
      return { raw: 0n, formatted: '0', uiAmount: 0 };
    }
    const accountData = firstAccount.account.data as {
      parsed: { info: { tokenAmount: { amount: string } } };
    };
    const raw = BigInt(accountData.parsed.info.tokenAmount.amount);
    const divisor = 10 ** RVUI_TOKEN_CONFIG.decimals;
    const uiAmount = Number(raw) / divisor;

    return {
      raw,
      formatted: uiAmount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: RVUI_TOKEN_CONFIG.decimals,
      }),
      uiAmount,
    };
  }, 'getRvuiBalance');
}

/**
 * Per-payment context required for the RVUI safeguards pipeline.
 *
 * - `userId` — RevealUI account that initiated the payment. Used as the
 *   FK target on `revealcoinPayments.user_id` and the rate-limit /
 *   discount-cap key inside `validatePayment`. Must be non-empty.
 * - `amountUsd` — human-readable USD value of the payment (e.g. `'0.05'`).
 *   This is the *negotiated* price the agent agreed to pay (already
 *   includes the 20% RVUI discount), not the underlying RVUI amount.
 *   Used by `validatePayment`'s single-payment cap + monthly-discount cap.
 */
export interface RvuiPaymentSafeguardsContext {
  userId: string;
  amountUsd: string;
}

/**
 * Verify an RVUI payment transaction on-chain AND run the safeguards
 * pipeline (replay-protection, $500 single-payment cap, wallet rate
 * limit, monthly discount cap, TWAP circuit breaker). On success,
 * record the payment in `revealcoinPayments` so future replays of the
 * same txSignature are caught by `isDuplicateTransaction`.
 *
 * GAP-159: this function previously did only the on-chain check —
 * `validatePayment`, `recordPayment`, and `isDuplicateTransaction`
 * were dead code. Wiring them in here is the fix for the replay-attack
 * hole that gated `RVUI_PAYMENTS_ENABLED=true` in any real-money
 * environment.
 *
 * Uses `finalized` commitment to prevent rollback exploits.
 */
export async function verifyRvuiPayment(
  txSignature: string,
  expectedAmountRaw: bigint,
  expectedRecipient: string,
  safeguards: RvuiPaymentSafeguardsContext,
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (!safeguards.userId) {
    return {
      valid: false,
      error: 'RVUI payments require an authenticated user (safeguards.userId is empty)',
    };
  }

  return callWithResilience(async () => {
    const rpc = getRpc();
    const config = getRevealCoinConfig();
    const mintAddress = RVUI_MINT_ADDRESSES[config.network];
    if (!mintAddress) {
      return { valid: false, error: `RVUI not deployed on ${config.network}` };
    }

    const tx = await rpc
      .getTransaction(signature(txSignature), {
        commitment: config.paymentCommitment,
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
      })
      .send();

    if (!tx) {
      return { valid: false, error: 'Transaction not found or not yet finalized' };
    }

    if (tx.meta?.err) {
      return { valid: false, error: `Transaction failed: ${JSON.stringify(tx.meta.err)}` };
    }

    // Parse token balance changes from transaction meta
    const preBalances = tx.meta?.preTokenBalances ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    // In @solana/kit, addresses are strings  -  no PublicKey class needed
    const recipientPost = postBalances.find(
      (b) =>
        b.mint === mintAddress &&
        b.owner === expectedRecipient &&
        b.programId === RVUI_TOKEN_PROGRAM,
    );

    const recipientPre = preBalances.find(
      (b) =>
        b.mint === mintAddress &&
        b.owner === expectedRecipient &&
        b.programId === RVUI_TOKEN_PROGRAM,
    );

    if (!recipientPost) {
      return { valid: false, error: 'Recipient did not receive RVUI tokens in this transaction' };
    }

    const preAmount = BigInt(recipientPre?.uiTokenAmount.amount ?? '0');
    const postAmount = BigInt(recipientPost.uiTokenAmount.amount);
    const received = postAmount - preAmount;

    if (received < expectedAmountRaw) {
      return {
        valid: false,
        error: `Insufficient payment: expected ${expectedAmountRaw}, received ${received}`,
      };
    }

    // Identify the payment sender — the account whose RVUI balance
    // decreased in this transaction. validatePayment keys wallet rate
    // limits on this address (3 payments/wallet/hour by default).
    let sourceWallet: string | null = null;
    for (const post of postBalances) {
      if (
        post.mint !== mintAddress ||
        post.programId !== RVUI_TOKEN_PROGRAM ||
        post.owner === expectedRecipient
      ) {
        continue;
      }
      const pre = preBalances.find((p) => p.owner === post.owner && p.mint === post.mint);
      const preAmt = BigInt(pre?.uiTokenAmount.amount ?? '0');
      const postAmt = BigInt(post.uiTokenAmount.amount);
      if (postAmt < preAmt) {
        // post.owner is typed as Address (branded string) by @solana/kit;
        // safeguards.validatePayment takes a plain string. Coerce explicitly.
        sourceWallet = post.owner ? String(post.owner) : null;
        break;
      }
    }

    if (!sourceWallet) {
      return {
        valid: false,
        error: 'Could not identify payment sender from transaction balances',
      };
    }

    // GAP-159: run safeguards AFTER on-chain verification passes, BEFORE
    // recording. validatePayment runs five checks in order:
    //   1. isDuplicateTransaction (replay protection)
    //   2. isPriceCircuitBreakerOpen (TWAP-based volatility halt)
    //   3. isPaymentOverMaximum (single-payment USD cap)
    //   4. isWalletRateLimited (per-wallet hourly cap)
    //   5. isDiscountCapExceeded (per-user monthly cap)
    // Dynamic import keeps the safeguards module out of cold-start cost
    // when RVUI is disabled.
    const { validatePayment, recordPayment } = await import('./safeguards.js');
    const amountUsdNum = Number.parseFloat(safeguards.amountUsd);
    if (!Number.isFinite(amountUsdNum) || amountUsdNum <= 0) {
      return {
        valid: false,
        error: `Invalid safeguards.amountUsd: ${JSON.stringify(safeguards.amountUsd)}`,
      };
    }

    const safeguardResult = await validatePayment({
      walletAddress: sourceWallet,
      userId: safeguards.userId,
      txSignature,
      amountUsd: amountUsdNum,
    });
    if (!safeguardResult.allowed) {
      // Emit the rejection metric BEFORE returning so operators can see
      // which safeguard fired (replay vs cap vs rate-limit vs ...).
      trackX402SafeguardRejection(classifySafeguardReason(safeguardResult.reason));
      return {
        valid: false,
        error: safeguardResult.reason ?? 'Payment safeguard check failed',
      };
    }

    // Record the payment so isDuplicateTransaction catches future
    // replays of this txSignature. Discount math: amountUsd in safeguards
    // context is the negotiated (post-discount) USD price, which is 80%
    // of the un-discounted USDC price after the 20% RVUI discount per
    // x402.ts:208. Customer savings = full - paid = full * 0.2 =
    // (amountUsd / 0.8) * 0.2 = amountUsd * 0.25.
    const discountUsd = amountUsdNum * 0.25;
    try {
      await recordPayment({
        txSignature,
        walletAddress: sourceWallet,
        userId: safeguards.userId,
        amountRvui: expectedAmountRaw.toString(),
        amountUsd: amountUsdNum,
        discountUsd,
        purpose: 'agent_task',
      });
    } catch (err) {
      // recordPayment failed (e.g., DB unavailable). The on-chain payment
      // and safeguard checks all passed — refusing service after the
      // customer paid is the worse failure mode. Log loudly so the gap
      // shows up in monitoring; future hardening should add INSERT...ON
      // CONFLICT idempotency so retries don't double-charge.
      logger.error(
        'recordPayment failed after successful RVUI verify',
        err instanceof Error ? err : new Error(String(err)),
        { txSignature, sourceWallet, userId: safeguards.userId },
      );
    }

    return { valid: true };
  }, 'verifyRvuiPayment');
}

/**
 * Total RVUI token supply, queried from the Token-2022 mint.
 */
export interface RvuiSupply {
  /** Raw on-chain amount (including decimals). */
  raw: bigint;
  /** Total supply formatted as a decimal string (e.g. "58906000000.000000"). */
  uiAmountString: string;
  /** Token decimals (RVUI is 6). */
  decimals: number;
}

/**
 * Get the total RVUI token supply.
 *
 * Queries the Token-2022 mint info via Solana JSON-RPC `getTokenSupply`.
 * Reflects current circulating supply minus any burns.
 */
export async function getRvuiSupply(): Promise<RvuiSupply> {
  return callWithResilience(async () => {
    const rpc = getRpc();
    const config = getRevealCoinConfig();
    const mintAddress = RVUI_MINT_ADDRESSES[config.network];
    if (!mintAddress) {
      throw new Error(`RVUI not deployed on ${config.network}`);
    }

    const mint = address(mintAddress);

    const response = await rpc.getTokenSupply(mint, { commitment: config.queryCommitment }).send();

    return {
      raw: BigInt(response.value.amount),
      uiAmountString: response.value.uiAmountString,
      decimals: response.value.decimals,
    };
  }, 'getRvuiSupply');
}

// =============================================================================
// Test-only exports
// =============================================================================

export const __solanaCircuitBreaker = solanaCircuitBreaker;
export const __CIRCUIT_BREAKER_CONFIG = CIRCUIT_BREAKER_CONFIG;
export const __RETRY_CONFIG = RETRY_CONFIG;
export const __resetCircuitBreaker = (): Promise<void> => solanaCircuitBreaker.reset();
export const __resetConnection = (): void => {
  _rpc = null;
  _rpcUrl = null;
};
