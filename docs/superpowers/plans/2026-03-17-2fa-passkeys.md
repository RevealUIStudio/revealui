# 2FA + Passkeys Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete TOTP 2FA wiring, add WebAuthn passkeys (passwordless sign-up/sign-in), and magic link account recovery.

**Architecture:** Three layers — database schemas (Drizzle ORM), auth logic (`packages/auth`), and API routes + UI (`apps/cms`). TOTP backend exists (~95%); passkeys use `@simplewebauthn/server`; magic links follow the existing `password-reset-tokens` pattern. Signed cookies for stateless challenge/pre-auth token storage.

**Tech Stack:** TypeScript, Drizzle ORM, `@simplewebauthn/server` + `@simplewebauthn/browser`, bcryptjs, Vitest, PGlite, Next.js 16 App Router.

**Spec:** `docs/superpowers/specs/2026-03-17-2fa-passkeys-design.md`

**Parallelization:** Tasks 1-2 are sequential (schemas then contracts). Tasks 3, 5, 6 are independent of each other (all depend on Tasks 1-2 only). Tasks 7-8 depend on Task 3 (signed cookie). Tasks 10-12 depend on all prior tasks. Tasks 14-17 (UI) depend on Tasks 10-12 (routes). Task 13 (hooks) can run in parallel with Tasks 10-12.

**Lockfile:** When adding dependencies (Tasks 6, 11), commit `pnpm-lock.yaml` alongside `package.json`.

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/passkeys.ts` | `passkeys` table (Drizzle schema) |
| `packages/db/src/schema/magic-links.ts` | `magic_links` table (Drizzle schema) |
| `packages/auth/src/server/passkey.ts` | WebAuthn registration/verification + challenge cookie signing |
| `packages/auth/src/server/magic-link.ts` | Token generation, HMAC hashing, verification |
| `packages/auth/src/server/signed-cookie.ts` | Shared signed cookie utility (used by passkey + MFA pre-auth) |
| `packages/auth/src/server/__tests__/passkey.test.ts` | Passkey unit tests |
| `packages/auth/src/server/__tests__/magic-link.test.ts` | Magic link unit tests |
| `packages/auth/src/server/__tests__/signed-cookie.test.ts` | Signed cookie unit tests |
| `packages/auth/src/react/usePasskey.ts` | `usePasskeyRegister()`, `usePasskeySignIn()` hooks |
| `packages/auth/src/react/useMFA.ts` | `useMFASetup()`, `useMFAVerify()` hooks |
| `apps/cms/src/app/api/auth/mfa/setup/route.ts` | POST — initiate MFA setup |
| `apps/cms/src/app/api/auth/mfa/verify-setup/route.ts` | POST — activate MFA |
| `apps/cms/src/app/api/auth/mfa/verify/route.ts` | POST — verify TOTP during login |
| `apps/cms/src/app/api/auth/mfa/backup/route.ts` | POST — verify backup code during login |
| `apps/cms/src/app/api/auth/mfa/disable/route.ts` | POST — disable MFA |
| `apps/cms/src/app/api/auth/mfa/regenerate/route.ts` | POST — regenerate backup codes |
| `apps/cms/src/app/api/auth/mfa/status/route.ts` | GET — check MFA status |
| `apps/cms/src/app/api/auth/passkey/register-options/route.ts` | POST — WebAuthn registration challenge |
| `apps/cms/src/app/api/auth/passkey/register-verify/route.ts` | POST — verify attestation |
| `apps/cms/src/app/api/auth/passkey/authenticate-options/route.ts` | POST — WebAuthn auth challenge |
| `apps/cms/src/app/api/auth/passkey/authenticate-verify/route.ts` | POST — verify assertion |
| `apps/cms/src/app/api/auth/passkey/list/route.ts` | GET — list passkeys |
| `apps/cms/src/app/api/auth/passkey/[id]/route.ts` | PATCH + DELETE — rename/remove passkey |
| `apps/cms/src/app/api/auth/recovery/request/route.ts` | POST — send magic link |
| `apps/cms/src/app/api/auth/recovery/verify/route.ts` | POST — validate magic link |
| `apps/cms/src/app/(frontend)/mfa/page.tsx` | TOTP verification page (during login) |
| `apps/cms/src/app/(backend)/admin/settings/security/page.tsx` | Security settings page |

### Modified Files

| File | Change |
|------|--------|
| `packages/db/src/schema/rest.ts:55` | Add exports for passkeys + magic-links |
| `packages/db/src/schema/index.ts` | Add relations for new tables |
| `packages/contracts/src/api/auth.ts:176` | Add passkey + recovery + updated MFA disable schemas |
| `packages/auth/src/server/auth.ts:153-160` | `signIn()` still returns `mfaUserId` — only the route handler changes to use a cookie |
| `packages/auth/src/server/mfa.ts:297-343` | Update `disableMFA()` to accept passkey re-auth as alternative to password |
| `packages/auth/src/server/session.ts:227-298` | Extend `createSession()` with optional `expiresAt` override + `metadata` field |
| `packages/db/src/schema/users.ts` (sessions table) | Add `metadata` jsonb column to sessions table |
| `packages/auth/src/types.ts:43-54` | Add `metadata?: Record<string, unknown> \| null` to `Session` type |
| `packages/auth/src/server/index.ts` | Add exports for passkey, magic-link, signed-cookie modules |
| `packages/auth/src/react/index.ts` | Add exports for usePasskey, useMFA hooks |
| `packages/auth/package.json` | Add `@simplewebauthn/server` dependency |
| `apps/cms/package.json` | Add `@simplewebauthn/browser` dependency |
| `apps/cms/src/app/api/auth/sign-in/route.ts:82-84` | Set `mfa-pending` signed cookie instead of returning mfaUserId |
| `apps/cms/src/app/(frontend)/login/page.tsx:75` | Navigate to `/mfa` page instead of inline handling |
| `apps/cms/src/app/(frontend)/signup/page.tsx` | Add "Sign up with passkey" option |

---

## Task 1: Database Schemas

**Files:**
- Create: `packages/db/src/schema/passkeys.ts`
- Create: `packages/db/src/schema/magic-links.ts`
- Modify: `packages/db/src/schema/rest.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write passkeys schema test**

