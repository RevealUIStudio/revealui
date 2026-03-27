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

export const MINT_ADDRESS = RVUI_MINT_ADDRESSES['mainnet-beta'];
export const EXPLORER_URL = `https://explorer.solana.com/address/${MINT_ADDRESS}`;
export const SOLSCAN_URL = `https://solscan.io/token/${MINT_ADDRESS}`;
export const ARWEAVE_LOGO = 'https://arweave.net/p6DmWVkFTfo9AcENidr7gmzgQSq_LCbZ-wrbM6hx8gY';
export const ARWEAVE_METADATA = 'https://arweave.net/jevrIBAIO7y3d7klAoXkPYRV5SpEtiBF-ZJOjwcLLYM';
export const DEPLOY_DATE = '2026-03-26';

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
