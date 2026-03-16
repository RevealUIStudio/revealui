# Wave 6: Consolidated Remaining Work

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all remaining non-owner code-side work items from the MASTER_PLAN audit rounds.

**Architecture:** Two agents working in parallel on non-overlapping areas. Each task is independent and can be done in any order within its agent's lane.

**Tech Stack:** TypeScript 5.9, React 19, Vitest 4, Vite 7, Drizzle ORM

---

## Agent Assignment

### Zed-Extension Agent (this session or next)
| Task | Source | Est | Priority |
|------|--------|-----|----------|
| 6.1 Error type classes | R4-M8 | 2h | HIGH |
| 6.2 ElectricSQL remaining fixes | §5.6 | 2h | HIGH |
| 6.3 Vite v6→v7 unification | R3-I1 | 3h | HIGH |
| 6.4 Cache package extraction | §4.5.11 Phase B | 4h | MEDIUM |
| 6.5 Quick polish items | R4-L4, R4-L6 | 1h | LOW |

### WSL-Terminal Agent
| Task | Source | Est | Priority |
|------|--------|-----|----------|
| 5.1 Landing page screenshots | §3.3 | IN PROGRESS | HIGH |
| 6.6 webhooks.ts god file split | R3-L12 | 3h | MEDIUM |
| 6.7 AdminDashboard refactor | R3-L12 | 2h | MEDIUM |
| 6.8 Type guard migration (hot paths) | R4-M7 | 4h | MEDIUM |

---

## Task 6.1: Error Type Classes (R4-M8)

**File to create:** `packages/core/src/utils/errors.ts` (extend existing)

**Context:** The file already defines `ApplicationError`, `ValidationError`, `DatabaseError`. Add:
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `RateLimitError` (429)
- `NotFoundError` (404)
- `ConflictError` (409)

Each should extend `ApplicationError` with appropriate `statusCode` default.

- [ ] **Step 1: Read existing error classes**
- [ ] **Step 2: Add 5 new error classes**
- [ ] **Step 3: Export from package barrel**
- [ ] **Step 4: Typecheck**
- [ ] **Step 5: Commit**

---

## Task 6.2: ElectricSQL Remaining Fixes (§5.6)

**4 items:**

1. **Add 10s fetch timeout** to Electric proxy in `packages/sync/`
2. **Create `setup-sync-schema.sql`** for new deploys
3. **Delete dead `getUserIdFromRequest()`** in sync package
4. **Extract Yjs protocol constants** to shared file

- [ ] **Step 1: Read sync package files**
- [ ] **Step 2: Add fetch timeout**
- [ ] **Step 3: Create setup SQL**
- [ ] **Step 4: Delete dead function**
- [ ] **Step 5: Extract Yjs constants**
- [ ] **Step 6: Typecheck and test**
- [ ] **Step 7: Commit**

---

## Task 6.3: Vite v6→v7 Unification (R3-I1)

**Context:** `apps/studio` pins `vite: ^6.0.0` and `@vitejs/plugin-react: ^4.3.0`. All other apps/packages use vite `^7.3.1` and plugin-react `^5.1.2`.

- [ ] **Step 1: Read Studio vite config and package.json**
- [ ] **Step 2: Update vite and plugin-react versions**
- [ ] **Step 3: Check for breaking changes (Vite 7 migration guide)**
- [ ] **Step 4: Fix any build issues**
- [ ] **Step 5: Run syncpack to verify alignment**
- [ ] **Step 6: Typecheck and build**
- [ ] **Step 7: Commit**

---

## Task 6.4: Cache Package Extraction (§4.5.11 Phase B)

**Context:** Same pattern as security extraction (Wave 4). Move `packages/core/src/caching/` → `packages/cache/`. Re-export from core barrel for backwards compat.

~2,300 LOC. Check for circular deps with core before starting.

- [ ] **Step 1: Analyze caching module dependencies**
- [ ] **Step 2: Create packages/cache/ scaffolding**
- [ ] **Step 3: Move source files**
- [ ] **Step 4: Create SecurityLogger-style interface if needed for any core imports**
- [ ] **Step 5: Update core barrel to re-export**
- [ ] **Step 6: Add workspace:* dep to core**
- [ ] **Step 7: Typecheck all consumers**
- [ ] **Step 8: Run tests**
- [ ] **Step 9: Commit**

---

## Task 6.5: Quick Polish Items

**R4-L4:** Wire `validateRelationshipMetadata()` call at end of `getRelationshipFields()` in `packages/core/src/relationships/analyzer.ts:152-186`.

**R4-L6:** Add `index.ts` to `packages/dev` and `packages/test` for clear public API surface.

- [ ] **Step 1: Wire relationship validation**
- [ ] **Step 2: Add index.ts files**
- [ ] **Step 3: Typecheck**
- [ ] **Step 4: Commit**

---

## Task 6.6: webhooks.ts God File Split (WSL-Terminal)

**File:** `apps/api/src/routes/webhooks.ts` (~1,138 LOC)

Split into:
- `webhooks/index.ts` — route registration
- `webhooks/stripe.ts` — Stripe webhook handlers
- `webhooks/email-templates.ts` — extracted inline HTML email templates
- `webhooks/helpers.ts` — shared utilities

- [ ] **Step 1: Read webhooks.ts and map structure**
- [ ] **Step 2: Extract email templates**
- [ ] **Step 3: Split route handlers**
- [ ] **Step 4: Typecheck and test**
- [ ] **Step 5: Commit**

---

## Task 6.7: AdminDashboard Refactor (WSL-Terminal)

**File:** `apps/cms/src/lib/components/AdminDashboard.tsx` (727 LOC, 6x useState)

- [ ] **Step 1: Read current component**
- [ ] **Step 2: Extract sub-components (panels, cards)**
- [ ] **Step 3: Replace 6x useState with useReducer**
- [ ] **Step 4: Typecheck**
- [ ] **Step 5: Commit**

---

## Task 6.8: Type Guard Migration — Hot Paths (WSL-Terminal)

**Context:** R4-M7 identified 81 files using `as unknown as`. Prioritize API route handlers and CMS hot paths. Use the `asNonEmptyTuple()` pattern from Wave 5 as reference.

- [ ] **Step 1: Grep remaining double casts in apps/api and apps/cms**
- [ ] **Step 2: Create type guards for common patterns**
- [ ] **Step 3: Replace hot-path casts**
- [ ] **Step 4: Typecheck and test**
- [ ] **Step 5: Commit**

---

## Post-Wave 6 Verification

```bash
pnpm gate
```

All tasks should leave the gate green. No new packages should break typecheck.