Create `packages/db/src/schema/__tests__/passkeys.test.ts` that imports the table and verifies column definitions exist (id, userId, credentialId, publicKey, counter, transports, aaguid, deviceName, backedUp, createdAt, lastUsedAt).

Run: `pnpm --filter @revealui/db test -- passkeys.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Create passkeys table schema**

Create `packages/db/src/schema/passkeys.ts`:

```ts
import { boolean, customType, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

const bytea = customType<{ data: Buffer }>({
  dataType() { return 'bytea'; },
});

export const passkeys = pgTable('passkeys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull(),
  publicKey: bytea('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: jsonb('transports').$type<string[]>(),
  aaguid: text('aaguid'),
  deviceName: text('device_name'),
  backedUp: boolean('backed_up').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => [
  index('passkeys_user_id_idx').on(table.userId),
  uniqueIndex('passkeys_credential_id_idx').on(table.credentialId),
]);
```

Run: `pnpm --filter @revealui/db test -- passkeys.test.ts`
Expected: PASS

- [ ] **Step 3: Write magic-links schema test**

Create `packages/db/src/schema/__tests__/magic-links.test.ts` that imports the table and verifies columns exist (id, userId, tokenHash, tokenSalt, expiresAt, usedAt, createdAt).

Run: `pnpm --filter @revealui/db test -- magic-links.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create magic-links table schema**

Create `packages/db/src/schema/magic-links.ts` following the `password-reset-tokens.ts` pattern at `packages/db/src/schema/password-reset-tokens.ts`:

```ts
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const magicLinks = pgTable('magic_links', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  tokenSalt: text('token_salt').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('magic_links_user_id_idx').on(table.userId),
  uniqueIndex('magic_links_token_hash_idx').on(table.tokenHash),
  index('magic_links_expires_at_idx').on(table.expiresAt),
]);
```

Run: `pnpm --filter @revealui/db test -- magic-links.test.ts`
Expected: PASS

- [ ] **Step 5: Register tables in schema barrels**

Modify `packages/db/src/schema/rest.ts` — add after line 55 (`export * from './password-reset-tokens.js'`):
```ts
export * from './passkeys.js';
export * from './magic-links.js';
```

Modify `packages/db/src/schema/index.ts` — add Drizzle relations for both tables (follow `passwordResetTokensRelations` pattern around line 152).

- [ ] **Step 6: Run full DB typecheck**

Run: `pnpm --filter @revealui/db typecheck`
Expected: PASS — no type errors

- [ ] **Step 7: Generate Drizzle migration**

Run: `pnpm --filter @revealui/db drizzle-kit generate`

This creates a SQL migration file in `packages/db/src/migrations/` for the `passkeys`, `magic_links` tables and the `metadata` column on `sessions`. Verify the generated SQL creates both tables with correct columns and indexes.

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/schema/passkeys.ts packages/db/src/schema/magic-links.ts packages/db/src/schema/rest.ts packages/db/src/schema/index.ts packages/db/src/schema/__tests__/ packages/db/src/migrations/
git commit -m "feat(db): add passkeys and magic_links table schemas with migration"
```

---

## Task 2: Contracts (Zod Schemas)

**Files:**
- Modify: `packages/contracts/src/api/auth.ts:145-176`

- [ ] **Step 1: Write contract tests**

Create `packages/contracts/src/api/__tests__/auth-passkey.test.ts` testing:
- `PasskeyRegisterOptionsRequestSchema` parses `{ email: 'a@b.com', name: 'User' }` and `{}`
- `PasskeyRegisterVerifyRequestSchema` parses `{ attestationResponse: {...}, deviceName: 'iPhone' }`
- `RecoveryRequestSchema` parses `{ email: 'a@b.com' }`
- `RecoveryVerifyRequestSchema` parses `{ token: 'abc123' }`
- Updated `MFADisableRequestSchema` parses both `{ method: 'password', password: '...' }` and `{ method: 'passkey', authenticationResponse: {...} }`

Run: `pnpm --filter @revealui/contracts test -- auth-passkey.test.ts`
Expected: FAIL — schemas not found

- [ ] **Step 2: Add new schemas to contracts**

Add after existing MFA schemas (around line 176) in `packages/contracts/src/api/auth.ts`:

```ts
// Passkey contracts
export const PasskeyRegisterOptionsRequestSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(255).optional(),
});

