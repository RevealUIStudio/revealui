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
import { sendCronFailureAlert } from '@/lib/utils/cron-alert';
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
    const err = error instanceof Error ? error : new Error(String(error));
    await sendCronFailureAlert({
      jobName: 'admin:cleanup-magic-links',
      error: err,
      severity: 'error',
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
