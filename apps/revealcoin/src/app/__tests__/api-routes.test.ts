import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the solana module
vi.mock('@/lib/solana', () => ({
  getTokenSupply: vi.fn(),
  getTokenBalance: vi.fn(),
}));

vi.mock('@/lib/constants', () => ({
  MINT_ADDRESS: 'FakeMintAddress123',
  RVUI_ALLOCATIONS: {
    ecosystem: { wallet: 'EcoWallet', percentage: 30, label: 'Ecosystem' },
    team: { wallet: 'TeamWallet', percentage: 20, label: 'Team' },
  },
}));

describe('API route: /api/solana/supply', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns supply data on success', async () => {
    const { getTokenSupply } = await import('@/lib/solana');
    vi.mocked(getTokenSupply).mockResolvedValueOnce({
      amount: '58900000000000000000',
      decimals: 9,
      uiAmount: 58900000000,
      uiAmountString: '58900000000',
    });

    const { GET } = await import('../api/solana/supply/route.js');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.totalSupply).toBe('58900000000');
    expect(data.decimals).toBe(9);
  });

  it('returns 502 on Solana RPC failure', async () => {
    const { getTokenSupply } = await import('@/lib/solana');
    vi.mocked(getTokenSupply).mockRejectedValueOnce(new Error('Solana RPC error: 429'));

    const { GET } = await import('../api/solana/supply/route.js');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toContain('429');
  });
});

describe('API route: /api/health', () => {
  it('returns 200', async () => {
    const { GET } = await import('../api/health/route.js');
    const response = await GET();

    expect(response.status).toBe(200);
  });
});
