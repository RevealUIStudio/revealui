# Wave 2: Medium Effort Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email verification enforcement to signIn() and split two god files (tickets.ts 1,259 LOC → 5 files, content.ts 1,059 LOC → 4 files) into focused route modules.

**Architecture:** Task 1 adds a single check to signIn() with a 24h grace period for new accounts. Tasks 2-3 extract route handlers from god files into per-resource modules while keeping the same Hono app export (no changes to index.ts registration). Shared helpers go into `routes/_helpers/`.

**Tech Stack:** TypeScript 5.9, Hono (OpenAPIHono), Vitest 4, Drizzle ORM, bcryptjs

**Spec:** `docs/superpowers/specs/2026-03-16-remaining-work-execution-design.md` — Wave 2

---

## Task 1: Email Verification Enforcement in signIn() (R3-I10)

**Files:**
- Modify: `packages/auth/src/server/auth.ts` (signIn function — add emailVerified check after password validation)
- Test: `packages/auth/src/server/__tests__/auth.test.ts` (add email verification test cases)

**Context for implementer:**
- Wave 1 already added the `email_not_verified` reason code to the `SignInResult` discriminated union. This task makes it reachable.
- The `signIn()` function validates password, then clears failed attempts, then checks MFA, then creates session. The email verification check goes **after clearing failed attempts** (line ~136) and **before the MFA check** (line ~139). This is intentional — a correct password should clear brute-force lockout even if email isn't verified.
- **Grace period:** Allow sign-in for 24h after `user.createdAt`. This prevents blocking users who signed up moments ago and haven't checked email yet. Use `Date.now() - user.createdAt.getTime() > 24 * 60 * 60 * 1000` to check.
- The `User` type already has `emailVerified: boolean`, `emailVerifiedAt: Date | null`, and `createdAt: Date`.
- Resend-verification endpoint at `apps/cms/src/app/api/auth/resend-verification/route.ts` already works — no changes needed there.
- **Parameterization rule applies:** Extract the 24h grace period as a named constant.
- Test file uses `vi.mock()` for all deps and a `makeUser()` helper for fixtures. Follow the exact same pattern.

- [ ] **Step 1: Add grace period constant and email verification check to signIn()**

In `packages/auth/src/server/auth.ts`, add a constant near the top of the file (after imports):

```typescript
/** Grace period after signup during which unverified users can still sign in (24 hours) */
const EMAIL_VERIFICATION_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
```

Then, in `signIn()`, find the line `await clearFailedAttempts(email);` and add the email verification check **after** it and **before** the MFA check (`if (user.mfaEnabled)`):

```typescript
    // Successful login - clear failed attempts
    await clearFailedAttempts(email);

    // Check email verification (with grace period for new accounts)
    if (!user.emailVerified) {
      const accountAge = Date.now() - user.createdAt.getTime();
      if (accountAge > EMAIL_VERIFICATION_GRACE_PERIOD_MS) {
        return {
          success: false,
          reason: 'email_not_verified',
          error: 'Please verify your email address before signing in.',
        };
      }
    }

    // Check if MFA is enabled...
```

- [ ] **Step 2: Add tests for email verification enforcement**

In `packages/auth/src/server/__tests__/auth.test.ts`, add these test cases inside the `signIn` describe block. Use the existing `makeUser()` helper and mock patterns:

```typescript
    it('returns email_not_verified for unverified account past grace period', async () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
      mockLimit.mockResolvedValueOnce([makeUser({ emailVerified: false, createdAt: oldDate })]);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await signIn('test@example.com', 'Password123');
      expect(result).toEqual({
        success: false,
        reason: 'email_not_verified',
        error: expect.stringContaining('verify your email'),
      });
    });

    it('allows sign-in for unverified account within grace period', async () => {
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1h ago
      mockLimit.mockResolvedValueOnce([makeUser({ emailVerified: false, createdAt: recentDate })]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockCreateSession.mockResolvedValueOnce({ token: 'session-token-123' });

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
    });

    it('allows sign-in for verified account regardless of age', async () => {
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30d ago
      mockLimit.mockResolvedValueOnce([makeUser({ emailVerified: true, createdAt: oldDate })]);
      mockBcryptCompare.mockResolvedValueOnce(true);
      mockCreateSession.mockResolvedValueOnce({ token: 'session-token-123' });

      const result = await signIn('test@example.com', 'Password123');
      expect(result.success).toBe(true);
    });
```

Note: `makeUser()` must support `emailVerified` and `createdAt` overrides. Check the existing helper — if it doesn't pass these through, update it to accept all User fields as overrides.

- [ ] **Step 3: Run tests and typecheck**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter @revealui/auth typecheck
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter @revealui/auth test
```

Expected: all pass including new tests.

- [ ] **Step 4: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 add packages/auth/src/server/auth.ts packages/auth/src/server/__tests__/auth.test.ts
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 commit -m "feat(auth): enforce email verification in signIn with 24h grace period (R3-I10)"
```

