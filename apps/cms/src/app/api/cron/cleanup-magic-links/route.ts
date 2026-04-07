/**
 * Cron: Cleanup expired magic links
 *
 * GET /api/cron/cleanup-magic-links
 * Schedule: daily
 *
 * Delegates to @revealui/db cleanupStaleTokens() for the magicLinks table.
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
    const result = await cleanupStaleTokens({ tables: ['magicLinks'] });
    return NextResponse.json({ deleted: result.magicLinks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
