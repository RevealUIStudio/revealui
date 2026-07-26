/**
 * Cron: Billing Readiness Check
 *
 * Validates that the billing system is correctly configured:
 * 1. All expected Stripe price env vars are set
 * 2. REVEALUI_LICENSE_PRIVATE_KEY is present (for license JWT generation)
 * 3. Billing catalog DB rows exist for all tiers
 * 4. Stripe price parity against the MRR fallback (CR8-P2-04)
 * 5. Stripe Tax Settings vs STRIPE_TAX_ENABLED, live mode only (GAP-437) —
 *    the authoritative control for this drift class; see inline comment
 * 6. Email provider configured (warning only  -  Gmail API via Google Workspace service account)
 *
 * Sends an alert email to REVEALUI_ALERT_EMAIL on any failure.
 * Runs daily at 06:00 UTC (configured in vercel.json).
 *
 * Protected by X-Cron-Secret header.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { billingCatalog } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';
import { getServices } from '../../lib/services-loader.js';
import { MRR_TIER_PRICE_FALLBACK_CENTS, type SubscriptionTierId } from '../../lib/tier-pricing.js';

const app = new Hono();

/** Subscription tiers whose Stripe prices must match the MRR fallback. */
const SUBSCRIPTION_TIERS: Array<{
  tier: SubscriptionTierId;
  priceEnvVar: 'STRIPE_PRO_PRICE_ID' | 'STRIPE_MAX_PRICE_ID' | 'STRIPE_ENTERPRISE_PRICE_ID';
}> = [
  { tier: 'pro', priceEnvVar: 'STRIPE_PRO_PRICE_ID' },
  { tier: 'max', priceEnvVar: 'STRIPE_MAX_PRICE_ID' },
  { tier: 'enterprise', priceEnvVar: 'STRIPE_ENTERPRISE_PRICE_ID' },
];

const ALERT_EMAIL = process.env.REVEALUI_ALERT_EMAIL ?? 'founder@revealui.com';

/** Env vars that must be set for billing to work */
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'REVEALUI_LICENSE_PRIVATE_KEY',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_MAX_PRICE_ID',
  'STRIPE_ENTERPRISE_PRICE_ID',
] as const;

/** All plan IDs that should exist in the billing_catalog table */
const EXPECTED_PLAN_IDS = [
  'subscription:pro',
  'subscription:max',
  'subscription:enterprise',
  'subscription:pro:year',
  'subscription:max:year',
  'subscription:enterprise:year',
  'perpetual:pro',
  'perpetual:max',
  'perpetual:enterprise',
  'credits:starter',
  'credits:standard',
  'credits:scale',
];

interface CheckResult {
  check: string;
  ok: boolean;
  detail: string;
}

interface WarningResult {
  check: string;
  detail: string;
}