---

## Task 2: Split tickets.ts God File (R3-L12)

**Files:**
- Create: `apps/api/src/routes/_helpers/access.ts` (shared access assertion helpers)
- Create: `apps/api/src/routes/tickets/boards.ts` (board CRUD — ~190 LOC)
- Create: `apps/api/src/routes/tickets/columns.ts` (board column CRUD — ~170 LOC)
- Create: `apps/api/src/routes/tickets/tickets.ts` (ticket CRUD + move + subtasks — ~300 LOC)
- Create: `apps/api/src/routes/tickets/comments.ts` (ticket comment CRUD — ~160 LOC)
- Create: `apps/api/src/routes/tickets/labels.ts` (label CRUD + assignment — ~270 LOC)
- Create: `apps/api/src/routes/tickets/index.ts` (compose all sub-routes into single export)
- Delete: `apps/api/src/routes/tickets.ts` (original god file)
- Test: `apps/api/src/routes/__tests__/tickets.test.ts` (existing — must still pass unchanged)

**Context for implementer:**
- The current `tickets.ts` (1,259 LOC) contains 5 resources: boards, columns, tickets, comments, labels. Each has its own CRUD handlers.
- The file exports a single `OpenAPIHono` app registered at `/api/tickets` in `apps/api/src/index.ts` (lines 35, 454, 475). The import path is `./routes/tickets.js`. After the split, `apps/api/src/routes/tickets/index.ts` must provide the SAME default export so `index.ts` needs NO changes.
- Three helper functions at the top of the file (`assertBoardTenantAccess`, `assertBoardAccess`, `assertTicketAccess`) are shared across resources. Extract these to `routes/_helpers/access.ts`.
- **Import pattern:** The file uses `@hono/zod-openapi`, `@revealui/contracts/entities`, `@revealui/db/client`, `@revealui/db/queries/*`, and `hono/http-exception`.
- **Variables type:** `{ db: DatabaseClient; tenant?: { id: string }; user?: { id: string; role: string } }` — define this once in the index file or _helpers.
- **Route structure:** Each sub-file creates its own `OpenAPIHono<{ Variables: Variables }>()`, defines routes, and exports it. The index file composes them with `app.route('/', boardsRoute)` etc.
- **Critical:** The existing test file at `apps/api/src/routes/__tests__/tickets.test.ts` must pass WITHOUT changes. This is a pure refactor — no behavior changes.

- [ ] **Step 1: Create shared helpers**

Create `apps/api/src/routes/_helpers/access.ts`:

Read `tickets.ts` lines 1-80 to extract the Variables type definition and the three `assert*` helper functions. The actual function signatures are:

```typescript
// These functions take a Hono context-like object and perform their own DB lookups internally
assertBoardAccess(db: DatabaseClient, boardId: string, c: { get: (key: string) => unknown })
assertTicketAccess(db: DatabaseClient, ticketId: string, c: { get: (key: string) => unknown })
```

**Important:** These helpers fetch board/ticket data internally from the DB — they are NOT passed pre-fetched entities. Copy the exact implementations from the source file. The file should also export the `Variables` type used by all ticket route files.

- [ ] **Step 2: Create tickets/boards.ts**

Extract board CRUD handlers (GET /boards, POST /boards, GET /boards/:id, PATCH /boards/:id, DELETE /boards/:id) from tickets.ts lines ~180-366.

Create a new OpenAPIHono app, define the board routes, import helpers from `../_helpers/access.js`. Export default.

- [ ] **Step 3: Create tickets/columns.ts**

Extract column CRUD handlers (GET /boards/:boardId/columns, POST /boards/:boardId/columns, PATCH /columns/:id, DELETE /columns/:id) from tickets.ts lines ~368-531.

- [ ] **Step 4: Create tickets/tickets.ts**

Extract ticket CRUD + move + subtasks handlers from tickets.ts lines ~533-826.

- [ ] **Step 5: Create tickets/comments.ts**

Extract comment CRUD handlers from tickets.ts lines ~828-987.

- [ ] **Step 6: Create tickets/labels.ts**

Extract label CRUD + ticket-label assignment handlers from tickets.ts lines ~989-1257.

- [ ] **Step 7: Create tickets/index.ts**

Compose all sub-route files into a single export:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Variables } from '../_helpers/access.js';
import boardsRoute from './boards.js';
import columnsRoute from './columns.js';
import commentsRoute from './comments.js';
import labelsRoute from './labels.js';
import ticketsRoute from './tickets.js';

const app = new OpenAPIHono<{ Variables: Variables }>();

app.route('/', boardsRoute);
app.route('/', columnsRoute);
app.route('/', ticketsRoute);
app.route('/', commentsRoute);
app.route('/', labelsRoute);

