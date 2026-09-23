/**
 * Cron: Billing Readiness Check
 *
 * Validates that the billing system is correctly configured:
 * 1. All expected Stripe price env vars are set
 * 2. License mint config matches the live path: local mint requires
 *    REVEALUI_LICENSE_PRIVATE_KEY; REVEALUI_LICENSE_SIGN_VIA_SIGNER requires
 *    the signer URL, public key, and invoke secret (no private key on serverless)
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

import { isSignViaSigner } from '@revealui/core/license/mint-client';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { billingCatalog } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { sendCronFailureAlert } from '../../lib/cron-alerts.js';
import { revealuiCronSecretMatches } from '../../lib/cron-auth.js';
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

/**
 * Best-effort GET of the license-signer liveness route
 * (`apps/license-signer` `GET /health/live`). A miss is a warning: mint config
 * is the readiness gate; the probe must not page on a transient blip.
 */
const SIGNER_HEALTH_PATH = '/health/live';
const SIGNER_HEALTH_PROBE_TIMEOUT_MS = 5_000;

/** Env vars that must be set for billing to work (license mint is separate). */
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_MAX_PRICE_ID',
  'STRIPE_ENTERPRISE_PRICE_ID',
] as const;

/**
 * Remote mint (`isSignViaSigner`: 1 | true | yes | on).
 * Invoke secret name is `REVEALUI_SIGNER_INVOKE_SECRET` (mint-client).
 * `REVEALUI_LICENSE_PUBLIC_KEY_NEXT` is the optional incoming rotation key
 * (`getPublicKeys`); absence is steady state, so it is not required here.
 */
const SIGNER_MODE_REQUIRED_ENV_VARS = [
  'REVEALUI_LICENSE_SIGNER_URL',
  'REVEALUI_LICENSE_PUBLIC_KEY',
  'REVEALUI_SIGNER_INVOKE_SECRET',
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

function stripTrailingSlashes(s: string): string {
  let end = s.length;
  while (end > 0 && s.charCodeAt(end - 1) === '/'.charCodeAt(0)) {
    end -= 1;
  }
  return end === s.length ? s : s.slice(0, end);
}

/**
 * Names of missing env vars only. Never include values: private keys, PEMs,
 * and the invoke secret must not appear in check details, logs, or email.
 */
function pushTrimmedEnv(results: CheckResult[], name: string): string {
  const trimmed = (process.env[name] ?? '').trim();
  const ok = trimmed.length > 0;
  results.push({ check: `env:${name}`, ok, detail: ok ? 'set' : 'MISSING' });
  return trimmed;
}

async function probeSignerHealth(baseUrl: string): Promise<CheckResult | WarningResult> {
  const url = `${stripTrailingSlashes(baseUrl)}${SIGNER_HEALTH_PATH}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(SIGNER_HEALTH_PROBE_TIMEOUT_MS),
    });
    try {
      await res.body?.cancel();
    } catch {
      // Status is the signal. Do not read or log the body.
    }
    if (res.ok) {
      return { check: 'signer:health', ok: true, detail: `HTTP ${res.status}` };
    }
    return { check: 'signer:health', detail: `HTTP ${res.status} (non-fatal)` };
  } catch {
    // Error text can embed the URL. Record only that the probe missed.
    return { check: 'signer:health', detail: 'probe failed (non-fatal)' };
  }
}

function isCheckResult(value: CheckResult | WarningResult): value is CheckResult {
  return 'ok' in value;
}

/**
 * Local mint: private key required (historical billing-readiness rule).
 * Signer mode: signer URL + public key + invoke secret; private key must not
 * fail the cron (Studio production keeps the mint key off Vercel).
 */
async function appendLicenseMintReadiness(
  results: CheckResult[],
  warnings: WarningResult[],
): Promise<void> {
  if (!isSignViaSigner()) {
    const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY;
    results.push({
      check: 'env:REVEALUI_LICENSE_PRIVATE_KEY',
      ok: Boolean(privateKey),
      detail: privateKey ? 'set' : 'MISSING',
    });
    return;
  }

  let signerUrl = '';
  for (const name of SIGNER_MODE_REQUIRED_ENV_VARS) {
    const trimmed = pushTrimmedEnv(results, name);
    if (name === 'REVEALUI_LICENSE_SIGNER_URL') signerUrl = trimmed;
  }
  results.push({
    check: 'env:REVEALUI_LICENSE_PRIVATE_KEY',
    ok: true,
    detail: 'not required when REVEALUI_LICENSE_SIGN_VIA_SIGNER is set',
  });
  if (!signerUrl) return;

  const probe = await probeSignerHealth(signerUrl);
  if (isCheckResult(probe)) results.push(probe);
  else warnings.push(probe);
}

app.post('/billing-readiness', async (c) => {
  const provided = c.req.header('X-Cron-Secret') || c.req.header('x-cron-secret');
  if (!revealuiCronSecretMatches(provided)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const results: CheckResult[] = [];
  const warnings: WarningResult[] = [];

  // 1. Check required env vars (Stripe). License mint is section 1b.
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (value) {
      results.push({ check: `env:${varName}`, ok: true, detail: 'set' });
    } else {
      results.push({ check: `env:${varName}`, ok: false, detail: 'MISSING' });
    }
  }

  // 1b. License mint: signer mode must not demand the private key.
  await appendLicenseMintReadiness(results, warnings);

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
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) && Boolean(process.env.GOOGLE_WIF_PROVIDER);
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