export const PasskeyRegisterVerifyRequestSchema = z.object({
  attestationResponse: z.object({}).passthrough(),
  deviceName: z.string().max(100).optional(),
});

export const PasskeyAuthenticateOptionsRequestSchema = z.object({});

export const PasskeyAuthenticateVerifyRequestSchema = z.object({
  authenticationResponse: z.object({}).passthrough(),
});

export const PasskeyListResponseSchema = z.object({
  passkeys: z.array(z.object({
    id: z.string(),
    deviceName: z.string().nullable(),
    aaguid: z.string().nullable(),
    backedUp: z.boolean(),
    createdAt: z.string(),
    lastUsedAt: z.string().nullable(),
  })),
});

export const PasskeyUpdateRequestSchema = z.object({
  deviceName: z.string().min(1).max(100),
});

// Recovery contracts
export const RecoveryRequestSchema = z.object({
  email: z.string().email(),
});

export const RecoveryVerifyRequestSchema = z.object({
  token: z.string().min(1),
});
```

Update `MFADisableRequestSchema` (around line 145) to a discriminated union:

```ts
export const MFADisableRequestSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('password'), password: z.string().min(1) }),
  z.object({ method: z.literal('passkey'), authenticationResponse: z.object({}).passthrough() }),
]);
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @revealui/contracts test -- auth-passkey.test.ts`
Expected: PASS

- [ ] **Step 4: Typecheck and verify consumers**

Run: `pnpm --filter @revealui/contracts typecheck`
Expected: PASS

**Important:** The `MFADisableRequestSchema` type changes from `{ password: string }` to a discriminated union. Check for any existing consumers of the inferred `MFADisableRequest` type or `MFADisableRequestContract`. The main consumer is `disableMFA()` in `packages/auth/src/server/mfa.ts` — this gets updated in Task 8. If there's an existing MFA disable route or tests that parse this schema, they must also be updated.

Run: `pnpm typecheck:all` to catch any type breaks across the monorepo.
Expected: May show errors in `mfa.ts` — these are fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/api/auth.ts packages/contracts/src/api/__tests__/auth-passkey.test.ts
git commit -m "feat(contracts): add passkey, recovery, and updated MFA disable schemas"
```

---

## Task 3: Signed Cookie Utility

**Files:**
- Create: `packages/auth/src/server/signed-cookie.ts`
- Create: `packages/auth/src/server/__tests__/signed-cookie.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for `signCookiePayload(payload, secret)` → signed string, `verifyCookiePayload(signed, secret)` → payload or null (expired/tampered), and expiry checking.

Run: `pnpm --filter @revealui/auth test -- signed-cookie.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Implement signed cookie utility**

Create `packages/auth/src/server/signed-cookie.ts`:
- `signCookiePayload<T>(payload: T & { expiresAt: number }, secret: string): string` — JSON + HMAC-SHA256 signature, base64url encoded
- `verifyCookiePayload<T>(signed: string, secret: string): T | null` — verify signature (timingSafeEqual), check expiry, return payload or null
- Use `crypto.createHmac('sha256', secret)` and `crypto.timingSafeEqual()`

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @revealui/auth test -- signed-cookie.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/server/signed-cookie.ts packages/auth/src/server/__tests__/signed-cookie.test.ts
git commit -m "feat(auth): add signed cookie utility for challenge/pre-auth tokens"
```

---

## Task 4: Extend Session Infrastructure

**Files:**
- Modify: `packages/auth/src/server/session.ts:227-298`

- [ ] **Step 1: Write failing test for expiresAt override**

Add test in `packages/auth/src/server/__tests__/session.test.ts`:
- `createSession(userId, { expiresAt: new Date(Date.now() + 30 * 60 * 1000) })` creates a session expiring in 30 minutes
- `createSession(userId, { metadata: { recovery: true } })` stores metadata

Run: `pnpm --filter @revealui/auth test -- session.test.ts`
Expected: FAIL — options not accepted

- [ ] **Step 2: Extend createSession signature**

In `packages/auth/src/server/session.ts`, extend the options parameter of `createSession()` (line 230):

```ts
options?: {
  persistent?: boolean;
  userAgent?: string;
  ipAddress?: string;
  expiresAt?: Date;        // NEW: override default expiry
  metadata?: Record<string, unknown>; // NEW: arbitrary metadata
}
```

When `expiresAt` is provided, use it instead of the 1-day/7-day default (line 255-257). Store `metadata` in the session row.

**Required schema change:** The sessions table in `packages/db/src/schema/users.ts` (lines 97-131) does NOT have a `metadata` column. Add one:
```ts
metadata: jsonb('metadata').$type<Record<string, unknown>>(),
```

Also update the `Session` type in `packages/auth/src/types.ts` (lines 43-54) to include:
```ts
metadata?: Record<string, unknown> | null;
```

And update the `createSession` insert call (session.ts line 262-274) to include `metadata: options?.metadata ?? null`.

The Drizzle migration for this column is generated in Task 1 Step 7 (along with the passkeys/magic_links tables).

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @revealui/auth test -- session.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/server/session.ts packages/auth/src/server/__tests__/session.test.ts packages/db/src/schema/users.ts
git commit -m "feat(auth): extend createSession with expiresAt override and metadata"
```

