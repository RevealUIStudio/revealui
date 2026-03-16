# Wave 1: Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 3 open audit items: discriminated SignInResult type, Studio Rust thiserror error types, and `as unknown as` double-cast cleanup in hot paths. Also verify and mark 3 items already complete (R4-M8, R3-I14, R3-I1).

**Architecture:** Each task is independent — no cross-task dependencies. Task 1 modifies auth types + signIn() + CMS caller. Task 2 adds thiserror to Rust and refactors all 16 command files. Task 3 removes dead type utilities and adds type guards to CMS collection hooks. Task 4 is verification-only for pre-completed items.

**Tech Stack:** TypeScript 5.9, Vitest 4, Rust (Tauri 2), thiserror crate, Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-03-16-remaining-work-execution-design.md` — Wave 1

---

## Task 1: Discriminated SignInResult Type (R3-I11)

**Files:**
- Modify: `packages/auth/src/types.ts:61-70` (SignInResult type)
- Modify: `packages/auth/src/server/auth.ts:27-167` (signIn function — 12 return points)
- Modify: `apps/cms/src/app/api/auth/sign-in/route.ts:69-110` (caller handling + success path)
- Test: `packages/auth/src/server/__tests__/auth.test.ts` (existing tests — update assertions)

**Context for implementer:**
- The current `SignInResult` is a flat interface with `success: boolean` and optional fields. Callers cannot distinguish "wrong password" from "rate limited" from "account locked".
- The `signIn()` function has 12 return points. Each returns `{ success: false, error: 'message' }` with no machine-readable reason code.
- The CMS sign-in route only checks `!result.success` — it doesn't handle MFA (`requiresMfa: true`) at all.
- Existing test file at `packages/auth/src/server/__tests__/auth.test.ts` uses vi.mock for all deps (bcryptjs, drizzle, rate-limit, brute-force, session). Follow the exact same mock pattern.
- **Security note:** `account_not_found` is intentionally collapsed into `invalid_credentials` to prevent user enumeration. The spec's `account_not_found` reason is dropped for this security reason. Additional internal reasons (`database_error`, `session_error`, `unexpected_error`) are added for operational observability — these are never exposed to end users but allow server-side error handling and monitoring to distinguish root causes.

- [ ] **Step 1: Replace SignInResult with discriminated union**

In `packages/auth/src/types.ts`, replace the `SignInResult` interface (find `export interface SignInResult`) with:

```typescript
/** Discriminated union for sign-in outcomes. Check `success` first, then `reason` for failure details. */
export type SignInResult =
  | { success: true; requiresMfa?: false; user: User; sessionToken: string }
  | { success: true; requiresMfa: true; mfaUserId: string }
  | {
      success: false;
      reason:
        | 'invalid_credentials'
        | 'account_locked'
        | 'rate_limited'
        | 'database_error'
        | 'session_error'
        | 'email_not_verified'
        | 'unexpected_error';
      error: string;
    };
```

Note: `requiresMfa?: false` on the non-MFA success branch enables safe type narrowing — after checking `!result.success` and `result.requiresMfa`, TypeScript narrows to the user+sessionToken branch.

- [ ] **Step 2: Update signIn() return points in auth.ts**

In `packages/auth/src/server/auth.ts`, update all failure return statements to include `reason`. Find each return by its surrounding code context (do NOT rely on line numbers — they may shift):

Find `if (!rateLimit.allowed)` → update its return:
```typescript
return { success: false, reason: 'rate_limited', error: 'Too many login attempts. Please try again later.' };
```

Find `if (bruteForceCheck.locked)` → update its return:
```typescript
return { success: false, reason: 'account_locked', error: `Account locked due to too many failed attempts. Please try again in ${lockMinutes} minutes.` };
```

Find `} catch {` after `db = getClient()` → update:
```typescript
return { success: false, reason: 'database_error', error: 'Database connection failed' };
```

Find `} catch {` after the `.select().from(users)` query → update:
```typescript
return { success: false, reason: 'database_error', error: 'Database error' };
```

Find `if (!user)` → update:
```typescript
return { success: false, reason: 'invalid_credentials', error: invalidCredentialsMessage };
```

Find `if (!user.password)` → update:
```typescript
return { success: false, reason: 'invalid_credentials', error: invalidCredentialsMessage };
```

Find `} catch {` after `bcrypt.compare` → update:
```typescript
return { success: false, reason: 'invalid_credentials', error: invalidCredentialsMessage };
```

Find `if (!isValid)` → update:
```typescript
return { success: false, reason: 'invalid_credentials', error: invalidCredentialsMessage };
```

Find `if (user.mfaEnabled)` → **no change needed** (already matches MFA branch shape).

Find `} catch {` after `createSession` → update:
```typescript
return { success: false, reason: 'session_error', error: 'Failed to create session' };
```

Find the final success return (`return { success: true, user, sessionToken: token }`) → **no change needed**.

Find the outer `} catch {` → update:
```typescript
return { success: false, reason: 'unexpected_error', error: 'Unexpected error' };
```

- [ ] **Step 3: Update CMS sign-in route to handle MFA, reason codes, and success path**

In `apps/cms/src/app/api/auth/sign-in/route.ts`, replace the block from `if (!result.success)` through to the `return response;` with:

```typescript
    if (!result.success) {
      const statusCode = result.reason === 'rate_limited' ? 429
        : result.reason === 'account_locked' ? 423
        : 401;
      return createApplicationErrorResponse(
        result.error,
        result.reason.toUpperCase(),
        statusCode,
      );
    }

    // MFA required — return early with mfaUserId for client to complete TOTP
    if (result.requiresMfa) {
      return NextResponse.json(
        { requiresMfa: true, mfaUserId: result.mfaUserId },
        { status: 200 },
      );
    }

    // At this point TypeScript narrows to: { success: true; user: User; sessionToken: string }
    const response = NextResponse.json({
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
      },
    });

    // Set session cookie
    response.cookies.set('revealui-session', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      domain:
        process.env.NODE_ENV === 'production'
          ? (() => {
              if (!process.env.SESSION_COOKIE_DOMAIN) {
                logger.error(
                  'SESSION_COOKIE_DOMAIN env var is required in production — session cookie will not be set cross-subdomain',
                );
              }
              return process.env.SESSION_COOKIE_DOMAIN || undefined;
            })()
          : undefined,
    });

    return response;
