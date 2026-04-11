export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { encryptApiKey, redactApiKey } from '@revealui/db/crypto';
import { deleteApiKeys, getApiKeyMetadata, upsertApiKey } from '@revealui/db/queries/user-api-keys';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractRequestContext } from '@/lib/utils/request-context';

const ApiKeySchema = z.object({
  provider: z.enum(['ollama', 'huggingface', 'vultr', 'inference-snaps']),
  key: z.string().min(1).max(4096),
});

export const dynamic = 'force-dynamic';

/** GET /api/user/api-keys  -  return { provider, keyHint } for current user (no plaintext key) */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getClient();
  const metadata = await getApiKeyMetadata(db, session.user.id);

  return NextResponse.json(metadata);
}

/** POST /api/user/api-keys  -  encrypt and upsert an API key */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { provider, key } = parsed.data;

  const encryptedKey = encryptApiKey(key);
  const keyHint = redactApiKey(key);

  const db = getClient();

  await upsertApiKey(db, {
    id: crypto.randomUUID(),
    userId: session.user.id,
    provider,
    encryptedKey,
    keyHint,
  });

  return NextResponse.json({ provider, keyHint });
}

/** DELETE /api/user/api-keys  -  remove the user's stored key */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getClient();
  await deleteApiKeys(db, session.user.id);

  return NextResponse.json({ deleted: true });
}
