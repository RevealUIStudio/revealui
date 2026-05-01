import { beforeEach, describe, expect, it, vi } from 'vitest';

// All mock fns must be created via vi.hoisted() so they exist when vi.mock factories run
const {
  mockGetTransaction,
  mockGetTokenAccountsByOwner,
  mockGetTokenSupply,
  mockIsOpen,
  mockRecordSuccess,
  mockRecordFailure,
  mockReset,
  mockValidatePayment,
  mockRecordPayment,
} = vi.hoisted(() => ({
  mockGetTransaction: vi.fn(),
  mockGetTokenAccountsByOwner: vi.fn(),
  mockGetTokenSupply: vi.fn(),
  mockIsOpen: vi.fn().mockResolvedValue(false),
  mockRecordSuccess: vi.fn().mockResolvedValue(undefined),
  mockRecordFailure: vi.fn().mockResolvedValue(undefined),
  mockReset: vi.fn().mockResolvedValue(undefined),
  mockValidatePayment: vi.fn(),
  mockRecordPayment: vi.fn(),
}));

vi.mock('@solana/kit', () => ({
  address: (s: string) => s,
  signature: (s: string) => s,
  createSolanaRpc: () => ({
    getTransaction: (...args: unknown[]) => ({ send: () => mockGetTransaction(...args) }),
    getTokenAccountsByOwner: (...args: unknown[]) => ({
      send: () => mockGetTokenAccountsByOwner(...args),
    }),
    getTokenSupply: (...args: unknown[]) => ({ send: () => mockGetTokenSupply(...args) }),
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

vi.mock('../safeguards.js', () => ({
  validatePayment: mockValidatePayment,
  recordPayment: mockRecordPayment,
}));

import { getRvuiBalance, getRvuiSupply, verifyRvuiPayment } from '../client.js';

function resetMocks(): void {
  mockGetTransaction.mockClear();
  mockGetTokenAccountsByOwner.mockClear();
  mockGetTokenSupply.mockClear();
  mockIsOpen.mockClear();
  mockIsOpen.mockResolvedValue(false);
  mockRecordSuccess.mockClear();
  mockRecordSuccess.mockResolvedValue(undefined);
  mockRecordFailure.mockClear();
  mockRecordFailure.mockResolvedValue(undefined);
  mockReset.mockClear();
  mockValidatePayment.mockReset();
  mockValidatePayment.mockResolvedValue({ allowed: true });
  mockRecordPayment.mockReset();
  mockRecordPayment.mockResolvedValue(undefined);
}

const validSafeguards = { userId: 'user-test-1', amountUsd: '0.05' };

/** Build a tx with sender + recipient balance changes that pass on-chain check. */
function txWithSenderAndRecipient(opts: {
  mintAddress: string;
  programId: string;
  recipient: string;
  sender: string;
  amount: string;
}) {
  const { mintAddress, programId, recipient, sender, amount } = opts;
  return {
    meta: {
      err: null,
      preTokenBalances: [
        {
          mint: mintAddress,
          owner: recipient,
          programId,
          uiTokenAmount: { amount: '0' },
        },
        {
          mint: mintAddress,
          owner: sender,
          programId,
          uiTokenAmount: { amount: amount },
        },
      ],
      postTokenBalances: [
        {
          mint: mintAddress,
          owner: recipient,
          programId,
          uiTokenAmount: { amount: amount },
        },
        {
          mint: mintAddress,
          owner: sender,
          programId,
          uiTokenAmount: { amount: '0' },
        },
      ],
    },
  };
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

  it('returns valid for correct payment with safeguards passing', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient-wallet',
        sender: 'sender-wallet',
        amount: '1000000',
      }),
    );

    const result = await verifyRvuiPayment(
      'tx-sig-valid',
      1_000_000n,
      'recipient-wallet',
      validSafeguards,
    );
    expect(result).toEqual({ valid: true });
    // Safeguards pipeline ran with the extracted source wallet
    expect(mockValidatePayment).toHaveBeenCalledWith({
      walletAddress: 'sender-wallet',
      userId: 'user-test-1',
      txSignature: 'tx-sig-valid',
      amountUsd: 0.05,
    });
    // Payment was recorded for future replay protection
    expect(mockRecordPayment).toHaveBeenCalledTimes(1);
    const recordCall = mockRecordPayment.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(recordCall).toMatchObject({
      txSignature: 'tx-sig-valid',
      walletAddress: 'sender-wallet',
      userId: 'user-test-1',
      amountRvui: '1000000',
      amountUsd: 0.05,
      // discount = 25% of paid (since paid is 80% of full at 20% discount)
      discountUsd: 0.0125,
      purpose: 'agent_task',
    });
  });

  it('rejects immediately when safeguards.userId is empty (no on-chain fetch)', async () => {
    const result = await verifyRvuiPayment('tx-sig-no-user', 1n, 'recipient', {
      userId: '',
      amountUsd: '0.05',
    });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toMatch(/authenticated user|userId/i);
    // Short-circuit: no Solana RPC call, no safeguards call
    expect(mockGetTransaction).not.toHaveBeenCalled();
    expect(mockValidatePayment).not.toHaveBeenCalled();
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('rejects when transaction not found', async () => {
    mockGetTransaction.mockResolvedValue(null);

    const result = await verifyRvuiPayment('tx-sig-missing', 1n, 'recipient', validSafeguards);
    expect(result).toEqual({
      valid: false,
      error: 'Transaction not found or not yet finalized',
    });
    expect(mockValidatePayment).not.toHaveBeenCalled();
  });

  it('rejects failed transactions', async () => {
    mockGetTransaction.mockResolvedValue({
      meta: {
        err: { InstructionError: [0, 'InsufficientFunds'] },
        preTokenBalances: [],
        postTokenBalances: [],
      },
    });

    const result = await verifyRvuiPayment('tx-sig-failed', 1n, 'recipient', validSafeguards);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Transaction failed');
    expect(mockValidatePayment).not.toHaveBeenCalled();
  });

  it('rejects when recipient did not receive tokens', async () => {
    mockGetTransaction.mockResolvedValue({
      meta: {
        err: null,
        preTokenBalances: [],
        postTokenBalances: [],
      },
    });

    const result = await verifyRvuiPayment('tx-sig-no-transfer', 1n, 'recipient', validSafeguards);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('did not receive');
    expect(mockValidatePayment).not.toHaveBeenCalled();
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

    const result = await verifyRvuiPayment('tx-sig-low', 1_000_000n, 'recipient', validSafeguards);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('Insufficient payment');
    expect(mockValidatePayment).not.toHaveBeenCalled();
  });

  it('rejects when source wallet cannot be identified', async () => {
    // Recipient received tokens but no other account shows a balance
    // decrease — pathological tx (mint or self-transfer).
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
            uiTokenAmount: { amount: '1000' },
          },
        ],
      },
    });

    const result = await verifyRvuiPayment(
      'tx-sig-no-sender',
      1_000n,
      'recipient',
      validSafeguards,
    );
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toMatch(/sender/i);
    expect(mockValidatePayment).not.toHaveBeenCalled();
  });

  it('rejects when validatePayment returns disallowed (replay attack)', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'sender',
        amount: '1000',
      }),
    );
    mockValidatePayment.mockResolvedValue({
      allowed: false,
      reason: 'Transaction signature already used',
    });

    const result = await verifyRvuiPayment('tx-sig-replay', 1_000n, 'recipient', validSafeguards);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('signature already used');
    // recordPayment must NOT be called when validatePayment rejects
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('rejects when validatePayment blocks for $500 single-payment cap', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'sender',
        amount: '600000000',
      }),
    );
    mockValidatePayment.mockResolvedValue({
      allowed: false,
      reason: 'Payment exceeds maximum of $500 USD. Use fiat for larger amounts.',
    });

    const result = await verifyRvuiPayment('tx-sig-overpaid', 600_000_000n, 'recipient', {
      userId: 'user-test-1',
      amountUsd: '600',
    });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('$500');
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('rejects when wallet rate limit exceeded', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'busy-wallet',
        amount: '1000',
      }),
    );
    mockValidatePayment.mockResolvedValue({
      allowed: false,
      reason: 'Wallet rate limit exceeded (max 3 payments/hour)',
    });

    const result = await verifyRvuiPayment(
      'tx-sig-rate-limited',
      1_000n,
      'recipient',
      validSafeguards,
    );
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('rate limit');
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('rejects when monthly discount cap exceeded', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'sender',
        amount: '1000',
      }),
    );
    mockValidatePayment.mockResolvedValue({
      allowed: false,
      reason: 'Monthly RVUI discount cap of $100 reached',
    });

    const result = await verifyRvuiPayment('tx-sig-cap', 1_000n, 'recipient', validSafeguards);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('discount cap');
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('rejects when TWAP price circuit breaker is open', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'sender',
        amount: '1000',
      }),
    );
    mockValidatePayment.mockResolvedValue({
      allowed: false,
      reason: 'RVUI payments temporarily disabled due to price volatility',
    });

    const result = await verifyRvuiPayment('tx-sig-circuit', 1_000n, 'recipient', validSafeguards);
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain('volatility');
    expect(mockRecordPayment).not.toHaveBeenCalled();
  });

  it('returns valid even when recordPayment throws (best-effort recording)', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'sender',
        amount: '1000',
      }),
    );
    mockRecordPayment.mockRejectedValue(new Error('DB unavailable'));

    const result = await verifyRvuiPayment(
      'tx-sig-record-fail',
      1_000n,
      'recipient',
      validSafeguards,
    );
    // The on-chain payment + safeguard checks all passed; refusing
    // service after the customer paid is the worse failure mode.
    expect(result.valid).toBe(true);
  });

  it('rejects when amountUsd is invalid (non-numeric or zero)', async () => {
    mockGetTransaction.mockResolvedValue(
      txWithSenderAndRecipient({
        mintAddress,
        programId,
        recipient: 'recipient',
        sender: 'sender',
        amount: '1000',
      }),
    );

    const result = await verifyRvuiPayment('tx-sig-bad-amount', 1_000n, 'recipient', {
      userId: 'user-test-1',
      amountUsd: 'not-a-number',
    });
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toMatch(/amountUsd/i);
    expect(mockValidatePayment).not.toHaveBeenCalled();
  });

  it('throws when circuit breaker is open', async () => {
    mockIsOpen.mockResolvedValue(true);

    await expect(verifyRvuiPayment('tx', 1n, 'recipient', validSafeguards)).rejects.toThrow(
      'circuit breaker is OPEN',
    );
  });
});

