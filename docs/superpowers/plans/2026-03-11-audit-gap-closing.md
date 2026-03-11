# Audit Gap-Closing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all blocking gaps identified in the 2026-03-11 codebase audit so RevealUI can charge customers with confidence.

**Architecture:** Fix-forward — add missing tests, harden auth storage, fix two CMS collection configs. No architectural changes.

**Tech Stack:** Vitest, Stripe SDK mocks, Drizzle ORM, Zod, Hono

**Prerequisite:** Read `docs/superpowers/specs/2026-03-11-codebase-audit.md` for full context.

---

## Phase A: Payment Integrity (Blocking)

### Task 1: Add Tests for @revealui/services — Stripe Client & Circuit Breaker

**Files:**
- Create: `packages/services/src/__tests__/stripe-client.test.ts`
- Read: `packages/services/src/stripe/index.ts` (or wherever protectedStripe is defined)

- [ ] **Step 1: Write failing tests for Stripe client initialization**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('protectedStripe', () => {
  it('should initialize Stripe client with secret key', () => {
    // Verify client is created with STRIPE_SECRET_KEY
  });

  it('should expose circuit breaker wrapper', () => {
    // Verify protectedStripe wraps calls with circuit breaker
  });

  it('should fail open after threshold failures', () => {
    // Simulate 3 consecutive failures, verify circuit opens
  });

  it('should recover after reset timeout', () => {
    // Verify circuit closes after successful call post-timeout
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/services test`
Expected: FAIL — test file doesn't exist yet or functions not imported

- [ ] **Step 3: Implement tests with proper mocks**

Mock the Stripe SDK constructor. Verify circuit breaker state transitions.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @revealui/services test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/__tests__/stripe-client.test.ts
git commit -m "test(services): add Stripe client and circuit breaker tests"
```

---

### Task 2: Add Tests for @revealui/services — Checkout & Subscriptions

**Files:**
- Create: `packages/services/src/__tests__/checkout.test.ts`
- Create: `packages/services/src/__tests__/subscriptions.test.ts`
- Read: Source files for checkout session creation, subscription management

- [ ] **Step 1: Write failing tests for checkout flow**

Test cases:
- Creates checkout session with correct tier metadata
- Includes customer ID when available
- Creates new customer when none exists
- Handles Stripe API errors gracefully
- Returns session URL on success
- Validates required parameters (tier, successUrl, cancelUrl)
- Includes trial period for eligible tiers
- Supports promotion codes

- [ ] **Step 2: Write failing tests for subscription management**

Test cases:
- Retrieves subscription by ID
- Updates subscription (upgrade/downgrade)
- Cancels subscription at period end
- Handles missing subscription gracefully
- Maps Stripe subscription status to internal tier

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @revealui/services test`

- [ ] **Step 4: Implement test mocks**

Use `vi.mock('stripe')` pattern from existing CMS tests. Reference: `apps/cms/src/__tests__/payments/stripe.test.ts`

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/services/src/__tests__/checkout.test.ts packages/services/src/__tests__/subscriptions.test.ts
git commit -m "test(services): add checkout and subscription tests"
```

---

### Task 3: Add Tests for @revealui/services — Webhook Handlers

**Files:**
- Create: `packages/services/src/__tests__/webhooks.test.ts`
- Read: Webhook handler source (checkout.session.completed, customer.subscription.*, invoice.payment.*)

- [ ] **Step 1: Write failing tests for webhook event handling**

Test cases:
- Verifies webhook signature (constructEvent)
- Rejects invalid signatures
- Handles checkout.session.completed (creates license)
- Handles customer.subscription.created (activates subscription)
- Handles customer.subscription.updated (tier change)
- Handles customer.subscription.deleted (revokes license)
- Handles invoice.payment.succeeded (records payment)
- Handles invoice.payment.failed (flags account)
- Idempotency: duplicate events are ignored (DB INSERT ON CONFLICT)
- Unknown event types are logged and ignored (not errors)
- Missing customer ID in event payload
- Subscription with cancel_at_period_end (scheduled cancellation)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement test mocks**

Mock Stripe.webhooks.constructEvent, mock database insert for idempotency.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/services/src/__tests__/webhooks.test.ts
git commit -m "test(services): add webhook handler tests with idempotency"
```

---

### Task 4: Add Tests for @revealui/services — Billing Portal & Supabase Client

**Files:**
- Create: `packages/services/src/__tests__/portal.test.ts`
- Create: `packages/services/src/__tests__/supabase-client.test.ts`

- [ ] **Step 1: Write failing tests for billing portal**

Test cases:
- Creates portal session with return URL
- Requires customer ID
- Handles Stripe errors
- Returns portal URL on success

- [ ] **Step 2: Write failing tests for Supabase client factory**

Test cases:
- createServerClient returns Supabase client
- Handles missing credentials
- SSR-compatible auth handling

- [ ] **Step 3: Run tests, implement, verify pass**

- [ ] **Step 4: Commit**

```bash
git add packages/services/src/__tests__/portal.test.ts packages/services/src/__tests__/supabase-client.test.ts
git commit -m "test(services): add billing portal and Supabase client tests"
```

---

### Task 5: Add Tests for @revealui/mcp — Hypervisor

**Files:**
- Create: `packages/mcp/src/__tests__/hypervisor.test.ts`
- Read: `packages/mcp/src/hypervisor/` (hypervisor source)

- [ ] **Step 1: Write failing tests for hypervisor lifecycle**

Test cases:
- Spawns MCP server process
- Discovers tools from spawned server
- Handles server crash/exit
- Stops server gracefully
- Lists running servers
- Health check on running server
- Timeout on unresponsive server
- Concurrent server management

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement with process mocking**

Mock child_process.spawn, verify lifecycle events.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/__tests__/hypervisor.test.ts
git commit -m "test(mcp): add hypervisor lifecycle tests"
```

---

### Task 6: Add Tests for @revealui/mcp — Server Launchers

**Files:**
- Create: `packages/mcp/src/__tests__/servers.test.ts`
- Read: Server launcher source files

- [ ] **Step 1: Write failing tests for server launchers**

Test cases:
- Code Validator: validates Python/JS patterns correctly
- Code Validator: rejects malicious patterns
- Stripe launcher: spawns with correct args
- Neon launcher: spawns with correct args
- Each launcher: handles missing credentials
- Each launcher: returns proper error on spawn failure

- [ ] **Step 2-4: Implement and verify**

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/src/__tests__/servers.test.ts
git commit -m "test(mcp): add MCP server launcher tests"
```

---

## Phase B: Auth Hardening

### Task 7: Evaluate Auth Storage for Serverless

**Files:**
- Read: `packages/auth/src/server/storage/database.ts`
- Read: `packages/auth/src/server/storage/index.ts`

- [ ] **Step 1: Assess DatabaseStorage in Vercel context**

Key questions:
1. Does Neon serverless driver support connection pooling? (Yes — `@neondatabase/serverless` uses HTTP, no persistent connection)
2. Does each rate limit check require a DB round-trip? (Yes — but Neon HTTP is typically <50ms)
3. Is <50ms acceptable for rate limit checks? (Likely yes for current scale)

- [ ] **Step 2: Document the architecture decision**

If DatabaseStorage is sufficient, document why in a code comment at the storage factory.
If latency is a concern, create a Upstash Redis adapter implementing the Storage interface.

- [ ] **Step 3: Commit decision**

```bash
git commit -m "docs(auth): document rate limit storage architecture decision"
```

---

### Task 8: Add Global Auth Configuration Functions

**Files:**
- Modify: `packages/auth/src/server/rate-limit.ts`
- Modify: `packages/auth/src/server/brute-force.ts`
- Create: `packages/auth/src/server/__tests__/config.test.ts`

- [ ] **Step 1: Write failing tests for configureRateLimit/configureBruteForce**

```typescript
describe('configureRateLimit', () => {
  it('should override default config', () => {
    configureRateLimit({ maxAttempts: 10, windowMs: 60_000 });
    // Verify subsequent calls use new config
  });

  it('should merge partial overrides with defaults', () => {
    configureRateLimit({ maxAttempts: 3 });
    // windowMs should still be default
  });
});
```

- [ ] **Step 2: Implement configureRateLimit and configureBruteForce**

Follow parameterization pattern from `.claude/rules/parameterization.md`:
```typescript
export function configureRateLimit(overrides: Partial<RateLimitConfig>): void {
  config = { ...DEFAULT_CONFIG, ...overrides };
}
```

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/server/rate-limit.ts packages/auth/src/server/brute-force.ts packages/auth/src/server/__tests__/config.test.ts
git commit -m "feat(auth): add global configureRateLimit/configureBruteForce per parameterization convention"
```

---

## Phase C: Quick Fixes

### Task 9: Fix Contents Collection Empty Blocks

**Files:**
- Modify: `apps/cms/src/lib/collections/Contents/index.ts`

- [ ] **Step 1: Add block imports and populate blocks array**

Import all available block configs:
```typescript
import { ArchiveBlock } from '../../blocks/ArchiveBlock/config';
import { Banner } from '../../blocks/Banner/config';
import { CallToAction } from '../../blocks/CallToAction/config';
import { Code } from '../../blocks/Code/config';
import { Content } from '../../blocks/Content/config';
import { FormBlock } from '../../blocks/Form/config';
import { MediaBlock } from '../../blocks/MediaBlock/config';
import { PageContent } from '../../blocks/PageContent';
import { PageList } from '../../blocks/PageList';
import { SiteTitle } from '../../blocks/SiteTitle';
import { StatsBlock } from '../../blocks/StatsBlock/config';
```

Update: `blocks: [ArchiveBlock, Banner, CallToAction, Code, Content, FormBlock, MediaBlock, PageContent, PageList, SiteTitle, StatsBlock]`

Note: ReusableContent references Contents (circular), so exclude it.

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter cms typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/cms/src/lib/collections/Contents/index.ts
git commit -m "fix(cms): populate Contents collection blocks array"
```

---

### Task 10: Fix PageList Block sortBy Options

**Files:**
- Modify: `apps/cms/src/lib/blocks/PageList/index.ts`

- [ ] **Step 1: Add sortBy options and document filterBy status**

```typescript
{
  name: 'sortBy',
  type: 'select',
  options: [
    { label: 'Title', value: 'title' },
    { label: 'Created At', value: 'createdAt' },
    { label: 'Updated At', value: 'updatedAt' },
  ],
}
```

Update filterByCategories/filterByTags comment to clarify current state:
```typescript
// Note: filterByCategories and filterByTags currently reference 'pages'
// as placeholder. Update relationTo when Categories/Tags collections are created.
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter cms typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/cms/src/lib/blocks/PageList/index.ts
git commit -m "fix(cms): add PageList sortBy options, document filterBy placeholder"
```

---

## Phase D: Positioning (No Code)

### Task 11: Reposition @revealui/router

- [ ] **Step 1: Update package.json description**

Change description to indicate it's a lightweight internal routing utility, not a full-featured router.

- [ ] **Step 2: Commit**

```bash
git add packages/router/package.json
git commit -m "docs(router): clarify as lightweight internal routing utility"
```

---

## Verification

After completing all phases:

- [ ] Run `pnpm gate` — full CI gate must pass
- [ ] Run `pnpm test` — all tests must pass
- [ ] Run `pnpm typecheck:all` — no type errors
- [ ] Verify @revealui/services has 40+ test cases
- [ ] Verify @revealui/mcp has 15+ test cases
- [ ] Verify Contents collection blocks are populated
- [ ] Verify PageList sortBy has options
