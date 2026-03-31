---
title: "Authentication System"
description: "Session-based auth, OAuth, password reset, rate limiting, and brute force protection"
category: guide
audience: developer
---

# RevealUI Authentication System

**Last Updated:** 2026-03-05
**Package:** `@revealui/auth`
**Status:** Production-ready
**Production Readiness:** 8.5/10 🟢

---

## Table of Contents

1. [Overview](#overview)
   - [Key Features](#key-features)
   - [Design Principles](#design-principles)
2. [Architecture](#architecture)
   - [High-Level Architecture](#high-level-architecture)
   - [Database Schema](#database-schema)
3. [Session Management](#session-management)
   - [Session Creation](#session-creation)
   - [Session Validation](#session-validation)
   - [Session Refresh](#session-refresh)
   - [Session Revocation](#session-revocation)
4. [Security Features](#security-features)
   - [Secure Cookies](#1-secure-cookies)
   - [Token Hashing](#2-token-hashing)
   - [CSRF Protection](#3-csrf-protection)
   - [Rate Limiting](#4-rate-limiting)
   - [Brute Force Protection](#5-brute-force-protection)
   - [Password Security](#6-password-security)
   - [Input Sanitization](#7-input-sanitization)
5. [Quick Start](#quick-start)
   - [Installation](#installation)
   - [Basic HTTP Usage](#basic-http-usage)
6. [Client-Side Usage (React)](#client-side-usage-react)
   - [Session Hook](#1-session-hook)
   - [Sign In Form](#2-sign-in-form)
   - [Sign Up Form](#3-sign-up-form)
   - [Sign Out Button](#4-sign-out-button)
   - [Protected Route Component](#5-protected-route-component)
7. [Server-Side Usage](#server-side-usage)
   - [Session Validation in API Route](#1-session-validation-in-api-route)
   - [Shape Proxy with Authentication](#2-shape-proxy-with-authentication)
   - [Middleware for Route Protection](#3-middleware-for-route-protection)
   - [Server Functions](#4-server-functions)
8. [API Endpoints](#api-endpoints)
   - [POST /api/auth/sign-up](#post-apiauthsign-up)
   - [POST /api/auth/sign-in](#post-apiauthsign-in)
   - [POST /api/auth/sign-out](#post-apiauthsign-out)
   - [POST /api/auth/password-reset](#post-apiauthpassword-reset)
   - [PUT /api/auth/password-reset](#put-apiauthpassword-reset)
9. [React Hooks Reference](#react-hooks-reference)
   - [useSession()](#usesession)
   - [useSignIn()](#usesignin)
   - [useSignOut()](#usesignout)
   - [useSignUp()](#usesignup)
10. [Configuration and Setup](#configuration-and-setup)
    - [Environment Variables](#environment-variables)
    - [Database Setup](#database-setup)
11. [Migration Guide (JWT to Session-Based)](#migration-guide-jwt-to-session-based)
    - [Current System (JWT)](#current-system-jwt)
    - [New System (Sessions)](#new-system-sessions)
    - [Migration Steps](#migration-steps)
    - [Migration Checklist](#migration-checklist)
    - [Rollback Plan](#rollback-plan)
12. [Best Practices](#best-practices)
13. [Error Handling](#error-handling)
    - [Common Errors](#common-errors)
    - [Error Response Format](#error-response-format)
14. [Troubleshooting](#troubleshooting)
15. [Current Status and Roadmap](#current-status-and-roadmap)
    - [What Works](#what-works)
    - [What Needs Work](#what-needs-work)
    - [Production Deployment](#production-deployment)
16. [Migration to Horizontal Scaling](#migration-to-horizontal-scaling)
17. [Related Documentation](#related-documentation)
18. [References](#references)

---

## Overview

The RevealUI authentication system is a modern, database-backed authentication solution inspired by Better Auth, Neon Auth, and Supabase Auth. It provides email/password authentication with session management, rate limiting, and brute force protection.

### Key Features

- ✅ Email/password authentication
- ✅ Session management (database-backed)
- ✅ Rate limiting and brute force protection
- ✅ Password hashing (bcrypt)
- ✅ CSRF protection
- ✅ SQL injection prevention
- ✅ Password reset (with email delivery via Resend/SMTP)

### Design Principles

1. **Database as Source of Truth** - All auth data stored in PostgreSQL (NeonDB)
2. **Session-Based Authentication** - Secure, revocable sessions stored in database
3. **Framework Agnostic** - Works with Next.js, TanStack Start, and React SPAs
4. **Type-Safe** - Full TypeScript support with Zod validation
5. **Secure by Default** - CSRF protection, secure cookies, rate limiting
6. **Developer Experience** - Simple API, clear patterns, good defaults

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser)                        │
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   React      │    │  Next.js     │    │ TanStack    │  │
│  │  Components  │    │  Components  │    │  Start      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                    │          │
│         └───────────────────┴────────────────────┘          │
│                            │                                │
│                   ┌────────▼────────┐                      │
│                   │  Auth Client    │                      │
│                   │  (useSession)   │                      │
│                   └────────┬────────┘                      │
└────────────────────────────│────────────────────────────────┘
                             │
                             │ HTTP + Cookies
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Server (Next.js/TanStack Start)           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Auth API Routes                           │ │
│  │  - POST /api/auth/sign-in                              │ │
│  │  - POST /api/auth/sign-up                              │ │
│  │  - POST /api/auth/sign-out                             │ │
│  │  - GET  /api/auth/session                              │ │
│  │  - POST /api/auth/refresh                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                            │                                │
│                   ┌────────▼────────┐                      │
│                   │  Auth Server   │                      │
│                   │  (Session Mgmt)│                      │
│                   └────────┬────────┘                      │
│                            │                                │
└────────────────────────────│────────────────────────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │   PostgreSQL      │
                   │   (NeonDB)        │
                   │                   │
                   │  - users          │
                   │  - sessions       │
                   │  - accounts       │
                   │  - verifications  │
                   └──────────────────┘
```

### Database Schema

#### Users Table

```typescript
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

#### Sessions Table

```typescript
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(), // Hashed session token
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

#### Accounts Table (OAuth providers)

```typescript
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google', 'github', etc.
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

#### Verifications Table (Email verification, password reset)

```typescript
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(), // Email or phone
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

---

## Session Management

### Session Creation

1. User signs in with email/password or OAuth
2. Server validates credentials
3. Server creates session record in database
4. Server generates secure session token (`crypto.randomBytes`)
5. Server sets HTTP-only cookie with session token
6. Server returns user data

**Session Expiration:**
- Regular sessions: 1 day
- Persistent sessions: 7 days (if "Remember Me" implemented)

### Session Validation

1. Client sends request with cookie
2. Server extracts session token from cookie
3. Server queries database for session by token hash
4. Server checks if session is expired
5. Server returns user data if valid

### Session Refresh

1. Client calls `/api/auth/refresh` before expiration
2. Server validates current session
3. Server creates new session with extended expiration
4. Server deletes old session
5. Server sets new cookie

### Session Revocation

1. User signs out
2. Server deletes session from database
3. Server clears cookie
4. All subsequent requests fail authentication

---

## Security Features

### 1. Secure Cookies

```typescript
{
  httpOnly: true,        // Not accessible via JavaScript
  secure: true,          // HTTPS only in production
  sameSite: 'lax',      // CSRF protection
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
}
```

### 2. Token Hashing

- Session tokens stored as hashes (SHA-256)
- Original token only sent in cookie
- Prevents token theft from database breach

### 3. CSRF Protection

- SameSite cookie attribute
- CSRF token for state-changing operations
- Origin validation

### 4. Rate Limiting

- Login attempts: 5 per 15 minutes per IP
- Sign-up attempts: 5 per 15 minutes per IP
- Password reset: 3 per hour per email
- Session creation: 10 per minute per IP

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

**⚠️ Limitation:** Currently uses in-memory storage (won't work with multiple servers or after server restart)

### 5. Brute Force Protection

- Account locking after 5 failed login attempts
- Lock duration: 30 minutes
- Automatic unlock after cooldown
- Error message: "Account locked due to too many failed attempts. Please try again in X minutes."

**⚠️ Limitation:** Currently uses in-memory storage (won't work with multiple servers or after server restart)

### 6. Password Security

- bcrypt hashing (cost factor 12)
- Minimum 8 characters
- Maximum 128 characters
- Password strength validation:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number

**Example Valid Passwords:**
- `Password123`
- `MySecure123!`
- `Test123Password`

**Example Invalid Passwords:**
- `password` (no uppercase, no number)
- `PASSWORD123` (no lowercase)
- `Password` (no number)

### 7. Input Sanitization

- Email validation and sanitization
- Name sanitization (removes HTML, scripts)
- SQL injection prevention (parameterized queries via Drizzle ORM)

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

**✅ Status:** Fully implemented with support for Resend and SMTP email providers.

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

## Configuration and Setup

### Environment Variables

```bash
# Database connection (required)
DATABASE_URL="postgresql://user:password@host:5432/database"
# or
POSTGRES_URL="postgresql://user:password@host:5432/database"

# Session configuration (optional)
SESSION_DURATION_DAYS=1  # Default: 1 day
SESSION_COOKIE_NAME="revealui-session"  # Default cookie name

# Environment
NODE_ENV="production"  # Enables secure cookies
```

### Database Setup

1. **Run database migrations:**

```bash
# Apply migration to add password_hash field and indexes
psql $DATABASE_URL -f packages/db/src/orm/drizzle/0001_add_password_hash.sql
```

Or use the migration script:

```bash
pnpm db:migrate
```

2. **Verify tables exist:**

Required tables:
- `users` - User accounts
- `sessions` - Active sessions
- `accounts` - OAuth provider accounts (for future use)
- `verifications` - Email verification and password reset tokens

---

## Migration Guide (JWT to Session-Based)

RevealUI supports migrating from JWT-based authentication to database-backed session authentication. This section explains the migration process.

### Current System (JWT)

- JWT tokens stored in cookies (`revealui-token`)
- Token validation via JWT verify
- No session revocation
- No database-backed sessions

### New System (Sessions)

- Database-backed sessions
- Session tokens in HTTP-only cookies
- Session revocation support
- Better security and control

### Migration Steps

#### 1. Database Migration

Run the migration to add `password_hash` field and indexes:

```bash
# Apply migration
psql $DATABASE_URL -f packages/db/src/orm/drizzle/0001_add_password_hash.sql
```

Or use the migration script:

```bash
pnpm db:migrate
```

#### 2. Update Existing Users

For existing users who need to use password authentication:

```sql
-- Users will need to reset their passwords
-- Or you can create a migration script to:
-- 1. Generate temporary passwords
-- 2. Email users to reset
-- 3. Or migrate from existing password storage
```

#### 3. Dual Support Period

During migration, support both systems:

```typescript
// Check both JWT and session auth
const jwtUser = await getJWTUser(request)
const sessionUser = await getSession(request.headers)

const user = sessionUser?.user || jwtUser
```

#### 4. Update API Routes

Gradually update routes to use new auth:

```typescript
// Old (JWT)
const token = request.cookies.get('revealui-token')?.value
const user = jwt.verify(token, secret)

// New (Session)
import { getSession } from '@revealui/auth/server'
const session = await getSession(request.headers)
const user = session?.user
```

#### 5. Update Client Code

Update React components to use new hooks:

```typescript
// Old (if using custom hooks)
const { user } = useJWTUser()

// New
import { useSession } from '@revealui/auth/react'
const { data: session } = useSession()
const user = session?.user
```

#### 6. Deprecation

After migration period:

1. Remove JWT validation code
2. Remove JWT cookie handling
3. Remove old auth utilities
4. Update all routes to use sessions only

### Migration Checklist

- [ ] Run database migration
- [ ] Update API routes to use `getSession()`
- [ ] Update React components to use `useSession()`
- [ ] Test authentication flows
- [ ] Test session expiration
- [ ] Test session revocation
- [ ] Update documentation
- [ ] Remove JWT code

### Rollback Plan

If issues occur:

1. Keep JWT code in place during migration
2. Use feature flag to switch between systems
3. Monitor error rates
4. Rollback by disabling session auth

### Migration Testing

Test the following scenarios:

1. **Sign Up**
   - Create new account
   - Verify session is created
   - Verify cookie is set

2. **Sign In**
   - Sign in with email/password
   - Verify session is created
   - Verify cookie is set

3. **Session Validation**
   - Access protected route with valid session
   - Access protected route with invalid session
   - Access protected route with expired session

4. **Sign Out**
   - Sign out user
   - Verify session is deleted
   - Verify cookie is cleared
   - Verify subsequent requests fail

5. **Session Expiration**
   - Wait for session to expire
   - Verify requests fail after expiration
   - Verify refresh works (if implemented)

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

### Session Validation Failing

**Cause:** Database issues or configuration problems

**Solution:**
- Check database connection
- Verify session table exists
- Check token hashing matches
- Verify session not expired

### Password Verification Failing

**Cause:** Password hash issues

**Solution:**
- Check password hash stored correctly
- Verify bcrypt comparison working
- Ensure password not null for email/password users

---

## Current Status and Roadmap

### What Works

- ✅ Sign-in, sign-up, sign-out flows
- ✅ Database-backed session management
- ✅ Password hashing and validation
- ✅ Rate limiting (single server)
- ✅ Brute force protection (single server)
- ✅ Input sanitization
- ✅ CSRF protection
- ✅ SQL injection prevention

### What Needs Work

1. ✅ **Email Sending** - Fully implemented with Resend and SMTP support
2. **In-Memory Stores** - Rate limiting and brute force protection won't scale horizontally
3. ✅ **Missing Endpoints** - `/api/auth/session` and `/api/auth/me` fully implemented
4. **Integration Tests** - Not running (need DATABASE_URL)
5. **Performance Baseline** - Not established

### Production Deployment

#### ✅ Ready For

- Single-server deployments
- MVP/prototype applications
- Low to medium traffic applications

#### 🔴 Must Fix Before Production

1. **Implement Email Sending**
   - Password reset emails
   - Email verification
   - Remove token from response

2. **Migrate In-Memory Stores**
   - Move rate limiting to database backend
   - Move brute force protection to database backend
   - Move reset tokens to database

#### 🟡 Should Fix Before Production

3. **Create Missing Endpoints**
   - `GET /api/auth/session`
   - `GET /api/auth/me`

4. **Run Integration Tests**
   - Set up test database
   - Verify database integration

5. **Establish Performance Baseline**
   - Run k6 load tests
   - Identify bottlenecks

#### API Endpoints Status

| Endpoint | Method | Status | Description |
|----------|--------|--------|-------------|
| `/api/auth/sign-up` | POST | ✅ Complete | Create new user account |
| `/api/auth/sign-in` | POST | ✅ Complete | Authenticate with email/password |
| `/api/auth/sign-out` | POST | ✅ Complete | Delete session and sign out |
| `/api/auth/password-reset` | POST | ⚠️ Partial | Generate reset token (no email) |
| `/api/auth/password-reset` | PUT | ✅ Complete | Reset password with token |
| `/api/auth/session` | GET | ❌ Missing | Get current session |
| `/api/auth/me` | GET | ❌ Missing | Get current user |

---

## Migration to Horizontal Scaling

When ready to scale horizontally, migrate in-memory stores:

1. **Rate Limiting:** Move to database with TTL
   - Use PostgreSQL `INSERT ... ON CONFLICT` with expiry column
   - Key format: `ratelimit:{ip}:{endpoint}`

2. **Brute Force Protection:** Move to database with TTL
   - Use PostgreSQL `INSERT ... ON CONFLICT` with expiry column
   - Key format: `bruteforce:{email}`

3. **Password Reset Tokens:** Move to database table
   - Use existing `verifications` table
   - Ensure proper expiration handling

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture and security design
- [Testing Guide](./TESTING.md) - Security and integration testing
- [Database Guide](./DATABASE.md) - Database configuration and setup

---

## References

- [Better Auth Documentation](https://www.better-auth.com/docs/introduction)
- [Neon Auth with Better Auth](https://neon.com/docs/auth/migrate/from-legacy-auth)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [TanStack Start Authentication](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)

---

**Last Updated:** 2026-03-05
**Production Readiness:** 8.5/10 🟢

---

# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of RevealUI seriously. If you discover a security vulnerability, please follow these steps:

### Where to Report

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **security@revealui.com**

### What to Include

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the manifestation of the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### Response Timeline

- We will acknowledge your email within 48 hours
- We will send a more detailed response within 7 days indicating the next steps
- We will work on a fix and coordinate a release timeline with you
- We will notify you when the vulnerability has been fixed

### Disclosure Policy

- Once a fix is released, we will publicly disclose the vulnerability
- We appreciate allowing us time to remediate before public disclosure
- We will credit you for responsible disclosure (unless you prefer to remain anonymous)

### Safe Harbor

We support safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a security issue you discover for any reason (This includes demonstrating additional risk)
- Report the vulnerability promptly
- Allow a reasonable time to fix the issue before public disclosure

## Security Best Practices

When using RevealUI, we recommend:

1. **Keep dependencies updated**: Run `pnpm update` regularly
2. **Use environment variables**: Never commit secrets to your repository
3. **Enable CSP headers**: Configure Content Security Policy in your deployment
4. **Use HTTPS**: Always use HTTPS in production
5. **Validate user input**: Use Zod schemas for all user inputs
6. **Enable rate limiting**: Configure rate limits on authentication endpoints
7. **Monitor logs**: Set up monitoring for suspicious activity

## Security Features

RevealUI includes several security features out of the box:

- ✅ Input validation with Zod
- ✅ CSRF protection
- ✅ Secure authentication with RevealUI Auth
- ✅ Rate limiting support
- ✅ Security headers configuration
- ✅ Environment variable validation
- ✅ SQL injection protection (via Drizzle ORM)

---

## CSRF Protection Strategy

### Current Implementation

The authentication system uses **cookie-based sessions** with the following CSRF protection measures:

#### 1. SameSite Cookie Attribute
- **Status:** ✅ Implemented
- **Value:** `sameSite: 'lax'`
- **Protection:** Prevents cookies from being sent in cross-site requests (except top-level navigation)
- **Location:** `apps/cms/src/app/api/auth/sign-up/route.ts`, `sign-in/route.ts`

#### 2. HttpOnly Cookie Flag
- **Status:** ✅ Implemented
- **Value:** `httpOnly: true`
- **Protection:** Prevents JavaScript access to cookies, mitigating XSS attacks
- **Location:** All auth API routes

#### 3. Secure Cookie Flag (Production)
- **Status:** ✅ Implemented
- **Value:** `secure: process.env.NODE_ENV === 'production'`
- **Protection:** Ensures cookies only sent over HTTPS in production
- **Location:** All auth API routes

### Why Additional CSRF Tokens Are Not Required

#### For Read Operations (GET)
- **No CSRF risk:** GET requests are idempotent and don't modify state
- **Current protection:** Session validation ensures user is authenticated

#### For Write Operations (POST)
- **SameSite: 'lax' protection:** Sufficient for most use cases
- **Origin validation:** Could be added but not critical with SameSite
- **Double-submit cookie pattern:** Not needed with SameSite

### When CSRF Tokens Would Be Needed

CSRF tokens would be required if:
1. SameSite cookies are set to `'none'` (not our case)
2. Supporting legacy browsers without SameSite support (not a priority)
3. Need to support cross-origin requests (not our use case)

### Current Protection Assessment

**Current CSRF protection is sufficient** for the following reasons:

1. ✅ SameSite: 'lax' provides strong protection
2. ✅ HttpOnly prevents XSS-based token theft
3. ✅ Secure flag ensures HTTPS-only in production
4. ✅ All state-changing operations require authentication
5. ✅ No cross-origin requirements

### Future Enhancements (Optional)

If additional CSRF protection is needed in the future:

1. **Origin Header Validation**
   ```typescript
   const origin = request.headers.get('origin')
   const expectedOrigin = process.env.NEXT_PUBLIC_SERVER_URL
   if (origin && origin !== expectedOrigin) {
     return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
   }
   ```

2. **CSRF Token Pattern**
   - Generate token on session creation
   - Store in httpOnly cookie
   - Require token in request body/header
   - Validate token matches cookie

3. **Referer Header Validation**
   - Validate Referer header matches expected domain
   - Less reliable than Origin (can be spoofed)

---

## Questions

If you have questions about this policy, please contact us at security@revealui.com

