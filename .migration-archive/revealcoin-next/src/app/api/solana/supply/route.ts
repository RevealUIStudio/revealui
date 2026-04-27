import { NextResponse } from 'next/server';
import { MINT_ADDRESS } from '@/lib/constants';
import { getTokenSupply } from '@/lib/solana';

export const runtime = 'nodejs';
export const revalidate = 60;

export async function GET(): Promise<NextResponse> {
  try {
    const supply = await getTokenSupply(MINT_ADDRESS);

    return NextResponse.json({
      totalSupply: supply.uiAmountString,
      decimals: supply.decimals,
      raw: supply.amount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch supply' },
      { status: 502 },
    );
  }
}
