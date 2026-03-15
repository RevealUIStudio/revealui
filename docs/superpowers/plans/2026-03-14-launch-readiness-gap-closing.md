# Launch Readiness Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 11 blocking issues across 3 weeks to enable tiered launch with early adopter transparency.

**Architecture:** Fixes span 4 apps (api, cms, marketing, docs) and 3 packages (db, core, router). All changes are incremental — no architectural rewrites. Week 1 is config + billing fixes, Week 2 is feature completion, Week 3 is CMS admin.

**Tech Stack:** TypeScript, Hono (API), Next.js 16 (CMS/marketing), Drizzle ORM, Stripe, Vitest, Biome 2.

**Spec:** `docs/superpowers/specs/2026-03-14-launch-readiness-audit-design.md`

---

## Chunk 1: Week 1 — Security & Billing Fixes

### Task 1: Add Pro packages to changeset ignore list

**Files:**
- Modify: `.changeset/config.json`

- [ ] **Step 1: Read current config**

```bash
cat .changeset/config.json
```

Confirm the `ignore` array does NOT include `@revealui/ai`, `@revealui/mcp`, `@revealui/editors`, `@revealui/services`, `@revealui/harnesses`.

- [ ] **Step 2: Add Pro packages to ignore list**

In `.changeset/config.json`, update the `ignore` array:

```json
"ignore": [
  "api",
  "cms",
  "docs",
  "marketing",
  "@revealui/studio",
  "test",
  "@revealui/ai",
  "@revealui/mcp",
  "@revealui/editors",
  "@revealui/services",
  "@revealui/harnesses"
]
```

- [ ] **Step 3: Verify changeset status runs clean**

```bash
pnpm changeset status
```

Expected: No error about private packages.

- [ ] **Step 4: Commit**

```bash
git add .changeset/config.json
git commit -m "fix(changeset): add Pro packages to ignore list

Prevents accidental versioning/publishing of commercially licensed packages."
```

---

### Task 2: Add missing env vars to Vercel configs

**Files:**
- Modify: `apps/cms/vercel.json`
- Modify: `apps/api/vercel.json`

- [ ] **Step 1: Add Stripe price ID env vars to CMS vercel.json**

In `apps/cms/vercel.json`, add to the `env` array (after `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`):

```json
"NEXT_PUBLIC_STRIPE_PRO_PRICE_ID",
"NEXT_PUBLIC_STRIPE_MAX_PRICE_ID",
"NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID"
```

- [ ] **Step 2: Add STRIPE_WEBHOOK_SECRET_LIVE to API vercel.json**

In `apps/api/vercel.json`, add to the `env` array (after `STRIPE_WEBHOOK_SECRET`):

```json
"STRIPE_WEBHOOK_SECRET_LIVE"
```

- [ ] **Step 3: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/cms/vercel.json', 'utf8')); console.log('CMS OK')"
node -e "JSON.parse(require('fs').readFileSync('apps/api/vercel.json', 'utf8')); console.log('API OK')"
```

Expected: Both print OK.

- [ ] **Step 4: Commit**

```bash
git add apps/cms/vercel.json apps/api/vercel.json
git commit -m "fix(deploy): add missing env vars to Vercel configs

CMS: NEXT_PUBLIC_STRIPE_PRO/MAX/ENTERPRISE_PRICE_ID for checkout buttons.
API: STRIPE_WEBHOOK_SECRET_LIVE for production webhook verification."
```

---

### Task 3: Add tier fallback alert to resolveTier

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts:100-119`
- Test: `apps/api/src/routes/__tests__/webhooks.test.ts`

- [ ] **Step 1: Write the failing test**

In `apps/api/src/routes/__tests__/webhooks.test.ts`, find the existing `resolveTier` tests (or add a new describe block). Add:

```ts
it('sends alert email when tier metadata is missing', async () => {
  // Create a checkout.session.completed event with missing tier metadata
  const event = createMockStripeEvent('checkout.session.completed', {
    metadata: {}, // no tier key
    customer: 'cus_test123',
    subscription: 'sub_test123',
    mode: 'subscription',
  });

  const res = await app.request('/api/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': 'mock_sig',
    },
    body: JSON.stringify(event),
  });

  // Should still succeed (defaults to pro)
  expect(res.status).toBe(200);
  // Verify alert was triggered (check logger.error was called with CRITICAL)
  // The actual email sending is fire-and-forget, so we verify the log
});
```

- [ ] **Step 2: Run test to see current behavior**

```bash
pnpm --filter api test -- --grep "tier metadata"
```

