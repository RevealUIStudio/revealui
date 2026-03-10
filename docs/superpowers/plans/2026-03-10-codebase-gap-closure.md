# Codebase Gap Closure Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all critical, high, and medium gaps identified by the exhaustive 7-agent codebase audit before public launch.

**Architecture:** Four sequential phases (A-D) ordered by blast radius. Phase A fixes data integrity and security issues in the API and DB layers. Phase B replaces placeholder tests with real assertions and adds missing test coverage. Phase C completes unfinished implementations and aligns contracts. Phase D addresses accessibility and UX gaps in the presentation layer.

**Tech Stack:** Drizzle ORM (schema + migrations), Hono (API middleware), Zod (validation), Vitest (testing), React 19 (components), Tailwind v4 (styling)

---

## File Map

### Phase A — Security & Data Integrity

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/db/src/schema/agents.ts` | Add indexes to agentMemories, composite PK to agentTaskUsage, NOT NULL on siteId |
| Modify | `packages/db/src/schema/sites.ts` | Add UNIQUE constraint on slug |
| Modify | `packages/db/src/schema/pages.ts` | Add index on parentId |
| Modify | `packages/db/src/schema/tickets.ts` | Add indexes on parentTicketId, reporterId |
| Modify | `packages/db/src/schema/rag.ts` | Add index on ragChunks.documentId, workspaceId |
| Create | `packages/db/migrations/0019_schema_hardening.sql` | Migration for all schema changes |
| Modify | `apps/api/src/routes/billing.ts` | Add Stripe idempotency key to prevent duplicate customers |
| Modify | `apps/api/src/routes/gdpr.ts` | Add admin role check on /admin/stats |
| Modify | `apps/api/src/routes/terminal-auth.ts` | Timing-safe OTP comparison |
| Modify | `apps/api/src/routes/content.ts` | Slug validation regex, fix pagination defaults |
| Modify | `packages/db/drizzle.config.neon.ts` | Fix schema path |
| Modify | `packages/db/drizzle.config.supabase.ts` | Fix schema path |

### Phase B — Test Integrity

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/core/src/__tests__/integration/error-handling.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `packages/core/src/__tests__/richtext-integration.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `packages/core/src/database/__tests__/universal-postgres.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `packages/core/src/error-handling/__tests__/error-handling.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `packages/core/src/types/__tests__/type-inference-problem-cases.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `packages/router/src/__tests__/router.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `packages/test/src/placeholder.test.ts` | Replace `expect(true).toBe(true)` |
| Modify | `e2e/error-scenarios.e2e.ts` | Replace `expect(true).toBe(true)` |
| Create | `apps/api/src/routes/__tests__/content-xss.test.ts` | XSS/injection tests for content API |
| Create | `packages/cli/src/generators/__tests__/readme.test.ts` | Generator tests |
| Create | `packages/cli/src/generators/__tests__/devbox.test.ts` | Generator tests |
| Create | `packages/cli/src/generators/__tests__/devcontainer.test.ts` | Generator tests |
| Create | `packages/cli/src/prompts/__tests__/prompts.test.ts` | Prompt function tests |
| Create | `packages/cli/src/installers/__tests__/installers.test.ts` | Installer tests |

### Phase C — Code Completion

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `apps/cms/src/lib/hooks/useChat.ts` | Fix SpeechRecognition instance management |
| Modify | `apps/cms/src/lib/components/AdminBar/index.tsx` | Add AbortController to fetch |
| Modify | `packages/contracts/src/entities/product.ts` | Remove .passthrough(), add explicit fields |
| Modify | `packages/contracts/src/entities/price.ts` | Remove .passthrough(), add explicit fields |
| Modify | `packages/contracts/src/entities/user.ts` | Add SESSION_SCHEMA_VERSION |
| Modify | `packages/core/src/api/rate-limit.ts` | Add configureRateLimits() function |
| Modify | `packages/core/src/license.ts` | Add TTL to license cache |
| Modify | `apps/api/src/routes/a2a.ts` | Unify provider list with contracts |
| Create | `packages/contracts/src/providers.ts` | Shared LLM provider list |
| Delete code | `apps/cms/src/lib/features/largeBody/plugins/LargeBodyPlugin.tsx` | Remove commented-out code |