app.post('/billing-readiness', async (c) => {
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');

  if (!(cronSecret && provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(cronSecret);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const results: CheckResult[] = [];
  const warnings: WarningResult[] = [];

  // 1. Check required env vars
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (value) {
      results.push({ check: `env:${varName}`, ok: true, detail: 'set' });
    } else {
      results.push({ check: `env:${varName}`, ok: false, detail: 'MISSING' });
    }
  }

  // 2. Check Stripe key is live (not test) in production
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey?.startsWith('sk_test_') && process.env.NODE_ENV === 'production') {
    results.push({
      check: 'env:STRIPE_KEY_MODE',
      ok: false,
      detail: 'Using TEST key in production',
    });
  }

  // 3. Check billing_catalog DB rows
  try {
    const db = getClient();
    const rows = await db
      .select({ planId: billingCatalog.planId, stripePriceId: billingCatalog.stripePriceId })
      .from(billingCatalog)
      // Live-readiness check: only the live-mode rows count (test rows may be
      // seeded for QA without implying the production catalog is ready).
      .where(eq(billingCatalog.mode, 'live'));

    for (const planId of EXPECTED_PLAN_IDS) {
      const row = rows.find((r) => r.planId === planId);
      if (!row) {
        results.push({ check: `db:${planId}`, ok: false, detail: 'missing from billing_catalog' });
      } else if (!row.stripePriceId) {
        results.push({ check: `db:${planId}`, ok: false, detail: 'stripePriceId is null' });
      } else {
        results.push({ check: `db:${planId}`, ok: true, detail: 'ok' });
      }
    }
  } catch (err) {
    results.push({
      check: 'db:billing_catalog',
      ok: false,
      detail: `query failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // 4. Check Stripe price parity against MRR fallback (CR8-P2-04)
  //
  //    For each subscription tier, fetch the Stripe price on the configured
  //    env var and compare `price.unit_amount` to the MRR fallback cents.
  //    Drift means the admin dashboard will misreport MRR for one full day
  //    until the next cron run, and — more importantly — that the published
  //    marketing price has diverged from what Stripe will charge.
  //
  //    We skip tiers whose env var is missing (earlier check already flags
  //    that) to avoid double-alerting. Stripe errors (network, permission,
  //    deleted price) surface as check failures so they page someone.
  // GAP-131: shared protectedStripe wrapper. Load once for the whole loop;
  // when @revealui/services isn't installed, surface a single check failure
  // rather than N per-tier failures.
  const services = await getServices();
  if (!services) {
    results.push({
      check: 'stripe:price-parity',
      ok: false,
      detail: '@revealui/services not installed — Stripe price-parity check skipped',
    });
  }
  for (const { tier, priceEnvVar } of SUBSCRIPTION_TIERS) {
    if (!services) break;
    const priceId = process.env[priceEnvVar]?.trim();
    if (!priceId) continue; // env-var absence already flagged by section 1
    try {
      const price = await services.protectedStripe.prices.retrieve(priceId);
      const expected = MRR_TIER_PRICE_FALLBACK_CENTS[tier];
      if (price.unit_amount === null) {
        results.push({
          check: `stripe:price:${tier}`,
          ok: false,
          detail: `${priceId} has no unit_amount (free-form or tiered price?)`,
        });
      } else if (price.unit_amount !== expected) {
        results.push({
          check: `stripe:price:${tier}`,
          ok: false,
          detail: `Stripe price ${price.unit_amount} cents != fallback ${expected} cents (${priceId})`,
        });
      } else {
        results.push({ check: `stripe:price:${tier}`, ok: true, detail: `${expected} cents` });
      }
    } catch (err) {
      results.push({
        check: `stripe:price:${tier}`,
        ok: false,
        detail: `lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 5. Stripe Tax Settings vs STRIPE_TAX_ENABLED (GAP-437)
  //
  //    THE authoritative control for this class of drift — this cron runs
  //    daily on the same Vercel deployment that actually builds Checkout
  //    sessions (routes/billing.ts gates automatic_tax on STRIPE_TAX_ENABLED,
  //    #828), unlike the boot-time warning in validate-startup.ts, which only
  //    runs on the Fly worker (a separate process/deployment that does not
  //    serve checkout). 2026-07-26 incident: a live $49 TN charge collected
  //    zero sales tax because Stripe Tax + a TN registration were both ACTIVE
  //    on the account while STRIPE_TAX_ENABLED was never set on this
  //    deployment.
  //
  //    A Stripe API failure here (permission scope, network, rate limit) is
  //    tolerated as a warning, not a check failure — an inability to CHECK
  //    tax config is not evidence that tax config is wrong, and alerting on
  //    every transient Stripe hiccup would train the on-call to ignore this
  //    alert. GAP-131: goes through protectedStripe, matching every other
  //    Stripe call site in this file.
  if (services && process.env.STRIPE_LIVE_MODE === 'true') {
    try {
      const taxSettings = await services.protectedStripe.tax.settings.retrieve();
      if (taxSettings.status === 'active' && process.env.STRIPE_TAX_ENABLED !== 'true') {
        results.push({
          check: 'stripe:tax-flag',
          ok: false,
          detail:
            'Stripe Tax Settings are ACTIVE but STRIPE_TAX_ENABLED is not "true" — live ' +
            'Checkout sessions are being created WITHOUT sales tax collection. Set ' +
            'STRIPE_TAX_ENABLED=true on this deployment, or confirm untaxed billing is ' +
            'intentional for this account.',
        });
      } else {
        results.push({
          check: 'stripe:tax-flag',
          ok: true,
          detail: `tax settings status: ${taxSettings.status}`,
        });
      }
    } catch (err) {
      warnings.push({
        check: 'stripe:tax-flag',
        detail: `Stripe Tax Settings lookup failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // 6. Check email provider configuration (warning only  -  billing works without
  //    email, but transactional emails will silently fail)
  const hasGmail =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) && Boolean(process.env.GOOGLE_PRIVATE_KEY);
  if (!hasGmail) {
    warnings.push({
      check: 'email:provider',
      detail:
        'No email provider configured  -  transactional emails (license activation, payment receipts, failure notices) will silently fail',
    });
  }

  const failures = results.filter((r) => !r.ok);
  const allOk = failures.length === 0;

  if (warnings.length > 0) {
    logger.warn('Billing readiness warnings', {
      warningCount: warnings.length,
      warnings: warnings.map((w) => `${w.check}: ${w.detail}`),
    });
  }

  if (!allOk) {
    logger.error('Billing readiness check failed', undefined, {
      failureCount: failures.length,
      failures: failures.map((f) => `${f.check}: ${f.detail}`),
    });
    void sendCronFailureAlert({
      jobName: 'billing-readiness',
      error: new Error(`Billing readiness check failed: ${failures.length} issue(s)`),
      severity: 'error',
      metadata: {
        failureCount: failures.length,
        failures: failures.map((f) => `${f.check}: ${f.detail}`).join('; '),
      },
    });

    // Send alert email (fire-and-forget, don't fail the cron)
    try {
      const { sendEmail } = await import('../../lib/email.js');
      const failureList = failures.map((f) => `• ${f.check}: ${f.detail}`).join('\n');
      const warningList =
        warnings.length > 0
          ? `\n\nWarnings:\n${warnings.map((w) => `• ${w.check}: ${w.detail}`).join('\n')}`
          : '';
      await sendEmail({
        to: ALERT_EMAIL,
        subject: `[RevealUI] Billing readiness check FAILED (${failures.length} issues)`,
        html: `<h2>Billing Readiness Check Failed</h2>
<p>${failures.length} issue(s) detected that may prevent customers from completing checkout:</p>
<pre>${failureList}</pre>
${warnings.length > 0 ? `<h3>Warnings</h3><pre>${warnings.map((w) => `• ${w.check}: ${w.detail}`).join('\n')}</pre>` : ''}
<p>Run <code>pnpm stripe:sync-env</code> and <code>pnpm billing:catalog:sync</code> to resolve.</p>
<p style="color:#666;font-size:12px;">Automated check from api.revealui.com  -  ${new Date().toISOString()}</p>`,
        text: `Billing Readiness Check Failed\n\n${failures.length} issue(s):\n${failureList}${warningList}\n\nRun: pnpm stripe:sync-env && pnpm billing:catalog:sync`,
      });
    } catch (emailErr) {
      logger.error('Failed to send billing readiness alert email', undefined, {
        detail: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }
  } else {
    logger.info('Billing readiness check passed', {
      checkCount: results.length,
      warningCount: warnings.length,
    });
  }

  return c.json(
    {
      status: allOk ? 'ok' : 'failed',
      checkCount: results.length,
      failureCount: failures.length,
      failures: failures.map((f) => ({ check: f.check, detail: f.detail })),
      warningCount: warnings.length,
      warnings: warnings.map((w) => ({ check: w.check, detail: w.detail })),
      checkedAt: new Date().toISOString(),
    },
    allOk ? 200 : 503,
  );
});

export default app;
