# ADR-004: Session-Only Authentication (No JWT)

**Date:** 2026-04-08
**Status:** Accepted

## Context

Most modern web frameworks default to JWT-based auth. JWTs are stateless and scale well, but they cannot be revoked instantly, leak claims in the payload, and require careful handling of refresh tokens. RevealUI's security posture prioritizes immediate revocation and simple session management over horizontal scaling of auth verification.

## Decision

**Session-only authentication.** No JWTs for user auth.

- **Session cookie**: `revealui-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, domain `.revealui.com` (cross-subdomain)
- **Session storage**: Server-side in NeonDB (`sessions` table), looked up on every request
- **OAuth**: GitHub, Google, Vercel providers. OAuth tokens exchanged for a server session immediately — no JWT intermediary.
- **2FA**: TOTP (app-based) with AES-256-GCM encrypted secrets at rest
- **Passkeys**: WebAuthn. Passkey sign-in skips TOTP (inherently MFA)
- **Magic links**: Email-based recovery, single-use tokens
- **Signed cookies**: For stateless tokens where needed (e.g., CSRF), using `REVEALUI_SECRET`

### What JWTs ARE used for

JWTs are used only for **license validation** (RS256, asymmetric), not for user authentication. The license JWT is verified at the API layer to gate Pro features — it is not a session token.

## Alternatives Considered

- **JWT + refresh tokens**: Standard approach. Rejected because: (1) revocation requires a blocklist (effectively re-introducing server state), (2) token leaks in logs/URLs are exploitable until expiry, (3) refresh token rotation adds complexity with marginal benefit for our scale.
- **JWT with short expiry + session fallback**: Hybrid approach. Rejected as unnecessary complexity — if you need server-side sessions anyway, just use sessions.
- **Passport.js**: Too much abstraction for what is fundamentally simple session management. Direct implementation is clearer and has fewer dependencies.

## Consequences

- Every authenticated request hits the database (session lookup). This is acceptable at current scale and can be cached later with PGlite or an in-memory session cache.
- Cross-subdomain auth works natively via cookie domain (`.revealui.com` covers `admin.revealui.com`, `api.revealui.com`)
- Session revocation is instant (delete the row)
- No token refresh flow needed — sessions have a configurable TTL with sliding window