### Phase D — Accessibility & UX

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/presentation/src/components/Pagination.tsx` | Add ARIA attributes |
| Modify | `packages/presentation/src/components/progress.tsx` | Add role, aria-value* |
| Modify | `packages/presentation/src/components/rating.tsx` | Add aria-label on stars |
| Modify | `packages/presentation/src/components/slider.tsx` | Add role, aria-value* |
| Modify | `packages/presentation/src/components/stepper.tsx` | Add aria-current |
| Modify | `packages/presentation/src/components/tooltip.tsx` | Add keyboard support |

---

## Chunk 1: Phase A — Security & Data Integrity

### Task A1: Add DB indexes and constraints to agentMemories

**Files:**
- Modify: `packages/db/src/schema/agents.ts:10-15` (imports), `:75-118` (agentMemories table), `:312-330` (agentTaskUsage table)

- [ ] **Step 1: Add index import and agentMemories indexes + siteId NOT NULL**

In `packages/db/src/schema/agents.ts`, add `index` to the import from `drizzle-orm/pg-core` and add a third argument to `pgTable` for indexes. Also make `siteId` NOT NULL:

```typescript
// In the import statement, add 'index' and 'primaryKey':
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
```

Change `siteId` in agentMemories from:
```typescript
siteId: text('site_id').references(() => sites.id, { onDelete: 'cascade' }),
```
to:
```typescript
siteId: text('site_id').notNull().references(() => sites.id, { onDelete: 'cascade' }),
```

Add the third argument to the `pgTable` call for `agentMemories`:
```typescript
export const agentMemories = pgTable(
  'agent_memories',
  {
    // ... existing columns unchanged ...
  },
  (table) => [
    index('agent_memories_site_id_idx').on(table.siteId),
    index('agent_memories_agent_id_idx').on(table.agentId),
    index('agent_memories_verified_idx').on(table.verified),
    index('agent_memories_expires_at_idx').on(table.expiresAt),
    index('agent_memories_type_idx').on(table.type),
  ],
)
```

- [ ] **Step 2: Add composite primary key to agentTaskUsage**

Change the `agentTaskUsage` table definition to use a composite primary key instead of relying on Drizzle auto-generation. Remove `.primaryKey()` from any column and add a third argument:

```typescript
export const agentTaskUsage = pgTable(
  'agent_task_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cycleStart: timestamp('cycle_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    overage: integer('overage').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cycleStart] }),
  ],
)
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @revealui/db typecheck`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/agents.ts
git commit -m "fix(db): add indexes to agentMemories, composite PK to agentTaskUsage, siteId NOT NULL"
```

---

### Task A2: Add UNIQUE constraint to sites.slug

**Files:**
- Modify: `packages/db/src/schema/sites.ts:29`

- [ ] **Step 1: Add unique import and constraint**

In `packages/db/src/schema/sites.ts`, add `uniqueIndex` to the import from `drizzle-orm/pg-core`.

Change `slug` from:
```typescript
slug: text('slug').notNull(),
```
to:
```typescript
slug: text('slug').notNull().unique(),
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @revealui/db typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/sites.ts
git commit -m "fix(db): add UNIQUE constraint to sites.slug"
```

---

### Task A3: Add missing FK indexes across schema

**Files:**
- Modify: `packages/db/src/schema/tickets.ts:179-182` (add parentTicketId, reporterId indexes)
- Modify: `packages/db/src/schema/pages.ts` (add parentId index)
- Modify: `packages/db/src/schema/rag.ts` (add documentId, workspaceId indexes)

- [ ] **Step 1: Add parentTicketId and reporterId indexes to tickets**

In `packages/db/src/schema/tickets.ts`, in the third argument of the `tickets` pgTable (the existing `(table) => [...]` block around line 179), add two more indexes:

```typescript
(table) => [
  index('tickets_board_id_idx').on(table.boardId),
  index('tickets_assignee_id_idx').on(table.assigneeId),
  index('tickets_parent_ticket_id_idx').on(table.parentTicketId),
  index('tickets_reporter_id_idx').on(table.reporterId),
],
```

- [ ] **Step 2: Add parentId index to pages**

