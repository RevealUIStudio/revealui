import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPaymentMethods,
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
  verifyPayment,
} from '../index.js';

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
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('X402_')) {
      delete process.env[key];
    }
  }
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe('getAdvertisedCurrencyLabel', () => {
  it('always returns usdc-only', () => {
    expect(getAdvertisedCurrencyLabel()).toBe('usdc-only');
  });
});

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

  it('selects correct USDC asset for network, falling back for unknown networks', () => {
    setEnv({ X402_NETWORK: 'evm:base' });
    expect(getX402Config().usdcAsset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

    setEnv({ X402_NETWORK: 'evm:base-sepolia' });
    expect(getX402Config().usdcAsset).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');

    setEnv({ X402_NETWORK: 'evm:unknown' });
    expect(getX402Config().usdcAsset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('reads custom price per task and facilitator URL', () => {
    setEnv({
      X402_PRICE_PER_TASK: '0.01',
      X402_FACILITATOR_URL: 'https://custom.facilitator/verify',
    });
    const config = getX402Config();
    expect(config.pricePerTask).toBe('0.01');
    expect(config.facilitatorUrl).toBe('https://custom.facilitator/verify');
  });
});

describe('encodePaymentRequired', () => {
  it('produces valid base64 that roundtrips to the original object', () => {
    const req = buildPaymentRequired('https://api.example.com/api/agent-stream');
    const encoded = encodePaymentRequired(req);

    expect(() => Buffer.from(encoded, 'base64')).not.toThrow();

    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
    expect(decoded.x402Version).toBe(1);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].resource).toBe('https://api.example.com/api/agent-stream');
  });
});

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
    expect(buildPaymentRequired('https://example.com/test').accepts[0].maxAmountRequired).toBe(
      '1000',
    );

    setEnv({ X402_PRICE_PER_TASK: '1.0' });
    expect(buildPaymentRequired('https://example.com/test').accepts[0].maxAmountRequired).toBe(
      '1000000',
    );

    setEnv({ X402_PRICE_PER_TASK: '0.5' });
    expect(buildPaymentRequired('https://example.com/test').accepts[0].maxAmountRequired).toBe(
      '500000',
    );
  });

  it('falls back to 1000 atomic units for invalid price', () => {
    setEnv({ X402_PRICE_PER_TASK: 'not-a-number' });
    expect(buildPaymentRequired('https://example.com/test').accepts[0].maxAmountRequired).toBe(
      '1000',
    );

    setEnv({ X402_PRICE_PER_TASK: '-5' });
    expect(buildPaymentRequired('https://example.com/test').accepts[0].maxAmountRequired).toBe(
      '1000',
    );

    setEnv({ X402_PRICE_PER_TASK: '0' });
    expect(buildPaymentRequired('https://example.com/test').accepts[0].maxAmountRequired).toBe(
      '1000',
    );
  });

  it('uses the same resource URL for both the 402 response and verification', () => {
    const resource = 'https://api.revealui.com/api/agent-stream';
    const paymentRequired = buildPaymentRequired(resource);
    const rebuilt = buildPaymentRequired(resource);
    expect(paymentRequired.accepts[0].resource).toBe(resource);
    expect(rebuilt.accepts[0].resource).toBe(paymentRequired.accepts[0].resource);
  });
});

describe('buildPaymentMethods', () => {
  it('returns null when x402 is disabled', () => {
    setEnv({ X402_ENABLED: 'false' });
    expect(buildPaymentMethods('https://api.example.com')).toBeNull();
  });

  it('returns null when enabled but no receiving address', () => {
    setEnv({ X402_ENABLED: 'true' });
    expect(buildPaymentMethods('https://api.example.com')).toBeNull();
  });

  it('returns a valid payload when enabled with an address', () => {
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

describe('verifyPayment', () => {
  beforeEach(() => {
    setEnv({
      X402_ENABLED: 'true',
      X402_RECEIVING_ADDRESS: '0xTestWallet',
      X402_FACILITATOR_URL: 'https://test-facilitator.example.com',
    });
  });

  it('rejects invalid base64 payload without invoking any hook', async () => {
    const onFacilitatorWarn = vi.fn();
    const onVerified = vi.fn();

    const result = await verifyPayment('not-valid-json!!!', 'https://example.com/test', 'unknown', {
      onFacilitatorWarn,
      onVerified,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('Could not decode');
    }
    expect(onFacilitatorWarn).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('rejects payload that decodes to invalid JSON', async () => {
    const badBase64 = Buffer.from('not json at all {{{', 'utf-8').toString('base64');
    const result = await verifyPayment(badBase64, 'https://example.com/test');
    expect(result.valid).toBe(false);
  });

  it('works with no hooks supplied (hooks are fully optional)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ isValid: true }) }),
    );

    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'evm:base',
      payload: { txHash: '0xabc' },
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test');
    expect(result.valid).toBe(true);
  });

  it('calls facilitator, returns valid on success, and invokes onVerified', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ isValid: true }),
    });
    vi.stubGlobal('fetch', mockFetch);
    const onVerified = vi.fn();

    const payload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'evm:base',
      payload: { txHash: '0xabc' },
    };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test', 'a2a', { onVerified });
    expect(result.valid).toBe(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test-facilitator.example.com/verify');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.x402Version).toBe(1);
    expect(body.paymentPayload).toEqual(payload);
    expect(body.paymentRequirements.resource).toBe('https://example.com/test');

    expect(onVerified).toHaveBeenCalledTimes(1);
    const [route, durationMs, valid] = onVerified.mock.calls[0];
    expect(route).toBe('a2a');
    expect(typeof durationMs).toBe('number');
    expect(valid).toBe(true);
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

  it('handles facilitator HTTP errors and invokes onFacilitatorWarn', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }),
    );
    const onFacilitatorWarn = vi.fn();

    const payload = { x402Version: 1, scheme: 'exact', network: 'evm:base', payload: {} };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test', 'unknown', {
      onFacilitatorWarn,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('HTTP 500');
    }
    expect(onFacilitatorWarn).toHaveBeenCalledTimes(1);
    expect(onFacilitatorWarn.mock.calls[0][0]).toBe('x402 facilitator returned non-OK status');
  });

  it('handles network errors gracefully and invokes onFacilitatorWarn', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const onFacilitatorWarn = vi.fn();

    const payload = { x402Version: 1, scheme: 'exact', network: 'evm:base', payload: {} };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const result = await verifyPayment(encoded, 'https://example.com/test', 'unknown', {
      onFacilitatorWarn,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toContain('ECONNREFUSED');
    }
    expect(onFacilitatorWarn).toHaveBeenCalledTimes(1);
    expect(onFacilitatorWarn.mock.calls[0][0]).toBe('x402 facilitator request failed');
  });
});
