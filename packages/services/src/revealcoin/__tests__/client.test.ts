import { beforeEach, describe, expect, it, vi } from 'vitest';

// All mock fns must be created via vi.hoisted() so they exist when vi.mock factories run
const {
  mockGetTransaction,
  mockGetTokenAccountsByOwner,
  mockIsOpen,
  mockRecordSuccess,
  mockRecordFailure,
  mockReset,
} = vi.hoisted(() => ({
  mockGetTransaction: vi.fn(),
  mockGetTokenAccountsByOwner: vi.fn(),
  mockIsOpen: vi.fn().mockResolvedValue(false),
  mockRecordSuccess: vi.fn().mockResolvedValue(undefined),
  mockRecordFailure: vi.fn().mockResolvedValue(undefined),
  mockReset: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@solana/kit', () => ({
  address: (s: string) => s,
  signature: (s: string) => s,
  createSolanaRpc: () => ({
    getTransaction: (...args: unknown[]) => ({ send: () => mockGetTransaction(...args) }),
    getTokenAccountsByOwner: (...args: unknown[]) => ({
      send: () => mockGetTokenAccountsByOwner(...args),
    }),
  }),
}));

vi.mock('@revealui/contracts', () => ({
  RVUI_MINT_ADDRESSES: {
    devnet: '4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo',
    'mainnet-beta': '',
  },
  RVUI_TOKEN_CONFIG: { decimals: 6 },
  RVUI_TOKEN_PROGRAM: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
}));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../config.js', () => ({
  getRevealCoinConfig: vi.fn(() => ({
    network: 'devnet' as const,
    queryCommitment: 'confirmed',
    paymentCommitment: 'finalized',
  })),
  resolveRpcUrl: vi.fn(() => 'https://api.devnet.solana.com'),
}));

vi.mock('../../stripe/db-circuit-breaker.js', () => ({
  DbCircuitBreaker: class {
    isOpen = mockIsOpen;
    recordSuccess = mockRecordSuccess;
    recordFailure = mockRecordFailure;
    reset = mockReset;
  },
}));

import { getRvuiBalance, verifyRvuiPayment } from '../client.js';

function resetMocks(): void {
  mockGetTransaction.mockClear();
  mockGetTokenAccountsByOwner.mockClear();
  mockIsOpen.mockClear();
  mockIsOpen.mockResolvedValue(false);
  mockRecordSuccess.mockClear();
  mockRecordSuccess.mockResolvedValue(undefined);
  mockRecordFailure.mockClear();
  mockRecordFailure.mockResolvedValue(undefined);
  mockReset.mockClear();
}

/** Helper to create a mock getTokenAccountsByOwner response */
function tokenAccountResponse(amount: string) {
  return {
    value: [
      {
        pubkey: 'mock-ata',
        account: {
          data: {
            parsed: { info: { tokenAmount: { amount } } },
          },
        },
      },
    ],
  };
}

describe('getRvuiBalance', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns balance for wallet with tokens', async () => {
    mockGetTokenAccountsByOwner.mockResolvedValue(tokenAccountResponse('1000000000'));

    const result = await getRvuiBalance('wallet-with-tokens');
    expect(result.raw).toBe(1_000_000_000n);
    expect(result.uiAmount).toBe(1000);
    expect(mockRecordSuccess).toHaveBeenCalled();
  });

  it('returns zero for wallet without token account', async () => {
    mockGetTokenAccountsByOwner.mockResolvedValue({ value: [] });

    const result = await getRvuiBalance('wallet-no-tokens');
    expect(result.raw).toBe(0n);
    expect(result.uiAmount).toBe(0);
    expect(result.formatted).toBe('0');
  });

  it('throws when circuit breaker is open', async () => {
    mockIsOpen.mockResolvedValue(true);

    await expect(getRvuiBalance('any-wallet')).rejects.toThrow('circuit breaker is OPEN');
  });

  it('retries on timeout errors', async () => {
    mockGetTokenAccountsByOwner
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(tokenAccountResponse('500000'));

    const result = await getRvuiBalance('wallet-retry');
    expect(result.raw).toBe(500_000n);
    expect(mockGetTokenAccountsByOwner).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    mockGetTokenAccountsByOwner.mockRejectedValue(new Error('Invalid public key input'));

    await expect(getRvuiBalance('bad-wallet')).rejects.toThrow('Invalid public key input');
    expect(mockGetTokenAccountsByOwner).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).toHaveBeenCalled();
  });
});

describe('verifyRvuiPayment', () => {
  beforeEach(() => {
    resetMocks();
  });

  const mintAddress = '4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo';
  const programId = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

  it('returns valid for correct payment', async () => {
    mockGetTransaction.mockResolvedValue({
      meta: {
        err: null,
        preTokenBalances: [
          {
            mint: mintAddress,
            owner: 'recipient-wallet',
            programId,
            uiTokenAmount: { amount: '0' },
          },
        ],
        postTokenBalances: [
          {
            mint: mintAddress,
            owner: 'recipient-wallet',
            programId,
            uiTokenAmount: { amount: '1000000' },
          },
        ],
      },
    });

    const result = await verifyRvuiPayment('tx-sig-valid', 1_000_000n, 'recipient-wallet');
    expect(result).toEqual({ valid: true });
  });

  it('rejects when transaction not found', async () => {
    mockGetTransaction.mockResolvedValue(null);

    const result = await verifyRvuiPayment('tx-sig-missing', 1n, 'recipient');
    expect(result).toEqual({
      valid: false,
      error: 'Transaction not found or not yet finalized',
    });
  });

  it('rejects failed transactions', async () => {
    mockGetTransaction.mockResolvedValue({
      meta: {
        err: { InstructionError: [0, 'InsufficientFunds'] },
        preTokenBalances: [],
        postTokenBalances: [],
      },
    });

    const result = await verifyRvuiPayment('tx-sig-failed', 1n, 'recipient');
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Transaction failed');
  });

  it('rejects when recipient did not receive tokens', async () => {
    mockGetTransaction.mockResolvedValue({
      meta: {
        err: null,
        preTokenBalances: [],
        postTokenBalances: [],
      },
    });

    const result = await verifyRvuiPayment('tx-sig-no-transfer', 1n, 'recipient');
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('did not receive');
  });

  it('rejects insufficient payment amount', async () => {
    mockGetTransaction.mockResolvedValue({
      meta: {
        err: null,
        preTokenBalances: [
          {
            mint: mintAddress,
            owner: 'recipient',
            programId,
            uiTokenAmount: { amount: '0' },
          },
        ],
        postTokenBalances: [
          {
            mint: mintAddress,
            owner: 'recipient',
            programId,
            uiTokenAmount: { amount: '500' },
          },
        ],
      },
    });

    const result = await verifyRvuiPayment('tx-sig-low', 1_000_000n, 'recipient');
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Insufficient payment');
  });

  it('throws when circuit breaker is open', async () => {
    mockIsOpen.mockResolvedValue(true);

    await expect(verifyRvuiPayment('tx', 1n, 'recipient')).rejects.toThrow(
      'circuit breaker is OPEN',
    );
  });
});