```

Note: `result.user.id` (no optional chain) and `result.sessionToken` (no conditional) — TypeScript has narrowed to the non-MFA success branch where both are guaranteed.

- [ ] **Step 4: Update existing signIn tests**

In `packages/auth/src/server/__tests__/auth.test.ts`, update all assertions that check `result.success === false` to also verify the `reason` field. For example, the rate limit test should assert:

```typescript
expect(result).toEqual({
  success: false,
  reason: 'rate_limited',
  error: expect.stringContaining('Too many'),
});
```

Do this for every failure-path test case:
- Rate limit → `reason: 'rate_limited'`
- Account locked → `reason: 'account_locked'`
- DB connection error → `reason: 'database_error'`
- DB query error → `reason: 'database_error'`
- User not found → `reason: 'invalid_credentials'`
- No password → `reason: 'invalid_credentials'`
- bcrypt error → `reason: 'invalid_credentials'`
- Wrong password → `reason: 'invalid_credentials'`
- Session error → `reason: 'session_error'`
- Unexpected error → `reason: 'unexpected_error'`

Add a new test for the MFA path if not already covered:
```typescript
it('should return requiresMfa when MFA is enabled', async () => {
  // Setup: user found with mfaEnabled: true, password valid
  mockLimit.mockResolvedValue([{ ...mockUser, mfaEnabled: true }]);
  mockBcryptCompare.mockResolvedValue(true);

  const result = await signIn('test@example.com', 'password');
  expect(result).toEqual({
    success: true,
    requiresMfa: true,
    mfaUserId: mockUser.id,
  });
});
```

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm --filter @revealui/auth typecheck
pnpm --filter @revealui/auth test
pnpm --filter cms typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/auth/src/types.ts packages/auth/src/server/auth.ts packages/auth/src/server/__tests__/auth.test.ts apps/cms/src/app/api/auth/sign-in/route.ts
git commit -m "refactor(auth): discriminated SignInResult union with reason codes (R3-I11)"
```

---

## Task 2: Studio Rust thiserror Types (R3-I12)

**Files:**
- Modify: `apps/studio/src-tauri/Cargo.toml` (add thiserror dependency)
- Create: `apps/studio/src-tauri/src/commands/error.rs` (shared error types)
- Modify: `apps/studio/src-tauri/src/commands/mod.rs` (add error module)
- Modify: All 16 command files (excluding mod.rs) in `apps/studio/src-tauri/src/commands/` and `commands/deploy/`

**Context for implementer:**
- Currently all 58 Tauri command functions return `Result<T, String>` with `.map_err(|e| e.to_string())`.
- Tauri 2 requires command return types to implement `serde::Serialize`. The `thiserror` crate provides `#[error("...")]` derive but does NOT auto-implement `Serialize`. You must add `#[derive(Debug, thiserror::Error, serde::Serialize)]` and `#[serde(tag = "kind", content = "message")]` for Tauri compatibility.
- There are 7 distinct error categories across the 16 command files (excluding 2 mod.rs files): lock poisoning, IO/process, network/HTTP, crypto, database, vault, SSH.
- The deploy/ subfolder has its own mod.rs — add error imports there too.
- Top-level command files (10): status.rs, sync.rs, mount.rs, setup.rs, apps.rs, config.rs, tunnel.rs, local_shell.rs, ssh.rs, vault.rs
- Deploy command files (6): secrets.rs, email.rs, health.rs, database.rs, stripe.rs, vercel.rs

