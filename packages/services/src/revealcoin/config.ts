/**
 * RevealCoin RPC Configuration
 *
 * Parameterized configuration for Solana RPC connections and payment
 * verification. All thresholds are overridable for testing.
 */

import type { SolanaNetwork } from '@revealui/contracts';

// =============================================================================
// Configuration Interface
// =============================================================================

export interface RevealCoinConfig {
  /** Solana network to connect to. Default: 'devnet' */
  network: SolanaNetwork;
  /** Solana RPC URL override. If empty, uses default cluster URL for the network. */
  rpcUrl: string;
  /** Commitment level for balance queries. Default: 'confirmed' */
  queryCommitment: 'processed' | 'confirmed' | 'finalized';
  /** Commitment level for payment verification. Default: 'finalized' */
  paymentCommitment: 'confirmed' | 'finalized';
  /** Whether RVUI payments are enabled. Default: false */
  enabled: boolean;
  /** Wallet address to receive RVUI payments. Required when enabled. */
  receivingWallet: string;
  /** Balance poll interval in milliseconds. Default: 60_000 */
  pollIntervalMs: number;
}

const DEFAULT_CONFIG: RevealCoinConfig = {
  network: 'devnet',
  rpcUrl: '',
  queryCommitment: 'confirmed',
  paymentCommitment: 'finalized',
  enabled: false,
  receivingWallet: '',
  pollIntervalMs: 60_000,
};

let config: RevealCoinConfig = { ...DEFAULT_CONFIG };

// =============================================================================
// Public API
// =============================================================================

/** Read RevealCoin configuration from environment variables. */
export function getRevealCoinConfig(): RevealCoinConfig {
  const network = (process.env.SOLANA_NETWORK as SolanaNetwork) ?? DEFAULT_CONFIG.network;

  return {
    ...config,
    network,
    rpcUrl: process.env.SOLANA_RPC_URL ?? config.rpcUrl,
    enabled: process.env.RVUI_PAYMENTS_ENABLED === 'true',
    receivingWallet: process.env.RVUI_RECEIVING_WALLET ?? config.receivingWallet,
  };
}

/** Override configuration (for testing or runtime reconfiguration). */
export function configureRevealCoin(overrides: Partial<RevealCoinConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}

/** Reset configuration to defaults. */
export function resetRevealCoinConfig(): void {
  config = { ...DEFAULT_CONFIG };
}

// =============================================================================
// RPC URL Resolution
// =============================================================================

const CLUSTER_URLS: Record<SolanaNetwork, string> = {
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
};

/** Resolve the RPC URL for the current network configuration. */
export function resolveRpcUrl(cfg?: RevealCoinConfig): string {
  const c = cfg ?? getRevealCoinConfig();
  if (c.rpcUrl) return c.rpcUrl;
  return CLUSTER_URLS[c.network] ?? 'https://api.devnet.solana.com';
}