---

## Task 5: Magic Link Module

**Files:**
- Create: `packages/auth/src/server/magic-link.ts`
- Create: `packages/auth/src/server/__tests__/magic-link.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for:
- `createMagicLink(userId)` → returns `{ token, expiresAt }` and stores hash+salt in DB
- `verifyMagicLink(token)` → returns userId for valid token, null for expired/used/invalid
- Token is consumed on use (second call returns null)
- Expired tokens return null
- Opportunistic cleanup: creating a new link deletes expired rows for same user

Run: `pnpm --filter @revealui/auth test -- magic-link.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Implement magic-link module**

Create `packages/auth/src/server/magic-link.ts` following `password-reset.ts` pattern:
- `MagicLinkConfig` interface with `tokenExpiryMs` (15 min), `tempSessionDurationMs` (30 min), `maxRequestsPerHour` (3)
- `configureMagicLink()` / `resetMagicLinkConfig()`
- `createMagicLink(userId: string): Promise<{ token: string; expiresAt: Date }>` — generates 32-byte random token, HMAC-SHA256 + salt hash, stores in `magic_links` table, cleans up expired rows for same user
- `verifyMagicLink(token: string): Promise<{ userId: string } | null>` — scans for matching hash using timingSafeEqual, checks expiry and usedAt, marks as used

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @revealui/auth test -- magic-link.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/server/magic-link.ts packages/auth/src/server/__tests__/magic-link.test.ts
git commit -m "feat(auth): add magic link token generation and verification"
```

---

## Task 6: Passkey Module

**Files:**
- Create: `packages/auth/src/server/passkey.ts`
- Create: `packages/auth/src/server/__tests__/passkey.test.ts`
- Modify: `packages/auth/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd ~/projects/RevealUI && pnpm --filter @revealui/auth add @simplewebauthn/server
```

- [ ] **Step 2: Write failing tests**

Tests (mock `@simplewebauthn/server`):
- `generateRegistrationChallenge(userId, userEmail)` → returns options object + challenge
- `verifyRegistration(attestation, challenge)` → returns credential data (id, publicKey, counter, transports, aaguid, backedUp)
- `storePasskey(userId, credential, deviceName?)` → inserts row, returns passkey
- `storePasskey` rejects when user has 10 passkeys (limit enforcement)
- `generateAuthenticationChallenge(credentialIds?)` → returns options + challenge
- `verifyAuthentication(assertion, credentialId, publicKey, counter)` → returns updated counter
- `listPasskeys(userId)` → returns array
- `deletePasskey(userId, passkeyId)` → removes row, blocks if last credential
- `renamePasskey(userId, passkeyId, name)` → updates device_name
- `countUserCredentials(userId)` → returns count of passkeys + whether user has password

Run: `pnpm --filter @revealui/auth test -- passkey.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement passkey module**

Create `packages/auth/src/server/passkey.ts`:
- `PasskeyConfig` interface: `maxPasskeysPerUser` (10), `challengeTtlMs` (5 min), `rpId`, `rpName`, `origin`
- `configurePasskey()` / `resetPasskeyConfig()`
- `generateRegistrationChallenge(userId, userEmail, existingCredentialIds?)` — calls `@simplewebauthn/server` `generateRegistrationOptions()`
- `verifyRegistration(attestation, expectedChallenge, expectedOrigin)` — calls `verifyRegistrationResponse()`
- `storePasskey(userId, credential, deviceName?)` — inserts into `passkeys` table, enforces 10-key limit
- `generateAuthenticationChallenge(allowCredentials?)` — calls `generateAuthenticationOptions()`
- `verifyAuthentication(assertion, credential, expectedChallenge, expectedOrigin)` — calls `verifyAuthenticationResponse()`, updates counter
- `listPasskeys(userId)` — select from passkeys where userId, ordered by createdAt
- `deletePasskey(userId, passkeyId)` — delete with last-credential safety check
- `renamePasskey(userId, passkeyId, name)` — update device_name
- `countUserCredentials(userId)` — count passkeys + check if user.password is non-null

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @revealui/auth test -- passkey.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/server/passkey.ts packages/auth/src/server/__tests__/passkey.test.ts packages/auth/package.json
git commit -m "feat(auth): add WebAuthn passkey registration and authentication"
```

---

## Task 7: Update Sign-In Flow (MFA Pre-Auth Cookie)

**Files:**
- Modify: `apps/cms/src/app/api/auth/sign-in/route.ts:82-84`

**Note:** The `signIn()` function in `packages/auth/src/server/auth.ts` continues to return `{ requiresMfa: true, mfaUserId: string }` — the `SignInResult` type in `packages/auth/src/types.ts` is unchanged. Only the **HTTP route handler** changes to put the userId in a signed cookie instead of the response body.

- [ ] **Step 1: Write failing test**

Update the sign-in route test to verify:
- Response body is `{ requiresMfa: true }` (no userId in body)
- A `mfa-pending` Set-Cookie header is present

- [ ] **Step 2: Update sign-in route**

In `apps/cms/src/app/api/auth/sign-in/route.ts`, replace lines 82-84:

```ts
if (result.requiresMfa) {
  const { signCookiePayload } = await import('@revealui/auth/server');
  const signed = signCookiePayload(
    { userId: result.mfaUserId, expiresAt: Date.now() + 5 * 60 * 1000 },
    process.env.REVEALUI_SECRET!,
  );
  const response = NextResponse.json({ requiresMfa: true }, { status: 200 });
  response.cookies.set('mfa-pending', signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/mfa',
    maxAge: 300,
  });
  return response;
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter cms test -- sign-in`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cms/src/app/api/auth/sign-in/route.ts
git commit -m "fix(cms): secure MFA flow with signed pre-auth cookie"
```

