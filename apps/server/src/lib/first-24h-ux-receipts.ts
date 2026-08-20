/**
 * First-24h Pro/Max UX verification receipts.
 *
 * Public-facing completed work uses RevealUI agent receipts: signed
 * `audit_log` rows through the existing door (`DrizzleAuditStore.append` /
 * `appendBatch` — same door as MCP tool receipts and harness-receipt-audit).
 * A PR body or markdown checklist is not the receipt.
 *
 * Checking a receipt is free. This writer never claims Max `auditLog`
 * Merkle-root delivery (`merkleRootDelivered` is always false).
 */

import { randomUUID } from 'node:crypto';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import type { AuditEntry } from '@revealui/db';

export const FIRST_24H_UX_ACTOR_ID = 'agent:first-24h-ux';
export const FIRST_24H_UX_EVENT_TYPE = 'verification.first24h.ux';
export const FIRST_24H_UX_REPORT_DATE = '2026-08-20';
export const FIRST_24H_UX_RECEIPT_CARD_TITLE = 'First-24h Pro/Max UX — 2026-08-20';

export type First24hUxPlan = 'pro' | 'max' | 'enterprise' | 'none';
export type First24hUxResult = 'PASS' | 'FAIL' | 'SKIP';

export interface First24hUxReceiptLine {
  surface: string;
  actor: string;
  action: string;
  plan: First24hUxPlan;
  result: First24hUxResult;
  evidence: string;
  skipReason?: string;
  /** Essential SKIP / FAIL blocks calling first-24h UX guaranteed. */
  essential?: boolean;
}

export interface First24hUxAuditDoor {
  append(entry: AuditEntry): Promise<void>;
  appendBatch?(entries: AuditEntry[]): Promise<void>;
}

export interface RecordFirst24hUxReceiptsInput {
  reportDate: string;
  actorId: string;
  lines: readonly First24hUxReceiptLine[];
  timestamp?: Date;
}

