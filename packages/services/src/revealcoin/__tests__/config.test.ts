import { afterEach, describe, expect, it } from 'vitest';

import {
  configureRevealCoin,
  getRevealCoinConfig,
  resetRevealCoinConfig,
  resolveRpcUrl,
} from '../config.js';

describe('RevealCoinConfig', () => {
  afterEach(() => {
    resetRevealCoinConfig();
    delete process.env.SOLANA_NETWORK;
    delete process.env.SOLANA_RPC_URL;
    delete process.env.RVUI_PAYMENTS_ENABLED;
    delete process.env.RVUI_RECEIVING_WALLET;
  });

  it('returns defaults', () => {
    const config = getRevealCoinConfig();
    expect(config.network).toBe('devnet');
    expect(config.queryCommitment).toBe('confirmed');
    expect(config.paymentCommitment).toBe('finalized');
    expect(config.enabled).toBe(false);
    expect(config.receivingWallet).toBe('');
    expect(config.pollIntervalMs).toBe(60_000);
  });

  it('reads network from env', () => {
    process.env.SOLANA_NETWORK = 'mainnet-beta';
    const config = getRevealCoinConfig();
    expect(config.network).toBe('mainnet-beta');
  });

  it('reads RPC URL from env', () => {
    process.env.SOLANA_RPC_URL = 'https://custom-rpc.example.com';
    const config = getRevealCoinConfig();
    expect(config.rpcUrl).toBe('https://custom-rpc.example.com');
  });

  it('reads enabled flag from env', () => {
    process.env.RVUI_PAYMENTS_ENABLED = 'true';
    const config = getRevealCoinConfig();
    expect(config.enabled).toBe(true);
  });

  it('reads receiving wallet from env', () => {
    process.env.RVUI_RECEIVING_WALLET = 'wallet-123';
    const config = getRevealCoinConfig();
    expect(config.receivingWallet).toBe('wallet-123');
  });

  it('applies overrides', () => {
    configureRevealCoin({ pollIntervalMs: 5_000, queryCommitment: 'finalized' });
    const config = getRevealCoinConfig();
    expect(config.pollIntervalMs).toBe(5_000);
    expect(config.queryCommitment).toBe('finalized');
  });

  it('resets to defaults', () => {
    configureRevealCoin({ pollIntervalMs: 1_000 });
    resetRevealCoinConfig();
    const config = getRevealCoinConfig();
    expect(config.pollIntervalMs).toBe(60_000);
  });
});

describe('resolveRpcUrl', () => {
  afterEach(() => {
    resetRevealCoinConfig();
    delete process.env.SOLANA_RPC_URL;
    delete process.env.SOLANA_NETWORK;
  });

  it('returns devnet URL by default', () => {
    const url = resolveRpcUrl();
    expect(url).toBe('https://api.devnet.solana.com');
  });

  it('returns custom URL when configured', () => {
    process.env.SOLANA_RPC_URL = 'https://my-rpc.example.com';
    const url = resolveRpcUrl();
    expect(url).toBe('https://my-rpc.example.com');
  });

  it('returns testnet URL for testnet network', () => {
    process.env.SOLANA_NETWORK = 'testnet';
    const url = resolveRpcUrl();
    expect(url).toBe('https://api.testnet.solana.com');
  });

  it('returns mainnet URL for mainnet-beta', () => {
    process.env.SOLANA_NETWORK = 'mainnet-beta';
    const url = resolveRpcUrl();
    expect(url).toBe('https://api.mainnet-beta.solana.com');
  });

  it('accepts explicit config override', () => {
    const url = resolveRpcUrl({
      network: 'mainnet-beta',
      rpcUrl: 'https://override.example.com',
      queryCommitment: 'confirmed',
      paymentCommitment: 'finalized',
      enabled: false,
      receivingWallet: '',
      pollIntervalMs: 60_000,
    });
    expect(url).toBe('https://override.example.com');
  });
});