---

## Task 8: Update disableMFA for Passkey Users

**Files:**
- Modify: `packages/auth/src/server/mfa.ts:297-343`

- [ ] **Step 1: Write failing test**

Add test in `packages/auth/src/server/__tests__/mfa.test.ts`:
- `disableMFA(userId, { method: 'passkey', verified: true })` succeeds for passkey-only user
- `disableMFA(userId, { method: 'password', password: '...' })` succeeds for password user
- Both clear mfaEnabled, mfaSecret, mfaBackupCodes, mfaVerifiedAt

Run: `pnpm --filter @revealui/auth test -- mfa.test.ts`
Expected: FAIL — type mismatch on second argument

- [ ] **Step 2: Update disableMFA signature**

Change `disableMFA(userId: string, password: string)` to:

```ts
type MFADisableProof =
  | { method: 'password'; password: string }
  | { method: 'passkey'; verified: true }; // Caller must verify passkey assertion first

export async function disableMFA(userId: string, proof: MFADisableProof): Promise<...>
```

For `method: 'password'` — verify password with bcrypt (existing logic).
For `method: 'passkey'` — trust the `verified: true` flag (the API route must perform the actual WebAuthn assertion verification before calling this).

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @revealui/auth test -- mfa.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/auth/src/server/mfa.ts packages/auth/src/server/__tests__/mfa.test.ts
git commit -m "feat(auth): update disableMFA to accept passkey re-auth"
```

---

## Task 9: Export Barrels

**Files:**
- Modify: `packages/auth/src/server/index.ts`
- Modify: `packages/auth/src/index.ts`

- [ ] **Step 1: Add server exports**

In `packages/auth/src/server/index.ts`, add:

```ts
// Passkey
export type { PasskeyConfig } from './passkey.js';
export {
  configurePasskey,
  resetPasskeyConfig,
  generateRegistrationChallenge,
  verifyRegistration,
  storePasskey,
  generateAuthenticationChallenge,
  verifyAuthentication,
  listPasskeys,
  deletePasskey,
  renamePasskey,
  countUserCredentials,
} from './passkey.js';

// Magic Link
export type { MagicLinkConfig } from './magic-link.js';
export {
  configureMagicLink,
  resetMagicLinkConfig,
  createMagicLink,
  verifyMagicLink,
} from './magic-link.js';