- [ ] **Step 1: Add thiserror to Cargo.toml**

In `apps/studio/src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
thiserror = "1"
```

- [ ] **Step 2: Create shared error module**

Create `apps/studio/src-tauri/src/commands/error.rs`:

```rust
use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum StudioError {
    #[error("Lock poisoned: {0}")]
    LockPoisoned(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Process error: {0}")]
    Process(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Crypto error: {0}")]
    Crypto(String),

    #[error("Vault error: {0}")]
    Vault(String),

    #[error("SSH error: {0}")]
    Ssh(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for StudioError {
    fn from(e: std::io::Error) -> Self {
        StudioError::Io(e.to_string())
    }
}

impl From<reqwest::Error> for StudioError {
    fn from(e: reqwest::Error) -> Self {
        StudioError::Network(e.to_string())
    }
}

impl From<serde_json::Error> for StudioError {
    fn from(e: serde_json::Error) -> Self {
        StudioError::Config(e.to_string())
    }
}
```

- [ ] **Step 3: Register error module in mod.rs**

In `apps/studio/src-tauri/src/commands/mod.rs`, add:
```rust
pub mod error;
pub use error::StudioError;
```

- [ ] **Step 4: Refactor each of the 16 command files to use StudioError**

For each command file:

1. Change return type from `Result<T, String>` to `Result<T, StudioError>`
2. Add `use super::error::StudioError;` (or `use super::super::error::StudioError;` for deploy/ files)
3. Replace `.map_err(|e| e.to_string())` with appropriate variant:
   - `state.platform.lock().map_err(|e| StudioError::LockPoisoned(e.to_string()))?`
   - `Command::new(...).output().map_err(|e| StudioError::Process(e.to_string()))?`
   - `client.post(...).send().await?` (uses `From<reqwest::Error>` impl)
   - Vault operations: `.map_err(|e| StudioError::Vault(e.to_string()))?`
   - SSH operations: `.map_err(|e| StudioError::Ssh(e.to_string()))?`
   - Crypto operations: `.map_err(|e| StudioError::Crypto(e.to_string()))?`
   - Database CLI operations: `.map_err(|e| StudioError::Database(e.to_string()))?`
   - `ok_or_else(|| ...)` patterns: `.ok_or_else(|| StudioError::Other("message".into()))?`

**Pattern for lock poisoning (status.rs, sync.rs, mount.rs, setup.rs, config.rs, tunnel.rs):**
```rust
use super::error::StudioError;

#[tauri::command]
pub fn get_system_status(state: State<'_, AppState>) -> Result<SystemStatus, StudioError> {
    let platform = state.platform.lock().map_err(|e| StudioError::LockPoisoned(e.to_string()))?;
    platform.get_system_status().map_err(|e| StudioError::Other(e.to_string()))
}
```

**Pattern for deploy/ files (use super::super path):**
```rust
use super::super::error::StudioError;
```

- [ ] **Step 5: Verify compilation**

```bash
cd apps/studio/src-tauri && cargo check
```

