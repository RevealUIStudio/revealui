# Authentication System Usage Guide

**Last Updated:** 2025-01-12

## Overview

The RevealUI authentication system provides email/password authentication with session management, rate limiting, and brute force protection.

## Quick Start

### Sign Up

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

### Sign In

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

### Sign Out

```typescript
const response = await fetch('/api/auth/sign-out', {
  method: 'POST',
})

// Session cookie is cleared
```

### Get Current Session

```typescript
// Server-side only
import { getSession } from '@revealui/auth/server'

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ user: session.user })
}
```

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

### `POST /api/auth/sign-out`

Signs out the current user by deleting their session.

**Response (200):**
```json
{
  "success": true
}
```

**Note:** Session cookie is automatically cleared.

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

## Password Requirements

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

## Rate Limiting

Rate limiting is applied to all authentication endpoints:

- **Sign-Up:** 5 attempts per 15 minutes per IP
- **Sign-In:** 5 attempts per 15 minutes per IP
- **Sign-Out:** 10 attempts per 15 minutes per IP

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Reset`: Timestamp when limit resets
- `Retry-After`: Seconds to wait before retrying (when rate limited)

**⚠️ Note:** Rate limiting uses in-memory storage. Will not work across multiple servers or after server restart.

## Brute Force Protection

Accounts are automatically locked after 5 failed login attempts:

- **Lock Duration:** 30 minutes
- **Reset:** Automatically unlocks after lock duration expires
- **Error Message:** "Account locked due to too many failed attempts. Please try again in X minutes."

**⚠️ Note:** Brute force protection uses in-memory storage. Will not work across multiple servers or after server restart.

## Session Management

### Session Creation

Sessions are automatically created on sign-in and sign-up:

- **Regular Sessions:** Expire after 1 day
- **Persistent Sessions:** Expire after 7 days (if "Remember Me" is implemented)
- **Token Storage:** Hashed and stored in database
- **Cookie:** `revealui-session` (HttpOnly, Secure in production, SameSite: lax)

### Session Validation

Sessions are validated on each request that uses `getSession()`:

```typescript
import { getSession } from '@revealui/auth/server'

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Use session.user and session.session
}
```

### Session Deletion

Sessions are deleted on sign-out or can be deleted manually:

```typescript
import { deleteSession } from '@revealui/auth/server'

await deleteSession(request.headers)
```

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

## Security Considerations

### ✅ Implemented

1. **Password Hashing**
   - bcrypt with 12 salt rounds
   - Secure password storage

2. **Rate Limiting**
   - IP-based rate limiting
   - Prevents brute force attacks

3. **Brute Force Protection**
   - Account locking after failed attempts
   - Automatic unlock after cooldown

4. **Input Sanitization**
   - Email validation and sanitization
   - Name sanitization (removes HTML, scripts)

5. **CSRF Protection**
   - SameSite cookies
   - HttpOnly flag
   - Secure flag (production)

6. **SQL Injection Prevention**
   - Parameterized queries
   - Drizzle ORM protection

### ⚠️ Limitations

1. **In-Memory Stores**
   - Rate limits and brute force protection use in-memory storage
   - Won't work with horizontal scaling
   - Lost on server restart

2. **Email Sending**
   - Password reset emails not implemented
   - Email verification not implemented

3. **Session Storage**
   - Sessions stored in database (good)
   - But no automatic cleanup job for expired sessions

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

## Best Practices

1. **Always validate input on frontend AND backend**
2. **Never expose error details in production** (already handled)
3. **Use HTTPS in production** (Secure cookie flag requires it)
4. **Monitor rate limit hits** for abuse detection
5. **Log authentication events** for security auditing
6. **Implement email verification** before allowing full access
7. **Use strong passwords** (enforced by validation)

## Migration to Redis/Database

When ready to scale horizontally, migrate in-memory stores:

1. **Rate Limiting:** Move to Redis with TTL
2. **Brute Force:** Move to Redis with TTL
3. **Password Reset Tokens:** Move to database table

See [BRUTAL_HONEST_ASSESSMENT_AUTH_FINAL.md](../../assessments/BRUTAL_HONEST_ASSESSMENT_AUTH_FINAL.md) for details.

## Related Documentation

- [Auth System Design](./AUTH_SYSTEM_DESIGN.md) - Authentication system overview
- [Auth Usage Examples](../../guides/auth/AUTH_USAGE_EXAMPLES.md) - Code examples and patterns
- [Auth Migration Guide](../../guides/auth/AUTH_MIGRATION_GUIDE.md) - JWT to session-based migration
- [Auth Status](./AUTH_STATUS.md) - Current implementation status
- [Auth Implementation Status](./IMPLEMENTATION_STATUS.md) - Implementation details
- [CSRF Protection Strategy](../../development/CSRF_PROTECTION.md) - CSRF protection
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../TASKS.md) - Find docs by task

---

**For implementation status, see:** [AUTH_STATUS.md](./AUTH_STATUS.md)