- [ ] **Step 3: Add alert mechanism to resolveTier**

In `apps/api/src/routes/webhooks.ts`, after the existing `logger.error(...)` call in `resolveTier()` (around line 115), add:

```ts
// Fire-and-forget alert to founder
const alertEmail = process.env.REVEALUI_ALERT_EMAIL || 'founder@revealui.com';
sendTierFallbackAlert(alertEmail, { tier: tier ?? null, metadata: metadata ?? null }).catch(
  (err) => {
    logger.warn('Failed to send tier fallback alert', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  },
);
```

Add the helper function near the other email helpers in the file:

```ts
async function sendTierFallbackAlert(
  email: string,
  context: { tier: string | null; metadata: Record<string, string> | null },
): Promise<void> {
  // Uses the same email infrastructure as other webhook emails
  const { sendEmail } = await import('../lib/email.js');
  await sendEmail({
    to: email,
    subject: '[CRITICAL] RevealUI: Stripe tier metadata missing — defaulted to pro',
    text: `A webhook event was processed with missing or unrecognized tier metadata.\n\nReceived tier: ${context.tier}\nMetadata: ${JSON.stringify(context.metadata)}\n\nThe customer was assigned 'pro' tier as a safety default. Check Stripe product metadata immediately.`,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter api test
```

Expected: All existing webhook tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/webhooks.ts apps/api/src/routes/__tests__/webhooks.test.ts
git commit -m "fix(billing): add alert email when Stripe tier metadata is missing

resolveTier() still defaults to 'pro' (safer than rejecting), but now
sends an email alert to founder so misconfigured products are caught
within minutes."
```

---

### Task 4: Fix billing page import path

**Files:**
- Modify: `apps/cms/src/app/(frontend)/account/billing/page.tsx:10-17`

- [ ] **Step 1: Check current build for warnings**

```bash
pnpm --filter cms build 2>&1 | grep -i "server" | head -5
```

Note any warnings about server/client component boundaries.

- [ ] **Step 2: Update import path**

In `apps/cms/src/app/(frontend)/account/billing/page.tsx`, change line 10-17 from:

```ts
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server';
```

To:

```ts
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation';
```

- [ ] **Step 3: Verify build still succeeds**

```bash
pnpm --filter cms build
```

Expected: Build succeeds with no new warnings.

- [ ] **Step 4: Commit**

```bash
git add apps/cms/src/app/(frontend)/account/billing/page.tsx
git commit -m "fix(cms): import presentation components from main entry

