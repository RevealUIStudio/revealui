# RevealUI Auth - Usage Examples

**Date**: January 2025  
**Package**: `@revealui/auth`

## Quick Start

### 1. Server-side Session Validation

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

### 2. Client-side Session Hook

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

### 3. Sign In Form

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

### 4. Sign Up Form

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

### 5. Sign Out Button

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

### 6. Protected Route Component

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

### 7. Shape Proxy with Authentication

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

### 8. Middleware for Route Protection

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

## API Reference

### Server Functions

#### `getSession(headers: Headers)`
Get current session from request headers.

#### `createSession(userId: string, options?)`
Create a new session for a user.

#### `deleteSession(headers: Headers)`
Delete current session (sign out).

#### `signIn(email: string, password: string, options?)`
Sign in with email and password.

#### `signUp(email: string, password: string, name: string, options?)`
Create a new user account.

### React Hooks

#### `useSession()`
Get current session with loading and error states.

#### `useSignIn()`
Sign in hook with email/password.

#### `useSignOut()`
Sign out hook.

#### `useSignUp()`
Sign up hook with validation.

## API Endpoints

- `GET /api/auth/session` - Get current session
- `POST /api/auth/sign-in` - Sign in
- `POST /api/auth/sign-up` - Sign up
- `POST /api/auth/sign-out` - Sign out

## Security Notes

- Sessions are stored in HTTP-only cookies
- Tokens are hashed with SHA-256 before storage
- Passwords are hashed with bcrypt (cost factor 12)
- CSRF protection via SameSite cookies
- Secure cookies in production (HTTPS only)

## Related Documentation

- [Auth System Design](../../reference/auth/AUTH_SYSTEM_DESIGN.md) - Authentication system overview
- [Auth Migration Guide](./AUTH_MIGRATION_GUIDE.md) - JWT to session-based migration
- [Auth Status](../../reference/authentication/AUTH_STATUS.md) - Current implementation status
- [Auth Implementation Status](../../reference/authentication/IMPLEMENTATION_STATUS.md) - Implementation details
- [CSRF Protection Strategy](../../development/CSRF_PROTECTION.md) - CSRF protection
- [Penetration Testing Guide](../../development/testing/PENETRATION-TESTING-GUIDE.md) - Security testing
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../TASKS.md) - Find docs by task
