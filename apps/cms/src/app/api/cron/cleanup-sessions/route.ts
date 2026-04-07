/**
 * Cron: Cleanup expired and revoked sessions
 *
 * GET /api/cron/cleanup-sessions
 * Schedule: hourly
 *
 * Delegates to @revealui/db cleanupStaleTokens() for the sessions table.
 * Prefer /api/cron/cleanup-all for consolidated cleanup.
 */
import { cleanupStaleTokens } from '@revealui/db/cleanup';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanupStaleTokens({ tables: ['sessions'] });
    return NextResponse.json({ deleted: result.sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