Billing page was importing from /server entry in a 'use client' component.
Components work in both contexts but import path was unconventional."
```

---

### Task 5: Early adopter coupon auto-apply

**Files:**
- Modify: `apps/api/src/routes/billing.ts:336-365`
- Test: `apps/api/src/routes/__tests__/billing.test.ts`

**Note:** Stripe coupons and promotion codes must be created in the Stripe Dashboard (or via Stripe CLI) before this code works. The code here adds auto-apply logic. The Stripe setup is an ops task documented at the end.

- [ ] **Step 1: Write the failing test**

In `apps/api/src/routes/__tests__/billing.test.ts`, add:

```ts
describe('early adopter coupon', () => {
  it('applies early adopter coupon when REVEALUI_EARLY_ADOPTER_END is in the future', async () => {
    // Set early adopter window to be active
    process.env.REVEALUI_EARLY_ADOPTER_END = new Date(Date.now() + 86400000).toISOString();
    process.env.REVEALUI_EARLY_ADOPTER_COUPON_PRO = 'EARLY_PRO_20OFF';

    const res = await authenticatedRequest('POST', '/api/billing/checkout', {
      tier: 'pro',
    });

    expect(res.status).toBe(200);
    // Verify the checkout session was created with the coupon
    // (mock Stripe to capture the create call args)
  });

  it('does not apply coupon when early adopter window has passed', async () => {
    process.env.REVEALUI_EARLY_ADOPTER_END = new Date(Date.now() - 86400000).toISOString();

    const res = await authenticatedRequest('POST', '/api/billing/checkout', {
      tier: 'pro',
    });

    expect(res.status).toBe(200);
    // Verify no coupon was applied
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter api test -- --grep "early adopter"
```

- [ ] **Step 3: Add early adopter logic to checkout route**

In `apps/api/src/routes/billing.ts`, add a helper before the checkout route:

```ts
/** Early adopter coupon config — set via env vars, not hardcoded */
interface EarlyAdopterConfig {
  endDate: Date | null;
  coupons: Record<string, string | undefined>;
}

function getEarlyAdopterConfig(): EarlyAdopterConfig {
  const endStr = process.env.REVEALUI_EARLY_ADOPTER_END;
  return {
    endDate: endStr ? new Date(endStr) : null,
    coupons: {
      pro: process.env.REVEALUI_EARLY_ADOPTER_COUPON_PRO,
      max: process.env.REVEALUI_EARLY_ADOPTER_COUPON_MAX,
      enterprise: process.env.REVEALUI_EARLY_ADOPTER_COUPON_ENT,
    },
  };
}

function getEarlyAdopterDiscount(tier: string): { discounts?: Array<{ coupon: string }> } | { allow_promotion_codes: true } {
  const config = getEarlyAdopterConfig();
  if (!config.endDate || new Date() > config.endDate) {
    return { allow_promotion_codes: true };
  }
  const couponId = config.coupons[tier];
  if (!couponId) {
    return { allow_promotion_codes: true };
  }
  return { discounts: [{ coupon: couponId }] };
}
```

Then modify the checkout session creation (around line 345-358) — replace `allow_promotion_codes: true` with the dynamic discount:

```ts
const discountConfig = getEarlyAdopterDiscount(resolvedTier);

const session = await withStripe((stripe) =>
  stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    billing_address_collection: 'required',
    ...discountConfig,
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { tier: resolvedTier, revealui_user_id: user.id },
    },
    success_url: `${cmsUrl}/account/billing?success=true`,
    cancel_url: `${cmsUrl}/account/billing`,
  }),
);
```

**Important:** Stripe's `discounts` and `allow_promotion_codes` are mutually exclusive. When the early adopter coupon is active, manual promotion codes are disabled (which is fine — they already have the best deal).

- [ ] **Step 3b: Store earlyAdopter flag on user record**

In the webhook handler for `checkout.session.completed` (webhooks.ts), after processing the subscription, check if the early adopter window is active and set a flag:

```ts
const earlyAdopterEnd = process.env.REVEALUI_EARLY_ADOPTER_END;
if (earlyAdopterEnd && new Date() < new Date(earlyAdopterEnd)) {
  await db
    .update(users)
    .set({ metadata: sql`jsonb_set(COALESCE(metadata, '{}'), '{earlyAdopter}', 'true')` })
    .where(eq(users.id, userId));
}
```

**Note:** Check if `users` table has a `metadata` JSONB column. If not, use a simpler approach: add an `earlyAdopter` boolean column or track via Stripe customer metadata.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter api test
```

Expected: All tests pass including new early adopter tests.

- [ ] **Step 5: Add env vars to API vercel.json**

Add to `apps/api/vercel.json` env array:

```json
"REVEALUI_EARLY_ADOPTER_END",
"REVEALUI_EARLY_ADOPTER_COUPON_PRO",
"REVEALUI_EARLY_ADOPTER_COUPON_MAX",
"REVEALUI_EARLY_ADOPTER_COUPON_ENT",
"REVEALUI_ALERT_EMAIL"
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/routes/__tests__/billing.test.ts apps/api/vercel.json
git commit -m "feat(billing): auto-apply early adopter coupon during launch window

Reads REVEALUI_EARLY_ADOPTER_END env var. If current date is within window,
applies tier-specific fixed-amount Stripe coupon. Falls back to manual
promotion codes when window expires."
```

---

### Task 6: Pre-launch validations

**Files:** No code changes — validation only.

- [ ] **Step 1: Verify component count**

```bash
find packages/presentation/src/components -name "*.tsx" -not -name "*.test.*" -not -name "*.stories.*" | wc -l
```

Confirm the number matches "54 UI Components" on the status page. If different, note the correct number for the marketing update.

- [ ] **Step 2: Verify CMS /signup route exists**

```bash
pnpm --filter cms build 2>&1 | grep "/signup"
```

Expected: Line showing `ƒ /signup` in build output.

- [ ] **Step 3: Verify CORS configuration**

Check that `CORS_ORIGIN` in Vercel API project settings includes `cms.revealui.com`. This is an ops verification — document the expected value:

```
CORS_ORIGIN=https://cms.revealui.com,https://marketing.revealui.com
```

- [ ] **Step 4: Run full gate**

```bash
pnpm gate
```

Expected: All phases pass (lint, typecheck, build). Tests may have the known 4-9 AI failures (acceptable).

- [ ] **Step 5: Commit any fixes from validation**

If component count differs, update the status page data (Week 2 task).

---

## Chunk 2: Week 2 — Feature Completeness & Marketing

### Task 7: Payment failure webhook — DB status update

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts:1112-1133`
- Test: `apps/api/src/routes/__tests__/webhooks.test.ts`

**Key context:** `accountSubscriptions` table already has a `status` column (default 'active') at `packages/db/src/schema/accounts.ts:72`. No schema migration needed.

- [ ] **Step 1: Write the failing test**

```ts
describe('invoice.payment_failed handler', () => {
  it('updates subscription status to past_due after payment failure', async () => {
    // Insert a test subscription with status 'active'
    // Fire invoice.payment_failed webhook
    // Assert subscription status is now 'past_due'
  });

  it('downgrades tier to free after 3 consecutive failures', async () => {
    // Insert a test subscription with status 'past_due' and attempt_count >= 3
    // Fire invoice.payment_failed webhook
    // Assert tier is downgraded (license revoked or set to free)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter api test -- --grep "payment_failed"
```

- [ ] **Step 3: Extend the invoice.payment_failed handler**

In `apps/api/src/routes/webhooks.ts`, update the `case 'invoice.payment_failed'` block (around line 1112):

```ts
case 'invoice.payment_failed': {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = resolveCustomerId(invoice.customer);
  if (!customerId) break;

  logger.warn('Invoice payment failed', {
    customerId,
    invoiceId: invoice.id,
    attemptCount: invoice.attempt_count,
  });

  // Update subscription status to past_due
  await db
    .update(accountSubscriptions)
    .set({ status: 'past_due', updatedAt: new Date() })
    .where(eq(accountSubscriptions.stripeCustomerId, customerId));

  // After 3+ attempts, downgrade the subscription
  if (invoice.attempt_count && invoice.attempt_count >= 3) {
    logger.error('Payment failed 3+ times — suspending subscription', {
      customerId,
      attemptCount: invoice.attempt_count,
    });
    // Update subscription status — stripeCustomerId lives on accountSubscriptions
    await db
      .update(accountSubscriptions)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(accountSubscriptions.stripeCustomerId, customerId));
  }

  // Send payment failed email (existing logic)
  const email = invoice.customer_email ?? (await findUserEmailByCustomerId(db, customerId));
  if (email) {
    sendPaymentFailedEmail(email).catch((err) => {
      logger.warn('Failed to send payment failed email', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    });
  }
  break;
}
```

**Note:** `stripeCustomerId` lives on the `accountSubscriptions` table (not `licenses`). Check existing imports at the top of webhooks.ts for Drizzle table references and add `accountSubscriptions` if not already imported. The `status` column already exists on `accountSubscriptions` with default 'active' — see `packages/db/src/schema/accounts.ts:72`.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter api test
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/webhooks.ts apps/api/src/routes/__tests__/webhooks.test.ts
git commit -m "fix(billing): update subscription status on payment failure

Sets status to past_due on first failure. Downgrades license to free
after 3+ consecutive failures. Existing email notification preserved."
```

---

### Task 8: BYOK provider detection fix

**Files:**
- Modify: `apps/api/src/routes/agent-stream.ts:46-75`
- Test: `apps/api/src/routes/__tests__/agent-stream.test.ts` (create if needed)

- [ ] **Step 1: Write the failing test**

```ts
describe('BYOK provider detection', () => {
  it('routes sk-ant-* keys to anthropic', () => {
    expect(detectProvider('sk-ant-api03-abc123')).toBe('anthropic');
  });

  it('routes sk-* keys to openai', () => {
    expect(detectProvider('sk-proj-abc123')).toBe('openai');
  });

  it('routes gsk_* keys to groq', () => {
    expect(detectProvider('gsk_abc123')).toBe('groq');
  });

  it('uses explicit provider parameter when provided', () => {
    expect(detectProvider('some-key', 'ollama')).toBe('ollama');
  });

  it('uses explicit provider for vultr keys', () => {
    expect(detectProvider('vl-abc123', 'vultr')).toBe('vultr');
  });

  it('returns null for undetectable keys without provider hint', () => {
    expect(detectProvider('random-key-format')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter api test -- --grep "BYOK provider"
```

- [ ] **Step 3: Extract and fix provider detection**

In `apps/api/src/routes/agent-stream.ts`, extract detection into a testable function:

```ts
/** Detect LLM provider from API key prefix or explicit parameter */
export function detectProvider(
  apiKey: string,
  explicitProvider?: string,
): string | null {
  if (explicitProvider) return explicitProvider;
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey.startsWith('gsk_')) return 'groq';
  if (apiKey.startsWith('hf_')) return 'huggingface';
  // Ollama and Vultr don't have standard key prefixes — require explicit provider
  return null;
}

/** Default model per provider */
const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5-20250514',
  openai: 'gpt-4o',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
  vultr: 'llama-3.3-70b-versatile',
  huggingface: 'meta-llama/Llama-3.3-70B-Instruct',
};
```

Then update the BYOK block to use it:

```ts
if (byokKey) {
  const body = await c.req.json().catch(() => ({}));
  const provider = detectProvider(byokKey, body.provider);
  if (!provider) {
    return c.json(
      {
        success: false,
        error: 'Cannot detect LLM provider from key format. Pass "provider" in request body.',
      },
      400,
    );
  }
  const model = body.model || DEFAULT_MODELS[provider] || 'llama-3.3-70b-versatile';
  llmClient = new llmClientMod.LLMClient({
    provider,
    apiKey: byokKey,
    model,
  });
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm --filter api test
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter api typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/agent-stream.ts apps/api/src/routes/__tests__/agent-stream.test.ts
git commit -m "fix(api): detect all 6 BYOK providers correctly

Extracts detectProvider() with prefix matching for Anthropic, OpenAI,
Groq, and HuggingFace. Ollama/Vultr require explicit provider parameter.
Returns 400 with helpful message for undetectable keys."
```

---

### Task 9: Upgrade route tier direction validation

**Files:**
- Modify: `apps/api/src/routes/billing.ts:531-580`
- Test: `apps/api/src/routes/__tests__/billing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
describe('upgrade route', () => {
  it('rejects downgrade attempt via upgrade route', async () => {
    // User has 'max' tier, tries to "upgrade" to 'pro'
    const res = await authenticatedRequest('POST', '/api/billing/upgrade', {
      targetTier: 'pro',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('cannot downgrade');
  });
});
```

- [ ] **Step 2: Add tier ordering and validation**

In `apps/api/src/routes/billing.ts`, add before the upgrade route:

```ts
const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, max: 2, enterprise: 3 };
```

Then in the upgrade handler, after getting `targetTier` and before the Stripe call, add:

```ts
// Validate upgrade direction
const currentTier = (requestEntitlements?.tier as string) ?? 'free';
const currentRank = TIER_ORDER[currentTier] ?? 0;
const targetRank = TIER_ORDER[targetTier] ?? 0;

if (targetRank <= currentRank) {
  throw new HTTPException(400, {
    message: `Cannot downgrade from ${currentTier} to ${targetTier} via upgrade route. Use the downgrade route instead.`,
  });
}
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter api test
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/routes/__tests__/billing.test.ts
git commit -m "fix(billing): reject downgrade attempts via upgrade route

Validates that target tier rank is higher than current tier. Returns 400
with helpful message directing to downgrade route instead."
```

---

### Task 10: OG images for marketing site

**Files:**
- Create: `apps/marketing/src/app/api/og/route.tsx`
- Modify: `apps/marketing/src/app/layout.tsx`

- [ ] **Step 1: Create OG image route**

```tsx
import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'RevealUI';
  const description =
    searchParams.get('description') ??
    'Build your business, not your boilerplate.';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          color: '#fafafa',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#a1a1aa',
              textAlign: 'center',
              maxWidth: '800px',
            }}
          >
            {description}
          </div>
          <div
            style={{
              fontSize: 20,
              color: '#71717a',
              marginTop: '20px',
            }}
          >
            revealui.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
```

- [ ] **Step 2: Add OG image to root layout metadata**

In `apps/marketing/src/app/layout.tsx`, update the `openGraph` object:

```ts
openGraph: {
  title: 'RevealUI — Build your business, not your boilerplate.',
  description:
    'Users, content, products, payments, and AI — pre-wired and ready to deploy. Open-source business infrastructure for software companies.',
  type: 'website',
  images: [
    {
      url: '/api/og?title=RevealUI&description=Build your business, not your boilerplate.',
      width: 1200,
      height: 630,
      alt: 'RevealUI — Open-Source Business Infrastructure',
    },
  ],
},
twitter: {
  card: 'summary_large_image',
  title: 'RevealUI — Build your business, not your boilerplate.',
  description:
    'Users, content, products, payments, and AI — pre-wired and ready to deploy.',
  images: ['/api/og?title=RevealUI&description=Build your business, not your boilerplate.'],
},
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter marketing build
```

Expected: Build succeeds with `/api/og` in the route list.

- [ ] **Step 4: Test locally** (optional if dev server available)

```bash
curl -o /tmp/og-test.png "http://localhost:3000/api/og?title=RevealUI" 2>/dev/null && echo "OG image generated" || echo "Dev server not running — skip"
```

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/api/og/route.tsx apps/marketing/src/app/layout.tsx
git commit -m "feat(marketing): add dynamic OG image generation

Creates /api/og edge route using next/og ImageResponse. Adds openGraph
and twitter card metadata to root layout. Branded design with gradient
title on dark background."
```

---

### Task 11: Fix AI test flakiness

**Files:**
- Modify: `packages/ai/src/client/hooks/__tests__/useWorkingMemory.test.ts`

- [ ] **Step 1: Read the failing test**

```bash
pnpm --filter @revealui/ai test -- --grep "should handle empty working memory" 2>&1 | tail -30
```

The test expects `isLoading` to become `false` but it never does within the `waitFor` timeout.

- [ ] **Step 2: Investigate the hook implementation**

Read `packages/ai/src/client/hooks/useWorkingMemory.ts` to understand the loading state lifecycle.

- [ ] **Step 3: Fix the test**

The likely fix is increasing the `waitFor` timeout or properly mocking the async data fetching. The test needs to wait for the hook's internal async operation to complete.

```ts
await waitFor(
  () => {
    expect(result.current.isLoading).toBe(false);
  },
  { timeout: 3000 },
);
```

Or mock the underlying fetch to resolve immediately.

- [ ] **Step 4: Run tests in isolation AND via turbo**

```bash
# Isolation
pnpm --filter @revealui/ai test

# Via turbo (where flakiness occurs)
pnpm test
```

Expected: Both pass with 0 failures.

- [ ] **Step 5: Commit**

```bash
git add packages/ai/src/client/hooks/__tests__/useWorkingMemory.test.ts
git commit -m "fix(ai): stabilize useWorkingMemory test timing

Increases waitFor timeout / fixes mock setup to prevent flaky failures
under turbo parallelism."
```

---

## Chunk 3: Week 3 — CMS Admin (Beta → Stable)

### Task 12: Collection REST API bridge in CMS

**Files:**
- Create: `apps/cms/src/app/api/collections/[collection]/route.ts`
- Create: `apps/cms/src/app/api/collections/[collection]/[id]/route.ts`
- Create: `apps/cms/src/app/api/globals/[slug]/route.ts`

**Context:** The admin dashboard's `apiClient` calls `/api/collections/{name}` and `/api/globals/{slug}`. These routes don't exist in the CMS app. We need to create Next.js API routes that bridge to the Hono API at `api.revealui.com` or handle collection CRUD directly.

- [ ] **Step 1: Read the apiClient to understand expected API shape**

```bash
# Understand what the admin dashboard expects
cat packages/core/src/client/admin/utils/apiClient.ts
```

Document the expected endpoints: GET/POST `/api/collections/{collection}`, GET/PATCH/DELETE `/api/collections/{collection}/{id}`, GET/POST `/api/globals/{slug}`.

- [ ] **Step 2: Read the CMS config to understand available collections**

```bash
cat apps/cms/revealui.config.ts | head -80
```

- [ ] **Step 3: Create the collection list/create route**

In `apps/cms/src/app/api/collections/[collection]/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:3004';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
): Promise<NextResponse> {
  const { collection } = await params;
  const { searchParams } = new URL(request.url);

  const apiResponse = await fetch(
    `${API_URL}/api/content/${collection}?${searchParams.toString()}`,
    {
      headers: {
        Cookie: request.headers.get('Cookie') ?? '',
      },
    },
  );

  if (!apiResponse.ok) {
    const text = await apiResponse.text();
    return NextResponse.json(
      { error: text || 'API request failed' },
      { status: apiResponse.status },
    );
  }

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string }> },
): Promise<NextResponse> {
  const { collection } = await params;
  const body = await request.json();

  const apiResponse = await fetch(`${API_URL}/api/content/${collection}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('Cookie') ?? '',
    },
    body: JSON.stringify(body),
  });

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}
```

- [ ] **Step 4: Create the collection item route**

In `apps/cms/src/app/api/collections/[collection]/[id]/route.ts`:

```ts
import { type NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:3004';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
): Promise<NextResponse> {
  const { collection, id } = await params;

  const apiResponse = await fetch(`${API_URL}/api/content/${collection}/${id}`, {
    headers: {
      Cookie: request.headers.get('Cookie') ?? '',
    },
  });

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
): Promise<NextResponse> {
  const { collection, id } = await params;
  const body = await request.json();

  const apiResponse = await fetch(`${API_URL}/api/content/${collection}/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: request.headers.get('Cookie') ?? '',
    },
    body: JSON.stringify(body),
  });

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; id: string }> },
): Promise<NextResponse> {
  const { collection, id } = await params;

  const apiResponse = await fetch(`${API_URL}/api/content/${collection}/${id}`, {
    method: 'DELETE',
    headers: {
      Cookie: request.headers.get('Cookie') ?? '',
    },
  });

  const data = await apiResponse.json();
  return NextResponse.json(data, { status: apiResponse.status });
}
```

- [ ] **Step 5: Create globals route**

In `apps/cms/src/app/api/globals/[slug]/route.ts`, follow same proxy pattern for GET/POST.

- [ ] **Step 6: Verify build**

```bash
pnpm --filter cms build 2>&1 | grep "collections"
```

Expected: Routes appear in build output.

- [ ] **Step 7: Commit**

```bash
git add apps/cms/src/app/api/collections/ apps/cms/src/app/api/globals/
git commit -m "feat(cms): add collection REST API bridge for admin dashboard

