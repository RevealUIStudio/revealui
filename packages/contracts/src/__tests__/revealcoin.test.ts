import { REVEALCOIN_MANIFEST } from '@revealui/revealcoin-manifest';
import { describe, expect, it } from 'vitest';
import {
  formatRvuiAmount,
  getRvuiMintAddress,
  parseRvuiAmount,
  RVUI_ALLOCATIONS,
  RVUI_DISCOUNT_RATES,
  RVUI_MINT_ADDRESSES,
  RVUI_MINT_AUTHORITY,
  RVUI_TOKEN_CONFIG,
  RVUI_TOKEN_PROGRAM,
  type SolanaNetwork,
} from '../revealcoin.js';

describe('RVUI_TOKEN_CONFIG', () => {
  it('matches the white-paper supply (Aug 14, 1971 USD in circulation × 10^6)', () => {
    expect(RVUI_TOKEN_CONFIG).toEqual({
      name: 'RevealCoin',
      symbol: 'RVUI',
      decimals: 6,
      totalSupply: 58_906_000_000_000_000n,
      description: 'Hybrid utility/governance/reward token for the RevealUI ecosystem',
    });
  });
});

describe('RVUI_TOKEN_PROGRAM', () => {
  it('is the Token-2022 program ID', () => {
    expect(RVUI_TOKEN_PROGRAM).toBe('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
  });
});

describe('Network derivation from manifest', () => {
  it('RVUI_MINT_ADDRESSES has all 3 SolanaNetwork entries', () => {
    const networks: SolanaNetwork[] = ['devnet', 'testnet', 'mainnet-beta'];
    for (const network of networks) {
      expect(RVUI_MINT_ADDRESSES).toHaveProperty(network);
    }
  });

  it('RVUI_MINT_ADDRESSES.devnet matches manifest devnet mintAddress', () => {
    const devnetEntry = REVEALCOIN_MANIFEST.networks.find((n) => n.network === 'devnet');
    expect(devnetEntry).toBeDefined();
    expect(RVUI_MINT_ADDRESSES.devnet).toBe(devnetEntry?.mintAddress);
    expect(RVUI_MINT_ADDRESSES.devnet).toBeTruthy(); // devnet is deployed
  });

  it('RVUI_MINT_ADDRESSES.testnet is empty (not deployed in placeholder manifest)', () => {
    expect(RVUI_MINT_ADDRESSES.testnet).toBe('');
  });

  it('RVUI_MINT_ADDRESSES["mainnet-beta"] matches manifest mainnet-beta entry', () => {
    const mainnetEntry = REVEALCOIN_MANIFEST.networks.find((n) => n.network === 'mainnet-beta');
    expect(mainnetEntry).toBeDefined();
    expect(RVUI_MINT_ADDRESSES['mainnet-beta']).toBe(mainnetEntry?.mintAddress);
  });

  it('RVUI_MINT_AUTHORITY.devnet matches manifest devnet mintAuthority', () => {
    const devnetEntry = REVEALCOIN_MANIFEST.networks.find((n) => n.network === 'devnet');
    expect(devnetEntry).toBeDefined();
    expect(RVUI_MINT_AUTHORITY.devnet).toBe(devnetEntry?.mintAuthority);
    expect(RVUI_MINT_AUTHORITY.devnet).toBeTruthy(); // devnet authority is set
  });

  it('RVUI_MINT_AUTHORITY has all 3 SolanaNetwork entries', () => {
    expect(Object.keys(RVUI_MINT_AUTHORITY).sort()).toEqual(
      ['devnet', 'mainnet-beta', 'testnet'].sort(),
    );
  });
});

describe('RVUI_ALLOCATIONS', () => {
  it('has all 7 allocations matching white paper §5.1', () => {
    expect(RVUI_ALLOCATIONS).toHaveLength(7);
    const names = RVUI_ALLOCATIONS.map((a) => a.name);
    expect(names).toEqual([
      'Ecosystem Rewards',
      'Protocol Treasury',
      'Team & Founders',
      'Community Governance',
      'Liquidity Provision',
      'Strategic Partners',
      'Public Distribution',
    ]);
  });

  it('percentages sum to 100', () => {
    const total = RVUI_ALLOCATIONS.reduce((acc, a) => acc + a.percentage, 0);
    expect(total).toBe(100);
  });

  it('amounts sum to totalSupply', () => {
    const total = RVUI_ALLOCATIONS.reduce((acc, a) => acc + a.amount, 0n);
    expect(total).toBe(RVUI_TOKEN_CONFIG.totalSupply);
  });

  it('every allocation wallet matches manifest by name', () => {
    for (const allocation of RVUI_ALLOCATIONS) {
      const manifestEntry = REVEALCOIN_MANIFEST.allocations.find((m) => m.name === allocation.name);
      expect(manifestEntry, `manifest missing allocation "${allocation.name}"`).toBeDefined();
      expect(allocation.wallet).toBe(manifestEntry?.wallet);
      expect(allocation.wallet).toBeTruthy();
    }
  });

  it('preserves human-decided fields (percentage, amount, vestingDescription)', () => {
    const ecosystem = RVUI_ALLOCATIONS.find((a) => a.name === 'Ecosystem Rewards');
    expect(ecosystem).toBeDefined();
    expect(ecosystem?.percentage).toBe(30);
    expect(ecosystem?.amount).toBe(17_671_800_000_000_000n);
    expect(ecosystem?.vestingDescription).toBe('5-year front-loaded emission schedule');
  });
});

describe('RVUI_DISCOUNT_RATES', () => {
  it('matches white paper §6.1 fixed rates', () => {
    expect(RVUI_DISCOUNT_RATES).toEqual({
      subscription: { service: 'Pro/Max tier subscription', discountPercent: 15 },
      aiCredits: { service: 'AI inference credits', discountPercent: 20 },
      customDomain: { service: 'Custom domain SSL', discountPercent: 10 },
      prioritySupport: { service: 'Priority support', discountPercent: 15 },
    });
  });
});

describe('formatRvuiAmount / parseRvuiAmount', () => {
  it('round-trips integer amounts', () => {
    const raw = 1_000_000n; // 1 RVUI at 6 decimals
    expect(formatRvuiAmount(raw)).toBe('1');
    expect(parseRvuiAmount('1')).toBe(raw);
  });

  it('round-trips fractional amounts', () => {
    const raw = 1_500_000n; // 1.5 RVUI
    expect(formatRvuiAmount(raw)).toBe('1.5');
    expect(parseRvuiAmount('1.5')).toBe(raw);
  });

  it('formats large amounts with thousands separators', () => {
    const raw = 1_000_000_000_000n; // 1,000,000 RVUI
    expect(formatRvuiAmount(raw)).toBe('1,000,000');
  });
});

describe('getRvuiMintAddress', () => {
  it('returns the devnet mint address', () => {
    expect(getRvuiMintAddress('devnet')).toBe(RVUI_MINT_ADDRESSES.devnet);
  });

  it('throws for undeployed testnet (placeholder manifest)', () => {
    expect(() => getRvuiMintAddress('testnet')).toThrow(/not deployed/);
  });

  it('throws for undeployed mainnet-beta (placeholder manifest)', () => {
    expect(() => getRvuiMintAddress('mainnet-beta')).toThrow(/not deployed/);
  });
});
