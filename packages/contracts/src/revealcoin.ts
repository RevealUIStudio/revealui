/**
 * @revealui/contracts/revealcoin
 *
 * Single source of truth for RevealCoin (RVC) token parameters, addresses,
 * and discount rates within the RevealUI ecosystem.
 *
 * Token: Solana Token-2022 (Token Extensions) — MetadataPointer + TokenMetadata
 * Supply: 58,906,000,000 RVC — US currency in circulation, August 14, 1971
 *
 * @packageDocumentation
 */

// =============================================================================
// Token Configuration
// =============================================================================

export interface RvcTokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  description: string;
}

/**
 * Core token parameters — immutable after mainnet deployment.
 *
 * Total supply anchors to the amount of US currency in circulation on
 * August 14, 1971, the day before Nixon ended dollar-gold convertibility.
 */
export const RVC_TOKEN_CONFIG: RvcTokenConfig = {
  name: 'RevealCoin',
  symbol: 'RVC',
  decimals: 6,
  totalSupply: 58_906_000_000_000_000n, // 58,906,000,000 × 10^6
  description: 'Hybrid utility/governance/reward token for the RevealUI ecosystem',
};

// =============================================================================
// Network Addresses
// =============================================================================

export type SolanaNetwork = 'devnet' | 'testnet' | 'mainnet-beta';

/** Token-2022 program ID (same across all networks). */
export const RVC_TOKEN_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

/** RVC mint addresses per Solana network. */
export const RVC_MINT_ADDRESSES: Record<SolanaNetwork, string> = {
  devnet: '4Ysb1gkz21FD2B9P8P5Pm8bHh4CAMKYU1L528e1MigPo',
  testnet: '', // not deployed
  'mainnet-beta': '', // deployed after mainnet launch
};

/** Mint authority (controls minting + metadata updates). */
export const RVC_MINT_AUTHORITY: Record<SolanaNetwork, string> = {
  devnet: 'BzFDXRj56QkizrhAfNLTTUuKwNbv5krCfcRMgTUSMpw4',
  testnet: '',
  'mainnet-beta': '', // will be multi-sig (Squads Protocol 3-of-5)
};

// =============================================================================
// Distribution Wallets (Devnet — White Paper Section 5.1)
// =============================================================================

export interface RvcAllocation {
  name: string;
  percentage: number;
  amount: bigint;
  wallet: string;
  vestingDescription: string;
}

export const RVC_ALLOCATIONS: RvcAllocation[] = [
  {
    name: 'Ecosystem Rewards',
    percentage: 30,
    amount: 17_671_800_000_000_000n,
    wallet: 'HRpDTX76PSRiXpgct2aTPbCfzoSzoJs9XyhY3SZEkx93',
    vestingDescription: '5-year front-loaded emission schedule',
  },
  {
    name: 'Protocol Treasury',
    percentage: 25,
    amount: 14_726_500_000_000_000n,
    wallet: '9ezxfrDTXgJVeuzwLDKAeKs6wurb2DQkP1HuMeRgazzU',
    vestingDescription: 'DAO-managed after governance launch',
  },
  {
    name: 'Team & Founders',
    percentage: 15,
    amount: 8_835_900_000_000_000n,
    wallet: '2EiJT4dMPTgEzAr2Q3wWJL7E967o6rNWjEBZckhvpSbN',
    vestingDescription: '12-month cliff, 4-year linear vest',
  },
  {
    name: 'Community Governance',
    percentage: 10,
    amount: 5_890_600_000_000_000n,
    wallet: '5d16DX9c69e11vPsmEwKn9qL6rysD4n21q21SEft3dM8',
    vestingDescription: 'Unlocked for staking and voting',
  },
  {
    name: 'Liquidity Provision',
    percentage: 10,
    amount: 5_890_600_000_000_000n,
    wallet: 'HjR2WZAFGVYfguRGFPqGMDTWS17U9PvLKhLTsvwSPTcB',
    vestingDescription: '6-month lockup, then gradual release',
  },
  {
    name: 'Strategic Partners',
    percentage: 5,
    amount: 2_945_300_000_000_000n,
    wallet: '3TFazumEiq5wyx3R2THApCPyX4o9AS5N241k8HNkT2UC',
    vestingDescription: '6-month cliff, 2-year linear vest',
  },
  {
    name: 'Public Distribution',
    percentage: 5,
    amount: 2_945_300_000_000_000n,
    wallet: '73M1FBCQCTo2ysmdjegtmvVGbFa3Wg9FMZnXxrTnX7qx',
    vestingDescription: 'Airdrops, bounties, hackathons',
  },
];

// =============================================================================
// Discount Rates (White Paper Section 6.1)
// =============================================================================

export interface RvcDiscountRate {
  service: string;
  discountPercent: number;
}

/**
 * Discount rates for paying with RVC instead of fiat.
 * These rates are fixed in the white paper and should only change via governance vote.
 */
export const RVC_DISCOUNT_RATES: Record<string, RvcDiscountRate> = {
  subscription: { service: 'Pro/Max tier subscription', discountPercent: 15 },
  aiCredits: { service: 'AI inference credits', discountPercent: 20 },
  customDomain: { service: 'Custom domain SSL', discountPercent: 10 },
  prioritySupport: { service: 'Priority support', discountPercent: 15 },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert raw token amount (with decimals) to human-readable string.
 * e.g., 1_000_000n → "1" (6 decimals)
 */
export function formatRvcAmount(rawAmount: bigint): string {
  const divisor = 10n ** BigInt(RVC_TOKEN_CONFIG.decimals);
  const whole = rawAmount / divisor;
  const fraction = rawAmount % divisor;

  if (fraction === 0n) {
    return whole.toLocaleString();
  }

  const fractionStr = fraction
    .toString()
    .padStart(RVC_TOKEN_CONFIG.decimals, '0')
    .replace(/0+$/, '');
  return `${whole.toLocaleString()}.${fractionStr}`;
}

/**
 * Convert human-readable RVC amount to raw token amount.
 * e.g., "1.5" → 1_500_000n (6 decimals)
 */
export function parseRvcAmount(humanAmount: string): bigint {
  const parts = humanAmount.split('.');
  const wholePart = parts[0] ?? '0';
  const fractionPart = (parts[1] ?? '')
    .padEnd(RVC_TOKEN_CONFIG.decimals, '0')
    .slice(0, RVC_TOKEN_CONFIG.decimals);
  return BigInt(wholePart) * 10n ** BigInt(RVC_TOKEN_CONFIG.decimals) + BigInt(fractionPart);
}

/**
 * Get the mint address for a given network. Throws if not deployed.
 */
export function getRvcMintAddress(network: SolanaNetwork): string {
  const address = RVC_MINT_ADDRESSES[network];
  if (!address) {
    throw new Error(`RevealCoin is not deployed on ${network}`);
  }
  return address;
}
