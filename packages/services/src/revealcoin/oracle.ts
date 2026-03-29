/**
 * Jupiter Price Oracle for RVUI → USD conversion.
 *
 * Fetches live RVUI price from Jupiter Price API v3, records snapshots
 * to the database for TWAP calculation, and provides a polling loop
 * for continuous price monitoring.
 *
 * Per whitepaper Section 9.4:
 *   - Source: Jupiter aggregator price feed (RVUI/USDC pair)
 *   - Window: 1-hour TWAP to smooth volatility
 *   - Update frequency: Every 60 seconds
 *   - Fallback: If oracle is unavailable, fiat pricing applies (no RVUI discount)
 *
 * Requires JUPITER_API_KEY env var (free tier: 1 RPS, sufficient for 60s polling).
 */

import { RVUI_MINT_ADDRESSES } from '@revealui/contracts';
import { createLogger } from '@revealui/core/observability/logger';

import { getRevealCoinConfig } from './config.js';
import { getTwapPrice, recordPriceSnapshot } from './safeguards.js';

const logger = createLogger({ service: 'RevealCoin:Oracle' });

// =============================================================================
// Configuration
// =============================================================================

export interface PriceOracleConfig {
  /** Jupiter Price API v3 endpoint. */
  apiUrl: string;
  /** Jupiter API key (required). Free tier at portal.jup.ag */
  apiKey: string;
  /** Polling interval in milliseconds. Default: 60_000 (60 seconds) */
  pollIntervalMs: number;
  /** Request timeout in milliseconds. Default: 10_000 */
  requestTimeoutMs: number;
  /** Maximum consecutive failures before stopping. Default: 10 */
  maxConsecutiveFailures: number;
}

const DEFAULT_CONFIG: PriceOracleConfig = {
  apiUrl: 'https://api.jup.ag/price/v3',
  apiKey: '',
  pollIntervalMs: 60_000,
  requestTimeoutMs: 10_000,
  maxConsecutiveFailures: 10,
};

let oracleConfig: PriceOracleConfig = { ...DEFAULT_CONFIG };

export function configurePriceOracle(overrides: Partial<PriceOracleConfig>): void {
  oracleConfig = { ...DEFAULT_CONFIG, ...overrides };
}

export function getPriceOracleConfig(): PriceOracleConfig {
  return {
    ...oracleConfig,
    apiKey: process.env.JUPITER_API_KEY ?? oracleConfig.apiKey,
  };
}

// =============================================================================
// Jupiter API Types
// =============================================================================

interface JupiterPriceEntry {
  createdAt: string;
  liquidity: number;
  usdPrice: number;
  blockId: number | null;
  decimals: number;
  priceChange24h: number | null;
}

type JupiterPriceResponse = Record<string, JupiterPriceEntry>;

// =============================================================================
// Price Fetching
// =============================================================================

/**
 * Fetch the current RVUI price in USD from Jupiter Price API v3.
 *
 * Returns null if:
 * - No API key configured
 * - RVUI mint not found on the active network
 * - Jupiter returns no price data (no recent trades)
 * - Network/API error
 */
