import type { NextRequest, NextResponse } from 'next/server';
import { forwardStudioAuthRequest } from '@/lib/utils/studio-auth-api-forward';

/**
 * More specific than `(backend)/api/[...slug]`. Forwards Cookie + CSRF to
 * ${API}/api/studio-auth/devices/:deviceId so revoke stays same-origin.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ deviceId: string }> },
): Promise<NextResponse> {
  const { deviceId } = await context.params;
  return forwardStudioAuthRequest(
    request,
    `/api/studio-auth/devices/${encodeURIComponent(deviceId)}`,
  );
}
