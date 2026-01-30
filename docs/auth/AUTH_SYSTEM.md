# RevealUI Authentication System

**Last Updated:** 2025-01-30
**Package:** `@revealui/auth`
**Status:** Production-ready for single server, needs work for horizontal scaling
**Production Readiness:** 7.5/10 🟡

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
- ⚠️ Password reset (token generation ready, email sending incomplete)

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

---

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

**⚠️ Limitation:** Currently uses in-memory storage (won't work with multiple servers)

### 5. Brute Force Protection

- Account locking after 5 failed login attempts
- Lock duration: 30 minutes
- Automatic unlock after cooldown

**⚠️ Limitation:** Currently uses in-memory storage (won't work with multiple servers)

### 6. Password Security

- bcrypt hashing (cost factor 12)
- Minimum 8 characters
- Password strength validation:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
- No password storage in plain text

### 7. Input Sanitization

- Email validation and sanitization
- Name sanitization (removes HTML, scripts)
- SQL injection prevention (parameterized queries via Drizzle ORM)

---

## Current Status

### ✅ What Works

- Sign-in, sign-up, sign-out flows
- Database-backed session management
- Password hashing and validation
- Rate limiting (single server)
- Brute force protection (single server)
- Input sanitization
- CSRF protection
- SQL injection prevention

### ⚠️ What Needs Work

1. **Email Sending** - Password reset emails not implemented
2. **In-Memory Stores** - Rate limiting and brute force protection won't scale horizontally
3. **Missing Endpoints** - `/api/auth/session` and `/api/auth/me` not implemented
4. **Integration Tests** - Not running (need DATABASE_URL)
5. **Performance Baseline** - Not established

### ❌ Not Production Ready For

- Horizontal scaling (multiple servers)
- High-traffic scenarios (no performance baseline)
- Production password reset (no email)

---

## Production Deployment

### ✅ Ready For

- Single-server deployments
- MVP/prototype applications
- Low to medium traffic applications

### 🔴 Must Fix Before Production

1. **Implement Email Sending**
   - Password reset emails
   - Email verification
   - Remove token from response

2. **Migrate In-Memory Stores**
   - Move rate limiting to Redis
   - Move brute force protection to Redis
   - Move reset tokens to database

### 🟡 Should Fix Before Production

3. **Create Missing Endpoints**
   - `GET /api/auth/session`
   - `GET /api/auth/me`

4. **Run Integration Tests**
   - Set up test database
   - Verify database integration

5. **Establish Performance Baseline**
   - Run k6 load tests
   - Identify bottlenecks

---

## API Endpoints

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

## Migration Path from JWT

RevealUI supports migrating from JWT-based to session-based authentication. See [AUTH_MIGRATION_GUIDE.md](./AUTH_MIGRATION_GUIDE.md) for details.

**Migration Steps:**
1. Dual support period (both JWT and sessions)
2. Gradual user migration on next login
3. Deprecate JWT endpoints
4. Clean up JWT code

---

## Related Documentation

- [AUTH_GUIDE.md](./AUTH_GUIDE.md) - Developer guide with usage examples and API reference
- [AUTH_MIGRATION_GUIDE.md](./AUTH_MIGRATION_GUIDE.md) - JWT to session migration guide
- [CSRF Protection](../security/CSRF_PROTECTION.md) - CSRF protection strategy
- [Security Testing](../testing/PENETRATION_TESTING_GUIDE.md) - Security testing guide
- [Project Status](../PROJECT_STATUS.md) - Overall project status

---

## References

- [Better Auth Documentation](https://www.better-auth.com/docs/introduction)
- [Neon Auth with Better Auth](https://neon.com/docs/auth/migrate/from-legacy-auth)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [TanStack Start Authentication](https://tanstack.com/start/latest/docs/framework/react/guide/authentication)

---

**Last Updated:** 2025-01-30
**Production Readiness:** 7.5/10 🟡 (Good for single server, needs work for horizontal scaling)
