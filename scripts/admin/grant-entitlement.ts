#!/usr/bin/env tsx

/**
 * CLI Entitlement Grant — set a hosted account's tier without a Stripe
 * subscription.
 *
 * The hosted entitlement row (`account_entitlements`) is normally written only
 * by the Stripe webhook path and the reconcile-entitlements cron. Neither can
 * grant a tier to an account with no subscription, so operator-comped accounts
 * (the founder's own account, tier-testing accounts) had no provisioning path.
 * This CLI is that path. It reuses `buildHostedEntitlementValues()` so a manual
 * grant produces exactly the row a webhook would have produced for the tier.
 *
 * Durability: the reconciler only heals accounts that HAVE a usable
 * subscription, and only upward toward the subscription's tier
 * (reconcile-entitlements.ts `no-entitlement-source` / `belowExpected` paths),
 * so a grant on a subscription-less account is never clobbered by the cron.
 * If the account later completes a real Stripe checkout, the webhook becomes
 * the source of truth again — by design, and this script warns when a healthy
 * subscription already exists.
 *
 * Usage:
 *   pnpm admin:grant-entitlement --email=<email> --tier=<free|pro|max|enterprise>
 *     [--mode=live|test]    default: getConfiguredStripeMode()
 *     [--create-account]    provision a personal account + owner membership if none
 *     [--dry-run]           print the plan, write nothing
 */

import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import {
  buildHostedEntitlementValues,
  coerceHostedTier,
  type HostedTier,
} from '../../apps/server/src/lib/hosted-entitlement.js';

interface CliArgs {
  email: string;
  tier: HostedTier;
  mode: 'live' | 'test';
  createAccount: boolean;
  dryRun: boolean;
}

