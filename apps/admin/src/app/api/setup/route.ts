import { type BootstrapResult, bootstrap, type RevealUILike } from '@revealui/setup/bootstrap';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getRevealUIInstance } from '@/lib/utilities/revealui-singleton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SetupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  name: z.string().min(1).max(100).optional(),
  seed: z.boolean().optional(),
});

/**
 * POST /api/setup — Bootstrap a fresh RevealUI instance.
 *
 * Creates the first admin user and seeds minimal content.
 * Self-disabling: returns 403 once any user exists.
 * No auth required (no users exist yet).
 */
export async function POST(request: Request): Promise<NextResponse<BootstrapResult>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: 'error', message: 'Invalid JSON body.' } satisfies BootstrapResult,
      { status: 400 },
    );
  }

  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Validation failed.';
    return NextResponse.json({ status: 'error', message: firstError } satisfies BootstrapResult, {
      status: 400,
    });
  }

  const revealui = await getRevealUIInstance();

  const result = await bootstrap({
    revealui: revealui as unknown as RevealUILike,
    admin: {
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
    },
    seed: parsed.data.seed ?? true,
  });

  const statusCode = result.status === 'created' ? 201 : result.status === 'locked' ? 403 : 500;

  return NextResponse.json(result, { status: statusCode });
}

/**
 * GET /api/setup — Check if setup is needed.
 *
 * Returns { needed: true } if no users exist, { needed: false } otherwise.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const revealui = await getRevealUIInstance();
    const existing = await revealui.find({
      collection: 'users',
      limit: 1,
      depth: 0,
    });

    return NextResponse.json({ needed: existing.totalDocs === 0 });
  } catch {
    return NextResponse.json({ needed: false, error: 'Database unavailable' }, { status: 503 });
  }
}