In `packages/db/src/schema/pages.ts`, add `index` to the import and add a third argument to the `pages` pgTable call:

```typescript
(table) => [
  index('pages_parent_id_idx').on(table.parentId),
  index('pages_site_id_idx').on(table.siteId),
],
```

- [ ] **Step 3: Add documentId and workspaceId indexes to ragChunks**

In `packages/db/src/schema/rag.ts`, the `ragChunks` table — add a third argument:

```typescript
(table) => [
  index('rag_chunks_document_id_idx').on(table.documentId),
  index('rag_chunks_workspace_id_idx').on(table.workspaceId),
],
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter @revealui/db typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/tickets.ts packages/db/src/schema/pages.ts packages/db/src/schema/rag.ts
git commit -m "fix(db): add missing FK indexes on tickets, pages, ragChunks"
```

---

### Task A4: Fix Stripe customer race condition

**Files:**
- Modify: `apps/api/src/routes/billing.ts:120-155` (ensureStripeCustomer)

- [ ] **Step 1: Add Stripe idempotency key**

In the `ensureStripeCustomer` function, change the `stripe.customers.create()` call to include an idempotency key based on the userId. This ensures that concurrent requests for the same user only create one Stripe customer:

Change:
```typescript
const customer = await stripe.customers.create({
  email,
  metadata: { revealui_user_id: userId },
})
```
to:
```typescript
const customer = await stripe.customers.create(
  {
    email,
    metadata: { revealui_user_id: userId },
  },
  {
    idempotencyKey: `create-customer-${userId}`,
  },
)
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/billing.ts
git commit -m "fix(billing): add idempotency key to Stripe customer creation to prevent race condition"
```

---

### Task A5: Add admin role check to GDPR stats endpoint

**Files:**
- Modify: `apps/api/src/routes/gdpr.ts:219-223`

- [ ] **Step 1: Add role check to admin/stats**

The GDPR routes are already behind `authMiddleware({ required: true })` via `writeProtected` in `index.ts`, but the admin stats endpoint needs an explicit role check. Add the user role validation:

Change:
```typescript
app.get('/admin/stats', async (c) => {
  const stats = await consentManager.getStatistics()

  return c.json({ success: true, stats })
})
```
to:
```typescript
app.get('/admin/stats', async (c) => {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ success: false, error: 'Admin access required' }, 403)
  }

  const stats = await consentManager.getStatistics()

  return c.json({ success: true, stats })
})
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/gdpr.ts
git commit -m "fix(gdpr): require admin role for consent statistics endpoint"
```

---

### Task A6: Timing-safe OTP comparison in terminal-auth

**Files:**
- Modify: `apps/api/src/routes/terminal-auth.ts:193`

- [ ] **Step 1: Add timing-safe comparison**

Add `timingSafeEqual` import at the top of the file:
```typescript
import { timingSafeEqual } from 'node:crypto'
```

Change the OTP comparison from:
```typescript
if (pending.code !== code) {
  return c.json({ success: false, error: 'Invalid verification code' }, 400)
}
```
to:
```typescript
const codeMatch =
  pending.code.length === code.length &&
  timingSafeEqual(Buffer.from(pending.code), Buffer.from(code))
if (!codeMatch) {
  return c.json({ success: false, error: 'Invalid verification code' }, 400)
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/terminal-auth.ts
git commit -m "fix(security): use timing-safe comparison for OTP verification"
```

---

### Task A7: Add slug validation regex to content routes

**Files:**
- Modify: `apps/api/src/routes/content.ts` (all slug fields in request schemas)

- [ ] **Step 1: Define slug regex constant and apply to all slug fields**

Near the top of `content.ts` (after imports, before schemas), add:
```typescript
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SlugField = z.string().min(1).max(200).regex(SLUG_PATTERN, 'Slug must be lowercase alphanumeric with hyphens only')
```

Then replace every `slug: z.string().min(1).max(200)` in request body schemas with `slug: SlugField`. This applies to:
- Create post body (~line 215)
- Update post body (~line 331)
- Create site body (~line 621)
- Update site body (~line 701)
- Create page body (~line 837)
- Update page body (~line 932)

