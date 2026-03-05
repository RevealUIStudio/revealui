# @revealui/auth

Session-based authentication, password management, rate limiting, and brute-force protection.

```bash
npm install @revealui/auth
```

## Subpath Exports

| Import path | Environment | Purpose |
|-------------|-------------|---------|
| `@revealui/auth` | Both | Re-exports server + react + types |
| `@revealui/auth/server` | Server only | Auth, sessions, password reset, rate limiting, OAuth |
| `@revealui/auth/react` | Client only | `useSession`, `useSignIn`, `useSignOut`, `useSignUp` |

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

### `getFailedAttemptCount(email: string): Promise<number>`

Returns the current number of consecutive failed sign-in attempts for an email address.

---

## OAuth (SSO)

Import from `@revealui/auth/server`. Supports Google, GitHub, and Vercel providers.

**Required environment variables:**
```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
VERCEL_CLIENT_ID / VERCEL_CLIENT_SECRET
REVEALUI_SECRET   # used for HMAC state signing
```

### `generateOAuthState(provider, redirectTo): { state: string; cookieValue: string }`

Generates a signed OAuth state token for CSRF protection. The `cookieValue` should be stored as a short-lived HttpOnly cookie; `state` is passed as the OAuth `state` query parameter.

```ts
import { generateOAuthState } from '@revealui/auth/server'

const { state, cookieValue } = generateOAuthState('google', '/dashboard')
// Set-Cookie: oauth_state=<cookieValue>; HttpOnly; Secure; SameSite=Lax; Max-Age=600
// Redirect to: buildAuthUrl('google', redirectUri, state)
```

### `verifyOAuthState(state, cookieValue): { provider: string; redirectTo: string } | null`

Verifies the OAuth state on the callback. Returns the decoded provider and `redirectTo` if valid, `null` if the HMAC check fails or the values don't match. Uses constant-time comparison to prevent timing attacks.

```ts
const verified = verifyOAuthState(
  searchParams.get('state'),
  req.cookies.get('oauth_state')?.value ?? null,
)
if (!verified) return new Response('Invalid state', { status: 400 })
const { provider, redirectTo } = verified
```

### `buildAuthUrl(provider, redirectUri, state): string`

Constructs the provider's authorization URL. Supported providers: `'google'`, `'github'`, `'vercel'`.

```ts
import { buildAuthUrl, generateOAuthState } from '@revealui/auth/server'

const { state, cookieValue } = generateOAuthState('github', '/dashboard')
const authUrl = buildAuthUrl('github', 'https://yourapp.com/auth/callback/github', state)
return Response.redirect(authUrl)
```

### `exchangeCode(provider, code, redirectUri): Promise<string>`

Exchanges the OAuth authorization code for an access token. Returns the access token string.

### `fetchProviderUser(provider, accessToken): Promise<ProviderUser>`

Fetches the user profile from the OAuth provider using an access token.

```ts
interface ProviderUser {
  id: string
  email: string | null
  name: string
  avatarUrl: string | null
}
```

### `upsertOAuthUser(provider, providerUser): Promise<User>`

Finds or creates a local user for the given OAuth identity. Links OAuth accounts to existing users by email if a match is found. New users are created with `role: 'admin'`.

**Full OAuth callback flow:**
```ts
import {
  buildAuthUrl, exchangeCode, fetchProviderUser,
  generateOAuthState, upsertOAuthUser, verifyOAuthState,
} from '@revealui/auth/server'

// Step 1 — Initiate (GET /auth/oauth/:provider)
const { state, cookieValue } = generateOAuthState(provider, redirectTo)
const authUrl = buildAuthUrl(provider, callbackUrl, state)
// Set cookie + redirect to authUrl

// Step 2 — Callback (GET /auth/callback/:provider)
const verified = verifyOAuthState(searchParams.get('state'), oauthStateCookie)
if (!verified) return error(400)
const accessToken = await exchangeCode(provider, searchParams.get('code')!, callbackUrl)
const providerUser = await fetchProviderUser(provider, accessToken)
const user = await upsertOAuthUser(provider, providerUser)
const { token } = await createSession(user.id)
// Set session cookie + redirect to verified.redirectTo
```

---

## React Hooks

Import from `@revealui/auth` or `@revealui/auth/react`. All hooks are client-only (`'use client'`).

### `useSession(): UseSessionResult`

Fetches the current session from `GET /api/auth/session` on mount. Automatically aborts in-flight requests on unmount.

```tsx
import { useSession } from '@revealui/auth'

function Header() {
  const { data: session, isLoading, error, refetch } = useSession()

  if (isLoading) return <Spinner />
  if (!session) return <Link href="/login">Sign in</Link>

  return <span>Hello, {session.user.name}</span>
}
```

**Returns:**
```ts
interface UseSessionResult {
  data: AuthSession | null  // null when not signed in
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>  // manually refresh
}
```

---

### `useSignIn(): UseSignInResult`

Calls `POST /api/auth/sign-in` with email and password.

```tsx
import { useSignIn } from '@revealui/auth'

function SignInForm() {
  const { signIn, isLoading } = useSignIn()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await signIn({ email, password })
    if (result.success) router.push('/dashboard')
    else setError(result.error)
  }
}
```

**Returns:**
```ts
interface UseSignInResult {
  signIn: (input: { email: string; password: string }) =>
    Promise<{ success: boolean; user?: User; error?: string }>
  isLoading: boolean
  error: Error | null
}
```

---

### `useSignUp(): UseSignUpResult`

Calls `POST /api/auth/sign-up` with email, password, and name.

```tsx
import { useSignUp } from '@revealui/auth'

const { signUp, isLoading } = useSignUp()
const result = await signUp({ email, password, name: 'Jane Smith' })
```

**Returns:**
```ts
interface UseSignUpResult {
  signUp: (input: { email: string; password: string; name: string }) =>
    Promise<{ success: boolean; user?: User; error?: string }>
  isLoading: boolean
  error: Error | null
}
```

---

### `useSignOut(): UseSignOutResult`

Calls `POST /api/auth/sign-out` and redirects to `/login` on success.

```tsx
import { useSignOut } from '@revealui/auth'

function SignOutButton() {
  const { signOut, isLoading } = useSignOut()
  return <button onClick={signOut} disabled={isLoading}>Sign out</button>
}
```

**Returns:**
```ts
interface UseSignOutResult {
  signOut: () => Promise<void>
  isLoading: boolean
  error: Error | null
}
```

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
| `DatabaseError` | Underlying DB query failed |

---

## Related

- [`@revealui/core`](/reference/core) — `buildConfig`, license validation
- [`@revealui/db`](/reference/db) — Session and user database schema
- [Authentication guide](/docs/AUTH) — Full auth setup guide