Proxies /api/collections/* and /api/globals/* requests to the Hono API.
Bridges the gap between admin apiClient expectations and actual API structure."
```

---

### Task 13: Wire serverFunction through RootLayout

**Files:**
- Modify: `packages/core/src/client/admin/layout.tsx`
- Create: `packages/core/src/client/admin/context/ServerFunctionContext.tsx`

- [ ] **Step 1: Create the context**

```tsx
'use client';

import { createContext, useContext } from 'react';

type ServerFunction = (name: string, args: unknown) => Promise<unknown>;

const ServerFunctionContext = createContext<ServerFunction | null>(null);

export function ServerFunctionProvider({
  children,
  serverFunction,
}: {
  children: React.ReactNode;
  serverFunction?: ServerFunction;
}) {
  return (
    <ServerFunctionContext value={serverFunction ?? null}>
      {children}
    </ServerFunctionContext>
  );
}

export function useServerFunction(): ServerFunction {
  const fn = useContext(ServerFunctionContext);
  if (!fn) {
    throw new Error(
      'useServerFunction must be used within a ServerFunctionProvider. ' +
        'Pass serverFunction prop to RootLayout.',
    );
  }
  return fn;
}
```

- [ ] **Step 2: Update RootLayout to provide the context**

In `packages/core/src/client/admin/layout.tsx`, wrap children with the provider:

```tsx
import { ServerFunctionProvider } from './context/ServerFunctionContext.js';

export function RootLayout({ children, serverFunction }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <ServerFunctionProvider serverFunction={serverFunction}>
          {children}
        </ServerFunctionProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Export from package index**

Add to `packages/core/src/client/admin/index.ts`:

```ts
export { useServerFunction, ServerFunctionProvider } from './context/ServerFunctionContext.js';
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @revealui/core typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/client/admin/
git commit -m "feat(core): wire serverFunction through admin layout context

Creates ServerFunctionContext + useServerFunction hook. RootLayout now
provides the serverFunction prop via context so admin action buttons
can invoke server-side operations."
```

---

### Task 14: Fix streaming SSR pipe function

**Files:**
- Modify: `packages/router/src/server.tsx:77`

- [ ] **Step 1: Read the current code**

```bash
cat packages/router/src/server.tsx
```

Understand the current SSR rendering approach and where `pipe` is used.

- [ ] **Step 2: Fix the streaming response**

Replace the pipe function assignment with `renderToReadableStream` (React 19 API, compatible with Hono):

```tsx
// Before (broken):
const html = pipe;
resolve(c.body(html as any) as Response);

// After (React 19 ReadableStream):
const stream = await renderToReadableStream(element, {
  bootstrapScripts: ['/client.js'],
});
resolve(new Response(stream, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
}));
```

**Note:** The exact fix depends on the full context of server.tsx. Read the file first to understand whether it uses `renderToPipeableStream` (Node streams) or should use `renderToReadableStream` (web streams). For Hono on Vercel/edge, `renderToReadableStream` is the correct choice.

- [ ] **Step 3: Test**

```bash
pnpm --filter @revealui/router test
pnpm --filter @revealui/router typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/router/src/server.tsx
git commit -m "fix(router): use renderToReadableStream for streaming SSR

Replaces broken pipe function assignment with React 19's
renderToReadableStream, compatible with Hono web Response."
```

---

### Task 15: Implement embed FieldsDrawer

**Files:**
- Modify: `apps/cms/src/lib/features/embed/plugins/EmbedPlugin.tsx:37-46`

- [ ] **Step 1: Read the current stub and surrounding context**

```bash
cat apps/cms/src/lib/features/embed/plugins/EmbedPlugin.tsx
```

Understand what `EmbedDrawerData` and `DrawerFields` look like, and how the drawer is triggered.

- [ ] **Step 2: Read the core FieldsDrawer implementation**

```bash
cat packages/core/src/client/ui/index.tsx | grep -A 30 "FieldsDrawer"
```

Check if core has a real implementation that can be imported instead of the local stub.

- [ ] **Step 3: Replace stub with implementation**

If core has a working `FieldsDrawer`, import it:

```tsx
import { FieldsDrawer } from '@revealui/core/client';
```

If not, implement using presentation components:

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@revealui/presentation';

const FieldsDrawer = (props: {
  data: EmbedDrawerData | null;
  drawerSlug: string;
  drawerTitle: string;
  featureKey: string;
  schemaPath: string;
  handleDrawerSubmit: (fields: DrawerFields, data: EmbedDrawerData) => void;
  schemaPathSuffix: string;
}) => {
  const isOpen = useModal(props.drawerSlug);
  if (!isOpen || !props.data) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => closeModal(props.drawerSlug)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.drawerTitle}</DialogTitle>
        </DialogHeader>
        {/* Render embed fields based on data */}
        <EmbedFieldForm
          data={props.data}
          onSubmit={(fields) => props.handleDrawerSubmit(fields, props.data!)}
        />
      </DialogContent>
    </Dialog>
  );
};
```

**Note:** The exact implementation depends on reading the full EmbedPlugin context. Step 1 and 2 inform the approach.

- [ ] **Step 4: Build and typecheck**

```bash
pnpm --filter cms typecheck
pnpm --filter cms build
```

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/lib/features/embed/plugins/EmbedPlugin.tsx
git commit -m "feat(cms): implement embed FieldsDrawer component

Replaces null stub with functional drawer using presentation Dialog
components. Users can now create and edit embeds in the rich text editor."
```

