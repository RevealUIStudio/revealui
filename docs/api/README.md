# API Reference

RevealUI exposes a REST API built with [Hono](https://hono.dev/) and documented with OpenAPI. The API runs at `apps/api/` (default port 3004) and serves content, billing, auth, and agent endpoints.

---

## Interactive Documentation

When the API is running, interactive Swagger documentation is available at:

```
http://localhost:3004/docs
```

This is auto-generated from OpenAPI route definitions and is the most up-to-date reference for request/response schemas.

---

## Base URL

| Environment | URL |
|-------------|-----|
| Local development | `http://localhost:3004` |
| Production | `https://api.yourdomain.com` |

All endpoints are prefixed with `/api/`.

---

## Authentication

Most endpoints require a valid session. Authentication is cookie-based -- include credentials in your requests:

```ts
const response = await fetch('https://api.yourdomain.com/api/posts', {
  credentials: 'include', // Sends the revealui-session cookie
});
```

Unauthenticated requests to protected endpoints return `401 Unauthorized`.

---

## Endpoints

### Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/:collection` | List documents (paginated) |
| GET | `/api/:collection/:id` | Get document by ID |
| POST | `/api/:collection` | Create document |
| PATCH | `/api/:collection/:id` | Update document |
| DELETE | `/api/:collection/:id` | Delete document |

Query parameters for list endpoints:

| Parameter | Type | Description |
|-----------|------|-------------|
| `where[field][operator]` | string | Filter (operators: `equals`, `not_equals`, `like`, `contains`, `in`, `greater_than`, `less_than`) |
| `sort` | string | Sort field (prefix with `-` for descending) |
| `limit` | number | Results per page (default: 10, max: 100) |
| `page` | number | Page number (default: 1) |
| `depth` | number | Relationship population depth (default: 0) |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/sign-up` | Create account |
| POST | `/api/auth/sign-in` | Sign in |
| POST | `/api/auth/sign-out` | Sign out (revoke session) |
| POST | `/api/auth/password-reset` | Request password reset |
| PUT | `/api/auth/password-reset` | Complete password reset |
| GET | `/api/auth/:provider` | Start OAuth flow |
| GET | `/api/auth/callback/:provider` | OAuth callback |

### Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pricing` | Get pricing tiers and prices |
| GET | `/api/billing/status` | Current subscription status |
| POST | `/api/billing/checkout` | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Create Stripe Customer Portal session |
| POST | `/api/webhooks/stripe` | Stripe webhook receiver |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/logs` | Application logs (admin only) |

### Agent and Collaboration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent-tasks` | Submit agent task |
| GET | `/api/agent-tasks/:id` | Get agent task status |
| POST | `/api/agent-stream` | Agent streaming endpoint |
| POST | `/api/a2a` | Agent-to-agent protocol |
| POST | `/api/collab` | Real-time collaboration |
| POST | `/api/rag-index` | RAG indexing |

### Administration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/api-keys` | Create API key |
| GET | `/api/api-keys` | List API keys |
| DELETE | `/api/api-keys/:id` | Revoke API key |
| POST | `/api/license` | Validate license key |
| GET | `/api/gdpr/export` | GDPR data export |
| POST | `/api/gdpr/delete` | GDPR data deletion |

---

## Response Format

### Success

```json
{
  "docs": [{ "id": "abc", "title": "..." }],
  "totalDocs": 42,
  "limit": 10,
  "page": 1,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

### Single Document

```json
{
  "id": "abc",
  "title": "Getting Started",
  "status": "published",
  "createdAt": "2026-03-01T00:00:00Z",
  "updatedAt": "2026-03-10T12:00:00Z"
}
```

### Error

```json
{
  "error": "Description of what went wrong"
}
```

HTTP status codes follow standard conventions:

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no valid session) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Internal server error |
| 503 | Service unavailable (e.g., Stripe circuit breaker open) |

---

## Rate Limiting

Auth endpoints are rate-limited per IP address. Content endpoints are rate-limited per account tier:

| Tier | Requests/Minute |
|------|----------------|
| Free | 200 |
| Pro | 300 |
| Max | 600 |
| Forge      | Custom |

When rate-limited, the response includes a `Retry-After` header.

---

## CORS

The API allows cross-origin requests from configured domains. In production, CORS is restricted to your CMS and marketing domains. In development, `localhost` origins are permitted.

---

## Package Reference

For detailed package-level API documentation:

- [@revealui/core](../REFERENCE.md) -- CMS engine, collections, access control, plugins
- [@revealui/contracts](../REFERENCE.md) -- Zod schemas and TypeScript types
- [@revealui/db](../DATABASE.md) -- Drizzle ORM schema and query patterns
- [@revealui/auth](../AUTH.md) -- Authentication, sessions, OAuth
- [@revealui/config](../ENVIRONMENT_VARIABLES_GUIDE.md) -- Environment configuration
- [@revealui/presentation](../COMPONENT_CATALOG.md) -- UI component library

---

## OpenAPI Specification

The full OpenAPI spec is available at runtime:

```
GET /api/docs/openapi.json
```

Use this to generate client SDKs, import into Postman, or integrate with API gateways.
