import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explorer  -  RevealCoin',
  description:
    'Live on-chain data for RevealCoin (RVC). Token supply, allocation wallet balances, and progress from Solana mainnet.',
};

export default function ExplorerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
