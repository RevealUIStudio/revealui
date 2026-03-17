# 2FA (TOTP) + Passkeys (WebAuthn) Design

> **Status:** Approved
> **Date:** 2026-03-17
> **Scope:** Finish existing TOTP 2FA backend + add WebAuthn passkeys + magic link recovery

---

## Summary

RevealUI's auth system currently supports password-based sign-in with session cookies, plus OAuth (GitHub, Google, Vercel). The TOTP 2FA backend is ~95% built (crypto, schema, contracts, sign-in detection) but lacks API routes and UI. This spec adds:

1. **TOTP 2FA** — wire up existing backend with API routes and frontend
2. **Passkeys (WebAuthn)** — passwordless sign-in/sign-up via biometrics (Face ID, fingerprint, Windows Hello, security keys)
3. **Magic link recovery** — email-based account recovery as a last resort

---

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | TOTP 2FA (finish existing) + Passkeys (new) |
| Passkey role | Alternative sign-in method; passwordless registration supported |
| Passkey + TOTP interaction | Passkey sign-in skips TOTP (inherently MFA) |
| Management UI | `/admin/settings/security` page |
| Passkey at sign-up | Yes — "Register with passkey" option on sign-up page |
| Passkey limit | 10 per account |
| Recovery | Backup codes (primary) + email magic link (last resort) |
| Challenge storage | Signed httpOnly cookie (stateless, 5-min TTL) |

---

## Data Model

### Existing: Users Table (no changes)

TOTP columns already in `packages/db/src/schema/users.ts`:

```
mfa_enabled     boolean  default(false)
mfa_secret      text     Base32-encoded TOTP secret
mfa_backup_codes jsonb   Array of bcrypt hashes
mfa_verified_at  timestamp
```

### New: `passkeys` Table

Location: `packages/db/src/schema/passkeys.ts`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `text` (PK) | Internal ID (cuid2) |
| `user_id` | `text` (FK → users) | Owner |
| `credential_id` | `text` (unique) | WebAuthn credential ID (base64url) |
| `public_key` | `bytea` | COSE public key from authenticator |
| `counter` | `integer` | Sign count for replay detection |
| `transports` | `jsonb` | `['internal', 'usb', 'ble', 'nfc']` |
| `aaguid` | `text` | Authenticator model identifier (auto device name/icon) |
| `device_name` | `text` | User-assigned label |
| `backed_up` | `boolean` | Whether passkey is synced (authenticator flags) |
| `created_at` | `timestamp` | Registration time |
| `last_used_at` | `timestamp` | Updated on each sign-in |

**Indexes:**
- `user_id` — for listing a user's passkeys
- `credential_id` — unique index for authentication lookup

### New: `magic_links` Table

Location: `packages/db/src/schema/magic-links.ts` (separate file, matching `password-reset-tokens.ts` convention)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `text` (PK) | Internal ID |
| `user_id` | `text` (FK → users) | Target user |
| `token_hash` | `text` | HMAC-SHA256 hash of the magic link token |
| `token_salt` | `text` | Per-token salt (matching password-reset-tokens pattern) |
| `expires_at` | `timestamp` | 15-minute expiry |
| `used_at` | `timestamp` | Null until consumed |
| `created_at` | `timestamp` | For audit |

**Indexes:**
- `user_id` — for listing/cleanup
- `token_hash` — unique, for lookup
- `expires_at` — for TTL cleanup queries

**Note:** Uses HMAC-SHA256 + per-token salt + `timingSafeEqual` for verification, matching the existing `password_reset_tokens` pattern in `packages/auth/src/server/password-reset.ts`.

---

## API Routes

All routes under `apps/cms/src/app/api/auth/`.

