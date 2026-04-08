/**
 * Cron: Cleanup expired password reset tokens
 *
 * GET /api/cron/cleanup-password-reset-tokens
 * Schedule: daily
 *
 * Delegates to @revealui/db cleanupStaleTokens() for the passwordResetTokens table.
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
    const result = await cleanupStaleTokens({ tables: ['passwordResetTokens'] });
    return NextResponse.json({ deleted: result.passwordResetTokens });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
