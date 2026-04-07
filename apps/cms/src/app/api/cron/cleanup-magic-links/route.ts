/**
 * Cron: Cleanup expired magic links
 *
 * GET /api/cron/cleanup-magic-links
 * Schedule: daily
 *
 * Deletes magic_links rows past their expiresAt timestamp.
 */
import { getClient } from '@revealui/db';
import { lt, magicLinks } from '@revealui/db/schema';
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

    const deleted = await db.delete(magicLinks).where(lt(magicLinks.expiresAt, now)).returning();

    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
