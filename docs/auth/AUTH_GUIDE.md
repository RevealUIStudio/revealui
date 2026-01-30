# RevealUI Authentication - Developer Guide

**Last Updated:** 2025-01-30
**Package:** `@revealui/auth`

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Client-Side Usage (React)](#client-side-usage-react)
3. [Server-Side Usage](#server-side-usage)
4. [API Endpoints](#api-endpoints)
5. [Security](#security)
6. [Error Handling](#error-handling)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## Quick Start

### Installation

```bash
# Already installed in RevealUI monorepo
# Package: @revealui/auth
```

### Basic HTTP Usage

#### Sign Up

```typescript
const response = await fetch('/api/auth/sign-up', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
    name: 'John Doe',
  }),
})

const data = await response.json()
// Response includes user data and sets session cookie
```

#### Sign In

```typescript
const response = await fetch('/api/auth/sign-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
  }),
})

const data = await response.json()
// Response includes user data and sets session cookie
```

#### Sign Out

```typescript
const response = await fetch('/api/auth/sign-out', {
  method: 'POST',
})

// Session cookie is cleared
```

---

## Client-Side Usage (React)

### 1. Session Hook

```typescript
'use client'
// components/UserProfile.tsx
import { useSession } from '@revealui/auth/react'

export function UserProfile() {
  const { data: session, isLoading, error } = useSession()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error.message}</div>
  }

  if (!session) {
    return <div>Please sign in</div>
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}!</h1>
      <p>Email: {session.user.email}</p>
      <p>Role: {session.user.role}</p>
    </div>
  )
}
```

### 2. Sign In Form

```typescript
'use client'
// components/SignInForm.tsx
import { useState, FormEvent } from 'react'
import { useSignIn } from '@revealui/auth/react'
import { useRouter } from 'next/navigation'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { signIn, isLoading, error } = useSignIn()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const result = await signIn({ email, password })

    if (result.success) {
      router.push('/dashboard')
      router.refresh() // Refresh to update session
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error.message}</div>}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
```

### 3. Sign Up Form

```typescript
'use client'
// components/SignUpForm.tsx
import { useState, FormEvent } from 'react'
import { useSignUp } from '@revealui/auth/react'
import { useRouter } from 'next/navigation'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const { signUp, isLoading, error } = useSignUp()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const result = await signUp({ email, password, name })

    if (result.success) {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error.message}</div>}

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        required
      />

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min 8 characters)"
        required
        minLength={8}
      />

      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Sign Up'}
      </button>
    </form>
  )
}
```

### 4. Sign Out Button

```typescript
'use client'
// components/SignOutButton.tsx
import { useSignOut } from '@revealui/auth/react'

export function SignOutButton() {
  const { signOut, isLoading } = useSignOut()

  return (
    <button onClick={() => signOut()} disabled={isLoading}>
      {isLoading ? 'Signing out...' : 'Sign Out'}
    </button>
  )
}
```

### 5. Protected Route Component

```typescript
'use client'
// components/ProtectedRoute.tsx
import { useSession } from '@revealui/auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/login')
    }
  }, [session, isLoading, router])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!session) {
    return null
  }

  return <>{children}</>
}
```

---

## Server-Side Usage

### 1. Session Validation in API Route

```typescript
// apps/cms/src/app/api/protected/route.ts
import { getSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    message: `Hello, ${session.user.name}!`,
    userId: session.user.id,
  })
}
```

### 2. Shape Proxy with Authentication

```typescript
// apps/cms/src/app/api/shapes/agent-contexts/route.ts
import { getSession } from '@revealui/auth/server'
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy'
import { type NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Validate session
  const session = await getSession(request.headers)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Build ElectricSQL URL with row-level filtering
  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'agent_contexts')
  originUrl.searchParams.set('where', `agent_id = '${session.user.id}'`)

  // Proxy request
  return proxyElectricRequest(originUrl)
}
```

### 3. Middleware for Route Protection

```typescript
// apps/cms/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@revealui/auth/server'

export async function middleware(request: NextRequest) {
  // Protect dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const session = await getSession(request.headers)

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
```

### 4. Server Functions

#### `getSession(headers: Headers)`

Get current session from request headers.

```typescript
import { getSession } from '@revealui/auth/server'

const session = await getSession(request.headers)
if (!session) {
  // Unauthorized
}
// Use session.user and session.session
```

#### `createSession(userId: string, options?)`

Create a new session for a user.

#### `deleteSession(headers: Headers)`

Delete current session (sign out).

```typescript
import { deleteSession } from '@revealui/auth/server'

await deleteSession(request.headers)
```

---

## API Endpoints

### `POST /api/auth/sign-up`

Creates a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "John Doe"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "viewer",
    "avatarUrl": null
  }
}
```

**Error Responses:**
- `400`: Invalid input (missing fields, invalid email, weak password)
- `400`: Email already exists
- `429`: Rate limit exceeded

**Rate Limit:** 5 attempts per 15 minutes per IP

---

### `POST /api/auth/sign-in`

Authenticates a user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "viewer"
  }
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials
- `429`: Rate limit exceeded or account locked

**Rate Limit:** 5 attempts per 15 minutes per IP
**Brute Force Protection:** Account locked after 5 failed attempts for 30 minutes

---

### `POST /api/auth/sign-out`

Signs out the current user by deleting their session.

**Response (200):**
```json
{
  "success": true
}
```

**Note:** Session cookie is automatically cleared.

---

### `POST /api/auth/password-reset`

Generates a password reset token.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "Password reset token generated"
}
```

**⚠️ Status:** Email sending not yet implemented. Token generation works but email delivery is incomplete.

---

### `PUT /api/auth/password-reset`

Resets password using a reset token.

**Request:**
```json
{
  "token": "reset-token",
  "password": "NewPassword123"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

## React Hooks Reference

### `useSession()`

Get current session with loading and error states.

**Returns:**
```typescript
{
  data: Session | null
  isLoading: boolean
  error: Error | null
}
```

### `useSignIn()`

Sign in hook with email/password.

**Returns:**
```typescript
{
  signIn: (credentials: { email: string, password: string }) => Promise<Result>
  isLoading: boolean
  error: Error | null
}
```

### `useSignOut()`

Sign out hook.

**Returns:**
```typescript
{
  signOut: () => Promise<void>
  isLoading: boolean
}
```

### `useSignUp()`

Sign up hook with validation.

**Returns:**
```typescript
{
  signUp: (data: { email: string, password: string, name: string }) => Promise<Result>
  isLoading: boolean
  error: Error | null
}
```

---

## Security

### Password Requirements

- Minimum 8 characters
- Maximum 128 characters
- Must contain at least one uppercase letter
- Must contain at least one lowercase letter
- Must contain at least one number

**Example Valid Passwords:**
- `Password123`
- `MySecure123!`
- `Test123Password`

**Example Invalid Passwords:**
- `password` (no uppercase, no number)
- `PASSWORD123` (no lowercase)
- `Password` (no number)

### Rate Limiting

Rate limiting is applied to all authentication endpoints:

- **Sign-Up:** 5 attempts per 15 minutes per IP
- **Sign-In:** 5 attempts per 15 minutes per IP
- **Sign-Out:** 10 attempts per 15 minutes per IP

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

**⚠️ Limitation:** Uses in-memory storage. Won't work across multiple servers or after server restart.

### Brute Force Protection

Accounts are automatically locked after 5 failed login attempts:

- **Lock Duration:** 30 minutes
- **Reset:** Automatically unlocks after lock duration expires
- **Error Message:** "Account locked due to too many failed attempts. Please try again in X minutes."

**⚠️ Limitation:** Uses in-memory storage. Won't work across multiple servers or after server restart.

### Security Features

✅ **Implemented:**
1. **Password Hashing** - bcrypt with 12 salt rounds
2. **Rate Limiting** - IP-based rate limiting
3. **Brute Force Protection** - Account locking after failed attempts
4. **Input Sanitization** - Email and name sanitization
5. **CSRF Protection** - SameSite cookies, HttpOnly flag, Secure flag (production)
6. **SQL Injection Prevention** - Parameterized queries via Drizzle ORM

⚠️ **Limitations:**
1. **In-Memory Stores** - Rate limits and brute force protection won't scale horizontally
2. **Email Sending** - Password reset emails not implemented
3. **Session Cleanup** - No automatic cleanup job for expired sessions

---

## Error Handling

### Common Errors

**400 Bad Request:**
- Missing required fields
- Invalid email format
- Weak password
- Email already exists (sign-up)

**401 Unauthorized:**
- Invalid credentials (sign-in)
- Missing or invalid session

**429 Too Many Requests:**
- Rate limit exceeded
- Account locked (brute force protection)

**500 Internal Server Error:**
- Database connection issues
- Unexpected server errors

### Error Response Format

```json
{
  "error": "Error message here"
}
```

---

## Troubleshooting

### "Too many login attempts"

**Cause:** Rate limit exceeded or account locked

**Solution:**
- Wait 15 minutes for rate limit reset
- Wait 30 minutes if account is locked
- Check rate limit headers for exact wait time

### "Invalid email or password"

**Cause:** Wrong credentials or user doesn't exist

**Solution:**
- Verify email and password
- Check for typos
- Try password reset (when email implemented)

### "Database connection failed"

**Cause:** Database not available or connection string incorrect

**Solution:**
- Check `DATABASE_URL` or `POSTGRES_URL` environment variable
- Verify database is running
- Check network connectivity

### Session Not Persisting

**Cause:** Cookie not set or expired

**Solution:**
- Check browser cookie settings
- Verify `sameSite` and `secure` flags match environment
- Check session expiration time
- Ensure HTTPS in production (required for Secure cookie flag)

---

## Best Practices

1. **Always validate input on frontend AND backend**
2. **Never expose error details in production** (already handled)
3. **Use HTTPS in production** (Secure cookie flag requires it)
4. **Monitor rate limit hits** for abuse detection
5. **Log authentication events** for security auditing
6. **Implement email verification** before allowing full access
7. **Use strong passwords** (enforced by validation)
8. **Handle errors gracefully** in UI
9. **Refresh session data** after mutations (router.refresh())
10. **Protect sensitive routes** with middleware or ProtectedRoute component

---

## Migration to Horizontal Scaling

When ready to scale horizontally, migrate in-memory stores:

1. **Rate Limiting:** Move to Redis with TTL
   - Use Redis INCR with EXPIRE
   - Key format: `ratelimit:{ip}:{endpoint}`

2. **Brute Force Protection:** Move to Redis with TTL
   - Use Redis INCR with EXPIRE
   - Key format: `bruteforce:{email}`

3. **Password Reset Tokens:** Move to database table
   - Use existing `verifications` table
   - Ensure proper expiration handling

See [AUTH_SYSTEM.md](./AUTH_SYSTEM.md) for architecture details.

---

## Related Documentation

- [AUTH_SYSTEM.md](./AUTH_SYSTEM.md) - Authentication system architecture and design
- [AUTH_MIGRATION_GUIDE.md](./AUTH_MIGRATION_GUIDE.md) - JWT to session migration guide
- [CSRF Protection](../security/CSRF_PROTECTION.md) - CSRF protection strategy
- [Security Testing](../testing/PENETRATION_TESTING_GUIDE.md) - Security testing guide
- [Project Status](../PROJECT_STATUS.md) - Overall project status

---

**Last Updated:** 2025-01-30
**Package:** `@revealui/auth`