// Signed Cookie
export { signCookiePayload, verifyCookiePayload } from './signed-cookie.js';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @revealui/auth typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/auth/src/server/index.ts packages/auth/src/index.ts
git commit -m "chore(auth): export passkey, magic-link, and signed-cookie modules"
```

---

## Task 10: TOTP MFA API Routes

**Files:**
- Create: `apps/cms/src/app/api/auth/mfa/setup/route.ts`
- Create: `apps/cms/src/app/api/auth/mfa/verify-setup/route.ts`
- Create: `apps/cms/src/app/api/auth/mfa/verify/route.ts`
- Create: `apps/cms/src/app/api/auth/mfa/backup/route.ts`
- Create: `apps/cms/src/app/api/auth/mfa/disable/route.ts`
- Create: `apps/cms/src/app/api/auth/mfa/regenerate/route.ts`
- Create: `apps/cms/src/app/api/auth/mfa/status/route.ts`

- [ ] **Step 1: Write route tests**

Create `apps/cms/src/app/api/auth/mfa/__tests__/routes.test.ts` testing:
- `POST /mfa/setup` requires session, returns secret + QR URI + backup codes
- `POST /mfa/verify-setup` requires session + valid 6-digit code, activates MFA
- `POST /mfa/verify` requires `mfa-pending` cookie, validates TOTP code, creates session, clears cookie
- `POST /mfa/backup` requires `mfa-pending` cookie, consumes backup code, creates session
- `POST /mfa/disable` requires session + password (or passkey proof), disables MFA
- `POST /mfa/regenerate` requires session + active MFA, returns new codes
- `GET /mfa/status` requires session, returns `{ enabled: boolean }`
- Rate limiting: 6th attempt to `/mfa/verify` within 15 min returns 429

Run: `pnpm --filter cms test -- mfa/routes`
Expected: FAIL — routes don't exist

- [ ] **Step 2: Implement all 7 routes**

Each route follows the same pattern:
1. Parse/validate request body with contract schema
2. Check auth (session cookie or mfa-pending cookie)
3. Call the corresponding `@revealui/auth` function
4. Return JSON response

Key details:
- `/mfa/verify` and `/mfa/backup`: Read userId from `mfa-pending` cookie via `verifyCookiePayload()`. Apply rate limiting (5 attempts/15 min). On success, call `createSession()` and clear the `mfa-pending` cookie.
- `/mfa/setup`: Call `initiateMFASetup(userId, email)`, return `{ secret, uri, backupCodes }`.
- `/mfa/disable`: Parse discriminated union body. For `method: 'password'`, pass directly. For `method: 'passkey'`, verify WebAuthn assertion first, then call `disableMFA(userId, { method: 'passkey', verified: true })`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter cms test -- mfa/routes`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cms/src/app/api/auth/mfa/
git commit -m "feat(cms): add TOTP MFA API routes (setup, verify, backup, disable, regenerate, status)"
```

---

## Task 11: Passkey API Routes

**Files:**
- Create: `apps/cms/src/app/api/auth/passkey/register-options/route.ts`
- Create: `apps/cms/src/app/api/auth/passkey/register-verify/route.ts`
- Create: `apps/cms/src/app/api/auth/passkey/authenticate-options/route.ts`
- Create: `apps/cms/src/app/api/auth/passkey/authenticate-verify/route.ts`
- Create: `apps/cms/src/app/api/auth/passkey/list/route.ts`
- Create: `apps/cms/src/app/api/auth/passkey/[id]/route.ts`
- Modify: `apps/cms/package.json`

- [ ] **Step 1: Install client dependency**

```bash
cd ~/projects/RevealUI && pnpm --filter cms add @simplewebauthn/browser
```

- [ ] **Step 2: Write route tests**

Create `apps/cms/src/app/api/auth/passkey/__tests__/routes.test.ts` testing:
- `POST /register-options` (authenticated): returns WebAuthn options + sets challenge cookie
- `POST /register-options` (unauthenticated, sign-up): validates email uniqueness, returns options + challenge cookie with pending email/name
- `POST /register-verify` (authenticated): stores credential, enforces 10-key limit
- `POST /register-verify` (sign-up): creates user + stores credential atomically, returns backup codes
- `POST /authenticate-options`: returns WebAuthn options + challenge cookie
- `POST /authenticate-verify`: verifies assertion, creates session (no TOTP check), clears challenge cookie
- `GET /list`: returns user's passkeys (no publicKey/counter in response)
- `PATCH /[id]`: renames passkey
- `DELETE /[id]`: deletes passkey, blocks if last credential
- Replayed assertion (counter regression) returns 401

Run: `pnpm --filter cms test -- passkey/routes`
Expected: FAIL — routes don't exist

- [ ] **Step 3: Implement all passkey routes**

Each route:
1. Validate with contract schema
2. Check auth where required (session cookie)
3. Challenge management via signed cookies (`signCookiePayload` / `verifyCookiePayload`)
4. Call `@revealui/auth` passkey functions
5. Return JSON

Key details:
- `/register-options` (sign-up flow): Validate email not taken, do NOT create user. Set signed challenge cookie with `{ challenge, email, name, expiresAt }`.
- `/register-verify` (sign-up flow): Read email/name from challenge cookie. Create user + passkey in single transaction. Generate backup codes via `initiateMFASetup()` + immediately activate. Return `{ user, backupCodes }`. Set session cookie.
- `/register-verify` (recovery session): If the current session has `metadata.recovery === true`, call `rotateSession()` after storing the credential to upgrade from temporary to full session. This implements the spec's "session rotated after new credential is added" requirement.
- `/authenticate-verify`: Look up passkey by credential ID from assertion. Verify with stored public key + counter. Update counter + lastUsedAt. Create session. No TOTP check.
- `/[id]` PATCH: Call `renamePasskey()`. DELETE: Call `deletePasskey()` (handles last-credential check).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter cms test -- passkey/routes`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/app/api/auth/passkey/ apps/cms/package.json
git commit -m "feat(cms): add WebAuthn passkey API routes"
```

---

## Task 12: Recovery API Routes

**Files:**
- Create: `apps/cms/src/app/api/auth/recovery/request/route.ts`
- Create: `apps/cms/src/app/api/auth/recovery/verify/route.ts`

- [ ] **Step 1: Write route tests**

Create `apps/cms/src/app/api/auth/recovery/__tests__/routes.test.ts` testing:
- `POST /recovery/request` with valid email: returns 200 (always, even if email not found — no enumeration)
- `POST /recovery/request` rate limiting: 4th request within 1 hour returns 429
- `POST /recovery/verify` with valid token: creates temporary session (30-min, recovery metadata), returns 200
- `POST /recovery/verify` with expired/used token: returns 401
- `POST /recovery/verify` rate limiting: 6th attempt within 15 min returns 429
- Temporary session has `recovery: true` metadata

Run: `pnpm --filter cms test -- recovery/routes`
Expected: FAIL — routes don't exist

- [ ] **Step 2: Implement recovery routes**

`/recovery/request`:
1. Parse email from body
2. Look up user by email (silent if not found — prevent enumeration)
3. Rate limit: 3 requests per hour per email
4. Call `createMagicLink(userId)` → get token
5. Send email with recovery link (use Resend or existing email utility)
6. Return `{ success: true }` always

`/recovery/verify`:
1. Parse token from body
2. Rate limit: 5 attempts per 15 min per IP (matches spec)
3. Call `verifyMagicLink(token)` → userId or null
4. If null: return 401
5. Create temporary session: `createSession(userId, { expiresAt: new Date(Date.now() + 30 * 60 * 1000), metadata: { recovery: true } })`
6. Set session cookie, return 200

- [ ] **Step 3: Run tests**

Run: `pnpm --filter cms test -- recovery/routes`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cms/src/app/api/auth/recovery/
git commit -m "feat(cms): add magic link account recovery routes"
```

