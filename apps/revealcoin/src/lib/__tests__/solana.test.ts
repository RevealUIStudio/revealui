import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('solana RPC helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  it('getTokenSupply returns parsed supply data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {
            context: {},
            value: {
              amount: '58900000000000000000',
              decimals: 9,
              uiAmount: 58900000000,
              uiAmountString: '58900000000',
            },
          },
        }),
    });

    const { getTokenSupply } = await import('../solana.js');
    const supply = await getTokenSupply('FakeMinTAddr123');

    expect(supply.uiAmountString).toBe('58900000000');
    expect(supply.decimals).toBe(9);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws on HTTP error from Solana RPC', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    });

    const { getTokenSupply } = await import('../solana.js');
    await expect(getTokenSupply('FakeMinTAddr123')).rejects.toThrow('Solana RPC error: 429');
  });

  it('throws on RPC-level error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32600, message: 'Invalid request' },
        }),
    });

    const { getTokenSupply } = await import('../solana.js');
    await expect(getTokenSupply('FakeMinTAddr123')).rejects.toThrow('Invalid request');
  });

  it('getTokenBalance returns zero for empty wallet', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: { value: [] },
        }),
    });

    const { getTokenBalance } = await import('../solana.js');
    const balance = await getTokenBalance('SomeWallet123', 'SomeMint456');

    expect(balance.balance).toBe(0);
    expect(balance.raw).toBe('0');
    expect(balance.wallet).toBe('SomeWallet123');
  });
});