Expected: compiles with 0 errors. Warnings about unused variants are acceptable.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src-tauri/
git commit -m "refactor(studio): replace Result<T, String> with thiserror StudioError enum (R3-I12)"
```

---

## Task 3: `as unknown as` Double Cast Cleanup (R4-M7)

**Files:**
- Modify: CMS collection hook files (hot paths with highest cast counts)
- Delete: Dead type utilities identified in prior audits (R3-A1, R3-A2, R3-A3) if still present
- Test: Existing tests must still pass

**Context for implementer:**
- There are 308 files with `as unknown as` but the distribution is highly concentrated:
  - **130 occurrences** in 3 test files (`enrichProduct.test.ts`, `calculatePrice.test.ts`, `Products/integration.test.ts`) — these are test mocks casting partial objects. **Leave test files alone** (test mocks are expected to use casts).
  - **~25 occurrences** in CMS collection hook files — these are the hot paths to fix.
  - Dead type utilities in `packages/contracts/` (R3-A1 `contractToDbInsert`, R3-A2 `DrizzleToContract`) — delete if still present.
- The CMS hooks use `as unknown as` because Drizzle query results and hook arguments come back as generic types but hooks need typed collection documents.
- **Important:** Before creating the type guard, grep each target file to check what type it casts TO. The CMS uses string UUIDs for all document IDs (`id: text('id').primaryKey()`), so an `id: string` guard is safe. But some casts may be on nested fields or non-document types — handle those case-by-case.
- Do NOT touch framework internals (`packages/core/`), config proxy patterns, or test files.
- Scope: Focus on the ~15 non-test files in `apps/cms/src/lib/collections/` and `apps/cms/src/lib/` that have `as unknown as`. Leave the remaining ~160 files across other packages for a future pass.

- [ ] **Step 1: Triage — grep and categorize all non-test double casts in CMS**

```bash
grep -rn 'as unknown as' apps/cms/src/lib/ --include='*.ts' --include='*.tsx' | grep -v '__tests__' | grep -v '.test.'
```

Review each match. Categorize:
- **Document casts** (hook args, query results → typed collection docs) → replace with type guard
- **Nested field casts** (accessing typed subfields) → replace with narrowing or inline check
- **Structural casts** (component props, config objects) → leave if low-risk, or add type assertion function

- [ ] **Step 2: Check and delete dead type utilities**

```bash
grep -rn 'contractToDbInsert\|DrizzleToContract' packages/contracts/src/
grep -rn 'DrizzleSecurityAuditStorage' packages/core/src/
```

If `contractToDbInsert` or `DrizzleToContract` are found, delete them and remove their exports from barrel files. `DrizzleSecurityAuditStorage` was already deleted in R3-A6 — just verify.

- [ ] **Step 3: Create a type guard helper for CMS collection documents**

In `apps/cms/src/lib/utils/type-guards.ts` (create if it doesn't exist), add:

```typescript
/**
 * Safely narrows a value to a typed document.
 * Validates that the value is a non-null object with a string `id` field.
 * All RevealUI collections use text('id').primaryKey() — IDs are always strings.
 */
export function asDocument<T extends { id: string }>(value: unknown): T {
  if (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as Record<string, unknown>).id === 'string'
  ) {
    return value as T;
  }
  throw new Error(
    `Invalid document: expected object with string 'id', got ${typeof value}`,
  );
}

/**
 * Safely narrows an array of values to typed documents.
 */
export function asDocuments<T extends { id: string }>(values: unknown[]): T[] {
  return values.map((v) => asDocument<T>(v));
}
```

- [ ] **Step 4: Replace double casts in CMS collection hooks**

For each non-test file from the Step 1 triage that uses document casts, replace `someValue as unknown as TargetType` with the type guard:

Before:
```typescript
const product = doc as unknown as ProductDocument;
```

After:
```typescript
import { asDocument } from '@/lib/utils/type-guards';
// ...
const product = asDocument<ProductDocument>(doc);
```

For array results, use `asDocuments<T>(rows)`.

For non-document casts (nested fields, config objects), evaluate case-by-case:
- If the cast is on a well-typed internal API result, add an inline type assertion with a comment
- If the cast is genuinely unsafe, add a runtime check
- If the cast is structural and low-risk (e.g., component prop spreading), add a `// biome-ignore` with justification

- [ ] **Step 5: Run tests and typecheck**

```bash
pnpm --filter cms typecheck
pnpm --filter cms test
pnpm --filter @revealui/contracts typecheck
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/cms/src/lib/utils/type-guards.ts apps/cms/src/lib/collections/ packages/contracts/
git commit -m "refactor(cms): replace as-unknown-as double casts with type guards in collection hooks (R4-M7)"
```

---

## Task 4: Verify Pre-Completed Items

These items were identified as already complete during pre-research. This task documents the verification.

- [ ] **Step 1: Verify R4-M8 (error type classes)**

```bash
grep -n 'class RateLimitError\|class NotFoundError\|class ConflictError\|class AuthenticationError\|class AuthorizationError' packages/core/src/utils/errors.ts
```

Expected: all 5 classes found. If yes, R4-M8 is complete.

- [ ] **Step 2: Verify R3-I14 (Stripe TODOs)**

```bash
grep -rn 'TODO\|FIXME' apps/api/src/routes/billing.ts packages/services/src/api/webhooks/ apps/cms/src/lib/collections/Products/ apps/cms/src/lib/collections/Prices/ 2>/dev/null | wc -l
```

Expected: 0 results. If yes, R3-I14 is complete.

- [ ] **Step 3: Verify R3-I1 (Vite v7)**

```bash
grep '"vite"' apps/studio/package.json
```

Expected: `"vite": "^7.3.1"`. If yes, R3-I1 is complete.

- [ ] **Step 4: Document and commit**

No code changes. Update MASTER_PLAN comments or add verification note in the commit.

```bash
git commit --allow-empty -m "chore: verify R4-M8, R3-I14, R3-I1 already complete (Wave 1 pre-research)"
```

---

## Post-Wave Verification

After all 4 tasks are complete:

```bash
pnpm gate:quick
```

Expected: lint, typecheck, and test all pass.