Do NOT change response schemas — only request/input schemas.

- [ ] **Step 2: Fix pagination defaults**

Change:
```typescript
const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
})
```
to:
```typescript
const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})
```

Remove `.optional()` — `.default()` already handles the missing case.

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/content.ts
git commit -m "fix(api): validate slug format, fix pagination defaults"
```

---

### Task A8: Fix Drizzle config paths

**Files:**
- Modify: `packages/db/drizzle.config.neon.ts:22`
- Modify: `packages/db/drizzle.config.supabase.ts:22`

- [ ] **Step 1: Fix schema paths**

In `drizzle.config.neon.ts`, change:
```typescript
schema: './src/core/rest.ts',
```
to:
```typescript
schema: './src/schema/rest.ts',
```

In `drizzle.config.supabase.ts`, change:
```typescript
schema: './src/core/vector.ts',
```
to:
```typescript
schema: './src/schema/vector.ts',
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/drizzle.config.neon.ts packages/db/drizzle.config.supabase.ts
git commit -m "fix(db): correct schema paths in neon and supabase drizzle configs"
```

---

### Task A9: Generate migration for schema changes

**Files:**
- Create: `packages/db/migrations/0019_schema_hardening.sql`

- [ ] **Step 1: Generate migration**

Run: `cd packages/db && pnpm drizzle-kit generate`

This will auto-generate a migration SQL file for:
- agentMemories indexes (5 indexes)
- agentMemories.siteId NOT NULL
- agentTaskUsage composite PK
- sites.slug UNIQUE
- tickets parentTicketId + reporterId indexes
- pages parentId + siteId indexes
- ragChunks documentId + workspaceId indexes

- [ ] **Step 2: Review generated SQL**

Read the generated migration file. Verify it contains:
- `CREATE INDEX` statements for all new indexes
- `ALTER TABLE` for siteId NOT NULL (may need `SET NOT NULL`)
- `ALTER TABLE` for composite PK
- `CREATE UNIQUE INDEX` or `ADD CONSTRAINT` for sites.slug

- [ ] **Step 3: Commit**

```bash
git add packages/db/migrations/
git commit -m "chore(db): add migration for schema hardening (indexes, constraints, PKs)"
```

---

### Task A10: Run Phase A gate check

- [ ] **Step 1: Run quick gate**

Run: `pnpm gate:quick`
Expected: PASS on all Phase 1 checks (Biome, typecheck)

- [ ] **Step 2: Run API tests**

Run: `pnpm --filter api test`
Expected: PASS (no regressions)

- [ ] **Step 3: Run DB tests**

Run: `pnpm --filter @revealui/db test`
Expected: PASS

---

## Chunk 2: Phase B — Test Integrity

### Task B1: Replace tautological assertions in core packages

**Files:**
- Modify: `packages/core/src/__tests__/integration/error-handling.test.ts`
- Modify: `packages/core/src/__tests__/richtext-integration.test.ts`
- Modify: `packages/core/src/database/__tests__/universal-postgres.test.ts`
- Modify: `packages/core/src/error-handling/__tests__/error-handling.test.ts`
- Modify: `packages/core/src/types/__tests__/type-inference-problem-cases.test.ts`
- Modify: `packages/router/src/__tests__/router.test.ts`
- Modify: `packages/test/src/placeholder.test.ts`
- Modify: `e2e/error-scenarios.e2e.ts`

- [ ] **Step 1: Read each file to understand what was intended**

Read every file listed above. For each `expect(true).toBe(true)`, determine from context (test name, surrounding code, imports) what the test SHOULD assert.

- [ ] **Step 2: Replace each tautological assertion**

For each file, replace `expect(true).toBe(true)` with an assertion that actually tests the behavior described by the test name. Common patterns:

- If the test is "should handle error X" → actually call the function and `expect(result).toThrow()` or `expect(result.error).toBeDefined()`
- If the test is "should return Y" → call the function and `expect(result).toEqual(expectedValue)`
- If the test is a type-level test → use `expectTypeOf()` from vitest
- If the test is truly a placeholder with no implementation path → delete the test entirely rather than leave a false green

- [ ] **Step 3: Run tests to verify new assertions pass**

Run: `pnpm --filter @revealui/core test && pnpm --filter @revealui/router test`
Expected: PASS (or some may fail, revealing real bugs — fix those bugs)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: replace tautological assertions with real test logic"
```