export default app;
```

- [ ] **Step 8: Delete original tickets.ts**

Remove `apps/api/src/routes/tickets.ts`.

- [ ] **Step 9: Run tests and typecheck**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter api typecheck
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter api test
```

Expected: all existing ticket tests pass unchanged.

- [ ] **Step 10: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 add apps/api/src/routes/
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 commit -m "refactor(api): split tickets.ts (1,259 LOC) into 5 focused route modules (R3-L12)"
```

---

## Task 3: Split content.ts God File (R3-L12)

**Files:**
- Create: `apps/api/src/routes/content/posts.ts` (post CRUD + slug lookup — ~280 LOC)
- Create: `apps/api/src/routes/content/media.ts` (media CRUD — ~160 LOC)
- Create: `apps/api/src/routes/content/sites.ts` (site CRUD — ~210 LOC)
- Create: `apps/api/src/routes/content/pages.ts` (page CRUD — ~270 LOC)
- Create: `apps/api/src/routes/content/index.ts` (compose all sub-routes)
- Delete: `apps/api/src/routes/content.ts` (original god file)
- Test: `apps/api/src/routes/__tests__/content.test.ts` (existing — must still pass unchanged)

**Context for implementer:**
- Same pattern as Task 2. The current `content.ts` (1,059 LOC) contains 4 resources: posts, media, sites, pages.
- Exported as default OpenAPIHono app, registered at `/api/content` in index.ts (lines 35, 457, 478).
- **Variables type:** `{ db: DatabaseClient; user?: { id: string; role: string } }` — note: NO tenant context (unlike tickets).
- **Shared patterns within the file:**
  - `PaginationQuery` Zod schema (used by posts, media, sites, pages)
  - `SLUG_PATTERN` regex (used by posts)
  - `SlugField` Zod field (used by posts)
  - Extract `PaginationQuery` to `routes/_helpers/pagination.ts`. Keep `SLUG_PATTERN`/`SlugField` in posts.ts since only posts use slugs.
- **Auth patterns differ per resource:**
  - Posts: GET is public (published only), mutations require auth + ownership
  - Media: all require auth + ownership
  - Sites: all require auth + ownership
  - Pages: GET public (published), mutations require auth
- Import path from index.ts: `./routes/content.js` → after split: `./routes/content/index.js` (same resolution)
- **Critical:** Existing content tests must pass WITHOUT changes.

- [ ] **Step 1: Create shared pagination helper**

Create `apps/api/src/routes/_helpers/pagination.ts`:

Copy the exact `PaginationQuery` schema from `content.ts` (lines 54-57) — do NOT add `.openapi()` calls that don't exist in the original:

```typescript
import { z } from '@hono/zod-openapi';

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
```

Note: The content-specific `Variables` type (`{ db: DatabaseClient; user?: { id: string; role: string } }`) should be defined in `content/index.ts`, not here.

- [ ] **Step 2: Create content/posts.ts**

Extract post CRUD handlers (GET /posts, POST /posts, GET /posts/:id, GET /posts/slug/:slug, PATCH /posts/:id, DELETE /posts/:id) from content.ts lines ~160-436. Keep the SLUG_PATTERN and SlugField in this file.

- [ ] **Step 3: Create content/media.ts**

Extract media CRUD handlers from content.ts lines ~438-591.

- [ ] **Step 4: Create content/sites.ts**

Extract site CRUD handlers from content.ts lines ~593-795.

- [ ] **Step 5: Create content/pages.ts**

Extract page CRUD handlers from content.ts lines ~797-1057.

- [ ] **Step 6: Create content/index.ts**

Compose all sub-route files into a single export (same pattern as tickets/index.ts).

- [ ] **Step 7: Delete original content.ts**

Remove `apps/api/src/routes/content.ts`.

- [ ] **Step 8: Run tests and typecheck**

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter api typecheck
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter api test
```

Expected: all existing content tests pass unchanged.

- [ ] **Step 9: Commit**

```bash
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 add apps/api/src/routes/
git -C /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 commit -m "refactor(api): split content.ts (1,059 LOC) into 4 focused route modules (R3-L12)"
```

---

## Omitted: AdminDashboard.tsx Split

Spec 2.2 mentions "AdminDashboard.tsx (if >700 LOC) → useReducer + sub-components". The actual file at `apps/cms/src/app/(backend)/admin/[[...segments]]/page.tsx` is only **51 LOC** — well under the threshold. No split needed.

---

## Post-Wave Verification

After all 3 tasks are complete:

```bash
cd /home/joshua-v-dev/projects/RevealUI/.worktrees/wave-2 && pnpm --filter @revealui/auth typecheck && pnpm --filter @revealui/auth test && pnpm --filter api typecheck && pnpm --filter api test
```

Expected: all pass.