describe('getRvuiSupply', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('returns parsed token supply', async () => {
    mockGetTokenSupply.mockResolvedValue({
      context: { slot: 1 },
      value: {
        amount: '58906000000000000',
        decimals: 6,
        uiAmount: 58906000000,
        uiAmountString: '58906000000',
      },
    });

    const result = await getRvuiSupply();
    expect(result.raw).toBe(58_906_000_000_000_000n);
    expect(result.uiAmountString).toBe('58906000000');
    expect(result.decimals).toBe(6);
    expect(mockRecordSuccess).toHaveBeenCalled();
  });

  it('throws when circuit breaker is open', async () => {
    mockIsOpen.mockResolvedValue(true);

    await expect(getRvuiSupply()).rejects.toThrow('circuit breaker is OPEN');
  });

  it('retries on retryable RPC failure', async () => {
    mockGetTokenSupply.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({
      context: { slot: 1 },
      value: {
        amount: '1000000',
        decimals: 6,
        uiAmount: 1,
        uiAmountString: '1',
      },
    });

    const result = await getRvuiSupply();
    expect(result.raw).toBe(1_000_000n);
    expect(mockGetTokenSupply).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-retryable errors', async () => {
    mockGetTokenSupply.mockRejectedValue(new Error('Invalid mint address'));

    await expect(getRvuiSupply()).rejects.toThrow('Invalid mint address');
    expect(mockGetTokenSupply).toHaveBeenCalledTimes(1);
    expect(mockRecordFailure).toHaveBeenCalled();
  });
});