export async function fetchRvuiPrice(): Promise<{
  priceUsd: number;
  liquidity: number;
  blockId: number | null;
  priceChange24h: number | null;
} | null> {
  const config = getPriceOracleConfig();

  if (!config.apiKey) {
    logger.debug('Jupiter API key not configured, skipping price fetch');
    return null;
  }

  const rvuiConfig = getRevealCoinConfig();
  const mintAddress = RVUI_MINT_ADDRESSES[rvuiConfig.network];
  if (!mintAddress) {
    logger.warn('No RVUI mint address for network', { network: rvuiConfig.network });
    return null;
  }

  try {
    const url = `${config.apiUrl}?ids=${mintAddress}`;
    const response = await fetch(url, {
      headers: { 'x-api-key': config.apiKey },
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });

    if (response.status === 429) {
      logger.warn('Jupiter API rate limited');
      return null;
    }

    if (response.status === 401) {
      logger.error('Jupiter API key invalid or expired');
      return null;
    }

    if (!response.ok) {
      logger.warn('Jupiter API error', { status: response.status });
      return null;
    }

    const data = (await response.json()) as JupiterPriceResponse;
    const entry = data[mintAddress];

    if (!entry) {
      // Token has no recent trades — no price available
      logger.debug('No Jupiter price data for RVUI', { mint: mintAddress });
      return null;
    }

    return {
      priceUsd: entry.usdPrice,
      liquidity: entry.liquidity,
      blockId: entry.blockId,
      priceChange24h: entry.priceChange24h,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.warn('Failed to fetch RVUI price from Jupiter', { error: message });
    return null;
  }
}

// =============================================================================
// Snapshot Recording
// =============================================================================

/**
 * Fetch the current price and record a snapshot for TWAP calculation.
 *
 * Returns the recorded price or null if fetch failed.
 */
export async function recordPriceFromJupiter(): Promise<number | null> {
  const priceData = await fetchRvuiPrice();
  if (!priceData) return null;

  await recordPriceSnapshot(priceData.priceUsd, 'jupiter-v3');

  logger.debug('Recorded RVUI price snapshot', {
    priceUsd: priceData.priceUsd,
    liquidity: priceData.liquidity,
    blockId: priceData.blockId,
  });

  return priceData.priceUsd;
}

// =============================================================================
// RVUI → USD Conversion
// =============================================================================

/**
 * Convert an RVUI amount to its USD equivalent using TWAP.
 *
 * Returns null if no TWAP price is available (oracle offline or
 * insufficient snapshots). Callers should fall back to fiat-only pricing.
 */
export async function rvuiToUsd(rvuiAmount: number): Promise<number | null> {
  const twap = await getTwapPrice();
  if (twap === null) return null;
  return rvuiAmount * twap;
}

/**
 * Convert a USD amount to the equivalent RVUI using TWAP.
 *
 * Returns null if no TWAP price is available.
 */
export async function usdToRvui(usdAmount: number): Promise<number | null> {
  const twap = await getTwapPrice();
  if (twap === null || twap === 0) return null;
  return usdAmount / twap;
}

// =============================================================================
// Polling Loop
// =============================================================================

let pollTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;

/**
 * Start the price oracle polling loop.
 *
 * Fetches and records RVUI price at the configured interval.
 * Stops automatically after maxConsecutiveFailures.
 *
 * Call stopPriceOracle() to stop manually.
 */
export function startPriceOracle(): void {
  if (pollTimer) {
    logger.warn('Price oracle already running');
    return;
  }

  const config = getPriceOracleConfig();

  if (!config.apiKey) {
    logger.info('Jupiter API key not configured — price oracle disabled');
    return;
  }

  consecutiveFailures = 0;

  logger.info('Starting RVUI price oracle', {
    intervalMs: config.pollIntervalMs,
    apiUrl: config.apiUrl,
  });

  // Initial fetch
  void tick(config);

  pollTimer = setInterval(() => {
    void tick(config);
  }, config.pollIntervalMs);
}

async function tick(config: PriceOracleConfig): Promise<void> {
  const price = await recordPriceFromJupiter();

  if (price === null) {
    consecutiveFailures++;
    if (consecutiveFailures >= config.maxConsecutiveFailures) {
      logger.error('Price oracle stopped — too many consecutive failures', undefined, {
        failures: consecutiveFailures,
      });
      stopPriceOracle();
    }
  } else {
    consecutiveFailures = 0;
  }
}

/**
 * Stop the price oracle polling loop.
 */
export function stopPriceOracle(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('Price oracle stopped');
  }
}

/**
 * Check if the price oracle is currently running.
 */
export function isPriceOracleRunning(): boolean {
  return pollTimer !== null;
}
