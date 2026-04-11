/**
 * RevealCoin RPC Client
 *
 * Provides balance queries and payment verification for RevealCoin (RVUI)
 * on the Solana blockchain. Uses circuit breaker + retry pattern mirroring
 * the Stripe client in packages/services/src/stripe/stripeClient.ts.
 */

import { RVUI_MINT_ADDRESSES, RVUI_TOKEN_CONFIG, RVUI_TOKEN_PROGRAM } from '@revealui/contracts';
import { createLogger } from '@revealui/core/observability/logger';
import { address, createSolanaRpc, signature } from '@solana/kit';
import { DbCircuitBreaker } from '../stripe/db-circuit-breaker.js';
import { getRevealCoinConfig, resolveRpcUrl } from './config.js';

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
 * Verify an RVUI payment transaction on-chain.
 *
 * Confirms that a Solana transaction contains a Token-2022 transfer of
 * the correct amount to the expected recipient for the RVUI mint.
 *
 * Uses `finalized` commitment to prevent rollback exploits.
 */
export async function verifyRvuiPayment(
  txSignature: string,
  expectedAmountRaw: bigint,
  expectedRecipient: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
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

    return { valid: true };
  }, 'verifyRvuiPayment');
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