---

### Task B2: Add XSS/injection tests for content API

**Files:**
- Create: `apps/api/src/routes/__tests__/content-xss.test.ts`

- [ ] **Step 1: Write XSS injection tests**

Create test file that validates the content API rejects or sanitizes malicious input:

```typescript
import { describe, expect, it } from 'vitest'

describe('Content API — XSS Prevention', () => {
  const XSS_PAYLOADS = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>alert(1)</script>',
  ]

  describe('POST body with script tags', () => {
    for (const payload of XSS_PAYLOADS) {
      it(`rejects or sanitizes: ${payload.slice(0, 30)}...`, async () => {
        // Test that the payload is either:
        // 1. Rejected with 400 (if validation catches it)
        // 2. Stored but HTML-escaped on retrieval
        // Implementation depends on how the content route handles content field
        // At minimum: verify the raw <script> tag is not returned verbatim in JSON response
      })
    }
  })

  describe('Slug field rejects injection', () => {
    it('rejects slug with HTML entities', async () => {
      // After Task A7, slug validation regex should reject these
    })
  })
})
```

The exact implementation depends on how content routes are tested elsewhere. Follow the pattern in existing `content.test.ts`.

- [ ] **Step 2: Run tests**

Run: `pnpm --filter api test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/__tests__/content-xss.test.ts
git commit -m "test(api): add XSS/injection prevention tests for content routes"
```

---

### Task B3: Add CLI generator and prompt tests

**Files:**
- Create: `packages/cli/src/generators/__tests__/generators.test.ts`
- Create: `packages/cli/src/prompts/__tests__/prompts.test.ts`
- Create: `packages/cli/src/installers/__tests__/installers.test.ts`

- [ ] **Step 1: Read generator source files to understand their API**

Read:
- `packages/cli/src/generators/readme.ts`
- `packages/cli/src/generators/devbox.ts`
- `packages/cli/src/generators/devcontainer.ts`

Understand: what each function takes as input, what it returns, any side effects (file writes).

- [ ] **Step 2: Write generator tests**

Test each generator function:
- Renders output containing expected sections
- Handles missing optional fields gracefully
- Does NOT throw on empty input
- Output is valid (e.g., readme is valid markdown, devbox is valid JSON/Nix)

- [ ] **Step 3: Read prompt source files**

Read:
- `packages/cli/src/prompts/devenv.ts`
- `packages/cli/src/prompts/database.ts`
- `packages/cli/src/prompts/project.ts`
- `packages/cli/src/prompts/payments.ts`
- `packages/cli/src/prompts/storage.ts`

- [ ] **Step 4: Write prompt tests**

Test prompt configuration objects:
- Each prompt has valid `type`, `name`, `message`
- Choices (if any) are non-empty arrays
- Default values are present where expected
- Validation functions (if any) accept valid input and reject invalid

- [ ] **Step 5: Read installer source files**

Read:
- `packages/cli/src/installers/database.ts`
- `packages/cli/src/installers/seed.ts`
- `packages/cli/src/installers/dependencies.ts`

- [ ] **Step 6: Write installer tests**

Test installer functions:
- Mock filesystem/execa calls
- Verify correct commands are invoked
- Verify error handling (what happens when install fails?)

- [ ] **Step 7: Run CLI tests**

Run: `pnpm --filter @revealui/cli test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/generators/__tests__/ packages/cli/src/prompts/__tests__/ packages/cli/src/installers/__tests__/
git commit -m "test(cli): add tests for generators, prompts, and installers"
```

---

### Task B4: Run Phase B gate check

- [ ] **Step 1: Run full test suite**

Run: `pnpm test`
Expected: PASS across all packages

- [ ] **Step 2: Commit any remaining fixes**

---

## Chunk 3: Phase C — Code Completion

### Task C1: Fix SpeechRecognition instance management in useChat

**Files:**
- Modify: `apps/cms/src/lib/hooks/useChat.ts:88-126`

- [ ] **Step 1: Read the full useChat hook**

