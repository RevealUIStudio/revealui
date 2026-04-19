#!/usr/bin/env tsx

/**
 * CLI Admin Bootstrap — Create the first admin user from revvault credentials.
 *
 * Replaces the unauthenticated /setup web flow for production deployments.
 * Reads admin email/password from revvault, creates the super-admin user via
 * the existing bootstrap() helper, and optionally flags the account for
 * forced password rotation on first sign-in.
 *
 * Usage:
 *   pnpm admin:bootstrap              # auto-detect env from NODE_ENV
 *   pnpm admin:bootstrap --env=prod   # explicit environment
 *   pnpm admin:bootstrap --force      # allow re-run in dev (prod ignores)
 *   pnpm admin:bootstrap --no-seed    # skip content seeding
 *
 * Requires revvault paths:
 *   revealui/{env}/admin/bootstrap/email
 *   revealui/{env}/admin/bootstrap/password
 *   revealui/{env}/admin/bootstrap/name          (optional)
 *   revealui/{env}/admin/bootstrap/force-rotate   (optional, default: true)
 */

import { execFileSync } from 'node:child_process';
import { randomFillSync } from 'node:crypto';
import { hostname } from 'node:os';

// ---------------------------------------------------------------------------
// Environment resolution
// ---------------------------------------------------------------------------

function resolveEnv(args: string[]): string {
  // --env=<value> flag
  const envFlag = args.find((a) => a.startsWith('--env='));
  if (envFlag) return envFlag.split('=')[1];

  // REVEALUI_ENV env var
  if (process.env.REVEALUI_ENV) return process.env.REVEALUI_ENV;

  // Map NODE_ENV
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') return 'prod';
  if (nodeEnv === 'test' || nodeEnv === 'staging') return 'stage';
  return 'dev';
}

// ---------------------------------------------------------------------------
// Revvault integration
// ---------------------------------------------------------------------------

function revvaultGet(path: string): string | null {
  try {
    const result = execFileSync('revvault', ['get', '--full', path], {
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return result.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const env = resolveEnv(args);
  const force = args.includes('--force');
  const noSeed = args.includes('--no-seed');

  console.log(`[bootstrap] env: ${env}`);

  // Validate --force usage
  if (force && env !== 'dev') {
    console.error('[bootstrap] --force is only allowed in dev environment');
    process.exit(1);
  }

  // Read credentials from revvault
  const email = revvaultGet(`revealui/${env}/admin/bootstrap/email`);
  if (!email) {
    console.error(
      `[bootstrap] revvault path not found: revealui/${env}/admin/bootstrap/email\n` +
        `Set it with: revvault set revealui/${env}/admin/bootstrap/email`,
    );
    process.exit(1);
  }

  const password = revvaultGet(`revealui/${env}/admin/bootstrap/password`);
  if (!password) {
    console.error(
      `[bootstrap] revvault path not found: revealui/${env}/admin/bootstrap/password\n` +
        `Set it with: revvault set revealui/${env}/admin/bootstrap/password`,
    );
    process.exit(1);
  }

  const name = revvaultGet(`revealui/${env}/admin/bootstrap/name`) ?? 'Super Admin';
  const forceRotateRaw = revvaultGet(`revealui/${env}/admin/bootstrap/force-rotate`);
  const forceRotate = forceRotateRaw !== 'false'; // default true

  // Import bootstrap (deferred to avoid top-level DB connection)
  const { bootstrap } = await import('@revealui/setup/bootstrap');

  // Build a minimal RevealUI-like instance using the DB client directly
  const { getClient } = await import('@revealui/db/client');
  const { users } = await import('@revealui/db/schema');
  const { eq } = await import('drizzle-orm');

  const db = getClient('rest');

  // Check for existing super-admin
  const existingAdmins = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.role, 'owner'))
    .limit(1);

  if (existingAdmins.length > 0 && !force) {
    const existing = existingAdmins[0];
    console.error(
      `[bootstrap] super-admin already exists (id: ${existing.id})\n` +
        `To rotate the password, use: pnpm admin:rotate-password\n` +
        `To create an additional admin, use the admin UI after signing in as super-admin.`,
    );
    process.exit(1);
  }

  // Get the RevealUI instance for bootstrap
  // We need to dynamically import to avoid pulling in the full admin app
  const { getRevealUIInstance } = await import(
    '../../apps/admin/src/lib/utilities/revealui-singleton.js'
  );
  const revealui = await getRevealUIInstance();

  const result = await bootstrap({
    revealui: revealui as Parameters<typeof bootstrap>[0]['revealui'],
    admin: { email, password, name },
    seed: !noSeed,
  });

  // Zeroize password in memory (best-effort)
  const buf = Buffer.from(password);
  randomFillSync(buf, 0, buf.length);

  if (result.status === 'error') {
    console.error(`[bootstrap] ${result.message}`);
    if (result.error) console.error(`[bootstrap] detail: ${result.error}`);
    process.exit(1);
  }

  if (result.status === 'locked' && !force) {
    console.error(`[bootstrap] ${result.message}`);
    process.exit(1);
  }

  // Set mustRotatePassword flag if requested
  if (forceRotate && result.user) {
    try {
      await db.update(users).set({ mustRotatePassword: true }).where(eq(users.email, email));
      console.log('[bootstrap] mustRotatePassword flag set — first sign-in will require rotation');
    } catch (err) {
      console.warn(
        `[bootstrap] failed to set mustRotatePassword flag: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Audit log entry
  try {
    const { auditLog } = await import('@revealui/db/schema');
    await db.insert(auditLog).values({
      event: 'admin.bootstrap.completed',
      actor: 'cli',
      severity: 'info',
      meta: {
        email,
        env,
        source: 'revvault',
        hostname: hostname(),
        forceRotate,
        seeded: result.seeded ?? false,
      },
    } as never);
  } catch {
    // Non-fatal — audit log may not be available in all environments
    console.warn('[bootstrap] audit log entry skipped (table may not exist)');
  }

  console.log(`[bootstrap] ${result.message}`);
  if (result.user) {
    console.log(`[bootstrap] user: ${result.user.email} (role: ${result.user.role})`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[bootstrap] unexpected error:', err);
  process.exit(1);
});
