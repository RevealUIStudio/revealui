export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { decryptApiKey } from '@revealui/db/crypto';
import { userApiKeys } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/user/api-keys/value
 *
 * Returns the decrypted plaintext key for the current user.
 * Used only at task call time — the key is NOT stored in client state between calls.
 * Updates lastUsedAt on each fetch.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getClient();
  const rows = await db
    .select({
      id: userApiKeys.id,
      provider: userApiKeys.provider,
      encryptedKey: userApiKeys.encryptedKey,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, session.user.id))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 404 });
  }

  const key = decryptApiKey(row.encryptedKey);

  // Update lastUsedAt (fire-and-forget — don't block the response)
  db.update(userApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKeys.id, row.id))
    .catch(() => {
      // Fire-and-forget — lastUsedAt update failure is non-critical
    });

  return NextResponse.json({ provider: row.provider, key });
}