export interface First24hUxStoredReceipt {
  id: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

/** ReceiptCard `lines` shape — structurally assignable to presentation `AuditEvent`. */
export interface First24hUxReceiptCardLine {
  ts: string;
  actor: string;
  action: string;
  object: string;
  refId?: string;
}

export function first24hPlanLabel(plan: First24hUxPlan): string {
  if (plan === 'max') return 'Max';
  if (plan === 'enterprise') return 'Enterprise';
  if (plan === 'none') return 'n/a';
  return 'Pro';
}

export function isFirst24hUxPlan(value: string): value is First24hUxPlan {
  return value === 'pro' || value === 'max' || value === 'enterprise' || value === 'none';
}

/**
 * First-24h UX is guaranteed only when every surface PASSes and no essential
 * row is SKIP. A FAIL or essential SKIP means the claim is not earned.
 */
export function first24hUxGuaranteed(lines: readonly First24hUxReceiptLine[]): boolean {
  if (lines.length === 0) return false;
  for (const line of lines) {
    if (line.result === 'FAIL') return false;
    if (line.result === 'SKIP' && line.essential === true) return false;
  }
  return true;
}

export function toFirst24hUxReceiptCardLines(
  rows: readonly First24hUxStoredReceipt[],
): First24hUxReceiptCardLine[] {
  return rows.map((row) => {
    const planRaw = typeof row.payload.plan === 'string' ? row.payload.plan : 'none';
    const planLabel =
      typeof row.payload.planLabel === 'string'
        ? row.payload.planLabel
        : first24hPlanLabel(isFirst24hUxPlan(planRaw) ? planRaw : 'none');
    const result = typeof row.payload.result === 'string' ? row.payload.result : 'SKIP';
    const surface = typeof row.payload.surface === 'string' ? row.payload.surface : 'unknown';
    const actor = typeof row.payload.actor === 'string' ? row.payload.actor : FIRST_24H_UX_ACTOR_ID;
    const action = typeof row.payload.action === 'string' ? row.payload.action : 'verify';
    return {
      ts: row.timestamp.toISOString(),
      actor,
      action,
      object: `${planLabel} ${result} — ${surface}`,
      refId: row.id,
    };
  });
}

function lineToEntry(
  line: First24hUxReceiptLine,
  input: RecordFirst24hUxReceiptsInput,
  timestamp: Date,
): AuditEntry {
  const payload: Record<string, unknown> = {
    actor: input.actorId,
    action: line.action,
    plan: line.plan,
    planLabel: first24hPlanLabel(line.plan),
    result: line.result,
    evidence: line.evidence,
    surface: line.surface,
    reportDate: input.reportDate,
    timestamp: timestamp.toISOString(),
    merkleRootDelivered: false,
  };
  if (line.skipReason !== undefined) payload.skipReason = line.skipReason;
  if (line.essential === true) payload.essential = true;

  return {
    id: randomUUID(),
    timestamp,
    eventType: FIRST_24H_UX_EVENT_TYPE,
    severity: line.result === 'FAIL' ? 'warn' : 'info',
    agentId: input.actorId,
    payload,
    policyViolations: [],
  };
}

/**
 * Append one `verification.first24h.ux` row per surface through the injected
 * `DrizzleAuditStore` (or any door that exposes the same append API).
 */
export async function recordFirst24hUxReceipts(
  store: First24hUxAuditDoor,
  input: RecordFirst24hUxReceiptsInput,
): Promise<string[]> {
  if (input.lines.length === 0) return [];

  const timestamp = input.timestamp ?? new Date();
  const entries = input.lines.map((line) => lineToEntry(line, input, timestamp));

  try {
    if (store.appendBatch) {
      await store.appendBatch(entries);
    } else {
      for (const entry of entries) {
        await store.append(entry);
      }
    }
    for (const entry of entries) {
      recordAuditWriteResult({
        ok: true,
        eventId: entry.id,
        eventType: FIRST_24H_UX_EVENT_TYPE,
      });
    }
    return entries.map((entry) => entry.id);
  } catch (err) {
    recordAuditWriteResult({
      ok: false,
      reason: classifyAuditWriteFailure(err),
      eventId: entries[0]?.id,
      eventType: FIRST_24H_UX_EVENT_TYPE,
    });
    throw err;
  }
}

function surface(
  partial: Omit<First24hUxReceiptLine, 'actor'> & { actor?: string },
): First24hUxReceiptLine {
  return { actor: FIRST_24H_UX_ACTOR_ID, ...partial };
}

/** Dated 2026-08-20 verification catalog. SoT for receipt rows; markdown is an index. */
export const FIRST_24H_UX_SURFACES_2026_08_20: readonly First24hUxReceiptLine[] = [
  surface({
    surface: 'signup-start-trial',
    action: 'verify-signup-start-trial',
    plan: 'pro',
    result: 'PASS',
    evidence:
      'SignupForm.test.tsx — routes an auto-verified user with ?plan=pro into the billing upgrade flow',
  }),
  surface({
    surface: 'signup-start-trial',
    action: 'verify-signup-start-trial',
    plan: 'max',
    result: 'PASS',
    evidence:
      'SignupForm.test.tsx — ?plan=max asserts “Sign up to start your free 7-day Max trial.”',
  }),
  surface({
    surface: 'marketing-pricing-trial-cta',
    action: 'verify-marketing-pricing-trial-cta',
    plan: 'pro',
    result: 'PASS',
    evidence: 'PricingPage.test.tsx — Pro trial CTA stays on admin signup `/signup?plan=pro`',
  }),
  surface({
    surface: 'marketing-pricing-trial-cta',
    action: 'verify-marketing-pricing-trial-cta',
    plan: 'max',
    result: 'PASS',
    evidence: 'PricingPage.test.tsx — Max trial CTA stays on admin signup `/signup?plan=max`',
  }),
  surface({
    surface: 'welcome-paid-success',
    action: 'verify-welcome-paid-success',
    plan: 'pro',
    result: 'PASS',
    evidence:
      'welcome/__tests__/page.test.tsx — license key + agent CTAs when tier: pro and ?success=true',
  }),
  surface({
    surface: 'welcome-paid-success',
    action: 'verify-welcome-paid-success',
    plan: 'max',
    result: 'PASS',
    evidence: 'welcome/__tests__/page.test.tsx — labels a Max paid-success visit as Max, not Pro',
  }),
  surface({
    surface: 'subscription-expires-at',
    action: 'verify-subscription-expires-at',
    plan: 'pro',
    result: 'PASS',
    evidence:
      'billing.test.ts — surfaces license expiresAt on the entitlements short-circuit for a Pro trial → 2026-08-27T00:00:00.000Z',
  }),
  surface({
    surface: 'subscription-expires-at',
    action: 'verify-subscription-expires-at',
    plan: 'max',
    result: 'PASS',
    evidence:
      'billing.test.ts — Max entitlements short-circuit; uses hosted snapshot graceUntil as Max trial expiry; reconciles a Max Stripe trial',
  }),
  surface({
    surface: 'billing-trial-callout',
    action: 'verify-billing-trial-callout',
    plan: 'pro',
    result: 'PASS',
    evidence: 'billing/__tests__/page.test.tsx — shows Pro trial expiry with the Pro price; $49/mo',
  }),
  surface({
    surface: 'billing-trial-callout',
    action: 'verify-billing-trial-callout',
    plan: 'max',
    result: 'PASS',
    evidence:
      'billing/__tests__/page.test.tsx — shows Max trial expiry and Max plan, not Pro; $299/mo; no “Your Pro trial”',
  }),
  surface({
    surface: 'account-license-expiry',
    action: 'verify-account-license-expiry',
    plan: 'none',
    result: 'PASS',
    evidence:
      'License page reads subscription.expiresAt (account/license/page.tsx). API now returns it on hosted paths.',
  }),
  surface({
    surface: 'stripe-webhook-emails',
    action: 'verify-stripe-webhook-emails',
    plan: 'max',
    result: 'PASS',
    evidence:
      'webhook-emails-trial.test.ts — Max subjects; trial-ending includes August 27, 2026. No transport in CI.',
  }),
  surface({
    surface: 'cron-lifecycle-armed-path',
    action: 'verify-cron-lifecycle-armed-path',
    plan: 'pro',
    result: 'PASS',
    evidence:
      'lifecycle-emails.test.ts — armed Pro day-0 invokes send(); disarmed never calls transport',
  }),
  surface({
    surface: 'cron-lifecycle-armed-path',
    action: 'verify-cron-lifecycle-armed-path',
    plan: 'max',
    result: 'PASS',
    evidence:
      'lifecycle-emails.test.ts — armed Max day-0 copy has no Pro; send() invoked when enabled: true',
  }),
  surface({
    surface: 'cron-lifecycle-production',
    action: 'verify-cron-lifecycle-production',
    plan: 'none',
    result: 'PASS',
    evidence:
      'lifecycle-email-arming.test.ts — production (VERCEL_ENV=production, branch main) stays disarmed without LIFECYCLE_EMAILS_ENABLED=true. Not a production spam flip.',
  }),
  surface({
    surface: 'cron-lifecycle-test-path',
    action: 'verify-cron-lifecycle-test-path',
    plan: 'pro',
    result: 'PASS',
    evidence:
      'lifecycle-email-arming.test.ts — hosted test (exact staging hostname / preview / test branch) arms Pro day-0/1/7 when Gmail SA + private key are present',
  }),
  surface({
    surface: 'cron-lifecycle-test-path',
    action: 'verify-cron-lifecycle-test-path',
    plan: 'max',
    result: 'PASS',
    evidence:
      'lifecycle-email-arming.test.ts — hosted test arms Max when mailbox present; Max copy has no Pro. lifecycle-emails.test.ts — armed Max day-0 invokes send()',
  }),
  surface({
    surface: 'cron-lifecycle-fail-closed',
    action: 'verify-cron-lifecycle-fail-closed',
    plan: 'none',
    result: 'PASS',
    evidence:
      'lifecycle-email-arming.test.ts — missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY never arms, even with the flag or preview',
  }),
  surface({
    surface: 'cron-lifecycle-host-allowlist',
    action: 'verify-cron-lifecycle-host-allowlist',
    plan: 'none',
    result: 'PASS',
    evidence:
      'lifecycle-email-arming.test.ts — URL hostname parsed via new URL(); exact allowlist only. Query-string, prefix, suffix, and unparseable values fail closed. No includes() on the raw URL.',
  }),
  surface({
    surface: 'cron-lifecycle-ci',
    action: 'verify-cron-lifecycle-ci',
    plan: 'none',
    result: 'PASS',
    evidence:
      'lifecycle-email-arming.test.ts — NODE_ENV=test never arms; unit/CI never calls the Gmail transport',
  }),
  surface({
    surface: 'cron-lifecycle-enterprise-absent',
    action: 'verify-cron-lifecycle-enterprise-absent',
    plan: 'enterprise',
    result: 'PASS',
    evidence:
      'lifecycle-emails.test.ts — armed Enterprise candidate never calls send(); no Enterprise trial sequence',
  }),
  surface({
    surface: 'upgrade-convert-self-serve',
    action: 'verify-upgrade-convert-self-serve',
    plan: 'pro',
    result: 'PASS',
    evidence: 'billing.test.ts — checkout/upgrade success for self-serve Pro',
  }),
  surface({
    surface: 'upgrade-convert-self-serve',
    action: 'verify-upgrade-convert-self-serve',
    plan: 'max',
    result: 'PASS',
    evidence: 'billing.test.ts — checkout/upgrade success for self-serve Max',
  }),
  surface({
    surface: 'converted-paid-path',
    action: 'verify-converted-paid-path',
    plan: 'max',
    result: 'PASS',
    evidence:
      'sendTrialExpiredEmail(..., max) subject “Your RevealUI Max trial has ended”. No live card charge.',
  }),
  surface({
    surface: 'cancel-expire-first-week',
    action: 'verify-cancel-expire-first-week',
    plan: 'pro',
    result: 'PASS',
    evidence: 'trial-copy.test.ts — expired message uses the Pro plan label',
  }),
  surface({
    surface: 'cancel-expire-first-week',
    action: 'verify-cancel-expire-first-week',
    plan: 'max',
    result: 'PASS',
    evidence: 'trial-copy.test.ts — resubscribes Max trials to Max, not Pro',
  }),
  surface({
    surface: 'enterprise-trial-absent',
    action: 'verify-enterprise-trial-absent',
    plan: 'enterprise',
    result: 'PASS',
    evidence:
      'SignupForm.test.tsx — no “7-day Enterprise trial”; Contact-sales copy. PricingPage.test.tsx — Enterprise CTA is Contact sales',
  }),
  surface({
    surface: 'enterprise-checkout-contact-sales',
    action: 'verify-enterprise-checkout-contact-sales',
    plan: 'enterprise',
    result: 'PASS',
    evidence:
      'billing/__tests__/page.test.tsx — parks ?upgrade=enterprise at Contact sales → https://revealui.com/contact',
  }),
  surface({
    surface: 'starter-kit-buy-paused',
    action: 'verify-starter-kit-buy-paused',
    plan: 'none',
    result: 'PASS',
    evidence:
      'PricingPage.test.tsx — Request mailto; no buy.stripe.com; no “Buy the RevealUI Starter Kit”',
  }),
  surface({
    surface: 'perpetual-buy-present',
    action: 'verify-perpetual-buy-present',
    plan: 'pro',
    result: 'PASS',
    evidence:
      'PricingPage.test.tsx — Buy Pro Perpetual and Buy Agency Perpetual → admin license checkout',
  }),
  surface({
    surface: 'live-stripe-e2e',
    action: 'verify-live-stripe-e2e',
    plan: 'none',
    result: 'SKIP',
    skipReason: 'Needs Stripe test/live keys and webhook forward. Not run.',
    evidence:
      'docs/checklists/stripe-checkout-verification.md — no live Stripe charges in this work',
  }),
  surface({
    surface: 'real-mailbox-delivery',
    action: 'verify-real-mailbox-delivery',
    plan: 'none',
    result: 'SKIP',
    essential: true,
    skipReason:
      'Gmail SA + EMAIL_FROM are documented on vercel:api-staging (GAP-343) but live inbox delivery was not exercised. No real mail in CI. Owner delivery check remains.',
    evidence:
      'scripts/sync/secret-paths.ts consumers include vercel:api-staging; no inbox send was run in this work',
  }),
];
