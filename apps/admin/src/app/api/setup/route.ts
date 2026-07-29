import crypto from 'node:crypto';
import { createSession } from '@revealui/auth/server';
import { type BootstrapResult, bootstrap, type RevealUILike } from '@revealui/setup/bootstrap';
import { logger } from '@revealui/utils/logger';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stampTosAcceptanceByEmail } from '@/lib/auth/tos';
import { getRevealUIInstance } from '@/lib/utils/revealui-singleton';
import {
  ROLE_COOKIE,
  requireSessionCookieDomain,
  SESSION_COOKIE,
  sessionCookieDomain,
} from '@/lib/utils/session-cookies';

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
 * Attach the same auth cookies sign-in sets (GAP-247 F8 auto-login).
 * Cookie flags mirror apps/admin/src/app/api/auth/sign-in/route.ts exactly —
 * do not weaken httpOnly/secure/sameSite or diverge maxAge from DB session TTL.
 */
function attachSessionCookies(response: NextResponse, sessionToken: string, role: string): void {
  response.cookies.set(ROLE_COOKIE, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    domain: sessionCookieDomain(),
  });

  response.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day (matches DB session expiry)
    domain: requireSessionCookieDomain(),
  });
}

/**
 * POST /api/setup  -  Bootstrap a fresh RevealUI instance.
 *
 * Creates the first admin user and seeds minimal content.
 * On success, mints a session (auto-login) so the new admin skips re-auth.
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
        const { DrizzleAuditStore } = await import('@revealui/db');
        const { classifyAuditWriteFailure, createAuditRowSignerFromEnv, recordAuditWriteResult } =
          await import('@revealui/core/security');
        // Sign at the door on a signing deployment (GAP-355 Stage 3, Advisory A):
        // this writer used to construct the store with no signer, so its rows
        // landed NULL and the verifier flagged legitimate bootstrap rows as
        // integrity failures. It now composes the same env-derived Ed25519 signer
        // apps/server uses. Absent a key (dev/test) it stays unsigned, logged.
        const { signer, mode, kid } = createAuditRowSignerFromEnv(process.env);
        if (mode === 'signed') {
          logger.info('Bootstrap audit signing enabled', { alg: 'ed25519', kid });
        } else {
          logger.warn(
            'Bootstrap audit row will be written UNSIGNED (no REVEALUI_AUDIT_SIGNING_KEY); ' +
              'legal only in dev/test',
          );
        }
        const eventId = crypto.randomUUID();
        try {
          await new DrizzleAuditStore(db, signer).append({
            id: eventId,
            timestamp: new Date(),
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
          // (id/event_type/severity/agent_id/payload); rows carry a
          // `v1.ed25519` signature on a signing deployment, NULL in dev/test.
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

    // Auto-login (GAP-247 F8): mint a session with the same createSession
    // primitive sign-in uses. Non-fatal — admin creation already succeeded;
    // a mint failure falls back to the old /login redirect on the client.
    const userId = result.user?.id;
    if (userId) {
      try {
        const userAgent = request.headers.get('user-agent') || undefined;
        const ipAddress =
          request.headers.get('x-real-ip') ||
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          undefined;
        const { token } = await createSession(userId, { userAgent, ipAddress });
        const body: BootstrapResult = { ...result, sessionMinted: true };
        const response = NextResponse.json(body, { status: 201 });
        attachSessionCookies(response, token, result.user?.role ?? 'owner');
        return response;
      } catch (sessionError) {
        logger.error('Setup auto-login session mint failed', {
          email: parsed.data.email,
          userId,
          error: sessionError instanceof Error ? sessionError.message : String(sessionError),
        });
      }
    } else {
      logger.warn('Setup auto-login skipped: bootstrap result missing user id', {
        email: parsed.data.email,
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
