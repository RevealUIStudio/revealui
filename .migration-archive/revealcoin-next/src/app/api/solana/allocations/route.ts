import { NextResponse } from 'next/server';
import { MINT_ADDRESS, RVUI_ALLOCATIONS } from '@/lib/constants';
import { getTokenBalance } from '@/lib/solana';

export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET(): Promise<NextResponse> {
  try {
    const balances = await Promise.all(
      RVUI_ALLOCATIONS.map(async (alloc) => {
        const balance = await getTokenBalance(alloc.wallet, MINT_ADDRESS);
        const totalHuman = Number(alloc.amount / 1_000_000n);
        return {
          name: alloc.name,
          percentage: alloc.percentage,
          totalAmount: totalHuman,
          wallet: alloc.wallet,
          balance: balance.balance,
          vestingDescription: alloc.vestingDescription,
        };
      }),
    );

    return NextResponse.json({ allocations: balances });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch allocations' },
      { status: 502 },
    );
  }
}