---

## Task 13: React Hooks

**Files:**
- Create: `packages/auth/src/react/useMFA.ts`
- Create: `packages/auth/src/react/usePasskey.ts`
- Create: `packages/auth/src/react/__tests__/useMFA.test.tsx`
- Create: `packages/auth/src/react/__tests__/usePasskey.test.tsx`
- Modify: `packages/auth/src/react/index.ts`

- [ ] **Step 1: Write useMFA hook tests**

Tests:
- `useMFASetup()` — calls `/api/auth/mfa/setup`, returns `{ secret, uri, backupCodes, verifySetup, isLoading }`
- `useMFAVerify()` — calls `/api/auth/mfa/verify`, returns `{ verify, verifyBackupCode, isLoading, error }`
- Error states for invalid codes

Run: `pnpm --filter @revealui/auth test -- useMFA.test`
Expected: FAIL

- [ ] **Step 2: Implement useMFA hook**

Create `packages/auth/src/react/useMFA.ts`:
- `useMFASetup()`: POST to `/api/auth/mfa/setup`, manage state for QR display
- `useMFAVerify()`: POST to `/api/auth/mfa/verify` with code, handle session creation response
- `useMFABackup()`: POST to `/api/auth/mfa/backup` with backup code

- [ ] **Step 3: Write usePasskey hook tests**

Tests:
- `usePasskeyRegister()` — calls register-options, invokes browser WebAuthn API, calls register-verify
- `usePasskeySignIn()` — calls authenticate-options, invokes browser API, calls authenticate-verify
- Browser API not supported → returns `{ supported: false }`

Run: `pnpm --filter @revealui/auth test -- usePasskey.test`
Expected: FAIL

- [ ] **Step 4: Implement usePasskey hook**

Create `packages/auth/src/react/usePasskey.ts`:
- `usePasskeyRegister()`: Calls register-options → `@simplewebauthn/browser` `startRegistration()` → register-verify
- `usePasskeySignIn()`: Calls authenticate-options → `startAuthentication()` → authenticate-verify
- Both detect browser support via `PublicKeyCredential` availability

**Note:** `@simplewebauthn/browser` is a peer dep — the CMS app installs it, the hook imports it dynamically.

- [ ] **Step 5: Export hooks**

Add to `packages/auth/src/react/index.ts`:
```ts
export { useMFASetup, useMFAVerify } from './useMFA.js';
export { usePasskeyRegister, usePasskeySignIn } from './usePasskey.js';
```

- [ ] **Step 6: Run all hook tests**

Run: `pnpm --filter @revealui/auth test -- useMFA.test usePasskey.test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/auth/src/react/useMFA.ts packages/auth/src/react/usePasskey.ts packages/auth/src/react/index.ts packages/auth/src/react/__tests__/
git commit -m "feat(auth): add useMFA and usePasskey React hooks"
```

---

## Task 14: MFA Verification Page

**Files:**
- Create: `apps/cms/src/app/(frontend)/mfa/page.tsx`
- Modify: `apps/cms/src/app/(frontend)/login/page.tsx:75`

- [ ] **Step 1: Create MFA verification page**

Create `apps/cms/src/app/(frontend)/mfa/page.tsx`:
- "Enter your 6-digit code" input (auto-focus, numeric, maxLength 6)
- "Use a backup code instead" link toggles to backup code input
- Submit calls `useMFAVerify()` → on success redirect to `/admin`
- Error display for invalid code
- Rate limit message when 429 returned
- Back to sign-in link

Use existing presentation components from `@revealui/presentation` where available. Style with Tailwind v4.

- [ ] **Step 2: Update login page redirect**

In `apps/cms/src/app/(frontend)/login/page.tsx`, update line 75 to navigate to `/mfa` when `requiresMfa` is true:

```tsx
if (result.requiresMfa) {
  router.push('/mfa');
  return;
}
```

(The `mfa-pending` cookie is set by the server — the client just needs to redirect.)

- [ ] **Step 3: Manual verification**

Start dev server: `pnpm dev:cms`
Navigate to `/login`, sign in with MFA-enabled user → should redirect to `/mfa` page.

- [ ] **Step 4: Commit**

```bash
git add apps/cms/src/app/(frontend)/mfa/ apps/cms/src/app/(frontend)/login/page.tsx
git commit -m "feat(cms): add MFA verification page and login redirect"
```

---

