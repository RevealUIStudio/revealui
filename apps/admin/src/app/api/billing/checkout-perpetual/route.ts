import type { NextRequest, NextResponse } from 'next/server';
import { forwardBillingRequest } from '@/lib/utils/billing-api-proxy';

/** More specific than `(backend)/api/[...slug]`. Forwards Cookie + body. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return forwardBillingRequest(request, '/api/billing/checkout-perpetual');
}
