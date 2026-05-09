import {
  formatRvuiAmount,
  RVUI_ALLOCATIONS,
  RVUI_DISCOUNT_RATES,
  RVUI_MINT_ADDRESSES,
  RVUI_TOKEN_CONFIG,
} from '@revealui/contracts';

export {
  formatRvuiAmount,
  RVUI_ALLOCATIONS,
  RVUI_DISCOUNT_RATES,
  RVUI_MINT_ADDRESSES,
  RVUI_TOKEN_CONFIG,
};

/**
 * Active display network for the revealcoin dashboard.
 *
 * Resolves to 'mainnet-beta' once the manifest entry is populated by the
 * mainnet deploy emitter (`packages/scripts/src/emit-manifest.ts`), and
 * falls back to 'devnet' until then. The dashboard MUST never display
 * mainnet copy or a broken mainnet explorer URL while the manifest entry
 * is empty — `mainnet-honesty.test.ts` enforces the invariant.
 */
export const ACTIVE_NETWORK: 'mainnet-beta' | 'devnet' = RVUI_MINT_ADDRESSES['mainnet-beta']
  ? 'mainnet-beta'
  : 'devnet';

/** Human-readable label for the active network — used in UI badges and copy. */
export const NETWORK_LABEL = ACTIVE_NETWORK === 'mainnet-beta' ? 'Mainnet' : 'Devnet preview';

/**
 * Mint address for the network the dashboard is currently displaying.
 *
 * Pre-mainnet, this resolves to the devnet mint so the explorer link works
 * and `truncateAddress(MINT_ADDRESS)` does not render `'...'`. Post-mainnet
 * deploy, automatically switches to the mainnet address.
 */
export const MINT_ADDRESS = RVUI_MINT_ADDRESSES[ACTIVE_NETWORK];

const EXPLORER_CLUSTER_QS = ACTIVE_NETWORK === 'devnet' ? '?cluster=devnet' : '';

export const EXPLORER_URL = `https://explorer.solana.com/address/${MINT_ADDRESS}${EXPLORER_CLUSTER_QS}`;
export const SOLSCAN_URL = `https://solscan.io/token/${MINT_ADDRESS}${
  ACTIVE_NETWORK === 'devnet' ? '?cluster=devnet' : ''
}`;
export const ARWEAVE_LOGO = 'https://arweave.net/p6DmWVkFTfo9AcENidr7gmzgQSq_LCbZ-wrbM6hx8gY';
export const ARWEAVE_METADATA = 'https://arweave.net/jevrIBAIO7y3d7klAoXkPYRV5SpEtiBF-ZJOjwcLLYM';

/** Devnet deploy date — dashboard surfaces this until the mainnet deploy date is set. */
export const DEVNET_DEPLOY_DATE = '2026-03-26';
/** Set to the ISO date string when the mainnet token actually deploys; null until then. */
export const MAINNET_DEPLOY_DATE: string | null = null;
/**
 * Active deploy date for vesting math + display. Always resolves to a string —
 * falls through to DEVNET_DEPLOY_DATE when MAINNET_DEPLOY_DATE has not been set,
 * which keeps the vesting timeline rendering correctly during the devnet preview.
 */
export const DEPLOY_DATE: string = MAINNET_DEPLOY_DATE ?? DEVNET_DEPLOY_DATE;

/** Format a large number with commas. */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Truncate a Solana address for display: "4Ysb...gPo" */
export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Human-readable total supply. */
export const TOTAL_SUPPLY_DISPLAY = '58,906,000,000';
