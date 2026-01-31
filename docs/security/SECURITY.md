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

