# @revealui/auth

Session-based authentication for RevealUI  -  database-backed sessions, rate limiting, brute force protection, and password reset.

## Features

- **Database Sessions**  -  PostgreSQL/NeonDB-backed sessions with SHA-256 token hashing
- **Secure Cookies**  -  HTTP-only, SameSite, secure flag, cross-subdomain support
- **Rate Limiting**  -  Configurable per-endpoint rate limits stored in database
- **Brute Force Protection**  -  Progressive lockout on failed sign-in attempts
- **Password Reset**  -  Token-based password reset flow with email integration
- **Password Validation**  -  Strength requirements and common password checks
- **React Hooks**  -  Client-side session management (`useSession`, `useSignIn`, `useSignOut`)
- **Framework Agnostic**  -  Works with Next.js, Hono, and other Node.js frameworks

## Installation

```bash
pnpm add @revealui/auth
```

## Usage

### Server-Side

```typescript
import { getSession, signIn, signOut, createSession } from '@revealui/auth/server'

// Validate session from request headers
const session = await getSession(request.headers)

// Sign in with email/password
const result = await signIn({ email, password })

// Sign out (invalidate session)
await signOut(sessionToken)
```

### Client-Side (React)

```typescript
'use client'
import { useSession, useSignIn, useSignOut } from '@revealui/auth/react'

function AuthComponent() {
  const { data: session, isLoading } = useSession()
  const { signIn } = useSignIn()
  const { signOut } = useSignOut()

  if (isLoading) return <div>Loading...</div>
  if (!session) return <button onClick={() => signIn({ email, password })}>Sign In</button>

  return (
    <div>
      <p>Hello, {session.user.name}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

## Exports

| Subpath | Contents |
|---------|----------|
| `@revealui/auth/server` | Server-side auth (session CRUD, sign in/out, rate limiting, brute force) |
| `@revealui/auth/client` | Client-side utilities |
| `@revealui/auth/react` | React hooks (`useSession`, `useSignIn`, `useSignOut`) |

## Security

- Passwords hashed with bcrypt
- Session tokens hashed with SHA-256 before storage
- HTTP-only cookies prevent XSS token theft
- SameSite cookie attribute prevents CSRF
- Rate limiting prevents abuse (configurable per endpoint)
- Brute force protection with progressive lockout
- Cookie domain supports cross-subdomain auth (e.g. `.revealui.com`)

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test
```

## When to Use This

- You need session-based auth with database-backed sessions for a RevealUI app
- You want built-in brute force protection and rate limiting without external services
- You need React hooks for client-side session management (`useSession`, `useSignIn`, `useSignOut`)
- **Not** for OAuth-only flows  -  use a dedicated OAuth provider and wire tokens through this package
- **Not** for stateless JWT auth  -  this package uses database sessions by design

## JOSHUA Alignment

- **Sovereign**: Sessions live in your PostgreSQL database, not a third-party auth service
- **Hermetic**: HTTP-only, SameSite cookies and SHA-256 token hashing prevent cross-boundary leaks
- **Justifiable**: Every security layer (bcrypt, progressive lockout, rate limiting) exists because the threat model demands it

## Related

- [Core Package](../core/README.md)  -  Runtime engine (uses auth for access control)
- [DB Package](../db/README.md)  -  Database schema (sessions, users, rate_limits tables)
- [Auth Guide](../../docs/AUTH.md)  -  Architecture, usage patterns, and security design

## License

MIT