function fail(message: string): never {
  console.error(`[grant-entitlement] ${message}`);
  process.exit(1);
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const prefix = `${flag}=`;
  return args.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function parseArgs(args: string[]): CliArgs {
  const email = readFlagValue(args, '--email')?.trim().toLowerCase() ?? '';
  if (!email.includes('@')) {
    fail('missing or invalid --email=<address>');
  }

  const tierRaw = readFlagValue(args, '--tier');
  const tier = coerceHostedTier(tierRaw);
  if (!tier) {
    fail(`missing or invalid --tier (got: ${tierRaw ?? 'none'}); expected free|pro|max|enterprise`);
  }

  const modeRaw = readFlagValue(args, '--mode');
  if (modeRaw !== undefined && modeRaw !== 'live' && modeRaw !== 'test') {
    fail(`invalid --mode (got: ${modeRaw}); expected live|test`);
  }
  const mode = modeRaw ?? getConfiguredStripeMode();

  return {
    email,
    tier,
    mode,
    createAccount: args.includes('--create-account'),
    dryRun: args.includes('--dry-run'),
  };
}

async function main(): Promise<void> {
  const { email, tier, mode, createAccount, dryRun } = parseArgs(process.argv.slice(2));

  console.log(`[grant-entitlement] target: ${email} → tier=${tier} mode=${mode}`);

  // Deferred imports so arg errors never open a DB connection (bootstrap.ts idiom).
  const { getClient } = await import('@revealui/db/client');
  const { accountEntitlements, accountMemberships, accountSubscriptions, accounts, users } =
    await import('@revealui/db/schema');
  const { and, eq, ne, sql } = await import('@revealui/db/orm');

  const db = getClient('rest');

  // 1. Resolve the user. Case-insensitive: signup normalizes, older rows may not.
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (!user) {
    fail(
      `no user found for ${email}. The user must sign up first ` +
        '(REVEALUI_SIGNUP_WHITELIST gates registration on closed deployments), ' +
        'or be created via pnpm admin:bootstrap.',
    );
  }

  // 2. Resolve the billing account via active membership.
  const [membership] = await db
    .select({ accountId: accountMemberships.accountId, role: accountMemberships.role })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, user.id), eq(accountMemberships.status, 'active')))
    .limit(1);

  let accountId = membership?.accountId;

  if (!accountId) {
    if (!createAccount) {
      fail(
        `user ${email} has no active account membership. ` +
          'Re-run with --create-account to provision a personal account + owner membership ' +
          '(same shape signup and the Stripe webhook produce).',
      );
    }
    accountId = randomUUID();
    const now = new Date();
    console.log(`[grant-entitlement] provisioning personal account ${accountId} for ${email}`);
    if (!dryRun) {
      // Mirrors the signup path (packages/auth/src/server/auth.ts) and the
      // webhook backfill (ensureHostedAccount in apps/server routes/webhooks.ts).
      await db.insert(accounts).values({
        id: accountId,
        name: `${user.name || 'RevealUI'} Workspace`,
        slug: `acct-${accountId}`,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(accountMemberships).values({
        id: randomUUID(),
        accountId,
        userId: user.id,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // 3. Existing entitlement (PK is accountId — one row per account).
  const [existing] = await db
    .select({
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
      mode: accountEntitlements.mode,
      lastEventAt: accountEntitlements.lastEventAt,
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);

  // 4. Exclusivity visibility: enterprise is the operator/founder tier. Surface
  //    every OTHER account already holding it so a second grant is a deliberate
  //    decision, never an accident.
  if (tier === 'enterprise') {
    const others = await db
      .select({ accountId: accountEntitlements.accountId, name: accounts.name })
      .from(accountEntitlements)
      .innerJoin(accounts, eq(accounts.id, accountEntitlements.accountId))
      .where(
        and(
          eq(accountEntitlements.tier, 'enterprise'),
          ne(accountEntitlements.accountId, accountId),
        ),
      );
    if (others.length > 0) {
      console.warn(
        `[grant-entitlement] WARNING: ${others.length} other account(s) already hold enterprise:`,
      );
      for (const o of others) {
        console.warn(`[grant-entitlement]   - ${o.name} (${o.accountId})`);
      }
    }
  }

  // 5. Warn when Stripe is authoritative for this account: a healthy
  //    subscription means the next webhook overwrites this manual grant.
  const [subscription] = await db
    .select({ status: accountSubscriptions.status, planId: accountSubscriptions.planId })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.accountId, accountId))
    .limit(1);
  if (subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
    console.warn(
      `[grant-entitlement] WARNING: account has a ${subscription.status} Stripe subscription ` +
        `(plan: ${subscription.planId}). Webhook events will overwrite this manual grant.`,
    );
  }

  // 6. Build the row exactly as the webhook path would.
  const values = buildHostedEntitlementValues({
    tier,
    status: 'active',
    mode,
    graceUntil: null,
    // Cursor contract (see hosted-entitlement.ts): NULL only on INSERT so the
    // next real webhook wins; on UPDATE preserve the existing cursor so a
    // stale replayed event cannot win.
    lastEventAt: existing ? (existing.lastEventAt ?? null) : null,
    now: new Date(),
    // GAP-444: gifted rows must not count as Stripe revenue in MRR.
    source: 'grant',
  });

  console.log(
    `[grant-entitlement] ${existing ? `update (was ${existing.tier}/${existing.status}/${existing.mode})` : 'insert'}: ` +
      `tier=${values.tier} features=${JSON.stringify(values.features)} limits=${JSON.stringify(values.limits)}`,
  );

  if (dryRun) {
    console.log('[grant-entitlement] dry run — nothing written');
    process.exit(0);
  }

  if (existing) {
    await db
      .update(accountEntitlements)
      .set(values)
      .where(eq(accountEntitlements.accountId, accountId));
  } else {
    await db.insert(accountEntitlements).values({ accountId, ...values });
  }

  // 7. Audit row — same signed-store pattern as scripts/admin/bootstrap.ts.
  {
    const { DrizzleAuditStore } = await import('@revealui/db');
    const { classifyAuditWriteFailure, createAuditRowSignerFromEnv, recordAuditWriteResult } =
      await import('@revealui/core/security');
    const { signer, mode: signMode, kid } = createAuditRowSignerFromEnv(process.env);
    console.log(
      signMode === 'signed'
        ? `[grant-entitlement] audit signing enabled (alg=ed25519, kid=${kid})`
        : '[grant-entitlement] audit row will be written UNSIGNED (no REVEALUI_AUDIT_SIGNING_KEY; dev/test only)',
    );
    const targetEnv =
      process.env.REVEALUI_ENV?.trim() || process.env.NODE_ENV?.trim() || 'development';
    const eventId = randomUUID();
    try {
      await new DrizzleAuditStore(db, signer, { targetEnv }).append({
        id: eventId,
        timestamp: new Date(),
        eventType: 'admin.entitlement.granted',
        severity: 'info',
        agentId: 'cli',
        payload: {
          email,
          accountId,
          tier,
          mode,
          previousTier: existing?.tier ?? null,
          hostname: hostname(),
          source: 'cli',
        },
        policyViolations: [],
      });
      recordAuditWriteResult({ ok: true, eventId, eventType: 'admin.entitlement.granted' });
      console.log('[grant-entitlement] recorded audit log entry');
    } catch (err) {
      const reason = classifyAuditWriteFailure(err);
      recordAuditWriteResult({
        ok: false,
        reason,
        eventId,
        eventType: 'admin.entitlement.granted',
      });
      // Non-fatal by design (mirrors bootstrap.ts): the grant already landed;
      // the failure is logged loudly with a classified reason, never swallowed.
      console.warn(
        `[grant-entitlement] audit log entry failed (reason: ${reason}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(
    `[grant-entitlement] done: ${email} (account ${accountId}) is now tier=${tier} mode=${mode}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('[grant-entitlement] unexpected error:', err);
  process.exit(1);
});
