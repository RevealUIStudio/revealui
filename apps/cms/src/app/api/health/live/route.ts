import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe endpoint
 * Simple check to verify the service is running
 * Always returns 200 if the endpoint is reachable
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'alive',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