Read: `apps/cms/src/lib/hooks/useChat.ts`

- [ ] **Step 2: Store SpeechRecognition in useRef**

Add a `useRef` for the recognition instance. Change `startVoiceRecognition` to store the instance, and `stopVoiceRecognition` to use the stored instance:

```typescript
const recognitionRef = useRef<SpeechRecognition | null>(null)

const startVoiceRecognition = useCallback(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return

  const recognition = new SpeechRecognition()
  recognitionRef.current = recognition
  // ... existing onresult/onerror/onend handlers ...
  recognition.start()
}, [])

const stopVoiceRecognition = useCallback(() => {
  if (recognitionRef.current) {
    recognitionRef.current.stop()
    recognitionRef.current = null
  }
  setIsListening(false)
}, [])
```

- [ ] **Step 3: Add cleanup on unmount**

In the hook's return/cleanup, add:
```typescript
useEffect(() => {
  return () => {
    recognitionRef.current?.stop()
  }
}, [])
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter cms typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/lib/hooks/useChat.ts
git commit -m "fix(cms): store SpeechRecognition in ref, fix stop/cleanup lifecycle"
```

---

### Task C2: Add AbortController to AdminBar fetch

**Files:**
- Modify: `apps/cms/src/lib/components/AdminBar/index.tsx:38-49`

- [ ] **Step 1: Read the AdminBar component**

Read: `apps/cms/src/lib/components/AdminBar/index.tsx`

- [ ] **Step 2: Add AbortController**

Wrap the fetch in an AbortController and return cleanup:

```typescript
useEffect(() => {
  const controller = new AbortController()
  fetch('/api/auth/me', { signal: controller.signal })
    .then((res) => res.json())
    .then((data) => { /* existing logic */ })
    .catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return
      /* existing catch logic */
    })
  return () => controller.abort()
}, [onAuthChange])
```

- [ ] **Step 3: Commit**

```bash
git add apps/cms/src/lib/components/AdminBar/index.tsx
git commit -m "fix(cms): add AbortController to AdminBar auth fetch"
```

---

### Task C3: Parameterize core rate limit presets

**Files:**
- Modify: `packages/core/src/api/rate-limit.ts:1-30`

- [ ] **Step 1: Read the full rate-limit.ts**

Read: `packages/core/src/api/rate-limit.ts`

- [ ] **Step 2: Add configurable preset system**

Add a configuration interface and override function per the parameterization rule:

```typescript
export interface RateLimitPresets {
  veryStrict: { windowMs: number; maxRequests: number }
  strict: { windowMs: number; maxRequests: number }
  standard: { windowMs: number; maxRequests: number }
  relaxed: { windowMs: number; maxRequests: number }
}

const DEFAULT_PRESETS: RateLimitPresets = {
  veryStrict: { windowMs: 60_000, maxRequests: 10 },
  strict: { windowMs: 60_000, maxRequests: 30 },
  standard: { windowMs: 60_000, maxRequests: 100 },
  relaxed: { windowMs: 60_000, maxRequests: 300 },
}

let presets: RateLimitPresets = { ...DEFAULT_PRESETS }

export function configureRateLimits(overrides: Partial<RateLimitPresets>): void {
  presets = { ...DEFAULT_PRESETS, ...overrides }
}

export function getRateLimitPresets(): Readonly<RateLimitPresets> {
  return presets
}
```

Update existing code that reads from the hardcoded presets to use `presets` variable instead.

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @revealui/core typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/api/rate-limit.ts
git commit -m "feat(core): parameterize rate limit presets with configureRateLimits()"
```

---

### Task C4: Add TTL to license cache

**Files:**
- Modify: `packages/core/src/license.ts:48-52`

- [ ] **Step 1: Read the full license.ts**

Read: `packages/core/src/license.ts`

- [ ] **Step 2: Add cache TTL**

Add a `cachedAt` timestamp alongside `cachedState`. In the getter, check if the cache is older than 24 hours and re-validate if so:

```typescript
interface LicenseCacheConfig {
  /** Cache TTL in milliseconds (default: 24 hours) */
  ttlMs: number
}

