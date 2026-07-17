import crypto from 'node:crypto';
import { type BootstrapResult, bootstrap, type RevealUILike } from '@revealui/setup/bootstrap';
import { logger } from '@revealui/utils/logger';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stampTosAcceptanceByEmail } from '@/lib/auth/tos';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SetupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  name: z.string().min(1).max(100).optional(),
  seed: z.boolean().optional(),
});

/**
 * Web setup is disabled in production by default. Use CLI bootstrap instead:
 *   pnpm admin:bootstrap
 *
 * Enable with REVEALUI_ALLOW_WEB_SETUP=true (dev defaults to enabled).
 */
const isWebSetupDisabled =
  process.env.REVEALUI_ALLOW_WEB_SETUP !== 'true' && process.env.NODE_ENV === 'production';

/**
 * POST /api/setup  -  Bootstrap a fresh RevealUI instance.
 *
 * Creates the first admin user and seeds minimal content.
 * Self-disabling: returns 403 once any user exists.
 * No auth required (no users exist yet).
 * Disabled in production unless REVEALUI_ALLOW_WEB_SETUP=true.
 */
export async function POST(request: Request): Promise<NextResponse<BootstrapResult>> {
  if (isWebSetupDisabled) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Web setup is disabled in production. Use CLI: pnpm admin:bootstrap',
      } satisfies BootstrapResult,
      { status: 404 },
    );
  }
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

  if (result.status === 'created') {
    try {
      const { getClient } = await import('@revealui/db/client');
      const db = getClient('rest');

      // Stamp TOS acceptance on the typed columns. bootstrap() creates the admin
      // through the engine's create(), which can't persist tos_accepted_at /
      // tos_version (its dynamic-SQL adapter rejects camelCase column
      // identifiers), so the caller records them via a typed Drizzle write —
      // mirrors the CLI (scripts/admin/bootstrap.ts) and the sign-up route.
      try {
        await stampTosAcceptanceByEmail(db, parsed.data.email);
      } catch (tosError) {
        logger.error('Failed to record TOS acceptance for bootstrap admin', {
          email: parsed.data.email,
          error: tosError instanceof Error ? tosError.message : String(tosError),
        });
      }

      // Audit log — non-fatal.
      try {
        const { hostname } = await import('node:os');
        const { auditLog } = await import('@revealui/db/schema');
        const { classifyAuditWriteFailure, recordAuditWriteResult } = await import(
          '@revealui/core/security'
        );
        const eventId = crypto.randomUUID();
        try {
          await db.insert(auditLog).values({
            id: eventId,
            eventType: 'admin.bootstrap.completed',
            severity: 'info',
            agentId: 'web',
            payload: {
              email: parsed.data.email,
              source: 'web',
              hostname: hostname(),
              seeded: parsed.data.seed ?? true,
            },
            policyViolations: [],
          });
          recordAuditWriteResult({ ok: true, eventId, eventType: 'admin.bootstrap.completed' });
        } catch (auditError) {
          const reason = classifyAuditWriteFailure(auditError);
          recordAuditWriteResult({
            ok: false,
            reason,
            eventId,
            eventType: 'admin.bootstrap.completed',
          });
          // Non-fatal — the admin account was already created above. Best-effort
          // by design: a failed bootstrap audit row does not block admin
          // creation, but the failure is logged loudly with a classified reason
          // (never swallowed). Writes real `audit_log` columns
          // (id/event_type/severity/agent_id/payload); rows land unsigned.
          logger.error('Bootstrap audit log write failed', {
            email: parsed.data.email,
            eventId,
            reason,
            error: auditError instanceof Error ? auditError.message : String(auditError),
          });
        }
      } catch (auditSetupError) {
        // Non-fatal — audit log subsystem may not be available in all environments
        logger.error('Bootstrap audit log setup failed', {
          email: parsed.data.email,
          error:
            auditSetupError instanceof Error ? auditSetupError.message : String(auditSetupError),
        });
      }
    } catch (dbError) {
      // DB client unavailable — the admin was still created by bootstrap(), but
      // the TOS record and audit entry couldn't be written. Surface loudly so the
      // gap (a backfillable NULL tos_accepted_at) is visible, not silent.
      logger.error('Post-create steps skipped: database client unavailable', {
        email: parsed.data.email,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }
  }

  const statusCode = result.status === 'created' ? 201 : result.status === 'locked' ? 403 : 500;

  return NextResponse.json(result, { status: statusCode });
}

/**
 * GET /api/setup  -  Check if setup is needed.
 *
 * Returns { needed: true } if no users exist, { needed: false } otherwise.
 */
export async function GET(): Promise<NextResponse> {
  if (isWebSetupDisabled) {
    return NextResponse.json({ needed: false, disabled: true }, { status: 404 });
  }
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