### TOTP 2FA Routes

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/mfa/setup` | Session | `initiateMFASetup()` → secret, QR URI, backup codes |
| `POST` | `/mfa/verify-setup` | Session | `verifyMFASetup()` → activates MFA |
| `POST` | `/mfa/verify` | None* | `verifyMFACode()` → creates session |
| `POST` | `/mfa/backup` | None* | `verifyBackupCode()` → creates session |
| `POST` | `/mfa/disable` | Session | `disableMFA()` → requires password or passkey re-auth (see note below) |
| `POST` | `/mfa/regenerate` | Session | `regenerateBackupCodes()` → new codes |
| `GET` | `/mfa/status` | Session | `isMFAEnabled()` → boolean |

*None = unauthenticated, requires valid signed `mfa-pending` cookie (not raw `mfaUserId`). See "MFA Pre-Auth Token" in Security section. Rate limited.*

**MFA disable contract update:** The existing `MFADisableRequestSchema` in contracts accepts only `{ password: string }`. This needs to become a discriminated union: `{ method: 'password', password: string } | { method: 'passkey', authenticationResponse: object }`. The `disableMFA()` function signature changes from `(userId, password)` to `(userId, proof)` where proof is either verified password or verified passkey assertion.

### Passkey Routes

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/passkey/register-options` | Session or sign-up | Generate WebAuthn registration challenge |
| `POST` | `/passkey/register-verify` | Session or sign-up | Verify attestation, store credential |
| `POST` | `/passkey/authenticate-options` | None | Generate WebAuthn authentication challenge |
| `POST` | `/passkey/authenticate-verify` | None | Verify assertion, create session |
| `GET` | `/passkey/list` | Session | List registered passkeys |
| `PATCH` | `/passkey/[id]` | Session | Rename a passkey |
| `DELETE` | `/passkey/[id]` | Session | Remove a passkey (block if last credential) |

### Recovery Routes

| Method | Path | Auth | Handler |
|--------|------|------|---------|
| `POST` | `/recovery/request` | None | Send magic link email (3/hour rate limit) |
| `POST` | `/recovery/verify` | None | Validate token → temporary session (30 min) |

---

## Auth Flows

### Flow 1: Password Sign-In with TOTP

```
POST /api/auth/sign-in { email, password }
  → if mfaEnabled: set signed `mfa-pending` cookie (httpOnly, secure, sameSite=strict, 5-min TTL)
  → return { requiresMfa: true } (no userId in response body)
  → Client shows TOTP input
POST /api/auth/mfa/verify { code }
  → Server reads userId from `mfa-pending` cookie (proves password was verified)
  → or POST /api/auth/mfa/backup { code }
  → Server verifies → creates session → sets cookie → clears mfa-pending cookie
```

### Flow 2: Passkey Sign-In

```
POST /api/auth/passkey/authenticate-options {}
  → Server generates challenge → signed cookie
  → Browser: navigator.credentials.get() → biometric prompt
POST /api/auth/passkey/authenticate-verify { assertion }
  → Server verifies signature + counter → creates session
  → TOTP skipped (passkey is inherently MFA)
```

### Flow 3: Sign-Up with Password

```
POST /api/auth/sign-up { email, password, name }
  → Session created → cookie set → verification email sent
```

### Flow 4: Sign-Up with Passkey (passwordless)

```
POST /api/auth/passkey/register-options { email, name }
  → Server validates email uniqueness (no user row created yet)
  → Generates challenge → signed cookie carries { challenge, email, name, expiresAt }
  → Browser: navigator.credentials.create() → biometric prompt
POST /api/auth/passkey/register-verify { attestation }
  → Server creates user (no password) + stores credential atomically (single transaction)
  → Creates session → cookie set
  → Mandatory: show backup codes (only recovery path)
```

**Important:** User row is NOT created in `register-options` — only after successful attestation in `register-verify`. This prevents orphaned user rows when the flow is abandoned. The signed cookie carries the pending email/name. Email uniqueness is ultimately enforced by the DB unique constraint in the `register-verify` transaction (handles race conditions between the options check and verify call).

### Flow 5: Adding a Passkey (settings)

```
GET /api/auth/passkey/list → show registered passkeys
POST /api/auth/passkey/register-options {} (authenticated)
  → Browser: navigator.credentials.create()
POST /api/auth/passkey/register-verify { attestation }
  → Server stores credential (enforces 10 max)
```

### Flow 6: Account Recovery (magic link)

```
POST /api/auth/recovery/request { email }
  → Token generated → HMAC-SHA256 + salt stored → email sent
  → User clicks link
POST /api/auth/recovery/verify { token }
  → Verify hash (timingSafeEqual) + expiry → temporary session (30 min)
  → User prompted to register new passkey or set password
  → Session rotated after new credential is added
```

