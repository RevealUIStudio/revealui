# Auth System Migration Guide

**Date**: January 2025  
**Purpose**: Guide for migrating from JWT-based auth to session-based auth

## Overview

RevealUI is migrating from JWT-based authentication to database-backed session authentication. This guide explains the migration process.

## Current System (JWT)

- JWT tokens stored in cookies (`revealui-token`)
- Token validation via JWT verify
- No session revocation
- No database-backed sessions

## New System (Sessions)

- Database-backed sessions
- Session tokens in HTTP-only cookies
- Session revocation support
- Better security and control

## Migration Steps

### 1. Database Migration

Run the migration to add `password_hash` field and indexes:

```bash
# Apply migration
psql $DATABASE_URL -f packages/db/src/orm/drizzle/0001_add_password_hash.sql
```

Or use the migration script:

```bash
pnpm db:migrate
```

### 2. Update Existing Users

For existing users who need to use password authentication:

```sql
-- Users will need to reset their passwords
-- Or you can create a migration script to:
-- 1. Generate temporary passwords
-- 2. Email users to reset
-- 3. Or migrate from existing password storage
```

### 3. Dual Support Period

During migration, support both systems:

```typescript
// Check both JWT and session auth
const jwtUser = await getJWTUser(request)
const sessionUser = await getSession(request.headers)

const user = sessionUser?.user || jwtUser
```

### 4. Update API Routes

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

### 5. Update Client Code

Update React components to use new hooks:

```typescript
// Old (if using custom hooks)
const { user } = useJWTUser()

// New
import { useSession } from '@revealui/auth/react'
const { data: session } = useSession()
const user = session?.user
```

### 6. Deprecation

After migration period:

1. Remove JWT validation code
2. Remove JWT cookie handling
3. Remove old auth utilities
4. Update all routes to use sessions only

## Migration Checklist

- [ ] Run database migration
- [ ] Update API routes to use `getSession()`
- [ ] Update React components to use `useSession()`
- [ ] Test authentication flows
- [ ] Test session expiration
- [ ] Test session revocation
- [ ] Update documentation
- [ ] Remove JWT code

## Rollback Plan

If issues occur:

1. Keep JWT code in place during migration
2. Use feature flag to switch between systems
3. Monitor error rates
4. Rollback by disabling session auth

## Testing

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

## Troubleshooting

### Issue: Sessions not persisting

**Solution**: Check cookie settings:
- `httpOnly: true`
- `secure: true` in production
- `sameSite: 'lax'`
- Correct `path` and `domain`

### Issue: Session validation failing

**Solution**: Check:
- Database connection
- Session table exists
- Token hashing matches
- Session not expired

### Issue: Password verification failing

**Solution**: Check:
- Password hash stored correctly
- Bcrypt comparison working
- Password not null for email/password users

## References

- [Auth System Design](../../reference/auth/AUTH_SYSTEM_DESIGN.md)
- [Auth Usage Examples](./AUTH_USAGE_EXAMPLES.md)

## Related Documentation

- [Auth System Design](../../reference/auth/AUTH_SYSTEM_DESIGN.md) - Authentication system overview
- [Auth Usage Examples](./AUTH_USAGE_EXAMPLES.md) - Code examples and patterns
- [Auth Status](../../reference/authentication/AUTH_STATUS.md) - Current implementation status
- [Auth Implementation Status](../../reference/authentication/IMPLEMENTATION_STATUS.md) - Implementation details
- [CSRF Protection Strategy](../../development/CSRF_PROTECTION.md) - CSRF protection
- [Fresh Database Setup](../../reference/database/FRESH_DATABASE_SETUP.md) - Database setup for sessions
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../INDEX.md) - Find docs by task
