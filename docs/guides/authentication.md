# Authentication

RevealUI uses session-based authentication backed by database-stored sessions. There are no JWTs. The sole authentication mechanism is a `revealui-session` cookie containing a hashed token that maps to a row in the `sessions` table.

**Package:** `@revealui/auth`

---

## How It Works

1. User signs in with email/password or an OAuth provider
2. A session row is created in the `sessions` table with a hashed token
3. The raw token is set as an `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `revealui-session`
4. Every subsequent request validates the cookie against the hashed token in the database
5. Sessions expire after a configurable TTL and are refreshed on activity

No tokens are stored in `localStorage` or sent as `Authorization` headers.

---

## Setup

### Install

```bash
pnpm add @revealui/auth
```

### Environment Variables

```env
# Required: 32+ character random string for token hashing
REVEALUI_SECRET=<your-secret>

# Required: your app URL (used for cookie domain)
REVEALUI_PUBLIC_SERVER_URL=https://admin.yourdomain.com

# Optional: OAuth providers
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
VERCEL_CLIENT_ID=...
VERCEL_CLIENT_SECRET=...
```

### Database

Auth requires the `users` and `sessions` tables. Run migrations to create them:

```bash
pnpm db:migrate
```

---

## Email/Password Authentication

### Sign Up (Server)

```ts
import { signUp } from '@revealui/auth';

const result = await signUp('user@example.com', 'securepassword', {
  name: 'Jane Doe',
  ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  userAgent: request.headers.get('user-agent') ?? undefined,
});