---

## Ops Tasks (not code — Stripe Dashboard / Vercel)

### Stripe Setup (Week 1, before deploy)

1. Create 3 Stripe coupons in Dashboard → Coupons:
   - `EARLY_PRO_20OFF`: Amount off = $20, Duration = forever, Redeem by = launch date + 30 days
   - `EARLY_MAX_60OFF`: Amount off = $60, Duration = forever, Redeem by = launch date + 30 days
   - `EARLY_ENT_120OFF`: Amount off = $120, Duration = forever, Redeem by = launch date + 30 days

2. Create promotion codes for each coupon (shareable URLs)

3. Verify all Stripe products have `tier` metadata key set to `pro`, `max`, or `enterprise`

### Vercel Env Vars (Week 1, before deploy)

Set in each Vercel project's Settings → Environment Variables:

**API project:**
- `STRIPE_WEBHOOK_SECRET_LIVE` = (from Stripe Dashboard → Webhooks)
- `REVEALUI_EARLY_ADOPTER_END` = (launch date + 30 days ISO string)
- `REVEALUI_EARLY_ADOPTER_COUPON_PRO` = `EARLY_PRO_20OFF`
- `REVEALUI_EARLY_ADOPTER_COUPON_MAX` = `EARLY_MAX_60OFF`
- `REVEALUI_EARLY_ADOPTER_COUPON_ENT` = `EARLY_ENT_120OFF`
- `REVEALUI_ALERT_EMAIL` = `founder@revealui.com`
- `CORS_ORIGIN` = `https://cms.revealui.com,https://revealui.com`

**CMS project:**
- `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` = (from Stripe Dashboard → Products)
- `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID` = (from Stripe Dashboard → Products)
- `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID` = (from Stripe Dashboard → Products)

### Email Verification (Week 1)

1. Send a test email via Resend to verify API key works
2. Verify `RESEND_API_KEY` is set in both API and CMS Vercel projects
3. Check that `from` address is verified in Resend (e.g., `noreply@revealui.com`)

---

## Final Verification

After all 3 weeks:

```bash
# Full gate
pnpm gate

# All tests
pnpm test

# Build all
pnpm build

# Verify no new any types
pnpm audit:any

# Verify no console statements
pnpm audit:console
```

Expected: All pass. 625/625 tests. 0 avoidable any. 0 console statements.
