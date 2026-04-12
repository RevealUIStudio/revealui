/**
 * Consolidated Cron: All cleanup tasks in a single endpoint
 *
 * GET /api/cron/cleanup-all
 * Schedule: daily (Vercel Hobby-friendly  -  single cron job)
 *
 * Handles:
 * - Expired/revoked sessions
 * - Stale rate limit records
 * - Expired password reset tokens
 * - Expired magic links
 * - Scheduled page publishing (scheduledAt <= now)
 *
 * Delegates to @revealui/db cleanupStaleTokens() which already
 * implements all five cleanup tasks. This route exists so a single
 * Vercel Cron job replaces the four individual cleanup routes.
 *
 * The individual routes (cleanup-sessions, cleanup-rate-limits, etc.)
 * are retained for backward compatibility and manual use.
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
    const result = await cleanupStaleTokens();

    return NextResponse.json({
      success: true,
      cleaned: {
        sessions: result.sessions,
        rateLimits: result.rateLimits,
        passwordResetTokens: result.passwordResetTokens,
        magicLinks: result.magicLinks,
        scheduledPages: result.scheduledPages,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
