import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPaymentMethods,
  buildPaymentRequired,
  createNonceClaimStore,
  decideNonceClaim,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
  readPaymentClaim,
  settlementSupportsPayout,
  settlePayment,
  toUsdcAtomicUnits,
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

  it('calls only the verify endpoint and does not settle', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ isValid: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const encoded = encodeSignedPayload();
    const result = await verifyPayment(encoded, 'https://example.com/test');
    expect(result.valid).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://test-facilitator.example.com/verify');
  });
});

function encodeSignedPayload(authorization: Record<string, string> = {}): string {
  const payload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'evm:base',
    payload: {
      signature: '0xsig',
      authorization: {
        from: '0xpayer',
        to: '0xpayee',
        value: '1000',
        validAfter: '0',
        validBefore: '4000000000',
        nonce: '0xnonce-1',
        ...authorization,
      },
    },
  };
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
}

describe('readPaymentClaim', () => {
  const nowMs = 1_700_000_000_000;

  it('rejects an authorization that has expired', () => {
    const encoded = encodeSignedPayload({ validBefore: '1000' });
    const result = readPaymentClaim(encoded, nowMs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('expired');
  });

  it('rejects an authorization that is not active yet', () => {
    const encoded = encodeSignedPayload({ validAfter: '4000000000', validBefore: '4000000001' });
    const result = readPaymentClaim(encoded, nowMs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not active');
  });

  it('reads nonce, payer, and amount from an active authorization', () => {
    const encoded = encodeSignedPayload({ nonce: '0xabc', value: '5000', from: '0xfrom' });
    const result = readPaymentClaim(encoded, nowMs);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.claim.nonce).toBe('0xabc');
      expect(result.claim.amount).toBe('5000');
      expect(result.claim.payer).toBe('0xfrom');
    }
  });
});

describe('settlePayment', () => {
  beforeEach(() => {
    setEnv({
      X402_ENABLED: 'true',
      X402_RECEIVING_ADDRESS: '0xTestWallet',
      X402_FACILITATOR_URL: 'https://test-facilitator.example.com',
      X402_PRICE_PER_TASK: '0.001',
    });
  });

  it('settles through the facilitator after the authorization is still active', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, transaction: '0xtxhash', payer: '0xfrom' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const encoded = encodeSignedPayload({ value: '1000', nonce: '0xsettle' });
    const result = await settlePayment(
      encoded,
      'https://example.com/resource',
      'marketplace-invoke',
      {},
      '0.001',
      1_700_000_000_000,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.txHash).toBe('0xtxhash');
      expect(result.nonce).toBe('0xsettle');
      expect(result.amount).toBe('1000');
      expect(result.payer).toBe('0xfrom');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://test-facilitator.example.com/settle');
  });

  it('does not call the facilitator when the authorization has expired', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const encoded = encodeSignedPayload({ validBefore: '10' });
    const result = await settlePayment(
      encoded,
      'https://example.com/resource',
      'marketplace-invoke',
      {},
      undefined,
      1_700_000_000_000,
    );
    expect(result.ok).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns failure when the facilitator settlement call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('bad gateway'),
      }),
    );

    const encoded = encodeSignedPayload();
    const result = await settlePayment(
      encoded,
      'https://example.com/resource',
      'marketplace-invoke',
      {},
      '0.001',
      1_700_000_000_000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('HTTP 502');
  });

  it('returns failure when the facilitator reports the payment was not settled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, errorReason: 'not settled' }),
      }),
    );

    const encoded = encodeSignedPayload();
    const result = await settlePayment(
      encoded,
      'https://example.com/resource',
      'marketplace-invoke',
      {},
      '0.001',
      1_700_000_000_000,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not settled');
  });
});

describe('nonce claim', () => {
  const record = {
    paymentNonce: '0xnonce-1',
    txHash: '0xtx',
    amount: '1000',
    payer: '0xpayer',
    resource: 'https://example.com/a',
    status: 'settled' as const,
  };

  it('keeps one row per nonce, rejects a different second use, and returns the same row on an identical retry', () => {
    const store = createNonceClaimStore();
    const first = store.claim(record);
    const replay = store.claim({ ...record, resource: 'https://example.com/b' });
    const sameAgain = store.claim(record);

    expect(first).toEqual({ ok: true, created: true, record });
    expect(replay).toEqual({ ok: false, reason: 'replay' });
    expect(sameAgain).toEqual({ ok: true, created: false, record });
    expect(decideNonceClaim(null)).toBe('insert');
    expect(decideNonceClaim({ paymentNonce: record.paymentNonce })).toBe('replay');
  });

  it('matches a payout only to a settled row for the same amount and resource', () => {
    expect(toUsdcAtomicUnits('1.00')).toBe('1000000');
    expect(
      settlementSupportsPayout(
        { status: 'settled', amount: '1000000', resource: 'https://example.com/a' },
        '1000000',
        'https://example.com/a',
      ),
    ).toBe(true);
    expect(
      settlementSupportsPayout(
        { status: 'settled', amount: '1', resource: 'https://example.com/a' },
        '1000000',
        'https://example.com/a',
      ),
    ).toBe(false);
    expect(settlementSupportsPayout(null, '1000000', 'https://example.com/a')).toBe(false);
  });
});
