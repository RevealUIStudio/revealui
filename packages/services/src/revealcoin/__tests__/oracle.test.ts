import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@revealui/contracts', () => ({
  RVUI_MINT_ADDRESSES: {
    devnet: '4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo',
    'mainnet-beta': '',
  },
}));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockGetRevealCoinConfig = vi.fn((): { network: 'devnet' | 'mainnet-beta' } => ({
  network: 'devnet',
}));

vi.mock('../config.js', () => ({
  getRevealCoinConfig: () => mockGetRevealCoinConfig(),
}));

const mockRecordPriceSnapshot = vi.fn();
const mockGetTwapPrice = vi.fn();

vi.mock('../safeguards.js', () => ({
  recordPriceSnapshot: (...args: unknown[]) => mockRecordPriceSnapshot(...args),
  getTwapPrice: () => mockGetTwapPrice(),
}));

import {
  configurePriceOracle,
  fetchRvuiPrice,
  getPriceOracleConfig,
  isPriceOracleRunning,
  recordPriceFromJupiter,
  rvuiToUsd,
  startPriceOracle,
  stopPriceOracle,
  usdToRvui,
} from '../oracle.js';

describe('PriceOracle config', () => {
  afterEach(() => {
    configurePriceOracle({ apiKey: '' });
  });

  it('returns default config', () => {
    const config = getPriceOracleConfig();
    expect(config.apiUrl).toBe('https://api.jup.ag/price/v3');
    expect(config.pollIntervalMs).toBe(60_000);
    expect(config.requestTimeoutMs).toBe(10_000);
    expect(config.maxConsecutiveFailures).toBe(10);
  });

  it('overrides config', () => {
    configurePriceOracle({ pollIntervalMs: 5_000, maxConsecutiveFailures: 3 });
    const config = getPriceOracleConfig();
    expect(config.pollIntervalMs).toBe(5_000);
    expect(config.maxConsecutiveFailures).toBe(3);
  });

  it('reads API key from env', () => {
    process.env.JUPITER_API_KEY = 'test-key-123';
    const config = getPriceOracleConfig();
    expect(config.apiKey).toBe('test-key-123');
    delete process.env.JUPITER_API_KEY;
  });
});

describe('fetchRvuiPrice', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    delete process.env.JUPITER_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    configurePriceOracle({ apiKey: '' });
  });

  it('returns null when API key is not configured', async () => {
    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });

  it('returns price data on success', async () => {
    configurePriceOracle({ apiKey: 'test-key' });

    const mintAddress = '4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          [mintAddress]: {
            createdAt: '2026-01-01T00:00:00Z',
            liquidity: 50_000,
            usdPrice: 0.0042,
            blockId: 123456,
            decimals: 6,
            priceChange24h: -2.5,
          },
        }),
    });

    const result = await fetchRvuiPrice();
    expect(result).toEqual({
      priceUsd: 0.0042,
      liquidity: 50_000,
      blockId: 123456,
      priceChange24h: -2.5,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining(mintAddress),
      expect.objectContaining({
        headers: { 'x-api-key': 'test-key' },
      }),
    );
  });

  it('returns null on 429 rate limit', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });

  it('returns null on 401 unauthorized', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });

    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });

  it('returns null on other HTTP errors', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });

  it('returns null when token has no price data', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });

    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });

  it('returns null when mint address is empty', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    mockGetRevealCoinConfig.mockReturnValueOnce({ network: 'mainnet-beta' as const });

    const result = await fetchRvuiPrice();
    expect(result).toBeNull();
  });
});

describe('recordPriceFromJupiter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    configurePriceOracle({ apiKey: '' });
    mockRecordPriceSnapshot.mockClear();
  });

  it('records snapshot and returns price on success', async () => {
    configurePriceOracle({ apiKey: 'test-key' });
    const mintAddress = '4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo';

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          [mintAddress]: {
            createdAt: '2026-01-01T00:00:00Z',
            liquidity: 50_000,
            usdPrice: 0.0042,
            blockId: 123456,
            decimals: 6,
            priceChange24h: null,
          },
        }),
    });

    const result = await recordPriceFromJupiter();
    expect(result).toBe(0.0042);
    expect(mockRecordPriceSnapshot).toHaveBeenCalledWith(0.0042, 'jupiter-v3');
  });

  it('returns null when fetch fails', async () => {
    const result = await recordPriceFromJupiter();
    expect(result).toBeNull();
    expect(mockRecordPriceSnapshot).not.toHaveBeenCalled();
  });
});

describe('rvuiToUsd', () => {
  afterEach(() => {
    mockGetTwapPrice.mockClear();
  });

  it('converts RVUI to USD using TWAP', async () => {
    mockGetTwapPrice.mockResolvedValue(0.005);
    const result = await rvuiToUsd(1000);
    expect(result).toBe(5);
  });

  it('returns null when TWAP is unavailable', async () => {
    mockGetTwapPrice.mockResolvedValue(null);
    const result = await rvuiToUsd(1000);
    expect(result).toBeNull();
  });
});

describe('usdToRvui', () => {
  afterEach(() => {
    mockGetTwapPrice.mockClear();
  });

  it('converts USD to RVUI using TWAP', async () => {
    mockGetTwapPrice.mockResolvedValue(0.005);
    const result = await usdToRvui(5);
    expect(result).toBe(1000);
  });

  it('returns null when TWAP is unavailable', async () => {
    mockGetTwapPrice.mockResolvedValue(null);
    const result = await usdToRvui(5);
    expect(result).toBeNull();
  });

  it('returns null when TWAP is zero', async () => {
    mockGetTwapPrice.mockResolvedValue(0);
    const result = await usdToRvui(5);
    expect(result).toBeNull();
  });
});

describe('polling lifecycle', () => {
  afterEach(() => {
    stopPriceOracle();
    configurePriceOracle({ apiKey: '' });
  });

  it('reports not running initially', () => {
    expect(isPriceOracleRunning()).toBe(false);
  });

  it('does not start without API key', () => {
    startPriceOracle();
    expect(isPriceOracleRunning()).toBe(false);
  });

  it('starts and stops with API key', () => {
    configurePriceOracle({ apiKey: 'test-key', pollIntervalMs: 60_000 });
    startPriceOracle();
    expect(isPriceOracleRunning()).toBe(true);

    stopPriceOracle();
    expect(isPriceOracleRunning()).toBe(false);
  });

  it('prevents duplicate starts', () => {
    configurePriceOracle({ apiKey: 'test-key', pollIntervalMs: 60_000 });
    startPriceOracle();
    startPriceOracle(); // should warn, not create second timer
    expect(isPriceOracleRunning()).toBe(true);

    stopPriceOracle();
    expect(isPriceOracleRunning()).toBe(false);
  });

  it('stop is idempotent', () => {
    stopPriceOracle();
    stopPriceOracle();
    expect(isPriceOracleRunning()).toBe(false);
  });
});