const DEFAULT_CACHE_CONFIG: LicenseCacheConfig = {
  ttlMs: 24 * 60 * 60 * 1000,
}

let cacheConfig = { ...DEFAULT_CACHE_CONFIG }
let cachedAt = 0

export function configureLicenseCache(overrides: Partial<LicenseCacheConfig>): void {
  cacheConfig = { ...DEFAULT_CACHE_CONFIG, ...overrides }
}
```

In the license state getter, add staleness check:
```typescript
if (cachedState && Date.now() - cachedAt > cacheConfig.ttlMs) {
  cachedState = null // Force re-validation on next access
}
```

Update `initializeLicense()` to set `cachedAt = Date.now()`.

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @revealui/core typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/license.ts
git commit -m "feat(core): add 24h TTL to license validation cache"
```

---

### Task C5: Remove .passthrough() from Stripe contract schemas

**Files:**
- Modify: `packages/contracts/src/entities/product.ts:109,158,164`
- Modify: `packages/contracts/src/entities/price.ts:106`

- [ ] **Step 1: Read both files**

Read: `packages/contracts/src/entities/product.ts` and `packages/contracts/src/entities/price.ts`

- [ ] **Step 2: Replace .passthrough() with explicit schemas or .strip()**

For `ProductBlockSchema` and `PriceBlockSchema`, remove `.passthrough()` and use `.strip()` (discard unknown keys) instead:

```typescript
// Before:
export const ProductBlockSchema = z.object({ blockType: ..., blockName: ... }).passthrough()
// After:
export const ProductBlockSchema = z.object({ blockType: ..., blockName: ..., data: z.record(z.string(), z.unknown()).optional() })
```

For category/relationship union types, replace `z.object({}).passthrough()` with a minimum viable shape:
```typescript
// Before:
z.union([z.number().int().positive(), z.object({}).passthrough()])
// After:
z.union([z.number().int().positive(), z.object({ id: z.number(), name: z.string().optional() }).passthrough()])
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @revealui/contracts typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/entities/product.ts packages/contracts/src/entities/price.ts
git commit -m "fix(contracts): remove loose .passthrough() from Stripe schemas, add explicit fields"
```

---

### Task C6: Unify LLM provider list + delete dead code

**Files:**
- Create: `packages/contracts/src/providers.ts`
- Modify: `packages/contracts/src/index.ts` (add export)
- Modify: `apps/api/src/routes/a2a.ts:75` (import from contracts)
- Modify: `apps/api/src/routes/api-keys.ts` (import from contracts)
- Modify: `apps/cms/src/lib/features/largeBody/plugins/LargeBodyPlugin.tsx` (delete commented code)

- [ ] **Step 1: Create shared provider constant**

Create `packages/contracts/src/providers.ts`:
```typescript
/** Supported LLM providers across the platform. Single source of truth. */
export const LLM_PROVIDERS = ['openai', 'anthropic', 'groq', 'ollama', 'huggingface', 'vultr'] as const
export type LLMProvider = (typeof LLM_PROVIDERS)[number]
```

- [ ] **Step 2: Export from contracts index**

Add to `packages/contracts/src/index.ts`:
```typescript
export { LLM_PROVIDERS, type LLMProvider } from './providers.js'
```

- [ ] **Step 3: Update a2a.ts and api-keys.ts to use shared constant**

Replace local `VALID_PROVIDERS` / `ALLOWED_PROVIDERS` with import from contracts.

- [ ] **Step 4: Delete commented-out code in LargeBodyPlugin**

Remove the 40+ lines of commented-out code.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @revealui/contracts typecheck && pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/providers.ts packages/contracts/src/index.ts apps/api/src/routes/a2a.ts apps/api/src/routes/api-keys.ts apps/cms/src/lib/features/largeBody/plugins/LargeBodyPlugin.tsx
git commit -m "refactor: unify LLM provider list in contracts, delete dead code"
```

---

### Task C7: Add SESSION_SCHEMA_VERSION constant

**Files:**
- Modify: `packages/contracts/src/entities/user.ts`

- [ ] **Step 1: Add constant and fix usage**

Add near the top (alongside `USER_SCHEMA_VERSION`):
```typescript
export const SESSION_SCHEMA_VERSION = 1
```

Find the session schema `version` field and change from `USER_SCHEMA_VERSION` to `SESSION_SCHEMA_VERSION`.

- [ ] **Step 2: Export from entities index**

Add `SESSION_SCHEMA_VERSION` to `packages/contracts/src/entities/index.ts` exports.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/entities/user.ts packages/contracts/src/entities/index.ts
git commit -m "fix(contracts): add SESSION_SCHEMA_VERSION, fix session version field"
```

