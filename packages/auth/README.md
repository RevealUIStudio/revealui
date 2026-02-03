# @revealui/auth

**Status:** 🟡 Active Development | ⚠️ NOT Production Ready

See [Project Status](../../docs/PROJECT_STATUS.md) for framework readiness.

Authentication system for RevealUI - database-backed sessions with Better Auth patterns.

> **⚠️ Security Note:** Auth implementation exists but requires independent security audit before production use.

## Features

- ✅ Database-backed sessions (PostgreSQL/NeonDB)
- ✅ Secure token handling (SHA-256 hashing, HTTP-only cookies)
- ✅ CSRF protection (SameSite cookies)
- ✅ Type-safe (TypeScript)
- ✅ Framework agnostic (Next.js, TanStack Start)
- ✅ React hooks for client-side usage

## Installation

```bash
pnpm add @revealui/auth
```

## Usage

### Server-side (Next.js API Routes)

```typescript
import { getSession } from '@revealui/auth/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers)
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ user: session.user })
}
```

### Client-side (React Hooks)

```typescript
'use client'
import { useSession, useSignIn, useSignOut } from '@revealui/auth/react'

function MyComponent() {
  const { data: session, isLoading } = useSession()
  const { signIn } = useSignIn()
  const { signOut } = useSignOut()

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

## API Routes

- `GET /api/auth/session` - Get current session
- `POST /api/auth/sign-in` - Sign in with email/password
- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-out` - Sign out

## Documentation

See [Auth System Design](../../docs/reference/auth/AUTH_SYSTEM_DESIGN.md) for comprehensive documentation.