if (result.success) {
  // Set the session cookie
  setCookie(response, 'revealui-session', result.sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}
```

### Sign In (Server)

```ts
import { signIn } from '@revealui/auth';

const result = await signIn(email, password, {
  ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  userAgent: request.headers.get('user-agent') ?? undefined,
});

if (!result.success) {
  // result.error contains the reason
  return new Response(JSON.stringify({ error: result.error }), { status: 401 });
}

if (result.requiresMfa) {
  // Prompt the user for a TOTP code before completing sign-in
  return new Response(JSON.stringify({ requiresMfa: true, mfaUserId: result.mfaUserId }));
}

// Set session cookie as above
```

### Password Requirements

Passwords are validated by `validatePasswordStrength()`:

- Minimum 8 characters
- At least one uppercase letter, one lowercase letter, and one digit
- Hashed with bcrypt before storage (never stored in plaintext)

---

## OAuth Providers

RevealUI supports three OAuth providers out of the box: GitHub, Google, and Vercel. Each provider follows the same pattern.

### Configuring a Provider

1. Register an OAuth app with the provider
2. Set the callback URL to `https://yourdomain.com/api/auth/callback/<provider>`
3. Add the client ID and secret to your environment variables

### OAuth Flow

```
User clicks "Sign in with GitHub"
  -> Redirect to /api/auth/github
  -> GitHub authorization screen
  -> Callback to /api/auth/callback/github
  -> RevealUI creates or links user account
  -> Session cookie set, redirect to dashboard
```

### Account Linking

When a user signs in with OAuth, RevealUI checks for an existing account with the same email. If found, the OAuth account is linked to the existing user. This requires the user to already have an authenticated session -- unauthenticated linking is not permitted for security reasons.

OAuth accounts are stored in the `oauth_accounts` table with provider name, provider account ID, and a foreign key to the `users` table.

---

## React Hooks

The `@revealui/auth` package exports React hooks for client-side auth flows.

### useSession

```tsx
import { useSession } from '@revealui/auth';

function Dashboard() {
  const { session, user, loading } = useSession();

  if (loading) return <div>Loading...</div>;
  if (!session) return <Redirect to="/signin" />;

  return <div>Welcome, {user.name}</div>;
}
```

### useSignIn

```tsx
import { useSignIn } from '@revealui/auth';

function SignInForm() {
  const { signIn, loading, error } = useSignIn();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await signIn(
      form.get('email') as string,
      form.get('password') as string,
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={loading}>Sign In</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

### useSignUp

```tsx
import { useSignUp } from '@revealui/auth';

function SignUpForm() {
  const { signUp, loading, error } = useSignUp();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await signUp(
      form.get('email') as string,
      form.get('password') as string,
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={loading}>Create Account</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

### useSignOut

```tsx
import { useSignOut } from '@revealui/auth';

function SignOutButton() {
  const { signOut } = useSignOut();
  return <button onClick={signOut}>Sign Out</button>;
}
```

---

## Password Reset

RevealUI includes a server-side password reset flow.

### Request a Reset

```ts
import { generatePasswordResetToken } from '@revealui/auth';

// Generates a time-limited token and returns it.
// Your application is responsible for sending the email with the reset link.
const result = await generatePasswordResetToken(email);

if (result.success && result.token && result.tokenId) {
  // Both tokenId and token are needed to complete the reset
  await sendResetEmail(email, result.tokenId, result.token);
}
```

### Complete the Reset

```ts
import { resetPasswordWithToken } from '@revealui/auth';

// tokenId identifies the reset row, token is the plain-text secret.
// Both are delivered in the reset URL, e.g. `?id=<tokenId>&token=<token>`.
const result = await resetPasswordWithToken(tokenId, token, newPassword);

if (!result.success) {
  // Token expired or invalid, or password does not meet strength requirements
  return new Response(JSON.stringify({ error: result.error }), { status: 400 });
}
```

Reset tokens are single-use and expire after 15 minutes.

---

## Rate Limiting

All auth endpoints are rate-limited by IP address using an in-memory sliding window.

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Sign in | 15 minutes | 10 |
| Sign up | 15 minutes | 5 |
| Password reset | 15 minutes | 3 |

When the limit is exceeded, the response includes a `429 Too Many Requests` status and a `Retry-After` header.

### Brute Force Protection

Failed sign-in attempts are tracked per email address. After 5 consecutive failures, the account is locked for 30 minutes. The lock duration increases with repeated lockouts.

```ts
import { isAccountLocked } from '@revealui/auth';

const check = await isAccountLocked(email);
if (check.locked) {
  const minutesLeft = Math.ceil(
    (check.lockUntil - Date.now()) / (60 * 1000),
  );
  // Account is locked for `minutesLeft` more minutes
}
```

Successful sign-in clears the failed attempt counter.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/sign-up` | Create account + session |
| POST | `/api/auth/sign-in` | Authenticate + create session |
| POST | `/api/auth/sign-out` | Revoke session |
| POST | `/api/auth/password-reset` | Request password reset token |
| PUT | `/api/auth/password-reset` | Complete password reset |
| GET | `/api/auth/<provider>` | Start OAuth flow |
| GET | `/api/auth/callback/<provider>` | OAuth callback |

All endpoints accept and return JSON. Error responses use the format:

```json
{
  "error": "Description of what went wrong"
}
```

---

## Session Management

### Validating a Session

```ts
import { getSession } from '@revealui/auth';

// Reads the `revealui-session` cookie from the request headers,
// looks up the matching row, and returns the session + user.
const authSession = await getSession(request.headers);

if (!authSession) {
  // Session is invalid or expired
  return new Response('Unauthorized', { status: 401 });
}

// authSession.user — the authenticated user
// authSession.session — the session record
```

### Revoking a Session

```ts
import { deleteSession } from '@revealui/auth';

// Deletes the session associated with the request's cookie.
// Returns true if a session was deleted, false if none matched.
await deleteSession(request.headers);
```

### Cookie Domain

For cross-subdomain auth (e.g., `admin.revealui.com` and `api.revealui.com`), set the cookie domain to `.revealui.com`. This allows the session cookie to be sent to all subdomains.

---

## Security Checklist

- [ ] `REVEALUI_SECRET` is at least 32 characters and randomly generated
- [ ] Session cookie uses `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] OAuth callback URLs are registered with exact paths
- [ ] Rate limiting is enabled for all auth endpoints
- [ ] Password reset tokens are single-use and time-limited
- [ ] HTTPS is enforced in production (cookie `Secure` flag requires it)

---

## Related Documentation

- [Auth & Security Reference](../AUTH.md) -- Full auth system reference
- [Environment Variables](../ENVIRONMENT-VARIABLES-GUIDE.md) -- All configuration options
- [Database Guide](../DATABASE.md) -- Schema and migration details
