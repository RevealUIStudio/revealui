# @revealui/auth

Session-based authentication, password management, rate limiting, and brute-force protection.

```bash
npm install @revealui/auth
```

## Subpath Exports

| Import path | Environment | Purpose |
|-------------|-------------|---------|
| `@revealui/auth` | Both | Types + React hooks |
| `@revealui/auth/server` | Server only | Auth logic, sessions, rate limiting |
| `@revealui/auth/react` | Client | React hooks and components |

---

## Server API

Import from `@revealui/auth/server`.

### `signIn(email, password, options?): Promise<SignInResult>`

Signs in a user with email and password. Checks brute-force protection and rate limits before validating credentials.

```ts
import { signIn } from '@revealui/auth/server'

const result = await signIn('user@example.com', 'password123', {
  userAgent: req.headers.get('user-agent') ?? undefined,
  ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
})

if (result.success) {
  // Set session cookie: result.sessionToken
} else {
  // Show error: result.error
}
```

**Returns:**
```ts
interface SignInResult {
  success: boolean
  user?: User
  sessionToken?: string
  error?: string
}
```

---

### `signUp(email, password, name, options?): Promise<SignUpResult>`

Registers a new user. Validates password strength and checks signup whitelist if configured.

```ts
import { signUp } from '@revealui/auth/server'

const result = await signUp('user@example.com', 'SecurePass123!', 'Jane Smith', {
  ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
})
```

**Signup access control** (via env vars):
- `REVEALUI_SIGNUP_OPEN=true` — allow all signups (default)
- `REVEALUI_SIGNUP_WHITELIST=user@a.com,user@b.com` — restrict to listed emails

---

### `isSignupAllowed(email: string): boolean`

Checks whether a given email is permitted to sign up based on environment configuration.

---

## Session Management

### `createSession(userId, options?): Promise<{ token: string; session: Session }>`

Creates a new session for a user. Returns the session token (store this in a cookie).

```ts
import { createSession } from '@revealui/auth/server'

const { token, session } = await createSession(user.id, {
  persistent: true, // 7-day session (default: 1-day)
  userAgent: req.headers.get('user-agent') ?? undefined,
  ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
})

// Set cookie:
res.setHeader('Set-Cookie', `session=${token}; HttpOnly; Secure; SameSite=Lax`)
```

**Session expiry:** 7 days if `persistent: true`, 1 day otherwise.

---

### `getSession(headers: Headers): Promise<SessionData | null>`

Validates the session cookie from request headers. Updates the last-activity timestamp.

```ts
import { getSession } from '@revealui/auth/server'

const session = await getSession(req.headers)
if (!session) {
  return new Response('Unauthorized', { status: 401 })
}

const { user, session: sessionRow } = session
```

---

### `deleteSession(headers: Headers): Promise<boolean>`

Signs out the current user by deleting their session from the database.

---

### `deleteAllUserSessions(userId: string): Promise<void>`

Removes all active sessions for a user (force sign-out everywhere).

---

## Password Reset

### `generatePasswordResetToken(email: string): Promise<PasswordResetResult>`

Generates a time-limited (1 hour) password reset token. Uses HMAC-SHA256 with a per-token salt.

```ts
import { generatePasswordResetToken } from '@revealui/auth/server'

const result = await generatePasswordResetToken('user@example.com')
if (result.success && result.token) {
  await sendEmail({
    to: 'user@example.com',
    subject: 'Reset your password',
    body: `https://yourapp.com/reset?token=${result.token}`,
  })
}
```

---

### `validatePasswordResetToken(token: string): Promise<string | null>`

Verifies a reset token is valid and unexpired. Returns the associated `userId` or `null`.

---

### `resetPasswordWithToken(token: string, newPassword: string): Promise<PasswordResetResult>`

Resets the user's password. Validates password strength and marks the token as used (single-use).

---

### `invalidatePasswordResetToken(token: string): Promise<void>`

Manually invalidates a reset token before use.

---

## Password Validation

### `validatePasswordStrength(password: string): { valid: boolean; errors: string[] }`

Checks that a password meets minimum requirements. Returns all failing criteria.

```ts
const { valid, errors } = validatePasswordStrength('weak')
// { valid: false, errors: ['Must be at least 12 characters', 'Must contain a number'] }
```

### `meetsMinimumPasswordRequirements(password: string): boolean`

Quick boolean check — no error detail.

---

## Rate Limiting & Brute-Force

### `checkRateLimit(key: string): Promise<{ allowed: boolean }>`

Checks whether an action is rate-limited. Keys are arbitrary strings (e.g., `signin:${ip}`, `reset:${email}`).

### `getRateLimitStatus(key: string): Promise<RateLimitStatus>`

Returns the current window count and time-to-reset.

### `resetRateLimit(key: string): Promise<void>`

Clears the rate limit counter for a key.

### `isAccountLocked(email: string): Promise<{ locked: boolean; lockUntil?: number }>`

Checks if an account is temporarily locked due to repeated failed sign-in attempts.

### `recordFailedAttempt(email: string): Promise<void>`

Increments the failed-attempt counter. Called automatically by `signIn()`.

### `clearFailedAttempts(email: string): Promise<void>`

Resets the failed-attempt counter after a successful sign-in.

---

## Types

```ts
interface User {
  id: string
  name: string
  email: string | null
  role: string                      // 'admin' | 'editor' | 'viewer'
  status: string                    // 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
  lastActiveAt: Date | null
}

interface Session {
  id: string
  userId: string
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  persistent: boolean | null
  expiresAt: Date
  lastActivityAt: Date
}

interface AuthSession {
  session: Session
  user: User
}
```

---

## Error Classes

```ts
import { AuthError, AuthenticationError, SessionError, TokenError } from '@revealui/auth/server'
```

| Class | When thrown |
|-------|-------------|
| `AuthError` | Base class for all auth errors |
| `AuthenticationError` | Invalid credentials, locked account |
| `SessionError` | Invalid or expired session |
| `TokenError` | Invalid or expired reset token |

---

## Related

- [`@revealui/core`](/reference/core) — `buildConfig`, license validation
- [`@revealui/db`](/reference/db) — Session and user database schema
- [Authentication guide](/docs/AUTH) — Full auth setup guide