**Temporary session:** Created with `expiresAt` set to 30 minutes (overrides the normal 1-day/7-day durations). A `recovery` flag is stored in session metadata to restrict actions — only credential management routes are accessible. After the user adds a new credential, `rotateSession()` is called to issue a full session.

**Implementation note:** `createSession()` in `packages/auth/src/server/session.ts` currently hardcodes expiry to 1-day or 7-day. It needs to be extended with an optional `expiresAt` override parameter and an optional `metadata` field for the `recovery` flag. Alternatively, add a `createTemporarySession()` variant.

**Expired magic link cleanup:** Expired rows cleaned up opportunistically on write (when creating new magic links for the same user, delete expired rows in the same transaction). No separate scheduled job needed.

### Edge Case: Last Credential Deletion

- Has password → allow delete
- Has another passkey → allow delete
- This is the only sign-in method → block: "You must have at least one sign-in method"

---

## Package & Library Strategy

### New Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `@simplewebauthn/server` | `packages/auth` | Server-side WebAuthn |
| `@simplewebauthn/browser` | `apps/cms` | Client-side WebAuthn browser API wrapper |

### Code Locations

| Layer | Location | Contents |
|-------|----------|----------|
| Crypto/core | `packages/auth/src/server/passkey.ts` | WebAuthn registration/verification, challenge signing |
| Crypto/core | `packages/auth/src/server/magic-link.ts` | Token generation, hashing, verification |
| Schema | `packages/db/src/schema/passkeys.ts` | `passkeys` + `magic_links` tables |
| Contracts | `packages/contracts/src/api/auth.ts` | New Zod schemas for passkey/recovery |
| API routes | `apps/cms/src/app/api/auth/mfa/` | 7 TOTP routes |
| API routes | `apps/cms/src/app/api/auth/passkey/` | 5 passkey routes + 2 dynamic |
| API routes | `apps/cms/src/app/api/auth/recovery/` | 2 recovery routes |
| React hooks | `packages/auth/src/react/usePasskey.ts` | `usePasskeyRegister()`, `usePasskeySignIn()` |
| React hooks | `packages/auth/src/react/useMFA.ts` | `useMFASetup()`, `useMFAVerify()` |
| UI | `apps/cms/src/app/(admin)/admin/settings/security/` | Security settings page |
| UI | `apps/cms/src/app/(auth)/sign-in/` | Updated with passkey option |
| UI | `apps/cms/src/app/(auth)/sign-up/` | Updated with passkey option |

---

