import type { NextRequest, NextResponse } from 'next/server';
import { forwardStudioAuthRequest } from '@/lib/utils/studio-auth-api-forward';

/**
 * More specific than `(backend)/api/[...slug]`. Forwards Cookie to
 * ${API}/api/studio-auth/devices so /account/license can stay same-origin.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return forwardStudioAuthRequest(request, '/api/studio-auth/devices');
}
