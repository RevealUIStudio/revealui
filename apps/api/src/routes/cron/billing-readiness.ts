/**
 * Cron: Billing Readiness Check
 *
 * Validates that the billing system is correctly configured:
 * 1. All expected Stripe price env vars are set
 * 2. REVEALUI_LICENSE_PRIVATE_KEY is present (for license JWT generation)
 * 3. Billing catalog DB rows exist for all tiers
 * 4. Email provider configured (warning only — Gmail or Resend)
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
import { Hono } from 'hono';

const app = new Hono();

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
      .from(billingCatalog);

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

  // 4. Check email provider configuration (warning only — billing works without
  //    email, but transactional emails will silently fail)
  const hasGmail =
    Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) && Boolean(process.env.GOOGLE_PRIVATE_KEY);
  if (!hasGmail) {
    warnings.push({
      check: 'email:provider',
      detail:
        'No email provider configured — transactional emails (license activation, payment receipts, failure notices) will silently fail',
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
<p style="color:#666;font-size:12px;">Automated check from api.revealui.com — ${new Date().toISOString()}</p>`,
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
