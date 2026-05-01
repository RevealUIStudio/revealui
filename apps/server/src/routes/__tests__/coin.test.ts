import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks  -  must come before route import
// ---------------------------------------------------------------------------

vi.mock('@revealui/services/revealcoin', () => ({
  getRvuiBalance: vi.fn(),
  getRvuiSupply: vi.fn(),
}));

vi.mock('@revealui/contracts', () => ({
  RVUI_ALLOCATIONS: [
    {
      name: 'Ecosystem Rewards',
      percentage: 30,
      amount: 17_671_800_000_000_000n,
      wallet: 'EcoWallet111111111111111111111111111111111111',
      vestingDescription: '5-year emission',
    },
    {
      name: 'Protocol Treasury',
      percentage: 25,
      amount: 14_726_500_000_000_000n,
      wallet: 'TreasuryWallet111111111111111111111111111111',
      vestingDescription: 'DAO-managed',
    },
  ],
}));

import { getRvuiBalance, getRvuiSupply } from '@revealui/services/revealcoin';
import coinApp from '../coin.js';

const mockedGetRvuiBalance = vi.mocked(getRvuiBalance);
const mockedGetRvuiSupply = vi.mocked(getRvuiSupply);

function createApp() {
  const app = new Hono();
  app.route('/', coinApp);
  return app;
}

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('revealcoin');
    expect(typeof body.timestamp).toBe('string');
  });

  it('does not call Solana RPC', async () => {
    const app = createApp();
    await app.request('/health');
    expect(mockedGetRvuiSupply).not.toHaveBeenCalled();
    expect(mockedGetRvuiBalance).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /supply
// ---------------------------------------------------------------------------

describe('GET /supply', () => {
  beforeEach(() => {
    mockedGetRvuiSupply.mockReset();
  });

  it('returns supply on success', async () => {
    mockedGetRvuiSupply.mockResolvedValueOnce({
      raw: 58_906_000_000_000_000n,
      uiAmountString: '58906000000',
      decimals: 6,
    });

    const app = createApp();
    const res = await app.request('/supply');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalSupply).toBe('58906000000');
    expect(body.decimals).toBe(6);
    expect(body.raw).toBe('58906000000000000');
  });

  it('returns 502 on Solana RPC failure', async () => {
    mockedGetRvuiSupply.mockRejectedValueOnce(new Error('Solana RPC error: 429'));

    const app = createApp();
    const res = await app.request('/supply');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('429');
  });

  it('returns 502 with generic message when error is not an Error', async () => {
    mockedGetRvuiSupply.mockRejectedValueOnce('boom');

    const app = createApp();
    const res = await app.request('/supply');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch supply');
  });
});

// ---------------------------------------------------------------------------
// GET /allocations
// ---------------------------------------------------------------------------

describe('GET /allocations', () => {
  beforeEach(() => {
    mockedGetRvuiBalance.mockReset();
  });

  it('returns allocations with balances', async () => {
    mockedGetRvuiBalance.mockImplementation(async (wallet) => ({
      raw: 100_000_000n,
      formatted: '100',
      uiAmount: 100,
      ...(wallet ? {} : {}),
    }));

    const app = createApp();
    const res = await app.request('/allocations');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allocations).toHaveLength(2);
    expect(body.allocations[0].name).toBe('Ecosystem Rewards');
    expect(body.allocations[0].percentage).toBe(30);
    expect(body.allocations[0].totalAmount).toBe(17_671_800_000);
    expect(body.allocations[0].balance).toBe(100);
    expect(body.allocations[1].name).toBe('Protocol Treasury');
  });

  it('returns 502 when any wallet balance fetch fails', async () => {
    mockedGetRvuiBalance.mockRejectedValueOnce(new Error('Solana RPC error: timeout'));

    const app = createApp();
    const res = await app.request('/allocations');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('timeout');
  });
});
