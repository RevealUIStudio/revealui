/**
 * Cron: Cleanup expired and revoked sessions
 *
 * GET /api/cron/cleanup-sessions
 * Schedule: hourly
 *
 * Deletes:
 * - Sessions past their expiresAt timestamp
 * - Sessions that have been soft-deleted (deletedAt IS NOT NULL)
 */
import { getClient } from '@revealui/db';
import { isNotNull, lt, or, sessions } from '@revealui/db/schema';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getClient();
    const now = new Date();

    const deleted = await db
      .delete(sessions)
      .where(or(lt(sessions.expiresAt, now), isNotNull(sessions.deletedAt)))
      .returning();

    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
