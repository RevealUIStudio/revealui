export const runtime = 'nodejs';

import { getSession } from '@revealui/auth/server';
import { LLM_PROVIDERS } from '@revealui/contracts';
import { getClient } from '@revealui/db';
import { encryptApiKey, redactApiKey } from '@revealui/db/crypto';
import { deleteApiKeys, getApiKeyMetadata, upsertApiKey } from '@revealui/db/queries/user-api-keys';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSessionWithMfa } from '@/lib/auth/require-mfa';
import { extractRequestContext } from '@/lib/utils/request-context';

const ApiKeySchema = z.object({
  provider: z.enum(LLM_PROVIDERS),
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
  // Admin/owner roles must have MFA enrolled + verified (C11 requireMfa).
  const gate = await requireSessionWithMfa(request);
  if (!gate.ok) return gate.response;
  const { session } = gate;

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

  // GAP-360 §5.7: verify the key against the provider before storing it, the
  // same probe the apps/server route runs (models-list-class call via
  // @revealui/ai key-validator). A provider-rejected key returns 400 so the
  // "tasks will use your key" banner never becomes a lie; an UNREACHABLE
  // provider (timeout, outage) validates as ok so network failures never block
  // storage. @revealui/ai is an optional Pro peer — absent module skips the
  // probe (pro-stub pattern).
  const keyValidatorMod = await import('@revealui/ai/llm/key-validator').catch(() => null);
  if (keyValidatorMod) {
    const validation = await keyValidatorMod.validateProviderKey(provider, key);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

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
  const gate = await requireSessionWithMfa(request);
  if (!gate.ok) return gate.response;
  const { session } = gate;

  const db = getClient();
  await deleteApiKeys(db, session.user.id);

  return NextResponse.json({ deleted: true });
}
