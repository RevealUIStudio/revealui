# Authentication System Documentation

Complete documentation for the RevealUI authentication system.

## Quick Links

- **[Status Dashboard](./IMPLEMENTATION_STATUS.md)** - Current implementation status
- **[Quick Status](./AUTH_STATUS.md)** - At-a-glance status overview
- **[Usage Guide](./USAGE_GUIDE.md)** - How to use the authentication system
- **[Brutal Assessment](../../assessments/BRUTAL_HONEST_ASSESSMENT_AUTH_FINAL.md)** - Honest production readiness assessment

## Overview

The RevealUI authentication system provides:

- ✅ Email/password authentication
- ✅ Session management (database-backed)
- ✅ Rate limiting and brute force protection
- ✅ Password reset (token generation ready, email pending)
- ✅ Security features (CSRF, input sanitization, SQL injection prevention)

**Production Readiness:** 7.5/10 🟡  
**Status:** Production-ready for single server, needs work for horizontal scaling

## Getting Started

### Installation

```bash
# Already installed in RevealUI monorepo
# Package: @revealui/auth
```

### Basic Usage

```typescript
// Sign up
const response = await fetch('/api/auth/sign-up', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
    name: 'John Doe',
  }),
})

// Sign in
const response = await fetch('/api/auth/sign-in', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123',
  }),
})

// Server-side: Get session
import { getSession } from '@revealui/auth/server'

const session = await getSession(request.headers)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for complete examples.

## Current Status

### ✅ What Works

- Sign-in, sign-up, sign-out
- Session management
- Password hashing and validation
- Rate limiting (single server)
- Brute force protection (single server)
- Input sanitization
- CSRF protection

### ⚠️ What Needs Work

- Email sending (password reset incomplete)
- In-memory stores (won't scale horizontally)
- Missing endpoints (`/session`, `/me`)
- Integration tests not running
- Performance tests not run

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for detailed status.

## Production Deployment

### ✅ Ready For

- Single-server deployments
- MVP/prototype applications
- Low to medium traffic

### ⚠️ Not Ready For

- Horizontal scaling (multiple servers)
- High-traffic scenarios (no performance baseline)
- Production password reset (no email)

### 🔴 Must Fix

1. Implement email sending
2. Move in-memory stores to Redis/database

See [BRUTAL_HONEST_ASSESSMENT_AUTH_FINAL.md](../../assessments/BRUTAL_HONEST_ASSESSMENT_AUTH_FINAL.md) for detailed requirements.

## Security

- ✅ Password hashing (bcrypt)
- ✅ Rate limiting
- ✅ Brute force protection
- ✅ Input sanitization
- ✅ CSRF protection
- ✅ SQL injection prevention
- ⚠️ In-memory stores (scalability concern)

## Testing

- ✅ Unit tests: 10 passing
- ⚠️ Integration tests: 19 skipped (need DATABASE_URL)
- ✅ E2E tests: Framework ready
- ⚠️ Performance tests: Created, not run

## API Reference

### Endpoints

- `POST /api/auth/sign-up` - Create account
- `POST /api/auth/sign-in` - Authenticate
- `POST /api/auth/sign-out` - Sign out
- `POST /api/auth/password-reset` - Request reset token
- `PUT /api/auth/password-reset` - Reset password

See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for complete API documentation.

## Troubleshooting

Common issues and solutions:

- **"Too many login attempts"** - Rate limit exceeded, wait 15 minutes
- **"Invalid email or password"** - Check credentials
- **"Database connection failed"** - Check DATABASE_URL environment variable
- **Session not persisting** - Check cookie settings, verify HTTPS in production

See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for complete troubleshooting guide.

## Contributing

When adding features:

1. Update [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
2. Add tests (unit, integration, E2E)
3. Update [USAGE_GUIDE.md](./USAGE_GUIDE.md)
4. Run full test suite
5. Update this README if needed

## Resources

- [Performance Testing Guide](../../development/performance/AUTH_PERFORMANCE_TESTING.md)
- [Load Testing Guide](../../development/testing/LOAD-TESTING-GUIDE.md)
- [Security Best Practices](./USAGE_GUIDE.md#security-considerations)

---

**Last Updated:** 2025-01-12