## Task 15: Sign-Up with Passkey Option

**Files:**
- Modify: `apps/cms/src/app/(frontend)/signup/page.tsx`

- [ ] **Step 1: Add passkey sign-up button**

Add a "Sign up with passkey" button below the existing form. When clicked:
1. Collect email + name from form fields (validate before proceeding)
2. Call `usePasskeyRegister()` with email + name
3. On success: show backup codes in a modal/card (with copy + download option)
4. After user confirms backup codes → redirect to `/admin`

Add feature detection: if `window.PublicKeyCredential` is not available, hide the passkey button.

- [ ] **Step 2: Manual verification**

Start dev server, navigate to `/signup`, verify passkey button appears (on supporting browsers).

- [ ] **Step 3: Commit**

```bash
git add apps/cms/src/app/(frontend)/signup/page.tsx
git commit -m "feat(cms): add passkey sign-up option"
```

---

## Task 16: Sign-In with Passkey Option

**Files:**
- Modify: `apps/cms/src/app/(frontend)/login/page.tsx`

- [ ] **Step 1: Add passkey sign-in button**

Add a "Sign in with passkey" button on the login page. When clicked:
1. Call `usePasskeySignIn()` — triggers browser biometric prompt
2. On success → redirect to `/admin`
3. On failure → show error

Feature detection: hide button if `PublicKeyCredential` not available.

- [ ] **Step 2: Manual verification**

Start dev server, navigate to `/login`, verify passkey button appears.

- [ ] **Step 3: Commit**

```bash
git add apps/cms/src/app/(frontend)/login/page.tsx
git commit -m "feat(cms): add passkey sign-in option"
```

---

## Task 17: Security Settings Page

**Files:**
- Create: `apps/cms/src/app/(backend)/admin/settings/security/page.tsx`

- [ ] **Step 1: Create security settings page**

Create `apps/cms/src/app/(backend)/admin/settings/security/page.tsx` with three sections:

**Section 1: Two-Factor Authentication**
- Status badge: "Enabled" (green) or "Disabled" (gray)
- If disabled: "Enable 2FA" button → calls `useMFASetup()` → shows QR code + backup codes → verify code input → activates
- If enabled: "Disable 2FA" button (requires password/passkey confirmation), "Regenerate backup codes" button

**Section 2: Passkeys**
- List of registered passkeys (device name, last used, created date)
- "Add passkey" button → calls `usePasskeyRegister()` → biometric prompt → added to list
- Each passkey: rename (inline edit) + delete (with confirmation)
- Count badge: "3 of 10 passkeys"

**Section 3: Account Recovery**
- Info text: "If you lose access to all your devices, you can recover your account via email."
- Show backup code count: "You have 6 unused backup codes"
- "View backup codes" button (requires re-auth) — not implemented in this task, just the UI structure

Style with Tailwind v4, use `@revealui/presentation` components. Follow existing admin page patterns from `apps/cms/src/app/(backend)/admin/settings/account/page.tsx`.

- [ ] **Step 2: Add navigation link**

Add "Security" link to the admin settings sidebar/nav (find the existing nav component that lists Account, API Keys, etc.).

- [ ] **Step 3: Manual verification**

Start dev server, navigate to `/admin/settings/security`, verify all three sections render.

- [ ] **Step 4: Commit**

```bash
git add apps/cms/src/app/(backend)/admin/settings/security/
git commit -m "feat(cms): add security settings page (2FA, passkeys, recovery)"
```

---

## Task 18: Integration Tests

**Files:**
- Create: `apps/cms/src/app/api/auth/__tests__/integration.test.ts`

- [ ] **Step 1: Write full-flow integration tests**

Test complete flows end-to-end (using PGlite + mocked WebAuthn):

1. **Password + TOTP flow**: Sign up → enable MFA → sign out → sign in → verify TOTP → session created
2. **Password + backup code flow**: Sign in with MFA → use backup code → session created, code consumed
3. **Passkey sign-up flow**: Register with passkey → backup codes returned → sign out → sign in with passkey → session created (no TOTP prompt)
4. **Passkey management**: Add passkey → rename → add second → delete first → try delete last (blocked if no password)
5. **Magic link recovery**: Request magic link → verify → temporary session → add new passkey → session upgraded
6. **MFA disable (passkey user)**: Enable MFA → disable with passkey re-auth → MFA disabled
7. **Edge case: expired challenge cookie** → 401
8. **Edge case: 10-passkey limit** → 400

- [ ] **Step 2: Run integration tests**

Run: `pnpm --filter cms test -- integration.test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/cms/src/app/api/auth/__tests__/integration.test.ts
git commit -m "test(cms): add 2FA and passkey integration tests"
```

---

## Task 19: Full Gate Check

- [ ] **Step 1: Run typecheck across all packages**

Run: `pnpm typecheck:all`
Expected: PASS — zero type errors

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: PASS — all tests pass including new ones

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS — Biome clean

- [ ] **Step 4: Run full gate**

Run: `pnpm gate`
Expected: PASS — all phases green

- [ ] **Step 5: Commit any fixes**

If any gate issues, fix them and commit:
```bash
git commit -m "fix: resolve gate issues from 2FA/passkey implementation"
```
