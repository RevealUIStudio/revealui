import type { NextRequest, NextResponse } from 'next/server';
import { forwardBillingRequest } from '@/lib/utils/billing-api-forward';

/**
 * More specific than `(backend)/api/[...slug]`. Forwards Cookie to
 * ${API}/api/billing/subscription so /account/license can stay same-origin.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return forwardBillingRequest(request, '/api/billing/subscription');
}
