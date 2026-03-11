import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock logger (must be before import)
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  buildPaymentMethods,
  buildPaymentRequired,
  encodePaymentRequired,
  getX402Config,
  verifyPayment,
} from '../x402.js';

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------
const originalEnv = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

beforeEach(() => {
  // Reset env to clean state
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('X402_')) delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getX402Config
// ---------------------------------------------------------------------------
describe('getX402Config', () => {
  it('returns disabled by default when no env vars set', () => {
    const config = getX402Config();
    expect(config.enabled).toBe(false);
    expect(config.receivingAddress).toBe('');
    expect(config.network).toBe('evm:base');
    expect(config.pricePerTask).toBe('0.001');
    expect(config.facilitatorUrl).toBe('https://x402.org/facilitator');
    expect(config.maxTimeoutSeconds).toBe(300);
  });

  it('reads enabled state from X402_ENABLED', () => {
    setEnv({ X402_ENABLED: 'true' });
    expect(getX402Config().enabled).toBe(true);

    setEnv({ X402_ENABLED: 'false' });
    expect(getX402Config().enabled).toBe(false);

    setEnv({ X402_ENABLED: 'yes' });
    expect(getX402Config().enabled).toBe(false); // only 'true' enables
  });

  it('reads receiving address', () => {
    setEnv({ X402_RECEIVING_ADDRESS: '0xabc123' });
    expect(getX402Config().receivingAddress).toBe('0xabc123');
  });

  it('selects correct USDC asset for network', () => {
    setEnv({ X402_NETWORK: 'evm:base' });
    expect(getX402Config().usdcAsset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

    setEnv({ X402_NETWORK: 'evm:base-sepolia' });
    expect(getX402Config().usdcAsset).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
  });

  it('falls back to base mainnet USDC for unknown network', () => {
    setEnv({ X402_NETWORK: 'evm:unknown' });
    expect(getX402Config().usdcAsset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('reads custom price per task', () => {
    setEnv({ X402_PRICE_PER_TASK: '0.01' });
    expect(getX402Config().pricePerTask).toBe('0.01');
  });

  it('reads custom facilitator URL', () => {
    setEnv({ X402_FACILITATOR_URL: 'https://custom.facilitator/verify' });
    expect(getX402Config().facilitatorUrl).toBe('https://custom.facilitator/verify');
  });
});

// ---------------------------------------------------------------------------
// encodePaymentRequired / decode roundtrip
// ---------------------------------------------------------------------------
describe('encodePaymentRequired', () => {
  it('produces valid base64 that roundtrips to the original object', () => {
    const req = buildPaymentRequired('https://api.example.com/api/agent-stream');
    const encoded = encodePaymentRequired(req);

    // Must be valid base64
    expect(() => Buffer.from(encoded, 'base64')).not.toThrow();

    // Roundtrip
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    expect(decoded.x402Version).toBe(1);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].resource).toBe('https://api.example.com/api/agent-stream');
  });
});

// ---------------------------------------------------------------------------
// buildPaymentRequired
// ---------------------------------------------------------------------------
describe('buildPaymentRequired', () => {
  beforeEach(() => {
    setEnv({
      X402_RECEIVING_ADDRESS: '0xTestWallet',
      X402_PRICE_PER_TASK: '0.001',
      X402_NETWORK: 'evm:base',
    });
  });

  it('builds a valid PaymentRequired with correct structure', () => {
    const result = buildPaymentRequired('https://api.example.com/api/agent-stream');

    expect(result.x402Version).toBe(1);
    expect(result.accepts).toHaveLength(1);

    const req = result.accepts[0];
    expect(req.scheme).toBe('exact');
    expect(req.network).toBe('evm:base');
    expect(req.resource).toBe('https://api.example.com/api/agent-stream');
    expect(req.payTo).toBe('0xTestWallet');
    expect(req.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(req.maxTimeoutSeconds).toBe(300);
    expect(req.mimeType).toBe('application/json');
  });

  it('converts price to USDC atomic units (6 decimals)', () => {
    setEnv({ X402_PRICE_PER_TASK: '0.001' });
    const result = buildPaymentRequired('https://example.com/test');
    expect(result.accepts[0].maxAmountRequired).toBe('1000'); // $0.001 = 1000 atomic

    setEnv({ X402_PRICE_PER_TASK: '1.0' });
    const result2 = buildPaymentRequired('https://example.com/test');
    expect(result2.accepts[0].maxAmountRequired).toBe('1000000'); // $1.00 = 1000000 atomic

    setEnv({ X402_PRICE_PER_TASK: '0.5' });
    const result3 = buildPaymentRequired('https://example.com/test');
    expect(result3.accepts[0].maxAmountRequired).toBe('500000'); // $0.50 = 500000 atomic
  });

  it('falls back to 1000 atomic units for invalid price', () => {
    setEnv({ X402_PRICE_PER_TASK: 'not-a-number' });
    const result = buildPaymentRequired('https://example.com/test');
    expect(result.accepts[0].maxAmountRequired).toBe('1000');

    setEnv({ X402_PRICE_PER_TASK: '-5' });
    const result2 = buildPaymentRequired('https://example.com/test');
    expect(result2.accepts[0].maxAmountRequired).toBe('1000');

    setEnv({ X402_PRICE_PER_TASK: '0' });
    const result3 = buildPaymentRequired('https://example.com/test');
    expect(result3.accepts[0].maxAmountRequired).toBe('1000');
  });
});

// ---------------------------------------------------------------------------
// buildPaymentMethods
// ---------------------------------------------------------------------------
describe('buildPaymentMethods', () => {
  it('returns null when x402 is disabled', () => {
    setEnv({ X402_ENABLED: 'false' });
    expect(buildPaymentMethods('https://api.example.com')).toBeNull();
  });

  it('returns null when enabled but no receiving address', () => {
    setEnv({ X402_ENABLED: 'true' });
    // X402_RECEIVING_ADDRESS not set → defaults to ''
    expect(buildPaymentMethods('https://api.example.com')).toBeNull();
  });

  it('returns valid payload when enabled with address', () => {
    setEnv({
      X402_ENABLED: 'true',
      X402_RECEIVING_ADDRESS: '0xTestWallet',
      X402_PRICE_PER_TASK: '0.001',
      X402_NETWORK: 'evm:base',
    });

    const result = buildPaymentMethods('https://api.example.com');
    expect(result).not.toBeNull();
    expect(result!.version).toBe('1.0');

    const accepts = result!.accepts as Array<Record<string, unknown>>;
    expect(accepts).toHaveLength(1);
    expect(accepts[0].resource).toBe('https://api.example.com/api/agent-stream');
    expect(accepts[0].payTo).toBe('0xTestWallet');
    expect(accepts[0].scheme).toBe('exact');
    expect(accepts[0].network).toBe('evm:base');
  });
});

// ---------------------------------------------------------------------------
// verifyPayment
// ---------------------------------------------------------------------------
describe('verifyPayment', () => {
  beforeEach(() => {
    setEnv({
      X402_ENABLED: 'true',
      X402_RECEIVING_ADDRESS: '0xTestWallet',
      X402_FACILITATOR_URL: 'https://test-facilitator.example.com',
    });
  });

  it('rejects invalid base64 payload', async () => {
    const result = await verifyPayment('not-valid-json!!!', 'https://example.com/test');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Could not decode');
    }
  });

  it('rejects payload that decodes to invalid JSON', async () => {
    const badBase64 = Buffer.from('not json at all {{{', 'utf-8').toString('base64');
    const result = await verifyPayment(badBase64, 'https://example.com/test');
    expect(result.valid).toBe(false);
  });

  it('calls facilitator and returns valid on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ isValid: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'evm:base',
      payload: { txHash: '0xabc' },
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test');
    expect(result.valid).toBe(true);

    // Verify fetch was called with correct URL and body
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test-facilitator.example.com/verify');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.x402Version).toBe(1);
    expect(body.paymentPayload).toEqual(payload);
    expect(body.paymentRequirements.resource).toBe('https://example.com/test');
  });

  it('returns invalid when facilitator rejects payment', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ isValid: false, invalidReason: 'Insufficient funds' }),
      }),
    );

    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'evm:base',
      payload: { txHash: '0xabc' },
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe('Insufficient funds');
    }
  });

  it('handles facilitator HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    );

    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'evm:base',
      payload: {},
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('HTTP 500');
    }
  });

  it('handles network errors gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'evm:base',
      payload: {},
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('ECONNREFUSED');
    }
  });

  it('uses the same resource URL for both 402 response and verification', () => {
    // This test verifies the fix for the resource URL mismatch bug.
    // buildPaymentRequired must produce the same resource whether called from
    // the 402 response path or the verify path — both use the full canonical URL.
    const resource = 'https://api.revealui.com/api/agent-stream';
    const paymentRequired = buildPaymentRequired(resource);
    const requirement = paymentRequired.accepts[0];

    // The resource in the requirement must match what was passed in
    expect(requirement.resource).toBe(resource);

    // Verify that verifyPayment internally rebuilds with the same resource
    // (it calls buildPaymentRequired(resource).accepts[0])
    // We can't test the internal call directly, but we verify the contract:
    // the resource field in the requirement must be exactly what was passed.
    const rebuilt = buildPaymentRequired(resource).accepts[0];
    expect(rebuilt.resource).toBe(requirement.resource);
  });
});