---

### Task C8: Run Phase C gate check

- [ ] **Step 1: Run gate:quick**

Run: `pnpm gate:quick`
Expected: PASS

- [ ] **Step 2: Run full tests**

Run: `pnpm test`
Expected: PASS

---

## Chunk 4: Phase D — Accessibility & UX

### Task D1: Add ARIA attributes to presentation components

**Files:**
- Modify: `packages/presentation/src/components/Pagination.tsx`
- Modify: `packages/presentation/src/components/progress.tsx`
- Modify: `packages/presentation/src/components/rating.tsx`
- Modify: `packages/presentation/src/components/slider.tsx`
- Modify: `packages/presentation/src/components/stepper.tsx`

- [ ] **Step 1: Read each component**

Read all 5 files to understand current markup.

- [ ] **Step 2: Add ARIA to Pagination**

- Add `aria-label="Pagination"` to nav wrapper
- Add `aria-current="page"` to active page button
- Add `aria-disabled="true"` to disabled prev/next buttons
- Add `aria-label="Page N"` to each page button
- Add `aria-label="Previous page"` and `aria-label="Next page"` to nav buttons

- [ ] **Step 3: Add ARIA to Progress**

- Add `role="progressbar"` to the progress track
- Add `aria-valuenow={value}`, `aria-valuemin={0}`, `aria-valuemax={max}`
- Add `aria-label` prop (or use existing label)

- [ ] **Step 4: Add ARIA to Rating**

- Add `role="radiogroup"` to the container
- Add `aria-label="Rating"` to the container
- Add `role="radio"` and `aria-checked={isSelected}` to each star
- Add `aria-label={`${n} star${n > 1 ? 's' : ''}`}` to each star button

- [ ] **Step 5: Add ARIA to Slider**

- Add `role="slider"` to the thumb element
- Add `aria-valuenow={value}`, `aria-valuemin={min}`, `aria-valuemax={max}`
- Add `aria-label` prop support

- [ ] **Step 6: Add ARIA to Stepper**

- Add `aria-current="step"` to the active step
- Add `aria-label={`Step ${index + 1} of ${total}`}` to each step

- [ ] **Step 7: Verify build passes**

Run: `pnpm --filter @revealui/presentation build`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/presentation/src/components/Pagination.tsx packages/presentation/src/components/progress.tsx packages/presentation/src/components/rating.tsx packages/presentation/src/components/slider.tsx packages/presentation/src/components/stepper.tsx
git commit -m "fix(a11y): add ARIA attributes to Pagination, Progress, Rating, Slider, Stepper"
```

---

### Task D2: Add keyboard support to Tooltip

**Files:**
- Modify: `packages/presentation/src/components/tooltip.tsx`

- [ ] **Step 1: Read tooltip.tsx**

Read: `packages/presentation/src/components/tooltip.tsx`

- [ ] **Step 2: Add focus/blur handlers + cleanup**

Add `onFocus` and `onBlur` handlers alongside mouse events:

```typescript
<span
  className="relative inline-flex"
  onMouseEnter={show}
  onMouseLeave={hide}
  onFocus={show}
  onBlur={hide}
>
```

Add unmount cleanup for the timeout:
```typescript
useEffect(() => {
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }
}, [])
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @revealui/presentation build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/presentation/src/components/tooltip.tsx
git commit -m "fix(a11y): add keyboard focus support and unmount cleanup to Tooltip"
```

---

### Task D3: Run final gate

- [ ] **Step 1: Run full gate**

Run: `pnpm gate`
Expected: PASS all 3 phases

- [ ] **Step 2: Run presentation build**

Run: `pnpm --filter @revealui/presentation build`
Expected: PASS

- [ ] **Step 3: Final commit if any cleanup needed**
