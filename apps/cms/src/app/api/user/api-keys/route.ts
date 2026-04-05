export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { encryptApiKey, redactApiKey } from '@revealui/db/crypto';
import { userApiKeys } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { extractRequestContext } from '@/lib/utils/request-context';

const ApiKeySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'groq', 'ollama', 'huggingface', 'vultr']),
  key: z.string().min(1).max(4096),
});

export const dynamic = 'force-dynamic';

/** GET /api/user/api-keys — return { provider, keyHint } for current user (no plaintext key) */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getClient();
  const rows = await db
    .select({ provider: userApiKeys.provider, keyHint: userApiKeys.keyHint })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, session.user.id))
    .limit(1);

  return NextResponse.json(rows[0] ?? null);
}

/** POST /api/user/api-keys — encrypt and upsert an API key */
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
  const now = new Date();

  const db = getClient();

  // Delete any existing key for this user+provider, then insert fresh
  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, session.user.id), eq(userApiKeys.provider, provider)));

  await db.insert(userApiKeys).values({
    id: crypto.randomUUID(),
    userId: session.user.id,
    provider,
    encryptedKey,
    keyHint,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ provider, keyHint });
}

/** DELETE /api/user/api-keys — remove the user's stored key */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getClient();
  await db.delete(userApiKeys).where(eq(userApiKeys.userId, session.user.id));

  return NextResponse.json({ deleted: true });
}
