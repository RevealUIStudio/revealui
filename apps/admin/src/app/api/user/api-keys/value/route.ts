export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { decryptApiKey } from '@revealui/db/crypto';
import { getEncryptedApiKey, touchApiKeyUsage } from '@revealui/db/queries/user-api-keys';
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
  const row = await getEncryptedApiKey(db, session.user.id);

  if (!row) {
    return NextResponse.json({ error: 'No API key configured' }, { status: 404 });
  }

  const key = decryptApiKey(row.encryptedKey);

  // Update lastUsedAt (fire-and-forget — don't block the response)
  touchApiKeyUsage(db, row.id).catch(() => {
    // Fire-and-forget — lastUsedAt update failure is non-critical
  });

  return NextResponse.json({ provider: row.provider, key });
}
