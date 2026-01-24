# RevealUI Authentication System Design

**Date**: January 2025  
**Status**: Design Document  
**Inspired By**: Better Auth, Neon Auth, Supabase Auth, TanStack Start

## Overview

This document outlines the design for a modern, database-backed authentication system for RevealUI, inspired by Better Auth patterns with database-as-source-of-truth approach (like Neon Auth).

## Design Principles

1. **Database as Source of Truth** - All auth data stored in PostgreSQL (NeonDB)
2. **Session-Based Authentication** - Secure, revocable sessions stored in database
3. **Framework Agnostic** - Works with Next.js, TanStack Start, and React SPAs
4. **Type-Safe** - Full TypeScript support with Zod validation
5. **Secure by Default** - CSRF protection, secure cookies, rate limiting
6. **Developer Experience** - Simple API, clear patterns, good defaults

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

## Database Schema

### Users Table

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

### Sessions Table

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

### Accounts Table (OAuth providers)

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

### Verifications Table (Email verification, password reset)

```typescript
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(), // Email or phone
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

## API Design

### Client API (React Hooks)

```typescript
// Client-side hooks (inspired by Better Auth)
import { useSession, useSignIn, useSignOut } from '@revealui/auth/react'

function MyComponent() {
  const { data: session, isLoading } = useSession()
  const signIn = useSignIn()
  const signOut = useSignOut()

  if (isLoading) return <div>Loading...</div>
  if (!session) return <div>Not signed in</div>

  return (
    <div>
      <p>Hello, {session.user.name}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

### Server API (Next.js/TanStack Start)

```typescript
// Server-side (inspired by Neon Auth)
import { getSession } from '@revealui/auth/server'

// Next.js API Route
export async function GET(request: NextRequest) {
  const session = await getSession({ headers: request.headers })
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ user: session.user })
}

// TanStack Start Route
export async function loader({ request }: LoaderArgs) {
  const session = await getSession({ headers: request.headers })
  
  if (!session) {
    throw redirect('/login')
  }

  return { user: session.user }
}
```

## Session Management

### Session Creation

1. User signs in with email/password or OAuth
2. Server validates credentials
3. Server creates session record in database
4. Server generates secure session token (crypto.randomBytes)
5. Server sets HTTP-only cookie with session token
6. Server returns user data

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

- Session tokens stored as hashes (bcrypt or SHA-256)
- Original token only sent in cookie
- Prevents token theft from database

### 3. CSRF Protection

- SameSite cookie attribute
- CSRF token for state-changing operations
- Origin validation

### 4. Rate Limiting

- Login attempts: 5 per 15 minutes per IP
- Password reset: 3 per hour per email
- Session creation: 10 per minute per IP

### 5. Password Security

- Bcrypt hashing (cost factor 12)
- Minimum 8 characters
- Password strength validation
- No password storage in plain text

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Database Schema**
   - Create migrations for users, sessions, accounts, verifications
   - Add indexes for performance
   - Add foreign key constraints

2. **Auth Server Package**
   - Create `@revealui/auth` package
   - Session management utilities
   - Token generation and validation
   - Database operations

3. **Auth Client Package**
   - React hooks (`useSession`, `useSignIn`, etc.)
   - Client-side session management
   - Cookie handling

### Phase 2: API Routes

1. **Sign In Route**
   - Email/password validation
   - Session creation
   - Cookie setting

2. **Sign Up Route**
   - User creation
   - Email verification
   - Session creation

3. **Sign Out Route**
   - Session deletion
   - Cookie clearing

4. **Session Route**
   - Session validation
   - User data return

5. **Refresh Route**
   - Session extension
   - Token rotation

### Phase 3: Integration

1. **Next.js Integration**
   - Middleware for route protection
   - Server component helpers
   - API route helpers

2. **TanStack Start Integration**
   - Loader helpers
   - Route protection
   - Client hooks

3. **Shape Proxy Integration**
   - Add session validation to shape proxies
   - Row-level filtering based on user

### Phase 4: Advanced Features

1. **OAuth Providers**
   - Google
   - GitHub
   - Custom providers

2. **Email Verification**
   - Verification email sending
   - Token validation
   - Account activation

3. **Password Reset**
   - Reset token generation
   - Email sending
   - Password update

4. **Multi-Factor Authentication**
   - TOTP support
   - SMS verification
   - Backup codes

## Migration from Current System

### Current System (JWT-based)

- JWT tokens in cookies
- Token validation via JWT verify
- No session revocation
- No database-backed sessions

### Migration Steps

1. **Dual Support Period**
   - Support both JWT and session-based auth
   - Migrate users gradually
   - Update API routes to check both

2. **Session Migration**
   - Create sessions for existing JWT users
   - Migrate on next login
   - Deprecate JWT endpoints

3. **Cleanup**
   - Remove JWT validation code
   - Remove JWT cookie handling
   - Update all routes to use sessions

## Code Examples

### Sign In Implementation

```typescript
// apps/cms/src/app/api/auth/sign-in/route.ts
import { signIn } from '@revealui/auth/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const result = await signIn({
    email,
    password,
    headers: request.headers,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ user: result.user })
  
  // Set session cookie
  response.cookies.set('revealui-session', result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  return response
}
```

### Session Validation in Shape Proxy

```typescript
// apps/cms/src/app/api/shapes/agent-contexts/route.ts
import { getSession } from '@revealui/auth/server'
import { prepareElectricUrl, proxyElectricRequest } from '@/lib/api/electric-proxy'

export async function GET(request: NextRequest) {
  const session = await getSession({ headers: request.headers })
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const originUrl = prepareElectricUrl(request.url)
  originUrl.searchParams.set('table', 'agent_contexts')
  originUrl.searchParams.set('where', `agent_id = '${session.user.id}'`)

  return proxyElectricRequest(originUrl)
}
```

## References

- [Better Auth Documentation](https://www.better-auth.com/docs/introduction)
- [Neon Auth with Better Auth](https://neon.com/docs/auth/migrate/from-legacy-auth)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [TanStack Start Authentication](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)

## Related Documentation

- [Auth Usage Examples](../guides/auth/AUTH_USAGE_EXAMPLES.md) - Code examples and patterns
- [Auth Migration Guide](../guides/auth/AUTH_MIGRATION_GUIDE.md) - JWT to session-based migration
- [Auth Status](./authentication/AUTH_STATUS.md) - Current implementation status
- [Auth Implementation Status](./authentication/IMPLEMENTATION_STATUS.md) - Implementation details
- [CSRF Protection Strategy](../development/CSRF_PROTECTION.md) - CSRF protection
- [Penetration Testing Guide](../development/testing/PENETRATION-TESTING-GUIDE.md) - Security testing
- [Master Index](../INDEX.md) - Complete documentation index
- [Task-Based Guide](../INDEX.md) - Find docs by task
