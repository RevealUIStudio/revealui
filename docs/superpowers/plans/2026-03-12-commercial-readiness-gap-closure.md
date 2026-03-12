# Commercial Readiness Gap Closure — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all blocker and high-priority gaps discovered in Session 99's exhaustive 6-agent audit so RevealUI can safely, confidently, and morally charge customers.

**Architecture:** Phase 0 fixes security + payment trust (authorization, license gates, services tests, email). Phase 1 hardens type safety + customer experience. Phase 2 addresses Pro tier + compliance. Phase 3 scales.

**Tech Stack:** TypeScript 5.9, Hono, Next.js 16, Vitest 4, Drizzle ORM, Stripe, Biome 2

**Source:** Session 99 audit findings → GAP-037 through GAP-046 + updated GAP-021/030/027

---

## Chunk 1: Phase 0 — Moral Minimum

These must be done before ANY customer pays. No exceptions.

---

### Task 1: Harnesses License Gate (GAP-040) — 5 min

**Files:**
- Modify: `packages/harnesses/src/cli.ts`
- Test: `packages/harnesses/src/__tests__/cli-license.test.ts`

The function `checkHarnessesLicense()` exists in `packages/harnesses/src/index.ts:21-28` but is never called in the CLI entry point. Mirror the pattern from `@revealui/editors`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/harnesses/src/__tests__/cli-license.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('harnesses CLI license gate', () => {
  it('should call checkHarnessesLicense on CLI startup', async () => {
    // Mock isFeatureEnabled to return false
    vi.mock('@revealui/core/features', () => ({
      isFeatureEnabled: vi.fn().mockReturnValue(false),
    }));

    // Import should throw
    await expect(async () => {
      await import('../cli.js');
    }).rejects.toThrow(/Pro license/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @revealui/harnesses vitest run src/__tests__/cli-license.test.ts`
Expected: FAIL — CLI currently doesn't call license check

- [ ] **Step 3: Add license gate to CLI**

In `packages/harnesses/src/cli.ts`, add at the top of the `main()` function (or module scope before any command registration):

```ts
import { checkHarnessesLicense } from './index.js';

// At start of main() or module scope:
checkHarnessesLicense();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @revealui/harnesses vitest run src/__tests__/cli-license.test.ts`
Expected: PASS

- [ ] **Step 5: Run full package tests**

Run: `pnpm --filter @revealui/harnesses test`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add packages/harnesses/src/cli.ts packages/harnesses/src/__tests__/cli-license.test.ts
git commit -m "fix(harnesses): add license gate to CLI entry point (GAP-040)"
```

---

### Task 2: AI Routes Upgrade Prompt (GAP-038) — 30 min

**Files:**
- Modify: `apps/api/src/routes/agent-tasks.ts`
- Modify: `apps/api/src/routes/agent-stream.ts` (if exists)
- Modify: `apps/api/src/routes/rag-index.ts`
- Modify: `apps/api/src/routes/a2a-discovery.ts` (if exists)
- Create: `apps/api/src/lib/upgrade-response.ts`
- Test: `apps/api/src/routes/__tests__/upgrade-prompt.test.ts`

Replace all bare 503 "not configured" responses with structured 402 upgrade prompt.

- [ ] **Step 1: Create the upgrade response helper**

```ts
// apps/api/src/lib/upgrade-response.ts
import type { Context } from 'hono';

interface UpgradeResponse {
  error: 'upgrade_required';
  tier: 'pro' | 'max' | 'enterprise';
  feature: string;
  message: string;
  url: string;
}

export function upgradeRequired(
  c: Context,
  feature: string,
  tier: 'pro' | 'max' | 'enterprise' = 'pro',
): Response {
  const body: UpgradeResponse = {
    error: 'upgrade_required',
    tier,
    feature,
    message: `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)} to unlock ${feature}. Visit https://revealui.com/pricing for details.`,
    url: 'https://revealui.com/pricing',
  };
  return c.json(body, 402);
}
```

- [ ] **Step 2: Write tests for upgrade response**

```ts
// apps/api/src/routes/__tests__/upgrade-prompt.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { upgradeRequired } from '../../lib/upgrade-response.js';

describe('upgrade prompt response', () => {
  it('returns 402 with structured body', async () => {
    const app = new Hono();
    app.get('/test', (c) => upgradeRequired(c, 'ai'));

    const res = await app.request('/test');
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.error).toBe('upgrade_required');
    expect(body.tier).toBe('pro');
    expect(body.feature).toBe('ai');
    expect(body.url).toContain('revealui.com/pricing');
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm --filter api vitest run src/routes/__tests__/upgrade-prompt.test.ts`
Expected: PASS

- [ ] **Step 4: Replace 503s in AI routes**

Search for all 503 responses related to AI/Pro package availability in `apps/api/src/routes/`. Replace each instance:

```ts
// BEFORE:
return c.json({ success: false, error: 'AI package not available' }, 503);

// AFTER:
import { upgradeRequired } from '../lib/upgrade-response.js';
return upgradeRequired(c, 'ai');
```

Do this for every route file that returns 503 for missing Pro packages:
- `agent-tasks.ts`
- `rag-index.ts`
- Any other route with `'AI not configured'` or `'AI package not available'`

Also check `apps/cms/src/` for similar patterns (`/api/chat`, `/api/memory/*`).

- [ ] **Step 5: Verify no bare 503s remain for AI features**

Run: `grep -rn "503" apps/api/src/routes/ apps/cms/src/ --include="*.ts" | grep -v node_modules | grep -v test | grep -vi "circuit\|unavailable\|rate"`
Expected: No results for AI-related 503s (circuit breaker 503s are legitimate)

- [ ] **Step 6: Run API tests**

Run: `pnpm --filter api test`
Expected: All tests pass (update any tests that assert 503 for AI routes → 402)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/upgrade-response.ts apps/api/src/routes/ apps/cms/src/
git commit -m "fix(api): replace AI 503s with 402 upgrade prompts (GAP-038)"
```

---

### Task 3: Services Package Tests (GAP-030) — 2 hours

**Files:**
- Create: `packages/services/src/__tests__/stripe-client.test.ts`
- Create: `packages/services/src/__tests__/circuit-breaker.test.ts`
- Create: `packages/services/src/__tests__/webhook-idempotency.test.ts`

The services package handles Stripe payments with circuit breakers and retry logic but has ZERO tests.

- [ ] **Step 1: Create circuit breaker tests**

Test the circuit breaker state machine: closed → open (after 5 failures) → half-open (after 30s) → closed (on success).

```ts
// packages/services/src/__tests__/circuit-breaker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test circuit breaker transitions:
// - 5 consecutive failures → circuit opens
// - In open state → requests fail immediately (no Stripe call)
// - After resetTimeout → half-open state → one request allowed
// - If that succeeds → circuit closes
// - If that fails → circuit re-opens
```

Write at least 8 tests covering: normal operation, failure threshold, open-circuit fast-fail, half-open transition, recovery, error types, concurrent requests, and reset.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/services vitest run`
Expected: Tests fail (verifying the tests are meaningful, not just passing on mocks)

- [ ] **Step 3: Fix any test setup issues**

Ensure vitest.config.ts exists in `packages/services/` and test infrastructure works.

- [ ] **Step 4: Create Stripe client tests**

```ts
// packages/services/src/__tests__/stripe-client.test.ts
// Test: createCustomer, createSubscription, updateSubscription, cancelSubscription
// Test: createPaymentIntent, retrievePaymentIntent, listInvoices
// Test: idempotent key generation (same input → same key)
// Test: retry logic (3 attempts, exponential backoff)
// Test: error handling (Stripe API errors → proper error messages)
// Mock Stripe SDK, verify correct API calls are made
```

Write at least 15 tests.

- [ ] **Step 5: Create webhook idempotency tests**

```ts
// packages/services/src/__tests__/webhook-idempotency.test.ts
// Test: first webhook → creates license + DB entry
// Test: duplicate webhook (same event ID) → no-op
// Test: checkout.session.completed → correct license tier
// Test: customer.subscription.deleted → license revoked
// Test: customer.subscription.updated → tier + JWT regenerated
// Test: invalid HMAC signature → rejected
```

Write at least 6 tests.

- [ ] **Step 6: Run full test suite**

Run: `pnpm --filter @revealui/services vitest run`
Expected: All 29+ tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/services/src/__tests__/
git commit -m "test(services): add 30 tests for Stripe client, circuit breaker, webhooks (GAP-030)"
```

---

### Task 4: Email Service Fail-Loud (GAP-045) — 20 min

**Files:**
- Modify: `apps/cms/src/lib/email/index.ts`
- Test: `apps/cms/src/lib/email/__tests__/email-provider.test.ts`

Currently: mock email provider silently swallows emails in production.
After: throw in production when no provider configured.

- [ ] **Step 1: Write failing test**

```ts
// apps/cms/src/lib/email/__tests__/email-provider.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('email provider in production', () => {
  it('throws when no provider configured in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    // Remove all provider env vars
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('SMTP_HOST', '');

    // Attempting to send should throw
    // expect(async () => await sendEmail({ to: 'test@test.com', subject: 'Test', html: '<p>Test</p>' }))
    //   .rejects.toThrow(/email provider not configured/i);
  });

  it('allows mock provider in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    // Should not throw, just log
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter cms vitest run src/lib/email/__tests__/email-provider.test.ts`

- [ ] **Step 3: Implement fail-loud behavior**

In `apps/cms/src/lib/email/index.ts`, modify the provider selection logic:

```ts
function getEmailProvider(): EmailProvider {
  if (process.env.RESEND_API_KEY) return new ResendProvider();
  if (process.env.SMTP_HOST) return new SMTPProvider();

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Email provider not configured in production. ' +
      'Set RESEND_API_KEY or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.'
    );
  }

  // Development only — log to console
  return new MockProvider();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter cms vitest run src/lib/email/__tests__/email-provider.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/lib/email/
git commit -m "fix(cms): email service fails loudly in production when unconfigured (GAP-045)"
```

---

### Task 5: CI Tests Hard-Fail (GAP-021) — 15 min

**Files:**
- Modify: `.github/workflows/ci.yml`

Currently tests are `continue-on-error: true`. Change to hard-fail.

- [ ] **Step 1: Read current CI workflow**

Read `.github/workflows/ci.yml` and find the test step with `continue-on-error: true`.

- [ ] **Step 2: Change tests from warn-only to hard-fail**

Remove `continue-on-error: true` from the test step. If tests fail, CI fails.

- [ ] **Step 3: Verify CI gate script alignment**

Read `scripts/gates/ci-gate.ts` and verify the test phase is not marked as `warnOnly`. If it is, change to `required`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml scripts/gates/ci-gate.ts
git commit -m "ci: make test failures block merges (GAP-021)"
```

---

### Task 6: CI Coverage Gate (GAP-042) — 20 min

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/gates/test-coverage-gate.ts` (if needed)

Add `pnpm test:coverage` to CI so coverage reports are generated and the coverage gate has data.

- [ ] **Step 1: Add coverage job to ci.yml**

After the existing test step, add a coverage step:

```yaml
- name: Test coverage
  run: pnpm test:coverage
  continue-on-error: true  # Coverage is advisory initially

- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage-reports
    path: packages/*/coverage/coverage-summary.json
    retention-days: 30
```

- [ ] **Step 2: Verify coverage gate can read reports**

Run locally: `pnpm test:coverage && pnpm coverage:check`
Expected: Coverage gate finds and reads the generated reports

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test:coverage to CI pipeline, feed coverage gate (GAP-042)"
```

---

### Task 7: Fix Types Gate (GAP-043) — 15 min

**Files:**
- Modify: `scripts/gates/types-gate.ts`

The script references `pnpm validate:types:enhanced`, `pnpm types:coverage`, `pnpm types:check` which don't exist.

- [ ] **Step 1: Identify non-existent script references**

Read `scripts/gates/types-gate.ts` and grep for all `pnpm` command invocations. Cross-reference with `package.json` scripts.

- [ ] **Step 2: Remove or stub missing script references**

For each missing script:
- If the validation is critical: implement the script
- If it's aspirational: remove the reference and add a TODO comment with the gap ID

At minimum, make the gate pass without errors. The core steps (generate, validate, build, typecheck contracts+db) should work.

- [ ] **Step 3: Verify types gate runs clean**

Run: `pnpm gate:types`
Expected: Completes with exit 0 (no crashes from missing scripts)

- [ ] **Step 4: Commit**

```bash
git add scripts/gates/types-gate.ts
git commit -m "fix(gates): remove references to non-existent scripts in types-gate (GAP-043)"
```

---

### Task 8: Console.log Migration (GAP-044) — 45 min

**Files:**
- Modify: `packages/harnesses/src/cli.ts` (57 console.log → logger)
- Modify: `packages/core/src/security/headers.ts` (2 console.warn → logger)
- Modify: `apps/cms/src/instrumentation.ts` (1 console.error → logger)

- [ ] **Step 1: Import logger in harnesses CLI**

```ts
import { createLogger } from '@revealui/utils';
const logger = createLogger('harnesses');
```

- [ ] **Step 2: Replace all 57 console.log in harnesses/cli.ts**

Replace each `console.log(...)` with `logger.info(...)`, `console.error(...)` with `logger.error(...)`, `console.warn(...)` with `logger.warn(...)`.

For CLI user-facing output (like `--help` or status display), use `process.stdout.write()` instead of console.log, since logger adds metadata.

- [ ] **Step 3: Replace 2 console.warn in core/security/headers.ts**

```ts
import { createLogger } from '@revealui/utils';
const logger = createLogger('security');
// Replace console.warn(...) → logger.warn(...)
```

- [ ] **Step 4: Replace 1 console.error in cms/instrumentation.ts**

```ts
import { createLogger } from '@revealui/utils';
const logger = createLogger('cms');
// Replace console.error(...) → logger.error(...)
```

- [ ] **Step 5: Verify zero console violations**

Run: `pnpm audit:console`
Expected: 0 production console statements

- [ ] **Step 6: Run affected package tests**

Run: `pnpm --filter @revealui/harnesses test && pnpm --filter @revealui/core test && pnpm --filter cms test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add packages/harnesses/src/cli.ts packages/core/src/security/headers.ts apps/cms/src/instrumentation.ts
git commit -m "refactor: migrate 66 console statements to structured logger (GAP-044)"
```

---

### Task 9: Authorization Middleware (GAP-037) — 3 hours

**Files:**
- Create: `apps/api/src/middleware/authorization.ts`
- Create: `apps/api/src/middleware/__tests__/authorization.test.ts`
- Modify: `apps/api/src/routes/*.ts` (wire middleware to routes)

This is the largest Phase 0 task. The authorization system exists in `packages/core/src/security/authorization.ts` — it just needs to be wired into route handlers.

- [ ] **Step 1: Create authorization middleware**

```ts
// apps/api/src/middleware/authorization.ts
import type { MiddlewareHandler } from 'hono';
import { canAccessResource } from '@revealui/core/security';
import { HTTPException } from 'hono/http-exception';

/**
 * Require authentication. Returns 401 if no user in context.
 */
export function requireAuth(): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    await next();
  };
}

/**
 * Require specific role(s). Returns 403 if user lacks required role.
 */
export function requireRole(...roles: string[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  };
}

/**
 * Check resource access using RBAC + ownership.
 */
export function requireAccess(
  resourceType: string,
  action: string,
): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const resourceId = c.req.param('id');
    const allowed = canAccessResource(
      user.id,
      [user.role],
      { type: resourceType, id: resourceId },
      action,
    );

    if (!allowed) {
      throw new HTTPException(403, { message: 'Access denied' });
    }

    await next();
  };
}
```

- [ ] **Step 2: Write middleware tests**

```ts
// apps/api/src/middleware/__tests__/authorization.test.ts
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireAuth, requireRole, requireAccess } from '../authorization.js';

describe('authorization middleware', () => {
  // Test requireAuth: 401 without user, passes with user
  // Test requireRole('admin'): 403 for non-admin, passes for admin
  // Test requireAccess: delegates to canAccessResource
  // At least 8 tests covering auth, role, and access scenarios
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter api vitest run src/middleware/__tests__/authorization.test.ts`
Expected: PASS

- [ ] **Step 4: Wire middleware to write routes**

For each route file in `apps/api/src/routes/`, add appropriate middleware:
- **Public routes** (license verify, health, pricing): no middleware
- **Authenticated routes** (content read, user profile): `requireAuth()`
- **Admin routes** (billing admin, GDPR, tickets admin): `requireRole('admin')`
- **Resource routes** (content create/update/delete): `requireAccess('content', 'update')`

Pattern:
```ts
// apps/api/src/routes/content.ts
import { requireAuth, requireRole } from '../middleware/authorization.js';

app.get('/posts', requireAuth(), async (c) => { ... });
app.post('/posts', requireRole('admin', 'editor'), async (c) => { ... });
app.delete('/posts/:id', requireRole('admin'), async (c) => { ... });
```

- [ ] **Step 5: Update route tests**

Update existing route tests to include user context in requests. Tests that were passing without auth should now fail without it (verifying the middleware works).

- [ ] **Step 6: Run full API test suite**

Run: `pnpm --filter api test`
Expected: All tests pass with updated auth context

- [ ] **Step 7: Run gate**

Run: `pnpm gate:quick`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/middleware/authorization.ts apps/api/src/middleware/__tests__/ apps/api/src/routes/
git commit -m "feat(api): wire RBAC authorization middleware to all routes (GAP-037)"
```

---

## Chunk 2: Phase 1 — Type Safety + Customer Experience

---

### Task 10: Enable Strict Mode — Foundation Packages (GAP-041, Part 1) — 2 hours

**Files:**
- Modify: `packages/contracts/tsconfig.json`
- Modify: `packages/db/tsconfig.json`
- Fix: Type errors surfaced in both packages

These two are the foundation — all other packages depend on them. Fix them first.

- [ ] **Step 1: Enable strict in contracts**

Set `"strict": true` in `packages/contracts/tsconfig.json`.

- [ ] **Step 2: Fix type errors in contracts**

Run `pnpm --filter @revealui/contracts typecheck` and fix all errors. Focus on:
- `as unknown as` double assertions → proper generics
- Missing null checks → optional chaining
- Implicit `any` → explicit types

- [ ] **Step 3: Verify contracts builds**

Run: `pnpm --filter @revealui/contracts build && pnpm --filter @revealui/contracts test`

- [ ] **Step 4: Commit contracts**

```bash
git commit -m "refactor(contracts): enable strict mode, fix type errors (GAP-041)"
```

- [ ] **Step 5: Enable strict in db**

Set `"strict": true` in `packages/db/tsconfig.json`.

- [ ] **Step 6: Fix type errors in db**

Run `pnpm --filter @revealui/db typecheck` and fix all errors.

- [ ] **Step 7: Verify db builds**

Run: `pnpm --filter @revealui/db build && pnpm --filter @revealui/db test`

- [ ] **Step 8: Commit db**

```bash
git commit -m "refactor(db): enable strict mode, fix type errors (GAP-041)"
```

---

### Task 11: Enable Strict Mode — Security Packages (GAP-041, Part 2) — 2 hours

**Files:**
- Modify: `packages/auth/tsconfig.json`
- Modify: `packages/config/tsconfig.json`
- Fix: Type errors in both packages

- [ ] **Step 1: Enable strict in auth**
- [ ] **Step 2: Fix type errors in auth**
- [ ] **Step 3: Verify auth builds and tests pass**
- [ ] **Step 4: Commit auth**
- [ ] **Step 5: Enable strict in config**
- [ ] **Step 6: Fix type errors in config** (expect config proxy pattern to need the most work)
- [ ] **Step 7: Verify config builds**
- [ ] **Step 8: Commit config**

---

### Task 12: Enable Strict Mode — Remaining Packages (GAP-041, Part 3) — 3 hours

**Files:**
- Modify: `packages/presentation/tsconfig.json`
- Modify: `packages/router/tsconfig.json`
- Modify: `packages/sync/tsconfig.json`
- Modify: `packages/utils/tsconfig.json`
- Modify: `packages/dev/tsconfig.json`
- Modify: `packages/test/tsconfig.json`

- [ ] **Step 1-12: Enable strict in each package, fix errors, test, commit**

One package at a time. After each: `pnpm --filter <pkg> typecheck && pnpm --filter <pkg> test`.

Final verification: `pnpm typecheck:all`

- [ ] **Step 13: Verify full monorepo**

Run: `pnpm typecheck:all && pnpm audit:any`
Expected: All 15 packages pass strict typecheck. `any` count at or below baseline.

- [ ] **Step 14: Commit**

```bash
git commit -m "refactor: enable strict mode in all remaining packages (GAP-041)"
```

---

### Task 13: Presentation Test Coverage (GAP-027) — 4 hours

**Files:**
- Create: `packages/presentation/src/__tests__/*.test.tsx` (multiple files)

55+ components at 3% coverage. Target: 60%.

- [ ] **Step 1: Audit component list**

Glob `packages/presentation/src/components/` and categorize: buttons, inputs, layout, feedback, data display.

- [ ] **Step 2: Write tests by category**

For each component category, write tests covering:
- Renders without crashing
- Accepts and applies className prop
- Handles user interaction (click, input, change)
- Handles disabled/error/loading states
- Renders children correctly

Aim for 3-5 assertions per component, 55+ components = 165+ assertions.

- [ ] **Step 3: Run coverage**

Run: `pnpm --filter @revealui/presentation test:coverage`
Expected: ≥60% line coverage

- [ ] **Step 4: Commit**

```bash
git commit -m "test(presentation): add comprehensive component tests, 3%→60% coverage (GAP-027)"
```

---

### Task 14: OpenAPI Docs for All Routes (GAP-014) — 3 hours

**Files:**
- Modify: `apps/api/src/routes/*.ts` (all route files)

Hono already supports OpenAPI via `@hono/zod-openapi`. Add schema descriptions to all routes.

- [ ] **Step 1: Audit routes missing OpenAPI schemas**
- [ ] **Step 2: Add OpenAPI route definitions with Zod schemas**
- [ ] **Step 3: Verify Swagger UI renders all routes**
- [ ] **Step 4: Commit**

---

### Task 15: Structured Error Codes (GAP-015) — 2 hours

**Files:**
- Create: `apps/api/src/lib/error-codes.ts`
- Modify: `apps/api/src/routes/*.ts`

Replace ad-hoc error messages with structured error codes.

- [ ] **Step 1: Define error code enum**
- [ ] **Step 2: Create error response helper**
- [ ] **Step 3: Replace string errors with codes across all routes**
- [ ] **Step 4: Test error code consistency**
- [ ] **Step 5: Commit**

---

### Task 16: JWT kid Claim (GAP-010) — 1 hour

**Files:**
- Modify: `packages/auth/src/server/jwt.ts` (or license key generation)

Add `kid` (key ID) claim to JWT license keys for key rotation support.

- [ ] **Step 1: Write test for kid claim in JWT**
- [ ] **Step 2: Implement kid claim**
- [ ] **Step 3: Verify existing license verification still works**
- [ ] **Step 4: Commit**

---

### Task 17: Refund Endpoint (GAP-031) — 1 hour

**Files:**
- Create: `apps/api/src/routes/refund.ts`
- Test: `apps/api/src/routes/__tests__/refund.test.ts`

Add POST `/api/billing/refund` with admin-only access.

- [ ] **Step 1: Write failing test for refund endpoint**
- [ ] **Step 2: Implement refund endpoint (Stripe refund API)**
- [ ] **Step 3: Wire requireRole('admin') middleware**
- [ ] **Step 4: Test edge cases (already refunded, partial refund)**
- [ ] **Step 5: Commit**

---

## Chunk 3: Phase 2 — Pro Tier Launch

---

### Task 18: MCP Decision (GAP-039)

**Decision required from founder:**
- **Option A:** Implement 2-3 original MCP servers (Stripe payment intents, Neon queries, email)
- **Option B:** Reposition as "MCP framework" — don't charge for server integrations, move to OSS

If Option A: ~3 weeks of work. If Option B: ~1 day (rename + docs).

- [ ] **Step 1: Present options to founder**
- [ ] **Step 2: Execute chosen option**
- [ ] **Step 3: Verify MCP build + exports**
- [ ] **Step 4: Commit**

---

### Task 19: GDPR Persistent Storage (GAP-046) — 3 hours

**Files:**
- Create: `packages/db/src/schema/gdpr.ts`
- Create: `packages/core/src/security/gdpr-drizzle-storage.ts`
- Modify: `packages/core/src/security/gdpr.ts` (wire DrizzleGDPRStorage as default)

- [ ] **Step 1: Add Drizzle schema for consent_records, deletion_requests, audit_events**
- [ ] **Step 2: Implement DrizzleGDPRStorage class**
- [ ] **Step 3: Wire as production default**
- [ ] **Step 4: Test with PGlite**
- [ ] **Step 5: Commit**

---

### Task 20: MFA/2FA (GAP-032) — 4 hours

- [ ] Steps deferred — see GAP-032.yml for acceptance criteria

---

### Task 21: Background Job Queue (GAP-033) — 4 hours

- [ ] Steps deferred — see GAP-033.yml for acceptance criteria

---

### Task 22: Redis Distributed Cache (GAP-034) — 3 hours

- [ ] Steps deferred — see GAP-034.yml for acceptance criteria

---

## Chunk 4: Phase 3 — Scale Confidence

---

### Task 23: Terminal App Decision (GAP-035)

- [ ] Decision: implement or remove from monorepo

### Task 24: N+1 Query Prevention (GAP-036)

- [ ] Audit all Drizzle query functions for N+1 patterns
- [ ] Add dataloader or batch query helpers where needed

### Task 25: E2E on Every PR

- [ ] Move Playwright from main-only to all PRs in ci.yml
- [ ] Add API contract tests

### Task 26: Load Testing

- [ ] Set up k6 scripts for critical paths
- [ ] Establish baseline performance numbers

---

## Verification Gate

After completing all Phase 0 tasks (Tasks 1-9), run:

```bash
pnpm gate          # Full CI gate
pnpm audit:any     # Zero avoidable any types
pnpm audit:console # Zero console statements
pnpm preflight     # Pre-launch checklist
```

All must pass before proceeding to Phase 1.

---

## Dependencies

```
Task 1 (license gate)     → independent
Task 2 (upgrade prompts)  → independent
Task 3 (services tests)   → independent
Task 4 (email fail-loud)  → independent
Task 5 (CI hard-fail)     → independent
Task 6 (CI coverage)      → after Task 5
Task 7 (types-gate fix)   → independent
Task 8 (console.log)      → independent
Task 9 (authorization)    → independent (largest task, start early)

Task 10 (strict contracts/db) → after Phase 0 complete
Task 11 (strict auth/config)  → after Task 10
Task 12 (strict remaining)    → after Task 11
Task 13 (presentation tests)  → independent of strict mode
Task 14-17                    → independent of each other

Task 18 (MCP decision)       → blocks Phase 2 Pro launch
Task 19-22                    → independent of each other
```

**Parallel execution:** Tasks 1-5, 7-9 can all run in parallel as separate subagents. Task 6 depends on Task 5. Tasks 10-12 are serial (dependency chain). Tasks 13-17 can run in parallel.