## Security

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| TOTP verify | 5 attempts | 15 min |
| Backup code verify | 5 attempts | 15 min |
| Passkey authenticate | No limit | — (cryptographic, can't brute force) |
| Magic link request | 3 requests | 1 hour |
| Magic link verify | 5 attempts | 15 min |

### MFA Pre-Auth Token

After successful password verification when MFA is enabled, the server sets a signed `mfa-pending` cookie instead of returning `mfaUserId` in the response body. This proves the caller already passed the password check — prevents attackers from bypassing password verification by calling `/mfa/verify` directly with a known user ID.

- Signed with `REVEALUI_SECRET` (HMAC-SHA256)
- `httpOnly`, `secure`, `sameSite=strict`, `path=/api/auth/mfa`
- 5-minute `Max-Age`, cleared after successful verification
- Payload: `{ userId, expiresAt }`

### WebAuthn Challenge Cookie

- Signed with `REVEALUI_SECRET` (HMAC-SHA256)
- `httpOnly`, `secure`, `sameSite=strict`, `path=/api/auth/passkey`
- 5-minute `Max-Age`, cleared after verification
- Payload: `{ challenge, userId?, email?, name?, expiresAt }`

### WebAuthn Relying Party Configuration

- **RP ID:** `revealui.com` (matches `SESSION_COOKIE_DOMAIN`, enables cross-subdomain auth between `cms.revealui.com` and `api.revealui.com`)
- **RP Name:** `RevealUI`
- **Origin:** configurable per environment (`http://localhost:4000` for dev, `https://cms.revealui.com` for prod)
- Parameterized via `PasskeyConfig` (see Configuration section)

### Passkey-Only Safeguards

- Backup codes mandatory at passkey-only registration (server-enforced)
- Cannot delete last passkey without a password set
- Cannot delete last sign-in method of any kind
- Magic link recovery creates temporary session (30 min, `recovery` flag) — must add new credential
- `disableMFA()` for passkey-only users: requires passkey re-authentication (WebAuthn assertion) instead of password

### Session Rotation

- After MFA setup completion: rotate session via existing `rotateSession()`
- After recovery credential registration: rotate session (upgrade from temporary to full)
- Matches existing pattern in `password-reset.ts`

### Replay Protection

- WebAuthn `counter` checked and incremented on every sign-in
- Counter regression → reject (cloned authenticator)
- Backed-up/synced passkeys (counter=0) — counter check relaxed per industry standard

---

## Configuration (Parameterization)

Following the project's parameterization convention (`packages/auth/src/server/mfa.ts` `MFAConfig` pattern):

```ts
interface PasskeyConfig {
  maxPasskeysPerUser: number       // default: 10
  challengeTtlMs: number           // default: 5 * 60 * 1000 (5 min)
  rpId: string                     // default: 'revealui.com'
  rpName: string                   // default: 'RevealUI'
  origin: string | string[]        // default: env-based
}

interface MagicLinkConfig {
  tokenExpiryMs: number            // default: 15 * 60 * 1000 (15 min)
  tempSessionDurationMs: number    // default: 30 * 60 * 1000 (30 min)
  maxRequestsPerHour: number       // default: 3
}
```

Each module exports `configurePasskey()` / `configureMagicLink()` with `Partial<Config>` overrides for testing.

---

## Contracts (Zod Schemas)

New schemas in `packages/contracts/src/api/auth.ts`:

```ts
// Passkey
PasskeyRegisterOptionsRequestSchema   // { email?, name? } — empty when authenticated
PasskeyRegisterVerifyRequestSchema    // { attestationResponse: object, deviceName?: string }
PasskeyAuthenticateOptionsRequestSchema // {} — no fields needed
PasskeyAuthenticateVerifyRequestSchema  // { authenticationResponse: object }
PasskeyListResponseSchema             // { passkeys: Array<{ id, deviceName, aaguid, backedUp, createdAt, lastUsedAt }> }
PasskeyUpdateRequestSchema            // { deviceName: string }

// Recovery
RecoveryRequestSchema                 // { email: string }
RecoveryVerifyRequestSchema           // { token: string }
```

The `attestationResponse` and `authenticationResponse` objects use `z.object({}).passthrough()` since their shape is defined by the WebAuthn spec and validated by `@simplewebauthn/server`.

---

## Migration

Drizzle migration file: `packages/db/src/migrations/XXXX_add_passkeys_and_magic_links.sql`

Creates:
- `passkeys` table with indexes
- `magic_links` table with indexes

No existing table modifications needed (MFA columns already exist on `users`).

---

## Testing Strategy

### Unit Tests (`packages/auth`)

| File | Coverage |
|------|----------|
| `passkey.test.ts` | Challenge generation, attestation/assertion verification (mocked), counter validation, 10-key limit |
| `magic-link.test.ts` | Token generation, hash verification, expiry, single-use consumption |
| `mfa.test.ts` | Existing + full setup→verify→disable lifecycle |

### Integration Tests (`apps/cms`)

| Flow | Coverage |
|------|----------|
| Password + TOTP | Sign-in → requiresMfa → verify → session |
| Password + backup code | Sign-in → requiresMfa → backup → session, code consumed |
| Passkey sign-up | Register options → create → verify → session + backup codes |
| Passkey sign-in | Auth options → assertion → session, TOTP skipped |
| Passkey management | Add, rename, delete, block delete of last credential |
| MFA management | Setup → QR + codes → verify → enable → disable → regenerate |
| Magic link recovery | Request → email → verify → temp session → add credential |
| Edge cases | Expired challenge, replayed assertion, passkey limit, rate limit |

### Mocking

- `@simplewebauthn/server` — mock registration/authentication functions
- Email (Resend) — mock in magic link tests
- Database — PGlite (existing pattern)

### Estimated Test Count

~40-50 new tests across unit + integration.

---

## Out of Scope

- WebAuthn attestation trust anchors (accept self-attestation — standard for consumer apps)
- Hardware security key management UI beyond basic list/rename/delete
- Admin-enforced MFA policies (e.g., "all users must enable 2FA") — future feature
- SMS-based 2FA — intentionally excluded (insecure, SIM swap attacks)
