# @revealui/security

Security infrastructure for RevealUI. Provides HTTP security headers, CORS management, RBAC/ABAC authorization, field-level encryption, audit logging, and GDPR compliance tooling.

## When to Use This

- You need security headers (CSP, HSTS, CORS) on HTTP responses
- You're implementing role-based or attribute-based access control
- You need audit logging for compliance (SOC2, HIPAA)
- You need GDPR tooling: consent management, data export, breach reporting, anonymization
- You need field-level encryption or key rotation

If you only need session auth (login/logout/password reset), use `@revealui/auth` instead.

## Installation

```bash
pnpm add @revealui/security
```

Dependencies: `@revealui/contracts`, `@revealui/utils`

## API Reference

### Security Headers & CORS

| Export | Type | Purpose |
|--------|------|---------|
| `SecurityHeaders` | Class | Generate CSP, HSTS, Permissions-Policy, X-Frame-Options headers |
| `SecurityPresets` | Object | Pre-built header configs (strict, moderate, development) |
| `CORSManager` | Class | CORS origin/method/header management |
| `CORSPresets` | Object | Pre-built CORS configs (restrictive, public API, development) |
| `createSecurityMiddleware` | Function | Hono middleware applying all security headers |
| `setRateLimitHeaders` | Function | Add X-RateLimit-* headers to responses |

### Authorization (RBAC + ABAC)

| Export | Type | Purpose |
|--------|------|---------|
| `AuthorizationSystem` | Class | Combined RBAC + ABAC policy engine |
| `CommonRoles` | Object | Pre-defined roles (admin, editor, viewer, superAdmin) |
| `PolicyBuilder` | Class | Fluent API for building ABAC policies |
| `PermissionBuilder` | Class | Fluent API for building RBAC permissions |
| `PermissionCache` | Class | LRU cache for permission lookups |
| `canAccessResource` | Function | Check if user can perform action on resource |
| `checkAttributeAccess` | Function | Evaluate ABAC policy conditions |
| `createAuthorizationMiddleware` | Function | Hono middleware for route-level authorization |
| `RequirePermission` | Decorator | Enforce permission on class methods |
| `RequireRole` | Decorator | Enforce role on class methods |

### Encryption

| Export | Type | Purpose |
|--------|------|---------|
| `EncryptionSystem` | Class | AES-256 encryption with key management |
| `EnvelopeEncryption` | Class | Envelope encryption (data key + master key) |
| `FieldEncryption` | Class | Encrypt/decrypt individual database fields |
| `KeyRotationManager` | Class | Scheduled key rotation with re-encryption |
| `DataMasking` | Class | Mask sensitive data for display (email, phone, SSN) |
| `TokenGenerator` | Class | Secure random token generation |

### Audit Logging

| Export | Type | Purpose |
|--------|------|---------|
| `AuditSystem` | Class | Structured audit event recording |
| `AuditTrail` | Class | Query and filter audit history |
| `AuditReportGenerator` | Class | Generate compliance reports from audit data |
| `createAuditMiddleware` | Function | Hono middleware for automatic request auditing |
| `InMemoryAuditStorage` | Class | In-memory storage for testing |

### GDPR Compliance

| Export | Type | Purpose |
|--------|------|---------|
| `ConsentManager` | Class | Record and query user consent |
| `CookieConsentManager` | Class | Browser cookie consent banner state |
| `DataDeletionSystem` | Class | Right-to-erasure request processing |
| `DataExportSystem` | Class | Right-to-portability data export |
| `DataAnonymization` | Class | Anonymize user data while preserving analytics |
| `DataBreachManager` | Class | Breach detection, notification, and reporting |
| `PrivacyPolicyManager` | Class | Version and publish privacy policies |
| `InMemoryGDPRStorage` | Class | In-memory GDPR storage for testing |
| `InMemoryBreachStorage` | Class | In-memory breach storage for testing |

## JOSHUA Alignment

- **Hermetic**: Security boundaries are sealed — auth checks happen at middleware, never inside business logic
- **Sovereign**: All security infrastructure runs in your deployment, no external auth service required
- **Justifiable**: Every security header and policy has a documented reason (CSP prevents XSS, HSTS forces HTTPS, etc.)

## Related Packages

- `@revealui/auth` — Session-based authentication (login, password reset, OAuth)
- `@revealui/core` — Applies security middleware to CMS routes
- `@revealui/contracts` — Shared types for roles, permissions, consent records
