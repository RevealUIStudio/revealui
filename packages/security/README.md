---
title: "@revealui/security"
description: "Security infrastructure for RevealUI. Provides HTTP security headers, CORS management, RBAC/ABAC authorization, field-level encryption, audit logging, and GDPR compliance tooling."
visibility: public
status: verified
audience: user
---

# @revealui/security

Security infrastructure for RevealUI. Provides HTTP security headers, CORS management, RBAC/ABAC authorization, field-level encryption, audit logging, and GDPR compliance tooling.

## When to Use This

- You need security headers (CSP, HSTS, CORS) on HTTP responses
- You're implementing role-based or attribute-based access control
- You need audit logging for compliance (SOC2, HIPAA)
- You need GDPR tooling: consent management, data export, breach reporting, anonymization
- You need field-level encryption or key rotation
- You need to sanitize untrusted input before rendering (terminal streams, shell args, SQL identifiers)

If you only need session auth (login/logout/password reset), use `@revealui/auth` instead.

## Installation

```bash
pnpm add @revealui/security
```

Runtime dependencies: `@revealui/contracts`, `@revealui/utils`, `parse5` (HTML sanitization), `undici` (SSRF/DNS checks in server subpath).

**Subpath exports:**

| Subpath | Contents |
|---------|----------|
| `@revealui/security` | Client-safe barrel — headers, CORS, authorization, encryption (Web Crypto), GDPR storage, alerting, request-IP, sanitization |
| `@revealui/security/server` | Server-only modules using `node:` built-ins — auth, GDPR managers, audit logging, SSRF/DNS checks |
| `@revealui/security/sanitize` | Minimal client-safe URL/HTML sanitize surface |

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

### Security Alerting

| Export | Type | Purpose |
|--------|------|---------|
| `SecurityAlertService` | Class | Emit and route security alerts via pluggable handlers |
| `AuditAlertHandler` | Class | Route alerts to the audit log |
| `LogAlertHandler` | Class | Route alerts to the logger |
| `WebhookAlertHandler` | Class | POST alerts to a webhook URL |

### Audit Logging

Server-only (`@revealui/security/server`).

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

### Input Sanitization

| Export | Type | Purpose |
|--------|------|---------|
| `sanitizeTerminalLine` | Function | Strip ANSI escape sequences; preserves SGR color codes, removes CSI/OSC/DCS and C0/C1 control chars |
| `sanitizeHtml` | Function | Strip dangerous HTML (parse5-based); removes script/style/event-handler attributes |
| `sanitizeUrl` | Function | Validate and sanitize URLs; blocks `javascript:`, `vbscript:`, `data:` schemes |
| `isSafeUrl` | Function | Boolean check — true for http/https/relative/anchor URLs |
| `escapeShellArg` | Function | Quote a value for safe use as a shell argument |
| `escapeSqlIdentifier` | Function | Quote an identifier for safe use in SQL (double-quote, escape internal quotes) |
| `redactLogContext` | Function | Redact sensitive keys in a log context object |
| `redactLogField` | Function | Redact a single field value |
| `redactSecretsInString` | Function | Scan a string and replace credential-shaped substrings with `[REDACTED]` |
| `isSensitiveLogKey` | Function | Heuristic check whether a log key name looks like a secret |

### Configuration & Utilities

| Export | Type | Purpose |
|--------|------|---------|
| `configureSecurityLogger` | Function | Set custom logger (defaults to console) |
| `configureClientIp` | Function | Configure trusted-proxy settings for IP extraction |
| `getClientIp` | Function | Extract client IP from a request (proxy-aware) |

## Design Principles

- **Hermetic**: Security boundaries are sealed  -  auth checks happen at middleware, never inside business logic
- **Sovereign**: All security infrastructure runs in your deployment, no external auth service required
- **Justifiable**: Every security header and policy has a documented reason (CSP prevents XSS, HSTS forces HTTPS, etc.)

## Related Packages

- `@revealui/auth`  -  Session-based authentication (login, password reset, OAuth)
- `@revealui/core`  -  Applies security middleware to CMS routes
- `@revealui/contracts`  -  Shared types for roles, permissions, consent records
