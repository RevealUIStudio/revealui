---
title: "REST API Reference"
description: "Generated REST API reference from the OpenAPI spec."
visibility: public
status: generated
audience: user
---

# REST API Reference

**Version:** 1.0.0

**Base URL (production):** `https://api.revealui.com/api`

**Interactive docs:** Start the API server (`pnpm dev:api`) and open [http://localhost:3004](http://localhost:3004) for full Swagger UI with request builder.

> **Note:** This reference and its schema snapshot are generated from the server route registry. No running server is required:
> ```bash
> pnpm docs:generate:api
> ```

---

## Authentication

RevealUI uses **session-based authentication** (no JWTs). Sign in via `POST /auth/sign-in` to receive a `revealui-session` cookie. Include this cookie in all subsequent requests. Routes marked 🔒 require an active session.

---

## Endpoints

- [a2a](#a2a)
- [health](#health)
- [errors](#errors)
- [gdpr](#gdpr)
- [observability](#observability)
- [license](#license)
- [Kits](#kits)
- [billing](#billing)
- [webhooks](#webhooks)
- [provenance](#provenance)
- [boards](#boards)
- [tickets](#tickets)
- [comments](#comments)
- [labels](#labels)
- [agent-tasks](#agent-tasks)
- [agent](#agent)
- [mcp](#mcp)
- [content](#content)
- [rag](#rag)
- [admin](#admin)
- [Analytics](#analytics)
- [Nudges](#nudges)
- [DevKit](#devkit)
- [Rotation](#rotation)
- [API Keys](#api-keys)
- [ghcr](#ghcr)
- [maintenance](#maintenance)
- [marketplace](#marketplace)
- [pricing](#pricing)
- [revmarket](#revmarket)
- [Collaboration](#collaboration)
- [Agent Collaboration](#agent-collaboration)

---

## a2a

### `GET` `/.well-known/agent.json`

**Platform-level agent card**

**Responses**

- `200`  -  Agent card
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Agent not found
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/.well-known/agents/{id}/agent.json`

**Per-agent discovery card**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ | Agent ID |

**Responses**

- `200`  -  Agent card
- `400`  -  Invalid agent ID format
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Agent not found
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/.well-known/marketplace.json`

**MCP Marketplace discovery metadata**

**Responses**

- `200`  -  Marketplace metadata

---

### `GET` `/.well-known/payment-methods.json`

**x402 payment methods discovery**

**Responses**

- `200`  -  Payment methods
- `404`  -  x402 payments not enabled

---

### `GET` `/.well-known/mcp.json`

**MCP server discovery manifest**

**Responses**

- `200`  -  MCP server manifest

---

### `GET` `/a2a/agents`

**List all registered agents as A2A agent cards**

**Responses**

- `200`  -  Agent card list
- `403`  -  AI feature requires Pro or Enterprise license
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `POST` `/a2a/agents`

**Register a new agent from an AgentDefinition**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `201`  -  Agent registered
- `400`  -  Invalid request
- `403`  -  AI feature requires Pro or Enterprise license
- `409`  -  Agent already registered
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/a2a/agents/{id}`

**Get a single agent card by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ | Agent ID |

**Responses**

- `200`  -  Agent card
- `400`  -  Invalid agent ID format
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Agent not found
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `PUT` `/a2a/agents/{id}`

**Update an agent's mutable fields**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ | Agent ID |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `description` | `string` | - |  |
| `systemPrompt` | `string` | - |  |
| `model` | `string` | - |  |
| `temperature` | `number` | - |  |
| `maxTokens` | `number` | - |  |
| `capabilities` | `any` | - |  |

**Responses**

- `200`  -  Updated agent card
- `400`  -  Invalid request
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Agent not found
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `DELETE` `/a2a/agents/{id}`

**Retire (unregister) an agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ | Agent ID |

**Responses**

- `200`  -  Agent retired
- `400`  -  Invalid agent ID format
- `403`  -  Built-in agents cannot be retired or AI feature requires Pro or Enterprise license
- `404`  -  Agent not found
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/a2a/agents/{id}/def`

**Get full agent definition (admin only)**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ | Agent ID |

**Responses**

- `200`  -  Agent definition
- `400`  -  Invalid agent ID format
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Agent not found
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/a2a/agents/{id}/tasks`

**Get task history for an agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ | Agent ID |

**Responses**

- `200`  -  Task history
- `400`  -  Invalid agent ID format
- `401`  -  Authentication required

---

### `GET` `/a2a/agent-tasks/exists`

**Check for attributed terminal task receipts and completed executions**

**Responses**

- `200`  -  Whether at least one agent task exists
- `401`  -  Authentication required

---

### `GET` `/a2a/stream/{taskId}`

**SSE stream for a running task**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `taskId` | `string` | ✓ | Task ID |

**Responses**

- `200`  -  SSE event stream
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Task not found in the authenticated actor and account scope
- `500`  -  Task operation could not complete; known execution outcomes include server-owned receipt status
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `POST` `/a2a`

**A2A JSON-RPC dispatcher**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  JSON-RPC response with server-owned receipt status; persisted false requires receipt recovery rather than execution retry
- `400`  -  Parse error or invalid request
- `402`  -  Payment proof required; the pending task has not executed
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Task not found in the authenticated actor and account scope
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `500`  -  Task operation could not complete; known execution outcomes include server-owned receipt status
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

## health

### `GET` `/health`

**Liveness probe**

Instant response with no dependencies. Kubernetes/load balancers use this to decide whether to restart the pod.

**Responses**

- `200`  -  Service is alive

---

### `GET` `/health/live`

**Liveness probe (alias)**

Alias for the root liveness probe  -  used by Playwright smoke tests and some load balancer conventions.

**Responses**

- `200`  -  Service is alive

---

### `GET` `/health/ready`

**Readiness probe**

Runs all registered health checks. Returns 200 when ready to serve traffic, 503 when a critical check fails.

**Responses**

- `200`  -  Service is ready
- `503`  -  Service is not ready

---

### `GET` `/health/metrics`

**Prometheus metrics**

Exposes all application metrics collected by the core MetricsCollector in Prometheus text format. Requires METRICS_SECRET or CRON_SECRET authentication.

**Responses**

- `200`  -  Prometheus-compatible metrics in text/plain format
- `401`  -  Unauthorized  -  missing or invalid metrics secret

---

### `GET` `/health/metrics/json`

**Metrics (JSON)**

Metrics in JSON format  -  useful for internal dashboards and debugging. Requires METRICS_SECRET or CRON_SECRET authentication.

**Responses**

- `200`  -  Metrics as JSON
- `401`  -  Unauthorized  -  missing or invalid metrics secret

---

## errors

### `POST` `/api/errors`

**Capture client-side error**

Accepts structured error payloads from admin client-side and any other app that cannot write to the DB directly. Requires X-Internal-Token header.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `level` | `string` | - |  |
| `message` | `string` | ✓ |  |
| `stack` | `string` | - |  |
| `app` | `string` | ✓ |  |
| `context` | `string` | - |  |
| `environment` | `string` | - |  |
| `url` | `string` | - |  |
| `requestId` | `string` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `202`  -  Error accepted for processing
- `400`  -  Invalid JSON or payload
- `403`  -  Forbidden  -  invalid or missing internal token

---

### `POST` `/api/v1/errors`

**Capture client-side error**

Accepts structured error payloads from admin client-side and any other app that cannot write to the DB directly. Requires X-Internal-Token header.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `level` | `string` | - |  |
| `message` | `string` | ✓ |  |
| `stack` | `string` | - |  |
| `app` | `string` | ✓ |  |
| `context` | `string` | - |  |
| `environment` | `string` | - |  |
| `url` | `string` | - |  |
| `requestId` | `string` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `202`  -  Error accepted for processing
- `400`  -  Invalid JSON or payload
- `403`  -  Forbidden  -  invalid or missing internal token

---

## gdpr

### `GET` `/api/gdpr/consent`

**List all consents for the authenticated user**

**Responses**

- `200`  -  List of user consents
- `401`  -  Authentication required

---

### `POST` `/api/gdpr/consent/grant`

**Grant consent for a specific type**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `type` | `string` | ✓ |  |
| `expiresIn` | `integer` | - |  |

**Responses**

- `200`  -  Consent granted
- `400`  -  Invalid request body
- `401`  -  Authentication required

---

### `POST` `/api/gdpr/consent/revoke`

**Revoke consent for a specific type**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `type` | `string` | ✓ |  |

**Responses**

- `200`  -  Consent revoked
- `400`  -  Invalid request or cannot revoke necessary consent
- `401`  -  Authentication required

---

### `GET` `/api/gdpr/consent/check/{type}`

**Check if a specific consent type is active**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `type` | `string` | ✓ |  |

**Responses**

- `200`  -  Consent check result
- `400`  -  Invalid consent type
- `401`  -  Authentication required

---

### `GET` `/api/gdpr/deletion`

**List the authenticated user's deletion requests**

**Responses**

- `200`  -  List of deletion requests
- `401`  -  Authentication required

---

### `POST` `/api/gdpr/deletion`

**Request data deletion (right to be forgotten)**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `categories` | `array` | - |  |
| `reason` | `string` | - |  |

**Responses**

- `201`  -  Deletion request created
- `400`  -  Invalid request body
- `401`  -  Authentication required
- `409`  -  Owned domain cleanup required

---

### `GET` `/api/gdpr/deletion/{id}`

**Get a specific deletion request by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Deletion request details
- `401`  -  Authentication required
- `404`  -  Deletion request not found

---

### `GET` `/api/gdpr/admin/stats`

**Aggregate consent statistics (admin only)**

**Responses**

- `200`  -  Consent statistics
- `403`  -  Admin access required

---

### `GET` `/api/v1/gdpr/consent`

**List all consents for the authenticated user**

**Responses**

- `200`  -  List of user consents
- `401`  -  Authentication required

---

### `POST` `/api/v1/gdpr/consent/grant`

**Grant consent for a specific type**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `type` | `string` | ✓ |  |
| `expiresIn` | `integer` | - |  |

**Responses**

- `200`  -  Consent granted
- `400`  -  Invalid request body
- `401`  -  Authentication required

---

### `POST` `/api/v1/gdpr/consent/revoke`

**Revoke consent for a specific type**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `type` | `string` | ✓ |  |

**Responses**

- `200`  -  Consent revoked
- `400`  -  Invalid request or cannot revoke necessary consent
- `401`  -  Authentication required

---

### `GET` `/api/v1/gdpr/consent/check/{type}`

**Check if a specific consent type is active**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `type` | `string` | ✓ |  |

**Responses**

- `200`  -  Consent check result
- `400`  -  Invalid consent type
- `401`  -  Authentication required

---

### `GET` `/api/v1/gdpr/deletion`

**List the authenticated user's deletion requests**

**Responses**

- `200`  -  List of deletion requests
- `401`  -  Authentication required

---

### `POST` `/api/v1/gdpr/deletion`

**Request data deletion (right to be forgotten)**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `categories` | `array` | - |  |
| `reason` | `string` | - |  |

**Responses**

- `201`  -  Deletion request created
- `400`  -  Invalid request body
- `401`  -  Authentication required
- `409`  -  Owned domain cleanup required

---

### `GET` `/api/v1/gdpr/deletion/{id}`

**Get a specific deletion request by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Deletion request details
- `401`  -  Authentication required
- `404`  -  Deletion request not found

---

### `GET` `/api/v1/gdpr/admin/stats`

**Aggregate consent statistics (admin only)**

**Responses**

- `200`  -  Consent statistics
- `403`  -  Admin access required

---

## observability

### `POST` `/api/logs`

**Ingest a structured log entry**

Accepts warn/error/fatal log entries from apps that cannot write to the DB directly. Rate-limited.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `level` | `string` | ✓ |  |
| `message` | `string` | ✓ |  |
| `app` | `string` | ✓ |  |
| `environment` | `string` | - |  |
| `requestId` | `string` | - |  |
| `data` | `object` | - |  |

**Responses**

- `202`  -  Log entry accepted
- `400`  -  Invalid payload
- `403`  -  Forbidden  -  missing or invalid X-Internal-Token

---

### `POST` `/api/v1/logs`

**Ingest a structured log entry**

Accepts warn/error/fatal log entries from apps that cannot write to the DB directly. Rate-limited.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `level` | `string` | ✓ |  |
| `message` | `string` | ✓ |  |
| `app` | `string` | ✓ |  |
| `environment` | `string` | - |  |
| `requestId` | `string` | - |  |
| `data` | `object` | - |  |

**Responses**

- `202`  -  Log entry accepted
- `400`  -  Invalid payload
- `403`  -  Forbidden  -  missing or invalid X-Internal-Token

---

## license

### `POST` `/api/license/verify`

**Verify a license key**

Validates a JWT license key and returns the tier, features, and limits.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `requireRegistration` | `boolean` | - |  |
| `licenseKey` | `string` | ✓ | JWT license key to verify |

**Responses**

- `200`  -  License verification result
- `400`  -  Missing license key
- `503`  -  The configured issuer trust set is unavailable

---

### `POST` `/api/license/generate`

**Generate a license key (admin only)**

Creates a signed JWT license key for a customer. Requires license mint config (REVEALUI_LICENSE_PRIVATE_KEY, or REVEALUI_LICENSE_SIGN_VIA_SIGNER + signer URL/secret) and admin API key.

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Matching committed operation recovered without minting
- `201`  -  License key generated
- `401`  -  Unauthorized  -  missing or invalid admin API key
- `404`  -  Authenticated recover-only lookup proved that no operation is committed
- `409`  -  Operation conflict or current identity changed
- `503`  -  Server error  -  missing private key configuration

---

### `POST` `/api/license/refresh`

**Refresh a license key**

Returns the current stored license key for the bound customerId. The presented JWT must match that customer and an undeleted, non-revoked registered prior token in the configured deployment mode. Unknown separately signed tokens require operator migration. Accepts a registered key expired within the refresh window. Never mints. Unbound or mismatched refresh is denied.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `licenseKey` | `string` | ✓ | The current (possibly recently-expired) license key held by the instance |
| `customerId` | `string` | ✓ | Customer id this instance is bound to. Must match the presented key. Unbound refresh is denied. |

**Responses**

- `200`  -  The current stored license key
- `403`  -  Refresh denied

---

### `GET` `/api/license/features`

**List features by tier**

Returns which features are available at each license tier.

**Responses**

- `200`  -  Feature comparison by tier

---

### `GET` `/api/license/public-key`

**Get the hosted license issuer trust set**

Returns one current and optionally one NEXT Ed25519 key in that order. keyId is lowercase SHA-256 hex of canonical SPKI DER; jwtKid preserves the existing first-eight-hex SHA-256 of normalized PEM. digest is lowercase SHA-256 hex of UTF-8 compact JSON with property order {version,issuer,audience,keys}, where each ordered key is {role,algorithm,keyId}. Clients must fetch this fixed-origin HTTPS endpoint without redirects and reject an unavailable or malformed trust set. The legacy publicKey property mirrors the current key for compatibility.

**Responses**

- `200`  -  Versioned hosted issuer trust set
- `503`  -  The hosted issuer trust set is unavailable or invalid

---

### `GET` `/api/license/current`

**Get the signed-in owner license**

Returns the latest license row for the authenticated user. Never mints. Disabled unless REVEALUI_LICENSE_AUTO_PROVISION=true.

**Responses**

- `200`  -  Owner license snapshot
- `401`  -  Authentication required
- `404`  -  Auto-provision is not enabled
- `503`  -  License or revocation authority unavailable; no key returned

---

### `POST` `/api/v1/license/verify`

**Verify a license key**

Validates a JWT license key and returns the tier, features, and limits.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `requireRegistration` | `boolean` | - |  |
| `licenseKey` | `string` | ✓ | JWT license key to verify |

**Responses**

- `200`  -  License verification result
- `400`  -  Missing license key
- `503`  -  The configured issuer trust set is unavailable

---

### `POST` `/api/v1/license/generate`

**Generate a license key (admin only)**

Creates a signed JWT license key for a customer. Requires license mint config (REVEALUI_LICENSE_PRIVATE_KEY, or REVEALUI_LICENSE_SIGN_VIA_SIGNER + signer URL/secret) and admin API key.

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Matching committed operation recovered without minting
- `201`  -  License key generated
- `401`  -  Unauthorized  -  missing or invalid admin API key
- `404`  -  Authenticated recover-only lookup proved that no operation is committed
- `409`  -  Operation conflict or current identity changed
- `503`  -  Server error  -  missing private key configuration

---

### `POST` `/api/v1/license/refresh`

**Refresh a license key**

Returns the current stored license key for the bound customerId. The presented JWT must match that customer and an undeleted, non-revoked registered prior token in the configured deployment mode. Unknown separately signed tokens require operator migration. Accepts a registered key expired within the refresh window. Never mints. Unbound or mismatched refresh is denied.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `licenseKey` | `string` | ✓ | The current (possibly recently-expired) license key held by the instance |
| `customerId` | `string` | ✓ | Customer id this instance is bound to. Must match the presented key. Unbound refresh is denied. |

**Responses**

- `200`  -  The current stored license key
- `403`  -  Refresh denied

---

### `GET` `/api/v1/license/features`

**List features by tier**

Returns which features are available at each license tier.

**Responses**

- `200`  -  Feature comparison by tier

---

### `GET` `/api/v1/license/public-key`

**Get the hosted license issuer trust set**

Returns one current and optionally one NEXT Ed25519 key in that order. keyId is lowercase SHA-256 hex of canonical SPKI DER; jwtKid preserves the existing first-eight-hex SHA-256 of normalized PEM. digest is lowercase SHA-256 hex of UTF-8 compact JSON with property order {version,issuer,audience,keys}, where each ordered key is {role,algorithm,keyId}. Clients must fetch this fixed-origin HTTPS endpoint without redirects and reject an unavailable or malformed trust set. The legacy publicKey property mirrors the current key for compatibility.

**Responses**

- `200`  -  Versioned hosted issuer trust set
- `503`  -  The hosted issuer trust set is unavailable or invalid

---

### `GET` `/api/v1/license/current`

**Get the signed-in owner license**

Returns the latest license row for the authenticated user. Never mints. Disabled unless REVEALUI_LICENSE_AUTO_PROVISION=true.

**Responses**

- `200`  -  Owner license snapshot
- `401`  -  Authentication required
- `404`  -  Auto-provision is not enabled
- `503`  -  License or revocation authority unavailable; no key returned

---

## Kits

### `GET` `/api/kits/agency-founding/download`

**Download Agency Founding Kit package (signed token)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `token` | `string` | ✓ |  -  | Signed download token |

**Responses**

- `200`  -  Kit package (text multi-file or redirected tarball)
- `302`  -  Redirect to object-storage tarball (full mode)
- `400`  -  Missing or invalid token
- `404`  -  Fulfillment not ready
- `410`  -  Token expired

---

### `GET` `/api/v1/kits/agency-founding/download`

**Download Agency Founding Kit package (signed token)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `token` | `string` | ✓ |  -  | Signed download token |

**Responses**

- `200`  -  Kit package (text multi-file or redirected tarball)
- `302`  -  Redirect to object-storage tarball (full mode)
- `400`  -  Missing or invalid token
- `404`  -  Fulfillment not ready
- `410`  -  Token expired

---

## billing

### `POST` `/api/billing/checkout`

**Create a checkout session**

Creates a Stripe checkout session for subscription purchase. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - |  |
| `tier` | `string` | - |  |
| `interval` | `string` | - |  |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated

---

### `POST` `/api/billing/payment-intent`

**Create an incomplete subscription PaymentIntent**

Creates a Stripe subscription with payment_behavior=default_incomplete and returns the first invoice client_secret for Payment Element.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - |  |
| `tier` | `string` | - |  |
| `interval` | `string` | - |  |

**Responses**

- `200`  -  PaymentIntent client_secret created
- `401`  -  Not authenticated

---

### `POST` `/api/billing/portal`

**Create a billing portal session**

Creates a Stripe billing portal session for subscription management.

**Responses**

- `200`  -  Portal session created
- `401`  -  Not authenticated

---

### `GET` `/api/billing/subscription`

**Get subscription status**

Returns the current user's license tier, status, and expiration.

**Responses**

- `200`  -  Current subscription status
- `401`  -  Not authenticated

---

### `GET` `/api/billing/invoices`

**List invoices**

Returns the current user's Stripe invoices with amounts, status, and PDF download links.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `string` | - |  -  | Max invoices to return (1-100, default 10) |
| `starting_after` | `string` | - |  -  | Cursor for pagination (Stripe invoice ID) |

**Responses**

- `200`  -  List of invoices
- `401`  -  Not authenticated

---

### `POST` `/api/billing/upgrade`

**Upgrade subscription tier**

Upgrades an active subscription to a new price/tier mid-cycle. Prorations are created automatically. Requires an existing active subscription.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - |  |
| `targetTier` | `string` | ✓ |  |

**Responses**

- `200`  -  Subscription upgraded  -  Stripe will fire customer.subscription.updated
- `400`  -  No active subscription or no billing account
- `401`  -  Not authenticated

---

### `POST` `/api/billing/downgrade`

**Downgrade to free tier**

Cancels the active subscription at the end of the current billing period. The user retains Pro/Enterprise access until then.

**Responses**

- `200`  -  Subscription scheduled for cancellation at end of billing period
- `400`  -  No active subscription found
- `401`  -  Not authenticated

---

### `POST` `/api/billing/pause`

**Pause subscription**

Pauses billing for the current subscription. Access is retained during the pause period.

**Responses**

- `200`  -  Subscription paused
- `401`  -  Not authenticated

---

### `POST` `/api/billing/resume`

**Resume subscription**

Resumes billing for a paused subscription.

**Responses**

- `200`  -  Subscription resumed
- `401`  -  Not authenticated

---

### `POST` `/api/billing/checkout-perpetual`

**Create a perpetual license checkout session**

Creates a one-time Stripe payment session for a perpetual license. Includes 1 year of support. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - | Stripe price ID for the perpetual license product |
| `tier` | `string` | ✓ | Perpetual license tier |
| `githubUsername` | `string` | - | GitHub username for revealui-pro team access provisioning |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated

---

### `POST` `/api/billing/checkout-support-renewal`

**Create a support renewal checkout session**

Creates a one-time Stripe payment session to renew the annual support contract on a perpetual license. Requires authentication and an existing perpetual license.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - | Stripe price ID for the support renewal product |
| `tier` | `string` | ✓ | Perpetual license tier whose support to renew |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated
- `404`  -  No perpetual license found for this tier

---

### `POST` `/api/billing/checkout-credits`

**Reject leftover credit-bundle checkout**

Credit bundles are not sold. The route stays registered so leftover clients receive a closed rejection instead of an unattended Stripe session.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - | Stripe price ID for the credit bundle product |
| `bundle` | `string` | ✓ | Credit bundle name |

**Responses**

- `400`  -  Credit bundles are not sold
- `401`  -  Not authenticated

---

### `GET` `/api/billing/credits`

**Get current credit balance**

Returns the authenticated user's prepaid agent task credit balance.

**Responses**

- `200`  -  Credit balance
- `401`  -  Not authenticated

---

### `GET` `/api/billing/usage`

**Agent task usage**

Returns agent task usage for the current monthly billing cycle plus this ISO week (UTC). Monthly fields are unchanged.

**Responses**

- `200`  -  Current cycle usage
- `401`  -  Not authenticated

---

### `GET` `/api/billing/seats`

**Seat usage**

Returns active member count and the tier seat cap for the current account.

**Responses**

- `200`  -  Current seat usage
- `401`  -  Not authenticated

---

### `POST` `/api/billing/support-renewal-check`

**Send support renewal reminders (internal cron)**

Finds perpetual licenses whose support contract expires within 30 days and sends reminder emails. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Reminders sent
- `403`  -  Invalid cron secret

---

### `POST` `/api/billing/report-agent-overage`

**Report agent task overage to Stripe (internal cron)**

Reads overage from the previous billing cycle and emits Stripe Billing Meter events. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Overage reported
- `401`  -  Invalid cron secret

---

### `POST` `/api/billing/sweep-expired-licenses`

**Sweep expired licenses (internal cron)**

Marks non-perpetual licenses whose expiresAt is in the past as expired, and perpetual licenses whose supportExpiresAt is in the past as support_expired. Clears caches so changes take effect immediately. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Sweep complete
- `403`  -  Invalid cron secret

---

### `POST` `/api/billing/refund`

**Issue a refund**

Creates a Stripe refund for a payment intent or charge. Admin-only. Full or partial refunds supported. License revocation is handled automatically by the charge.refunded webhook.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `paymentIntentId` | `string` | - |  |
| `chargeId` | `string` | - |  |
| `amount` | `integer` | - |  |
| `reason` | `string` | - |  |

**Responses**

- `200`  -  Refund created
- `400`  -  Invalid request (missing payment reference)
- `401`  -  Not authenticated
- `403`  -  Admin access required

---

### `GET` `/api/billing/metrics`

**Revenue metrics (admin)**

Returns aggregate revenue metrics for the admin dashboard. Requires admin or owner role.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `from` | `string` | - |  -  | Start of date range for recent events (ISO 8601). Defaults to 30 days ago. |
| `to` | `string` | - |  -  | End of date range for recent events (ISO 8601). Defaults to now. |

**Responses**

- `200`  -  Revenue metrics snapshot
- `401`  -  Not authenticated
- `403`  -  Admin access required

---

### `POST` `/api/v1/billing/checkout`

**Create a checkout session**

Creates a Stripe checkout session for subscription purchase. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - |  |
| `tier` | `string` | - |  |
| `interval` | `string` | - |  |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/payment-intent`

**Create an incomplete subscription PaymentIntent**

Creates a Stripe subscription with payment_behavior=default_incomplete and returns the first invoice client_secret for Payment Element.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - |  |
| `tier` | `string` | - |  |
| `interval` | `string` | - |  |

**Responses**

- `200`  -  PaymentIntent client_secret created
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/portal`

**Create a billing portal session**

Creates a Stripe billing portal session for subscription management.

**Responses**

- `200`  -  Portal session created
- `401`  -  Not authenticated

---

### `GET` `/api/v1/billing/subscription`

**Get subscription status**

Returns the current user's license tier, status, and expiration.

**Responses**

- `200`  -  Current subscription status
- `401`  -  Not authenticated

---

### `GET` `/api/v1/billing/invoices`

**List invoices**

Returns the current user's Stripe invoices with amounts, status, and PDF download links.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `string` | - |  -  | Max invoices to return (1-100, default 10) |
| `starting_after` | `string` | - |  -  | Cursor for pagination (Stripe invoice ID) |

**Responses**

- `200`  -  List of invoices
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/upgrade`

**Upgrade subscription tier**

Upgrades an active subscription to a new price/tier mid-cycle. Prorations are created automatically. Requires an existing active subscription.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - |  |
| `targetTier` | `string` | ✓ |  |

**Responses**

- `200`  -  Subscription upgraded  -  Stripe will fire customer.subscription.updated
- `400`  -  No active subscription or no billing account
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/downgrade`

**Downgrade to free tier**

Cancels the active subscription at the end of the current billing period. The user retains Pro/Enterprise access until then.

**Responses**

- `200`  -  Subscription scheduled for cancellation at end of billing period
- `400`  -  No active subscription found
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/pause`

**Pause subscription**

Pauses billing for the current subscription. Access is retained during the pause period.

**Responses**

- `200`  -  Subscription paused
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/resume`

**Resume subscription**

Resumes billing for a paused subscription.

**Responses**

- `200`  -  Subscription resumed
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/checkout-perpetual`

**Create a perpetual license checkout session**

Creates a one-time Stripe payment session for a perpetual license. Includes 1 year of support. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - | Stripe price ID for the perpetual license product |
| `tier` | `string` | ✓ | Perpetual license tier |
| `githubUsername` | `string` | - | GitHub username for revealui-pro team access provisioning |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/checkout-support-renewal`

**Create a support renewal checkout session**

Creates a one-time Stripe payment session to renew the annual support contract on a perpetual license. Requires authentication and an existing perpetual license.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - | Stripe price ID for the support renewal product |
| `tier` | `string` | ✓ | Perpetual license tier whose support to renew |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated
- `404`  -  No perpetual license found for this tier

---

### `POST` `/api/v1/billing/checkout-credits`

**Reject leftover credit-bundle checkout**

Credit bundles are not sold. The route stays registered so leftover clients receive a closed rejection instead of an unattended Stripe session.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` | - | Stripe price ID for the credit bundle product |
| `bundle` | `string` | ✓ | Credit bundle name |

**Responses**

- `400`  -  Credit bundles are not sold
- `401`  -  Not authenticated

---

### `GET` `/api/v1/billing/credits`

**Get current credit balance**

Returns the authenticated user's prepaid agent task credit balance.

**Responses**

- `200`  -  Credit balance
- `401`  -  Not authenticated

---

### `GET` `/api/v1/billing/usage`

**Agent task usage**

Returns agent task usage for the current monthly billing cycle plus this ISO week (UTC). Monthly fields are unchanged.

**Responses**

- `200`  -  Current cycle usage
- `401`  -  Not authenticated

---

### `GET` `/api/v1/billing/seats`

**Seat usage**

Returns active member count and the tier seat cap for the current account.

**Responses**

- `200`  -  Current seat usage
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/support-renewal-check`

**Send support renewal reminders (internal cron)**

Finds perpetual licenses whose support contract expires within 30 days and sends reminder emails. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Reminders sent
- `403`  -  Invalid cron secret

---

### `POST` `/api/v1/billing/report-agent-overage`

**Report agent task overage to Stripe (internal cron)**

Reads overage from the previous billing cycle and emits Stripe Billing Meter events. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Overage reported
- `401`  -  Invalid cron secret

---

### `POST` `/api/v1/billing/sweep-expired-licenses`

**Sweep expired licenses (internal cron)**

Marks non-perpetual licenses whose expiresAt is in the past as expired, and perpetual licenses whose supportExpiresAt is in the past as support_expired. Clears caches so changes take effect immediately. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Sweep complete
- `403`  -  Invalid cron secret

---

### `POST` `/api/v1/billing/refund`

**Issue a refund**

Creates a Stripe refund for a payment intent or charge. Admin-only. Full or partial refunds supported. License revocation is handled automatically by the charge.refunded webhook.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `paymentIntentId` | `string` | - |  |
| `chargeId` | `string` | - |  |
| `amount` | `integer` | - |  |
| `reason` | `string` | - |  |

**Responses**

- `200`  -  Refund created
- `400`  -  Invalid request (missing payment reference)
- `401`  -  Not authenticated
- `403`  -  Admin access required

---

### `GET` `/api/v1/billing/metrics`

**Revenue metrics (admin)**

Returns aggregate revenue metrics for the admin dashboard. Requires admin or owner role.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `from` | `string` | - |  -  | Start of date range for recent events (ISO 8601). Defaults to 30 days ago. |
| `to` | `string` | - |  -  | End of date range for recent events (ISO 8601). Defaults to now. |

**Responses**

- `200`  -  Revenue metrics snapshot
- `401`  -  Not authenticated
- `403`  -  Admin access required

---

## webhooks

### `POST` `/api/webhooks/stripe`

**Stripe webhook handler**

Receives Stripe webhook events for subscription lifecycle, license management, disputes, and refunds. Requires raw body access for signature verification.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |
| `type` | `string` | ✓ |  |
| `data` | `object` | ✓ |  |
| `created` | `number` | ✓ |  |
| `livemode` | `boolean` | ✓ |  |

**Responses**

- `200`  -  Webhook event received and processed
- `400`  -  Missing signature or invalid webhook
- `500`  -  Webhook processing failed
- `503`  -  Webhook service unavailable (Stripe env vars misconfigured)

---

### `POST` `/api/v1/webhooks/stripe`

**Stripe webhook handler**

Receives Stripe webhook events for subscription lifecycle, license management, disputes, and refunds. Requires raw body access for signature verification.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |
| `type` | `string` | ✓ |  |
| `data` | `object` | ✓ |  |
| `created` | `number` | ✓ |  |
| `livemode` | `boolean` | ✓ |  |

**Responses**

- `200`  -  Webhook event received and processed
- `400`  -  Missing signature or invalid webhook
- `500`  -  Webhook processing failed
- `503`  -  Webhook service unavailable (Stripe env vars misconfigured)

---

## provenance

### `GET` `/api/provenance`

**List provenance entries**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `authorType` | `string` | - |  -  |  |
| `reviewStatus` | `string` | - |  -  |  |
| `filePathPrefix` | `string` | - |  -  |  |
| `limit` | `integer` | - |  -  |  |
| `offset` | `integer` | - |  -  |  |

**Responses**

- `200`  -  Provenance list

---

### `POST` `/api/provenance`

**Create a provenance entry**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `filePath` | `string` | ✓ |  |
| `authorType` | `string` | ✓ |  |
| `functionName` | `string` | - |  |
| `lineStart` | `integer` | - |  |
| `lineEnd` | `integer` | - |  |
| `aiModel` | `string` | - |  |
| `aiSessionId` | `string` | - |  |
| `gitCommitHash` | `string` | - |  |
| `gitAuthor` | `string` | - |  |
| `confidence` | `number` | - |  |
| `linesOfCode` | `integer` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Provenance entry created
- `500`  -  Server error

---

### `GET` `/api/provenance/stats`

**Get provenance statistics**

**Responses**

- `200`  -  Provenance statistics

---

### `GET` `/api/provenance/file/{filePath}`

**Get provenance for a specific file**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `filePath` | `string` | ✓ |  |

**Responses**

- `200`  -  File provenance

---

### `GET` `/api/provenance/{id}`

**Get a provenance entry by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Provenance entry found
- `404`  -  Not found

---

### `PATCH` `/api/provenance/{id}`

**Update a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `filePath` | `string` | - |  |
| `functionName` | `string` | - |  |
| `lineStart` | `integer` | - |  |
| `lineEnd` | `integer` | - |  |
| `authorType` | `string` | - |  |
| `aiModel` | `string` | - |  |
| `aiSessionId` | `string` | - |  |
| `gitCommitHash` | `string` | - |  |
| `gitAuthor` | `string` | - |  |
| `confidence` | `number` | - |  |
| `reviewStatus` | `string` | - |  |
| `linesOfCode` | `integer` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `200`  -  Provenance entry updated
- `404`  -  Not found

---

### `DELETE` `/api/provenance/{id}`

**Delete a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Provenance entry deleted

---

### `POST` `/api/provenance/{id}/review`

**Add a review to a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reviewType` | `string` | ✓ |  |
| `status` | `string` | ✓ |  |
| `reviewerId` | `string` | - |  |
| `comment` | `string` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Review added
- `404`  -  Not found
- `500`  -  Server error

---

### `GET` `/api/provenance/{id}/reviews`

**List reviews for a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Review list

---

### `GET` `/api/v1/provenance`

**List provenance entries**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `authorType` | `string` | - |  -  |  |
| `reviewStatus` | `string` | - |  -  |  |
| `filePathPrefix` | `string` | - |  -  |  |
| `limit` | `integer` | - |  -  |  |
| `offset` | `integer` | - |  -  |  |

**Responses**

- `200`  -  Provenance list

---

### `POST` `/api/v1/provenance`

**Create a provenance entry**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `filePath` | `string` | ✓ |  |
| `authorType` | `string` | ✓ |  |
| `functionName` | `string` | - |  |
| `lineStart` | `integer` | - |  |
| `lineEnd` | `integer` | - |  |
| `aiModel` | `string` | - |  |
| `aiSessionId` | `string` | - |  |
| `gitCommitHash` | `string` | - |  |
| `gitAuthor` | `string` | - |  |
| `confidence` | `number` | - |  |
| `linesOfCode` | `integer` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Provenance entry created
- `500`  -  Server error

---

### `GET` `/api/v1/provenance/stats`

**Get provenance statistics**

**Responses**

- `200`  -  Provenance statistics

---

### `GET` `/api/v1/provenance/file/{filePath}`

**Get provenance for a specific file**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `filePath` | `string` | ✓ |  |

**Responses**

- `200`  -  File provenance

---

### `GET` `/api/v1/provenance/{id}`

**Get a provenance entry by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Provenance entry found
- `404`  -  Not found

---

### `PATCH` `/api/v1/provenance/{id}`

**Update a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `filePath` | `string` | - |  |
| `functionName` | `string` | - |  |
| `lineStart` | `integer` | - |  |
| `lineEnd` | `integer` | - |  |
| `authorType` | `string` | - |  |
| `aiModel` | `string` | - |  |
| `aiSessionId` | `string` | - |  |
| `gitCommitHash` | `string` | - |  |
| `gitAuthor` | `string` | - |  |
| `confidence` | `number` | - |  |
| `reviewStatus` | `string` | - |  |
| `linesOfCode` | `integer` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `200`  -  Provenance entry updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/provenance/{id}`

**Delete a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Provenance entry deleted

---

### `POST` `/api/v1/provenance/{id}/review`

**Add a review to a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reviewType` | `string` | ✓ |  |
| `status` | `string` | ✓ |  |
| `reviewerId` | `string` | - |  |
| `comment` | `string` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Review added
- `404`  -  Not found
- `500`  -  Server error

---

### `GET` `/api/v1/provenance/{id}/reviews`

**List reviews for a provenance entry**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Review list

---

## boards

### `GET` `/api/tickets/boards`

**List all boards**

**Responses**

- `200`  -  Board list

---

### `POST` `/api/tickets/boards`

**Create a board**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `description` | `string` | - |  |
| `isDefault` | `boolean` | - |  |

**Responses**

- `201`  -  Board created

---

### `GET` `/api/tickets/boards/{id}`

**Get a board by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Board found
- `404`  -  Not found

---

### `PATCH` `/api/tickets/boards/{id}`

**Update a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `description` | `string` | - |  |

**Responses**

- `200`  -  Board updated
- `404`  -  Not found

---

### `DELETE` `/api/tickets/boards/{id}`

**Delete a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Board deleted

---

### `GET` `/api/tickets/boards/{boardId}/columns`

**List columns for a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Responses**

- `200`  -  Columns list

---

### `POST` `/api/tickets/boards/{boardId}/columns`

**Create a column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `position` | `integer` | ✓ |  |
| `wipLimit` | `integer` | - |  |
| `color` | `string` | - |  |

**Responses**

- `201`  -  Column created

---

### `PATCH` `/api/tickets/columns/{id}`

**Update a column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `position` | `integer` | - |  |
| `wipLimit` | `integer` | - |  |
| `color` | `string` | - |  |

**Responses**

- `200`  -  Column updated
- `404`  -  Not found

---

### `DELETE` `/api/tickets/columns/{id}`

**Delete a column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Column deleted

---

### `GET` `/api/v1/tickets/boards`

**List all boards**

**Responses**

- `200`  -  Board list

---

### `POST` `/api/v1/tickets/boards`

**Create a board**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `description` | `string` | - |  |
| `isDefault` | `boolean` | - |  |

**Responses**

- `201`  -  Board created

---

### `GET` `/api/v1/tickets/boards/{id}`

**Get a board by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Board found
- `404`  -  Not found

---

### `PATCH` `/api/v1/tickets/boards/{id}`

**Update a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `description` | `string` | - |  |

**Responses**

- `200`  -  Board updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/tickets/boards/{id}`

**Delete a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Board deleted

---

### `GET` `/api/v1/tickets/boards/{boardId}/columns`

**List columns for a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Responses**

- `200`  -  Columns list

---

### `POST` `/api/v1/tickets/boards/{boardId}/columns`

**Create a column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `position` | `integer` | ✓ |  |
| `wipLimit` | `integer` | - |  |
| `color` | `string` | - |  |

**Responses**

- `201`  -  Column created

---

### `PATCH` `/api/v1/tickets/columns/{id}`

**Update a column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `position` | `integer` | - |  |
| `wipLimit` | `integer` | - |  |
| `color` | `string` | - |  |

**Responses**

- `200`  -  Column updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/tickets/columns/{id}`

**Delete a column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Column deleted

---

## tickets

### `GET` `/api/tickets/boards/{boardId}/tickets`

**List tickets for a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |
| `priority` | `string` | - |  -  |  |
| `type` | `string` | - |  -  |  |
| `assigneeId` | `string` | - |  -  |  |
| `columnId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Ticket list

---

### `POST` `/api/tickets/boards/{boardId}/tickets`

**Create a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `description` | `object` | - |  |
| `columnId` | `string` | - |  |
| `parentTicketId` | `string` | - |  |
| `status` | `string` | - |  |
| `priority` | `string` | - |  |
| `type` | `string` | - |  |
| `assigneeId` | `string` | - |  |
| `reporterId` | `string` | - |  |
| `dueDate` | `string (date-time)` | - |  |
| `estimatedEffort` | `integer` | - |  |

**Responses**

- `201`  -  Ticket created

---

### `GET` `/api/tickets/tickets/{id}`

**Get a ticket by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Ticket found
- `404`  -  Not found

---

### `PATCH` `/api/tickets/tickets/{id}`

**Update a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `description` | `object` | - |  |
| `status` | `string` | - |  |
| `priority` | `string` | - |  |
| `type` | `string` | - |  |
| `assigneeId` | `string` | - |  |
| `reporterId` | `string` | - |  |
| `columnId` | `string` | - |  |
| `dueDate` | `string (date-time)` | - |  |
| `estimatedEffort` | `integer` | - |  |
| `sortOrder` | `number` | - |  |

**Responses**

- `200`  -  Ticket updated
- `404`  -  Not found

---

### `DELETE` `/api/tickets/tickets/{id}`

**Delete a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Ticket deleted

---

### `POST` `/api/tickets/tickets/{id}/move`

**Move a ticket to a different column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `columnId` | `string` | ✓ |  |
| `sortOrder` | `integer` | ✓ |  |

**Responses**

- `200`  -  Ticket moved
- `404`  -  Not found

---

### `GET` `/api/tickets/tickets/{id}/subtasks`

**Get subtasks for a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Subtask list

---

### `GET` `/api/v1/tickets/boards/{boardId}/tickets`

**List tickets for a board**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |
| `priority` | `string` | - |  -  |  |
| `type` | `string` | - |  -  |  |
| `assigneeId` | `string` | - |  -  |  |
| `columnId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Ticket list

---

### `POST` `/api/v1/tickets/boards/{boardId}/tickets`

**Create a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `boardId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `description` | `object` | - |  |
| `columnId` | `string` | - |  |
| `parentTicketId` | `string` | - |  |
| `status` | `string` | - |  |
| `priority` | `string` | - |  |
| `type` | `string` | - |  |
| `assigneeId` | `string` | - |  |
| `reporterId` | `string` | - |  |
| `dueDate` | `string (date-time)` | - |  |
| `estimatedEffort` | `integer` | - |  |

**Responses**

- `201`  -  Ticket created

---

### `GET` `/api/v1/tickets/tickets/{id}`

**Get a ticket by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Ticket found
- `404`  -  Not found

---

### `PATCH` `/api/v1/tickets/tickets/{id}`

**Update a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `description` | `object` | - |  |
| `status` | `string` | - |  |
| `priority` | `string` | - |  |
| `type` | `string` | - |  |
| `assigneeId` | `string` | - |  |
| `reporterId` | `string` | - |  |
| `columnId` | `string` | - |  |
| `dueDate` | `string (date-time)` | - |  |
| `estimatedEffort` | `integer` | - |  |
| `sortOrder` | `number` | - |  |

**Responses**

- `200`  -  Ticket updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/tickets/tickets/{id}`

**Delete a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Ticket deleted

---

### `POST` `/api/v1/tickets/tickets/{id}/move`

**Move a ticket to a different column**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `columnId` | `string` | ✓ |  |
| `sortOrder` | `integer` | ✓ |  |

**Responses**

- `200`  -  Ticket moved
- `404`  -  Not found

---

### `GET` `/api/v1/tickets/tickets/{id}/subtasks`

**Get subtasks for a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Subtask list

---

## comments

### `GET` `/api/tickets/tickets/{id}/comments`

**List comments for a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Comment list

---

### `POST` `/api/tickets/tickets/{id}/comments`

**Add a comment to a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `body` | `object` | ✓ |  |
| `authorId` | `string` | - |  |

**Responses**

- `201`  -  Comment created

---

### `PATCH` `/api/tickets/comments/{id}`

**Update a comment**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `body` | `object` | ✓ |  |

**Responses**

- `200`  -  Comment updated
- `404`  -  Not found

---

### `DELETE` `/api/tickets/comments/{id}`

**Delete a comment**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Comment deleted

---

### `GET` `/api/v1/tickets/tickets/{id}/comments`

**List comments for a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Comment list

---

### `POST` `/api/v1/tickets/tickets/{id}/comments`

**Add a comment to a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `body` | `object` | ✓ |  |
| `authorId` | `string` | - |  |

**Responses**

- `201`  -  Comment created

---

### `PATCH` `/api/v1/tickets/comments/{id}`

**Update a comment**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `body` | `object` | ✓ |  |

**Responses**

- `200`  -  Comment updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/tickets/comments/{id}`

**Delete a comment**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Comment deleted

---

## labels

### `GET` `/api/tickets/labels`

**List all labels**

**Responses**

- `200`  -  Label list

---

### `POST` `/api/tickets/labels`

**Create a label**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `color` | `string` | - |  |
| `description` | `string` | - |  |

**Responses**

- `201`  -  Label created

---

### `PATCH` `/api/tickets/labels/{id}`

**Update a label**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `color` | `string` | - |  |
| `description` | `string` | - |  |

**Responses**

- `200`  -  Label updated
- `404`  -  Not found

---

### `DELETE` `/api/tickets/labels/{id}`

**Delete a label**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Label deleted

---

### `GET` `/api/tickets/tickets/{id}/labels`

**Get labels for a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Labels for ticket

---

### `POST` `/api/tickets/tickets/{id}/labels`

**Assign a label to a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `labelId` | `string` | ✓ |  |

**Responses**

- `201`  -  Label assigned

---

### `DELETE` `/api/tickets/tickets/{id}/labels/{labelId}`

**Remove a label from a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |
| `labelId` | `string` | ✓ |  |

**Responses**

- `200`  -  Label removed

---

### `GET` `/api/v1/tickets/labels`

**List all labels**

**Responses**

- `200`  -  Label list

---

### `POST` `/api/v1/tickets/labels`

**Create a label**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `color` | `string` | - |  |
| `description` | `string` | - |  |

**Responses**

- `201`  -  Label created

---

### `PATCH` `/api/v1/tickets/labels/{id}`

**Update a label**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `color` | `string` | - |  |
| `description` | `string` | - |  |

**Responses**

- `200`  -  Label updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/tickets/labels/{id}`

**Delete a label**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Label deleted

---

### `GET` `/api/v1/tickets/tickets/{id}/labels`

**Get labels for a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Labels for ticket

---

### `POST` `/api/v1/tickets/tickets/{id}/labels`

**Assign a label to a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `labelId` | `string` | ✓ |  |

**Responses**

- `201`  -  Label assigned

---

### `DELETE` `/api/v1/tickets/tickets/{id}/labels/{labelId}`

**Remove a label from a ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |
| `labelId` | `string` | ✓ |  |

**Responses**

- `200`  -  Label removed

---

## agent-tasks

### `POST` `/api/agent-tasks`

**Submit a natural language task for an agent to execute**

Creates a ticket from the instruction, dispatches an AI agent with admin tools to resolve it, and returns the result. When durable dispatch is enabled and the agent takes longer than ~22 s, returns 202 with a jobId the caller can poll at /status.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` | ✓ | Board to create the ticket on |
| `priority` | `string` | - |  |
| `trustPreset` | `string` | - |  |

**Responses**

- `200`  -  Agent task completed within the sync/poll window
- `202`  -  Dispatch enqueued but still running at the poll-window timeout. Caller polls the statusUrl.
- `400`  -  Bad request
- `403`  -  AI feature requires Pro or Enterprise license
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `POST` `/api/agent-tasks/{ticketId}/dispatch`

**Dispatch an agent for an existing ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `ticketId` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent dispatch completed within the sync/poll window
- `202`  -  Dispatch enqueued but still running at the poll-window timeout
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Ticket not found
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/api/agent-tasks/{ticketId}/status`

**Fetch the canonical dispatch status for a ticket**

Returns the current state of the most recent dispatch job for a ticket. `status = idle` means no job was ever queued (legacy sync dispatch or ticket never dispatched). Safe to poll; returns 200 even when nothing is in flight.

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `ticketId` | `string` | ✓ |  |

**Responses**

- `200`  -  Dispatch status
- `404`  -  Ticket not found

---

### `POST` `/api/v1/agent-tasks`

**Submit a natural language task for an agent to execute**

Creates a ticket from the instruction, dispatches an AI agent with admin tools to resolve it, and returns the result. When durable dispatch is enabled and the agent takes longer than ~22 s, returns 202 with a jobId the caller can poll at /status.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` | ✓ | Board to create the ticket on |
| `priority` | `string` | - |  |
| `trustPreset` | `string` | - |  |

**Responses**

- `200`  -  Agent task completed within the sync/poll window
- `202`  -  Dispatch enqueued but still running at the poll-window timeout. Caller polls the statusUrl.
- `400`  -  Bad request
- `403`  -  AI feature requires Pro or Enterprise license
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `POST` `/api/v1/agent-tasks/{ticketId}/dispatch`

**Dispatch an agent for an existing ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `ticketId` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent dispatch completed within the sync/poll window
- `202`  -  Dispatch enqueued but still running at the poll-window timeout
- `403`  -  AI feature requires Pro or Enterprise license
- `404`  -  Ticket not found
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `GET` `/api/v1/agent-tasks/{ticketId}/status`

**Fetch the canonical dispatch status for a ticket**

Returns the current state of the most recent dispatch job for a ticket. `status = idle` means no job was ever queued (legacy sync dispatch or ticket never dispatched). Safe to poll; returns 200 even when nothing is in flight.

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `ticketId` | `string` | ✓ |  |

**Responses**

- `200`  -  Dispatch status
- `404`  -  Ticket not found

---

## agent

### `POST` `/api/agent-stream/elicit`

**Submit an elicitation response for an in-flight agent run**

Resolves a pending `elicitation/create` request issued by an MCP server during an agent-stream run. The client provides `{ sessionId, elicitationId, action, content? }`; the server maps the session to the pending handler promise and resolves it.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `sessionId` | `string (uuid)` | ✓ |  |
| `elicitationId` | `string` | ✓ |  |
| `action` | `string` | ✓ |  |
| `content` | `object` | - |  |

**Responses**

- `200`  -  Elicitation resolved
- `401`  -  Authentication required
- `403`  -  Session belongs to a different user
- `404`  -  No pending elicitation matching the supplied ids

---

### `POST` `/api/agent-stream`

**Stream agent execution via SSE**

Streams agent execution events in real-time using Server-Sent Events. Client-side: use fetch + ReadableStream (not EventSource  -  it does not support POST).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` | - |  |
| `workspaceId` | `string` | - |  |
| `priority` | `string` | - |  |
| `provider` | `string` | - |  |
| `model` | `string` | - |  |
| `mode` | `string` | - |  |
| `agentId` | `string` | - |  |
| `trustPreset` | `string` | - |  |

**Responses**

- `200`  -  SSE stream of agent execution events (text/event-stream)
- `400`  -  Missing instruction or invalid provider
- `403`  -  AI feature requires Pro or Enterprise license
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `500`  -  AI client resolve failed (not a Free-plan limit)
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

### `POST` `/api/v1/agent-stream/elicit`

**Submit an elicitation response for an in-flight agent run**

Resolves a pending `elicitation/create` request issued by an MCP server during an agent-stream run. The client provides `{ sessionId, elicitationId, action, content? }`; the server maps the session to the pending handler promise and resolves it.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `sessionId` | `string (uuid)` | ✓ |  |
| `elicitationId` | `string` | ✓ |  |
| `action` | `string` | ✓ |  |
| `content` | `object` | - |  |

**Responses**

- `200`  -  Elicitation resolved
- `401`  -  Authentication required
- `403`  -  Session belongs to a different user
- `404`  -  No pending elicitation matching the supplied ids

---

### `POST` `/api/v1/agent-stream`

**Stream agent execution via SSE**

Streams agent execution events in real-time using Server-Sent Events. Client-side: use fetch + ReadableStream (not EventSource  -  it does not support POST).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` | - |  |
| `workspaceId` | `string` | - |  |
| `priority` | `string` | - |  |
| `provider` | `string` | - |  |
| `model` | `string` | - |  |
| `mode` | `string` | - |  |
| `agentId` | `string` | - |  |
| `trustPreset` | `string` | - |  |

**Responses**

- `200`  -  SSE stream of agent execution events (text/event-stream)
- `400`  -  Missing instruction or invalid provider
- `403`  -  AI feature requires Pro or Enterprise license
- `409`  -  Hosted account has no LLM provider configured (set one at /settings/api-keys)
- `500`  -  AI client resolve failed (not a Free-plan limit)
- `503`  -  AI runtime package not available in this deployment (not a Free-plan limit)

---

## mcp

### `GET` `/api/mcp/usage`

**Aggregate MCP usage for the caller’s account**

Returns per-`meterName` totals, success / error / unknown counts (unknown = pre-A.3 row with NULL `errored`), duration counts, and p50 / p95 duration buckets in milliseconds. Filtered by the caller’s `accountId` (resolved from `entitlementMiddleware`) and the requested time range.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `range` | `string` | - | `24h` |  |

**Responses**

- `200`  -  Usage aggregations for the caller’s account
- `401`  -  Authentication required
- `409`  -  Caller has no resolvable account membership

---

### `GET` `/api/mcp/approvals`

**List governed MCP approvals for the caller account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Approvals visible to this account
- `401`  -  Authentication required
- `403`  -  Caller cannot review approvals
- `409`  -  Caller has no account

---

### `GET` `/api/mcp/approvals/:id`

**Read one governed MCP approval**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Approval detail with a redacted argument preview
- `401`  -  Authentication required
- `403`  -  Caller cannot review approvals
- `404`  -  Approval not found
- `409`  -  Caller has no account

---

### `POST` `/api/mcp/approvals/:id/decide`

**Approve or deny a pending MCP approval**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `verdict` | `string` | ✓ |  |
| `note` | `string` | - |  |

**Responses**

- `200`  -  Decision recorded
- `401`  -  Authentication required
- `403`  -  Caller cannot decide this approval
- `404`  -  Approval not found
- `409`  -  Approval is not a pending unexpired request
- `503`  -  Audit write failed, so the decision was refused

---

### `GET` `/api/mcp/approval-settings`

**Read which eligible tools require approval**

**Responses**

- `200`  -  Current requireTools list
- `401`  -  Authentication required
- `403`  -  Caller cannot review approval settings
- `409`  -  Caller has no account

---

### `PUT` `/api/mcp/approval-settings`

**Replace which eligible tools require approval**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `requireTools` | `array` | ✓ |  |

**Responses**

- `200`  -  Settings saved
- `400`  -  requireTools is not a set of eligible tools
- `401`  -  Authentication required
- `403`  -  Caller cannot change approval settings
- `409`  -  Caller has no account

---

### `GET` `/api/v1/mcp/usage`

**Aggregate MCP usage for the caller’s account**

Returns per-`meterName` totals, success / error / unknown counts (unknown = pre-A.3 row with NULL `errored`), duration counts, and p50 / p95 duration buckets in milliseconds. Filtered by the caller’s `accountId` (resolved from `entitlementMiddleware`) and the requested time range.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `range` | `string` | - | `24h` |  |

**Responses**

- `200`  -  Usage aggregations for the caller’s account
- `401`  -  Authentication required
- `409`  -  Caller has no resolvable account membership

---

### `GET` `/api/v1/mcp/approvals`

**List governed MCP approvals for the caller account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Approvals visible to this account
- `401`  -  Authentication required
- `403`  -  Caller cannot review approvals
- `409`  -  Caller has no account

---

### `GET` `/api/v1/mcp/approvals/:id`

**Read one governed MCP approval**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Approval detail with a redacted argument preview
- `401`  -  Authentication required
- `403`  -  Caller cannot review approvals
- `404`  -  Approval not found
- `409`  -  Caller has no account

---

### `POST` `/api/v1/mcp/approvals/:id/decide`

**Approve or deny a pending MCP approval**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `verdict` | `string` | ✓ |  |
| `note` | `string` | - |  |

**Responses**

- `200`  -  Decision recorded
- `401`  -  Authentication required
- `403`  -  Caller cannot decide this approval
- `404`  -  Approval not found
- `409`  -  Approval is not a pending unexpired request
- `503`  -  Audit write failed, so the decision was refused

---

### `GET` `/api/v1/mcp/approval-settings`

**Read which eligible tools require approval**

**Responses**

- `200`  -  Current requireTools list
- `401`  -  Authentication required
- `403`  -  Caller cannot review approval settings
- `409`  -  Caller has no account

---

### `PUT` `/api/v1/mcp/approval-settings`

**Replace which eligible tools require approval**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `requireTools` | `array` | ✓ |  |

**Responses**

- `200`  -  Settings saved
- `400`  -  requireTools is not a set of eligible tools
- `401`  -  Authentication required
- `403`  -  Caller cannot change approval settings
- `409`  -  Caller has no account

---

## content

### `GET` `/api/content/posts`

**List posts**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |
| `authorId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Post list

---

### `POST` `/api/content/posts`

**Create a post**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `excerpt` | `string` | - |  |
| `content` | `any` | - |  |
| `featuredImageId` | `string` | - |  |
| `authorId` | `string` | - |  |
| `status` | `string` | - |  |
| `meta` | `object` | - |  |
| `categories` | `array` | - |  |

**Responses**

- `201`  -  Post created
- `400`  -  Content validation failed

---

### `GET` `/api/content/posts/{id}`

**Get a post by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Post found
- `404`  -  Not found

---

### `PATCH` `/api/content/posts/{id}`

**Update a post**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `slug` | `string` | - |  |
| `excerpt` | `string` | - |  |
| `content` | `any` | - |  |
| `featuredImageId` | `string` | - |  |
| `status` | `string` | - |  |
| `published` | `boolean` | - |  |
| `meta` | `object` | - |  |
| `categories` | `array` | - |  |
| `publishedAt` | `string (date-time)` | - |  |

**Responses**

- `200`  -  Post updated
- `400`  -  Content validation failed
- `404`  -  Not found

---

### `DELETE` `/api/content/posts/{id}`

**Delete a post**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Post deleted
- `404`  -  Not found

---

### `GET` `/api/content/posts/slug/{slug}`

**Get a post by slug**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `slug` | `string` | ✓ |  |

**Responses**

- `200`  -  Post found
- `404`  -  Not found

---

### `POST` `/api/content/media/presign`

**Presign a direct-to-storage media upload**

Returns a short-lived presigned PUT URL. The client uploads bytes directly to object storage, then calls POST /media/confirm. File bytes never buffer in the API function (GAP-215).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `filename` | `string` | ✓ |  |
| `mimeType` | `string` | ✓ |  |
| `size` | `integer` | ✓ |  |

**Responses**

- `200`  -  Presigned upload issued
- `400`  -  Invalid request
- `413`  -  File too large

---

### `POST` `/api/content/media/confirm`

**Confirm a direct-to-storage media upload**

After the client PUTs to the presigned URL, confirm HEADs the object, re-checks size and magic bytes, then creates the media DB row (GAP-215).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `key` | `string` | ✓ |  |
| `filename` | `string` | ✓ |  |
| `mimeType` | `string` | ✓ |  |
| `size` | `integer` | ✓ |  |
| `alt` | `string` | - |  |

**Responses**

- `201`  -  Media registered
- `400`  -  Validation failed
- `413`  -  File too large

---

### `GET` `/api/content/media`

**List media**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `mimeType` | `string` | - |  -  |  |

**Responses**

- `200`  -  Media list

---

### `POST` `/api/content/media`

**Upload a media file**

**Responses**

- `201`  -  Media uploaded
- `400`  -  Invalid file
- `413`  -  File too large

---

### `GET` `/api/content/media/{id}`

**Get a media item by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Media found
- `404`  -  Not found

---

### `PATCH` `/api/content/media/{id}`

**Update media metadata**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `alt` | `string` | - |  |
| `focalPoint` | `object` | - |  |

**Responses**

- `200`  -  Media updated
- `404`  -  Not found

---

### `DELETE` `/api/content/media/{id}`

**Delete a media item**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Media deleted
- `404`  -  Not found

---

### `GET` `/api/content/sites`

**List sites**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |
| `consultationBookingId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Site list

---

### `POST` `/api/content/sites`

**Create a site**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `description` | `string` | - |  |
| `status` | `string` | - |  |
| `visibility` | `string` | - |  |
| `settings` | `object` | - |  |

**Responses**

- `201`  -  Site created
- `409`  -  Site address already in use

---

### `GET` `/api/content/sites/{id}`

**Get a site by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Site found
- `404`  -  Not found

---

### `PATCH` `/api/content/sites/{id}`

**Update a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `description` | `string` | - |  |
| `status` | `string` | - |  |
| `visibility` | `string` | - |  |
| `favicon` | `string` | - |  |

**Responses**

- `200`  -  Site updated
- `404`  -  Not found

---

### `DELETE` `/api/content/sites/{id}`

**Delete a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Site deleted
- `404`  -  Not found

---

### `PUT` `/api/content/sites/{siteId}/consultation-lifecycle`

**Apply verified consultation payment lifecycle evidence**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Current consultation lifecycle
- `409`  -  Evidence does not match the current binding or refund

---

### `GET` `/api/content/sites/{siteId}/collaborators`

**List site collaborators**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Responses**

- `200`  -  Site collaborators

---

### `PUT` `/api/content/sites/{siteId}/collaborators/{userId}`

**Grant or update a site collaborator**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |
| `userId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role` | `string` | ✓ |  |

**Responses**

- `200`  -  Site collaborator saved

---

### `DELETE` `/api/content/sites/{siteId}/collaborators/{userId}`

**Revoke a site collaborator**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |
| `userId` | `string` | ✓ |  |

**Responses**

- `200`  -  Site collaborator revoked

---

### `GET` `/api/content/consultation-domain`

**Resolve a published private consultation hostname**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `hostname` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Authenticated reader target only
- `404`  -  No active domain delivery

---

### `PUT` `/api/content/sites/{siteId}/consultation-domain`

**Attach and verify a consultation hostname**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `hostname` | `string` | ✓ |  |

**Responses**

- `200`  -  Verified domain attached
- `202`  -  Ownership or DNS verification pending; domain is not attached
- `409`  -  Current delivery cannot bind this domain

---

### `DELETE` `/api/content/sites/{siteId}/consultation-domain`

**Detach a consultation hostname**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Responses**

- `200`  -  Domain detached

---

### `GET` `/api/content/pages`

**List pages across owned sites**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `siteId` | `string` | - |  -  |  |
| `status` | `string` | - |  -  |  |
| `createdByMe` | `string` | - |  -  |  |
| `limit` | `integer` | - | `50` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Page list
- `401`  -  Authentication required
- `403`  -  Forbidden
- `404`  -  Site not found

---

### `GET` `/api/content/sites/{siteId}/pages`

**List pages for a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |
| `createdByMe` | `string` | - |  -  |  |

**Responses**

- `200`  -  Page list
- `404`  -  Site not found

---

### `POST` `/api/content/sites/{siteId}/pages`

**Create a page**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `path` | `string` | ✓ |  |
| `status` | `string` | - |  |
| `parentId` | `string` | - |  |
| `templateId` | `string` | - |  |
| `blocks` | `array` | - |  |
| `seo` | `object` | - |  |

**Responses**

- `201`  -  Page created
- `400`  -  Content validation failed
- `404`  -  Site not found

---

### `GET` `/api/content/pages/{id}`

**Get a page by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Page found
- `404`  -  Not found

---

### `PATCH` `/api/content/pages/{id}`

**Update a page**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `slug` | `string` | - |  |
| `path` | `string` | - |  |
| `status` | `string` | - |  |
| `parentId` | `string` | - |  |
| `templateId` | `string` | - |  |
| `blocks` | `array` | - |  |
| `seo` | `object` | - |  |
| `publishedAt` | `string (date-time)` | - |  |

**Responses**

- `200`  -  Page updated
- `400`  -  Content validation failed
- `404`  -  Not found

---

### `DELETE` `/api/content/pages/{id}`

**Delete a page**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Page deleted
- `404`  -  Not found

---

### `GET` `/api/content/globals/{slug}`

**Get a global by slug**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `slug` | `string` | ✓ |  |

**Responses**

- `200`  -  Global found
- `404`  -  Not found

---

### `PATCH` `/api/content/globals/{slug}`

**Update a global**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `slug` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Global updated
- `400`  -  Validation failed
- `404`  -  Not found

---

### `GET` `/api/content/sessions`

**List edit sessions**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |
| `siteId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Session list

---

### `POST` `/api/content/sessions`

**Open an edit session**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |
| `title` | `string` | ✓ |  |

**Responses**

- `201`  -  Session opened
- `404`  -  Site not found

---

### `GET` `/api/content/sessions/{id}`

**Get an edit session with its docs and recent events**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Session detail
- `404`  -  Not found

---

### `GET` `/api/content/sessions/{id}/events`

**Poll session events after a cursor**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `after` | `integer` | - |  -  |  |

**Responses**

- `200`  -  Events after the cursor
- `404`  -  Not found

---

### `PATCH` `/api/content/sessions/{id}/docs/{docType}/{docId}`

**Patch a draft field or apply a block-array op in an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |
| `docType` | `string` | ✓ |  |
| `docId` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Draft patched
- `400`  -  Bad request
- `404`  -  Not found
- `409`  -  Session not open
- `422`  -  Voice validation rejected the patch (fleet-marketing only)

---

### `POST` `/api/content/sessions/{id}/publish`

**Publish an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Session published
- `400`  -  Unsupported doc type
- `404`  -  Not found
- `409`  -  Version conflict or session not open

---

### `POST` `/api/content/sessions/{id}/discard`

**Discard an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Session discarded
- `404`  -  Not found
- `409`  -  Session not open

---

### `POST` `/api/content/sessions/{id}/preview-token`

**Mint a preview token for an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `pageId` | `string` | - |  -  |  |

**Responses**

- `201`  -  Preview token minted
- `404`  -  Not found
- `409`  -  Session not open

---

### `GET` `/api/content/sessions/{id}/preview`

**Read edit session draft overlays with a preview token**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `token` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Draft overlays for the session
- `401`  -  Invalid or expired token
- `403`  -  Token does not authorize this session
- `404`  -  Not found
- `409`  -  Session not open

---

### `GET` `/api/content/search`

**Full-text search across published content**

Uses PostgreSQL full-text search with plainto_tsquery. Searches published posts and/or pages.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `q` | `string` | ✓ |  -  |  |
| `type` | `string` | - | `all` |  |
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Search results sorted by relevance
- `400`  -  Invalid query parameters

---

### `GET` `/api/content/users`

**List users (admin-only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `page` | `integer` | - | `1` |  |
| `limit` | `integer` | - | `10` |  |
| `status` | `string` | - |  -  |  |
| `role` | `string` | - |  -  |  |
| `search` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated user list

---

### `GET` `/api/content/users/{id}`

**Get a user by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  User found
- `404`  -  Not found

---

### `PATCH` `/api/content/users/{id}`

**Update a user**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `email` | `string (email)` | - |  |
| `role` | `string` | - |  |
| `status` | `string` | - |  |
| `avatarUrl` | `string` | - |  |

**Responses**

- `200`  -  User updated
- `404`  -  Not found
- `409`  -  Owned domain cleanup required

---

### `DELETE` `/api/content/users/{id}`

**Delete a user (soft-delete)**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  User deleted
- `404`  -  Not found
- `409`  -  Owned domain cleanup required

---

### `GET` `/api/content/products`

**List products**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Product list

---

### `POST` `/api/content/products`

**Create a product**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `description` | `string` | - |  |
| `priceInCents` | `integer` | - |  |
| `currency` | `string` | - |  |
| `stripeProductId` | `string` | - |  |
| `stripePriceId` | `string` | - |  |
| `active` | `boolean` | - |  |
| `status` | `string` | - |  |
| `images` | `array` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Product created

---

### `GET` `/api/content/products/{id}`

**Get a product by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Product found
- `404`  -  Not found

---

### `PATCH` `/api/content/products/{id}`

**Update a product**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `slug` | `string` | - |  |
| `description` | `string` | - |  |
| `priceInCents` | `integer` | - |  |
| `currency` | `string` | - |  |
| `stripeProductId` | `string` | - |  |
| `stripePriceId` | `string` | - |  |
| `active` | `boolean` | - |  |
| `status` | `string` | - |  |
| `images` | `array` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `200`  -  Product updated
- `404`  -  Not found

---

### `DELETE` `/api/content/products/{id}`

**Delete a product**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Product deleted
- `404`  -  Not found

---

### `GET` `/api/content/orders`

**List orders**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Order list

---

### `POST` `/api/content/orders`

**Create an order**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `items` | `array` | ✓ |  |
| `currency` | `string` | - |  |
| `shippingAddress` | `object` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Order created

---

### `GET` `/api/content/orders/{id}`

**Get an order by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Order found
- `404`  -  Not found

---

### `PATCH` `/api/content/orders/{id}`

**Update order status**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `status` | `string` | ✓ |  |
| `metadata` | `object` | - |  |

**Responses**

- `200`  -  Order updated
- `404`  -  Not found

---

### `POST` `/api/content/batch/create`

**Batch create items in a collection**

Supports posts, pages and sites using the direct mutation contracts. Media creation requires the media upload endpoint. Each item reports its own result.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |
| `items` | `array` | ✓ |  |

**Responses**

- `200`  -  Batch create results
- `400`  -  Bad request

---

### `POST` `/api/content/batch/update`

**Batch update items in a collection**

Supports posts, pages, sites and media metadata using the direct mutation contracts and current per-item authority.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |
| `items` | `array` | ✓ |  |

**Responses**

- `200`  -  Batch update results
- `400`  -  Bad request

---

### `POST` `/api/content/batch/delete`

**Batch delete items in a collection**

Supports posts, pages and sites. Detach consultation hostnames before deleting sites. Media deletion requires the media delete endpoint so storage cleanup runs.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |
| `items` | `array` | ✓ |  |

**Responses**

- `200`  -  Batch delete results
- `400`  -  Bad request

---

### `GET` `/api/content/export/{collection}`

**Export collection data as JSON or CSV**

Admin-only bulk export endpoint. Supported collections: posts, pages, users, sites, media. Limited to 10,000 rows per request.

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `format` | `string` | - | `json` |  |
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Export data
- `400`  -  Invalid collection
- `401`  -  Authentication required
- `403`  -  Admin access required

---

### `GET` `/api/v1/content/posts`

**List posts**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |
| `authorId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Post list

---

### `POST` `/api/v1/content/posts`

**Create a post**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `excerpt` | `string` | - |  |
| `content` | `any` | - |  |
| `featuredImageId` | `string` | - |  |
| `authorId` | `string` | - |  |
| `status` | `string` | - |  |
| `meta` | `object` | - |  |
| `categories` | `array` | - |  |

**Responses**

- `201`  -  Post created
- `400`  -  Content validation failed

---

### `GET` `/api/v1/content/posts/{id}`

**Get a post by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Post found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/posts/{id}`

**Update a post**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `slug` | `string` | - |  |
| `excerpt` | `string` | - |  |
| `content` | `any` | - |  |
| `featuredImageId` | `string` | - |  |
| `status` | `string` | - |  |
| `published` | `boolean` | - |  |
| `meta` | `object` | - |  |
| `categories` | `array` | - |  |
| `publishedAt` | `string (date-time)` | - |  |

**Responses**

- `200`  -  Post updated
- `400`  -  Content validation failed
- `404`  -  Not found

---

### `DELETE` `/api/v1/content/posts/{id}`

**Delete a post**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Post deleted
- `404`  -  Not found

---

### `GET` `/api/v1/content/posts/slug/{slug}`

**Get a post by slug**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `slug` | `string` | ✓ |  |

**Responses**

- `200`  -  Post found
- `404`  -  Not found

---

### `POST` `/api/v1/content/media/presign`

**Presign a direct-to-storage media upload**

Returns a short-lived presigned PUT URL. The client uploads bytes directly to object storage, then calls POST /media/confirm. File bytes never buffer in the API function (GAP-215).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `filename` | `string` | ✓ |  |
| `mimeType` | `string` | ✓ |  |
| `size` | `integer` | ✓ |  |

**Responses**

- `200`  -  Presigned upload issued
- `400`  -  Invalid request
- `413`  -  File too large

---

### `POST` `/api/v1/content/media/confirm`

**Confirm a direct-to-storage media upload**

After the client PUTs to the presigned URL, confirm HEADs the object, re-checks size and magic bytes, then creates the media DB row (GAP-215).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `key` | `string` | ✓ |  |
| `filename` | `string` | ✓ |  |
| `mimeType` | `string` | ✓ |  |
| `size` | `integer` | ✓ |  |
| `alt` | `string` | - |  |

**Responses**

- `201`  -  Media registered
- `400`  -  Validation failed
- `413`  -  File too large

---

### `GET` `/api/v1/content/media`

**List media**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `mimeType` | `string` | - |  -  |  |

**Responses**

- `200`  -  Media list

---

### `POST` `/api/v1/content/media`

**Upload a media file**

**Responses**

- `201`  -  Media uploaded
- `400`  -  Invalid file
- `413`  -  File too large

---

### `GET` `/api/v1/content/media/{id}`

**Get a media item by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Media found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/media/{id}`

**Update media metadata**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `alt` | `string` | - |  |
| `focalPoint` | `object` | - |  |

**Responses**

- `200`  -  Media updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/content/media/{id}`

**Delete a media item**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Media deleted
- `404`  -  Not found

---

### `GET` `/api/v1/content/sites`

**List sites**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |
| `consultationBookingId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Site list

---

### `POST` `/api/v1/content/sites`

**Create a site**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `description` | `string` | - |  |
| `status` | `string` | - |  |
| `visibility` | `string` | - |  |
| `settings` | `object` | - |  |

**Responses**

- `201`  -  Site created
- `409`  -  Site address already in use

---

### `GET` `/api/v1/content/sites/{id}`

**Get a site by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Site found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/sites/{id}`

**Update a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `slug` | `string` | - |  |
| `description` | `string` | - |  |
| `status` | `string` | - |  |
| `visibility` | `string` | - |  |
| `favicon` | `string` | - |  |

**Responses**

- `200`  -  Site updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/content/sites/{id}`

**Delete a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Site deleted
- `404`  -  Not found

---

### `PUT` `/api/v1/content/sites/{siteId}/consultation-lifecycle`

**Apply verified consultation payment lifecycle evidence**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Current consultation lifecycle
- `409`  -  Evidence does not match the current binding or refund

---

### `GET` `/api/v1/content/sites/{siteId}/collaborators`

**List site collaborators**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Responses**

- `200`  -  Site collaborators

---

### `PUT` `/api/v1/content/sites/{siteId}/collaborators/{userId}`

**Grant or update a site collaborator**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |
| `userId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `role` | `string` | ✓ |  |

**Responses**

- `200`  -  Site collaborator saved

---

### `DELETE` `/api/v1/content/sites/{siteId}/collaborators/{userId}`

**Revoke a site collaborator**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |
| `userId` | `string` | ✓ |  |

**Responses**

- `200`  -  Site collaborator revoked

---

### `GET` `/api/v1/content/consultation-domain`

**Resolve a published private consultation hostname**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `hostname` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Authenticated reader target only
- `404`  -  No active domain delivery

---

### `PUT` `/api/v1/content/sites/{siteId}/consultation-domain`

**Attach and verify a consultation hostname**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `hostname` | `string` | ✓ |  |

**Responses**

- `200`  -  Verified domain attached
- `202`  -  Ownership or DNS verification pending; domain is not attached
- `409`  -  Current delivery cannot bind this domain

---

### `DELETE` `/api/v1/content/sites/{siteId}/consultation-domain`

**Detach a consultation hostname**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Responses**

- `200`  -  Domain detached

---

### `GET` `/api/v1/content/pages`

**List pages across owned sites**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `siteId` | `string` | - |  -  |  |
| `status` | `string` | - |  -  |  |
| `createdByMe` | `string` | - |  -  |  |
| `limit` | `integer` | - | `50` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Page list
- `401`  -  Authentication required
- `403`  -  Forbidden
- `404`  -  Site not found

---

### `GET` `/api/v1/content/sites/{siteId}/pages`

**List pages for a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |
| `createdByMe` | `string` | - |  -  |  |

**Responses**

- `200`  -  Page list
- `404`  -  Site not found

---

### `POST` `/api/v1/content/sites/{siteId}/pages`

**Create a page**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `path` | `string` | ✓ |  |
| `status` | `string` | - |  |
| `parentId` | `string` | - |  |
| `templateId` | `string` | - |  |
| `blocks` | `array` | - |  |
| `seo` | `object` | - |  |

**Responses**

- `201`  -  Page created
- `400`  -  Content validation failed
- `404`  -  Site not found

---

### `GET` `/api/v1/content/pages/{id}`

**Get a page by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Page found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/pages/{id}`

**Update a page**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `slug` | `string` | - |  |
| `path` | `string` | - |  |
| `status` | `string` | - |  |
| `parentId` | `string` | - |  |
| `templateId` | `string` | - |  |
| `blocks` | `array` | - |  |
| `seo` | `object` | - |  |
| `publishedAt` | `string (date-time)` | - |  |

**Responses**

- `200`  -  Page updated
- `400`  -  Content validation failed
- `404`  -  Not found

---

### `DELETE` `/api/v1/content/pages/{id}`

**Delete a page**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Page deleted
- `404`  -  Not found

---

### `GET` `/api/v1/content/globals/{slug}`

**Get a global by slug**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `slug` | `string` | ✓ |  |

**Responses**

- `200`  -  Global found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/globals/{slug}`

**Update a global**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `slug` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Global updated
- `400`  -  Validation failed
- `404`  -  Not found

---

### `GET` `/api/v1/content/sessions`

**List edit sessions**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` | - |  -  |  |
| `siteId` | `string` | - |  -  |  |

**Responses**

- `200`  -  Session list

---

### `POST` `/api/v1/content/sessions`

**Open an edit session**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |
| `title` | `string` | ✓ |  |

**Responses**

- `201`  -  Session opened
- `404`  -  Site not found

---

### `GET` `/api/v1/content/sessions/{id}`

**Get an edit session with its docs and recent events**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Session detail
- `404`  -  Not found

---

### `GET` `/api/v1/content/sessions/{id}/events`

**Poll session events after a cursor**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `after` | `integer` | - |  -  |  |

**Responses**

- `200`  -  Events after the cursor
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/sessions/{id}/docs/{docType}/{docId}`

**Patch a draft field or apply a block-array op in an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |
| `docType` | `string` | ✓ |  |
| `docId` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Draft patched
- `400`  -  Bad request
- `404`  -  Not found
- `409`  -  Session not open
- `422`  -  Voice validation rejected the patch (fleet-marketing only)

---

### `POST` `/api/v1/content/sessions/{id}/publish`

**Publish an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Session published
- `400`  -  Unsupported doc type
- `404`  -  Not found
- `409`  -  Version conflict or session not open

---

### `POST` `/api/v1/content/sessions/{id}/discard`

**Discard an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Session discarded
- `404`  -  Not found
- `409`  -  Session not open

---

### `POST` `/api/v1/content/sessions/{id}/preview-token`

**Mint a preview token for an edit session**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `pageId` | `string` | - |  -  |  |

**Responses**

- `201`  -  Preview token minted
- `404`  -  Not found
- `409`  -  Session not open

---

### `GET` `/api/v1/content/sessions/{id}/preview`

**Read edit session draft overlays with a preview token**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `token` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Draft overlays for the session
- `401`  -  Invalid or expired token
- `403`  -  Token does not authorize this session
- `404`  -  Not found
- `409`  -  Session not open

---

### `GET` `/api/v1/content/search`

**Full-text search across published content**

Uses PostgreSQL full-text search with plainto_tsquery. Searches published posts and/or pages.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `q` | `string` | ✓ |  -  |  |
| `type` | `string` | - | `all` |  |
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Search results sorted by relevance
- `400`  -  Invalid query parameters

---

### `GET` `/api/v1/content/users`

**List users (admin-only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `page` | `integer` | - | `1` |  |
| `limit` | `integer` | - | `10` |  |
| `status` | `string` | - |  -  |  |
| `role` | `string` | - |  -  |  |
| `search` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated user list

---

### `GET` `/api/v1/content/users/{id}`

**Get a user by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  User found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/users/{id}`

**Update a user**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `email` | `string (email)` | - |  |
| `role` | `string` | - |  |
| `status` | `string` | - |  |
| `avatarUrl` | `string` | - |  |

**Responses**

- `200`  -  User updated
- `404`  -  Not found
- `409`  -  Owned domain cleanup required

---

### `DELETE` `/api/v1/content/users/{id}`

**Delete a user (soft-delete)**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  User deleted
- `404`  -  Not found
- `409`  -  Owned domain cleanup required

---

### `GET` `/api/v1/content/products`

**List products**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Product list

---

### `POST` `/api/v1/content/products`

**Create a product**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | ✓ |  |
| `slug` | `string` | ✓ |  |
| `description` | `string` | - |  |
| `priceInCents` | `integer` | - |  |
| `currency` | `string` | - |  |
| `stripeProductId` | `string` | - |  |
| `stripePriceId` | `string` | - |  |
| `active` | `boolean` | - |  |
| `status` | `string` | - |  |
| `images` | `array` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Product created

---

### `GET` `/api/v1/content/products/{id}`

**Get a product by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Product found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/products/{id}`

**Update a product**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | - |  |
| `slug` | `string` | - |  |
| `description` | `string` | - |  |
| `priceInCents` | `integer` | - |  |
| `currency` | `string` | - |  |
| `stripeProductId` | `string` | - |  |
| `stripePriceId` | `string` | - |  |
| `active` | `boolean` | - |  |
| `status` | `string` | - |  |
| `images` | `array` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `200`  -  Product updated
- `404`  -  Not found

---

### `DELETE` `/api/v1/content/products/{id}`

**Delete a product**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Product deleted
- `404`  -  Not found

---

### `GET` `/api/v1/content/orders`

**List orders**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Order list

---

### `POST` `/api/v1/content/orders`

**Create an order**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `items` | `array` | ✓ |  |
| `currency` | `string` | - |  |
| `shippingAddress` | `object` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Order created

---

### `GET` `/api/v1/content/orders/{id}`

**Get an order by ID**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Order found
- `404`  -  Not found

---

### `PATCH` `/api/v1/content/orders/{id}`

**Update order status**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `status` | `string` | ✓ |  |
| `metadata` | `object` | - |  |

**Responses**

- `200`  -  Order updated
- `404`  -  Not found

---

### `POST` `/api/v1/content/batch/create`

**Batch create items in a collection**

Supports posts, pages and sites using the direct mutation contracts. Media creation requires the media upload endpoint. Each item reports its own result.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |
| `items` | `array` | ✓ |  |

**Responses**

- `200`  -  Batch create results
- `400`  -  Bad request

---

### `POST` `/api/v1/content/batch/update`

**Batch update items in a collection**

Supports posts, pages, sites and media metadata using the direct mutation contracts and current per-item authority.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |
| `items` | `array` | ✓ |  |

**Responses**

- `200`  -  Batch update results
- `400`  -  Bad request

---

### `POST` `/api/v1/content/batch/delete`

**Batch delete items in a collection**

Supports posts, pages and sites. Detach consultation hostnames before deleting sites. Media deletion requires the media delete endpoint so storage cleanup runs.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |
| `items` | `array` | ✓ |  |

**Responses**

- `200`  -  Batch delete results
- `400`  -  Bad request

---

### `GET` `/api/v1/content/export/{collection}`

**Export collection data as JSON or CSV**

Admin-only bulk export endpoint. Supported collections: posts, pages, users, sites, media. Limited to 10,000 rows per request.

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `collection` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `format` | `string` | - | `json` |  |
| `status` | `string` | - |  -  |  |

**Responses**

- `200`  -  Export data
- `400`  -  Invalid collection
- `401`  -  Authentication required
- `403`  -  Admin access required

---

## rag

### `POST` `/api/rag/workspaces/{workspaceId}/index/{collection}`

**Trigger RAG indexing for an admin collection**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |
| `collection` | `string` | ✓ | Admin collection name |

**Responses**

- `200`  -  Indexing completed
- `400`  -  Invalid collection name
- `403`  -  AI feature requires Pro or Enterprise license

---

### `GET` `/api/rag/workspaces/{workspaceId}/documents`

**List documents in a workspace**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |

**Responses**

- `200`  -  Document list

---

### `DELETE` `/api/rag/workspaces/{workspaceId}/documents/{documentId}`

**Delete a RAG document**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |
| `documentId` | `string` | ✓ | Document ID |

**Responses**

- `200`  -  Document deleted
- `403`  -  AI feature requires Pro or Enterprise license

---

### `GET` `/api/rag/workspaces/{workspaceId}/status`

**Get workspace RAG indexing status**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |

**Responses**

- `200`  -  Workspace RAG status

---

### `POST` `/api/v1/rag/workspaces/{workspaceId}/index/{collection}`

**Trigger RAG indexing for an admin collection**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |
| `collection` | `string` | ✓ | Admin collection name |

**Responses**

- `200`  -  Indexing completed
- `400`  -  Invalid collection name
- `403`  -  AI feature requires Pro or Enterprise license

---

### `GET` `/api/v1/rag/workspaces/{workspaceId}/documents`

**List documents in a workspace**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |

**Responses**

- `200`  -  Document list

---

### `DELETE` `/api/v1/rag/workspaces/{workspaceId}/documents/{documentId}`

**Delete a RAG document**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |
| `documentId` | `string` | ✓ | Document ID |

**Responses**

- `200`  -  Document deleted
- `403`  -  AI feature requires Pro or Enterprise license

---

### `GET` `/api/v1/rag/workspaces/{workspaceId}/status`

**Get workspace RAG indexing status**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ | Workspace ID |

**Responses**

- `200`  -  Workspace RAG status

---

## admin

### `GET` `/api/admin/logs`

**List application logs (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `app` | `string` | - |  -  |  |
| `level` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated app logs
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/admin/errors`

**List error events (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Paginated error events
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/admin/audit`

**List audit log entries (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `severity` | `string` | - |  -  |  |
| `agentId` | `string` | - |  -  |  |
| `eventType` | `string` | - |  -  |  |
| `dateFrom` | `string` | - |  -  | ISO 8601 lower bound (inclusive) on `timestamp`. |
| `dateTo` | `string` | - |  -  | ISO 8601 upper bound (inclusive) on `timestamp`. |
| `policyViolationId` | `string` | - |  -  | Match entries whose `policy_violations` JSONB array contains this string. Useful for scoping to a single rule's violations. |

**Responses**

- `200`  -  Paginated audit log entries
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/admin/webhooks`

**List processed webhook events (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `eventType` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated webhook events
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/admin/jobs`

**List durable-queue jobs (fleet operator only)**

Paginated view of the `jobs` table. Filterable by state (created/active/completed/failed/retry) and by handler name. Ordered newest-created first.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `state` | `string` | - |  -  |  |
| `name` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated jobs
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/admin/jobs/summary`

**Durable-queue aggregate stats (fleet operator only)**

Returns: current depth by state, per-handler counts over the last 24 hours (completed / failed / running), and the 10 most-recent failures. Intended for the admin jobs dashboard header.

**Responses**

- `200`  -  Queue summary
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/admin/inference/config`

**Read per-site inference config (Max tier)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `workspaceId` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Config (per-site) or system default

---

### `PUT` `/api/admin/inference/config`

**Upsert per-site inference config (Max tier)**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ |  |
| `provider` | `string` | ✓ |  |
| `apiKey` | `string` | - |  |
| `model` | `string` | - |  |
| `baseURL` | `string (uri)` | - |  |
| `temperature` | `number` | - |  |
| `maxTokens` | `integer` | - |  |

**Responses**

- `200`  -  Config saved

---

### `DELETE` `/api/admin/inference/config`

**Revert site to system default inference (Max tier)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `workspaceId` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Config deleted; default returned

---

### `GET` `/api/admin/local-ai/status`

**Host local AI profile status (self-host only)**

**Responses**

- `200`  -  Profile snapshot or hosted unavailable
- `404`  -  Hosted deployments do not expose host local AI status

---

### `GET` `/api/admin/margin/summary`

**Latest margin snapshot, short history, and top accounts by cost**

**Responses**

- `200`  -  Margin admission analytics summary
- `401`  -  Authentication required
- `403`  -  Operator access required

---

### `GET` `/api/admin/coordination/sessions`

**List coordination sessions across the agent fleet (admin-only)**

Returns sessions from the Neon coordination_sessions table joined with agent info. Default scope is "active" (sessions with ended_at IS NULL). Empty result when no daemon writes have landed yet — the surface is intentionally tolerant of the no-data case so admins can deploy this before any daemon is configured.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `scope` | `string` | - | `active` |  |
| `agentId` | `string` | - |  -  |  |
| `limit` | `integer` | - | `100` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Paginated coordination sessions
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/logs`

**List application logs (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `app` | `string` | - |  -  |  |
| `level` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated app logs
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/errors`

**List error events (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Paginated error events
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/audit`

**List audit log entries (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `severity` | `string` | - |  -  |  |
| `agentId` | `string` | - |  -  |  |
| `eventType` | `string` | - |  -  |  |
| `dateFrom` | `string` | - |  -  | ISO 8601 lower bound (inclusive) on `timestamp`. |
| `dateTo` | `string` | - |  -  | ISO 8601 upper bound (inclusive) on `timestamp`. |
| `policyViolationId` | `string` | - |  -  | Match entries whose `policy_violations` JSONB array contains this string. Useful for scoping to a single rule's violations. |

**Responses**

- `200`  -  Paginated audit log entries
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/webhooks`

**List processed webhook events (fleet operator only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `eventType` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated webhook events
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/jobs`

**List durable-queue jobs (fleet operator only)**

Paginated view of the `jobs` table. Filterable by state (created/active/completed/failed/retry) and by handler name. Ordered newest-created first.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` | - | `20` |  |
| `offset` | `integer` | - | `0` |  |
| `state` | `string` | - |  -  |  |
| `name` | `string` | - |  -  |  |

**Responses**

- `200`  -  Paginated jobs
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/jobs/summary`

**Durable-queue aggregate stats (fleet operator only)**

Returns: current depth by state, per-handler counts over the last 24 hours (completed / failed / running), and the 10 most-recent failures. Intended for the admin jobs dashboard header.

**Responses**

- `200`  -  Queue summary
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/admin/inference/config`

**Read per-site inference config (Max tier)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `workspaceId` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Config (per-site) or system default

---

### `PUT` `/api/v1/admin/inference/config`

**Upsert per-site inference config (Max tier)**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `workspaceId` | `string` | ✓ |  |
| `provider` | `string` | ✓ |  |
| `apiKey` | `string` | - |  |
| `model` | `string` | - |  |
| `baseURL` | `string (uri)` | - |  |
| `temperature` | `number` | - |  |
| `maxTokens` | `integer` | - |  |

**Responses**

- `200`  -  Config saved

---

### `DELETE` `/api/v1/admin/inference/config`

**Revert site to system default inference (Max tier)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `workspaceId` | `string` | ✓ |  -  |  |

**Responses**

- `200`  -  Config deleted; default returned

---

### `GET` `/api/v1/admin/local-ai/status`

**Host local AI profile status (self-host only)**

**Responses**

- `200`  -  Profile snapshot or hosted unavailable
- `404`  -  Hosted deployments do not expose host local AI status

---

### `GET` `/api/v1/admin/margin/summary`

**Latest margin snapshot, short history, and top accounts by cost**

**Responses**

- `200`  -  Margin admission analytics summary
- `401`  -  Authentication required
- `403`  -  Operator access required

---

### `GET` `/api/v1/admin/coordination/sessions`

**List coordination sessions across the agent fleet (admin-only)**

Returns sessions from the Neon coordination_sessions table joined with agent info. Default scope is "active" (sessions with ended_at IS NULL). Empty result when no daemon writes have landed yet — the surface is intentionally tolerant of the no-data case so admins can deploy this before any daemon is configured.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `scope` | `string` | - | `active` |  |
| `agentId` | `string` | - |  -  |  |
| `limit` | `integer` | - | `100` |  |
| `offset` | `integer` | - | `0` |  |

**Responses**

- `200`  -  Paginated coordination sessions
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

## Analytics

### `GET` `/api/analytics/summary`

**Period totals for the authenticated user account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |

**Responses**

- `200`  -  Aggregated metrics for the period

---

### `GET` `/api/analytics/by-meter`

**Per-meter breakdown for the authenticated user account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |

**Responses**

- `200`  -  Breakdown by meter name, sorted by count desc

---

### `GET` `/api/analytics/by-source`

**Per-source breakdown for the authenticated user account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |

**Responses**

- `200`  -  Breakdown by source (system|user|agent|api), sorted by count desc

---

### `GET` `/api/analytics/activation`

**Platform-wide onboarding activation funnel (admin only)**

**Responses**

- `200`  -  Time-to-first-agent-action and day-7 return rate across all accounts
- `403`  -  Admin role required

---

### `GET` `/api/v1/analytics/summary`

**Period totals for the authenticated user account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |

**Responses**

- `200`  -  Aggregated metrics for the period

---

### `GET` `/api/v1/analytics/by-meter`

**Per-meter breakdown for the authenticated user account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |

**Responses**

- `200`  -  Breakdown by meter name, sorted by count desc

---

### `GET` `/api/v1/analytics/by-source`

**Per-source breakdown for the authenticated user account**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |

**Responses**

- `200`  -  Breakdown by source (system|user|agent|api), sorted by count desc

---

### `GET` `/api/v1/analytics/activation`

**Platform-wide onboarding activation funnel (admin only)**

**Responses**

- `200`  -  Time-to-first-agent-action and day-7 return rate across all accounts
- `403`  -  Admin role required

---

## Nudges

### `GET` `/api/nudges/current`

**The single onboarding nudge to show, or null**

**Responses**

- `200`  -  Current nudge for the authenticated user

---

### `POST` `/api/nudges/{nudgeId}/dismiss`

**Snooze (1st call) or permanently retire (2nd call) a nudge**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `nudgeId` | `string` | ✓ |  |

**Responses**

- `200`  -  Dismissal recorded

---

### `GET` `/api/v1/nudges/current`

**The single onboarding nudge to show, or null**

**Responses**

- `200`  -  Current nudge for the authenticated user

---

### `POST` `/api/v1/nudges/{nudgeId}/dismiss`

**Snooze (1st call) or permanently retire (2nd call) a nudge**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `nudgeId` | `string` | ✓ |  |

**Responses**

- `200`  -  Dismissal recorded

---

## DevKit

### `GET` `/api/devkit/profiles`

**List available DevKit profiles**

**Responses**

- `200`  -  Profile metadata for all five available profiles

---

### `GET` `/api/devkit/profile/active`

**Read the user's active DevKit profile**

**Responses**

- `200`  -  User selection (or null if unset)

---

### `PUT` `/api/devkit/profile/active`

**Set the user's active DevKit profile (Max tier)**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `profileId` | `string` | ✓ |  |

**Responses**

- `200`  -  Profile selection saved

---

### `GET` `/api/v1/devkit/profiles`

**List available DevKit profiles**

**Responses**

- `200`  -  Profile metadata for all five available profiles

---

### `GET` `/api/v1/devkit/profile/active`

**Read the user's active DevKit profile**

**Responses**

- `200`  -  User selection (or null if unset)

---

### `PUT` `/api/v1/devkit/profile/active`

**Set the user's active DevKit profile (Max tier)**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `profileId` | `string` | ✓ |  |

**Responses**

- `200`  -  Profile selection saved

---

## Rotation

### `GET` `/api/rotation/history`

**Read the user's credential lifecycle history**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |
| `kind` | `string` | - |  -  |  |

**Responses**

- `200`  -  Credential events for the authenticated user, newest first

---

### `GET` `/api/v1/rotation/history`

**Read the user's credential lifecycle history**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `days` | `integer` | - | `30` |  |
| `kind` | `string` | - |  -  |  |

**Responses**

- `200`  -  Credential events for the authenticated user, newest first

---

## API Keys

### `GET` `/api/api-keys`

**List stored API keys (hints only, never plaintext)**

**Responses**

- `200`  -  List of key summaries

---

### `POST` `/api/api-keys`

**Store an encrypted API key**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `provider` | `string` | ✓ | LLM provider for this key |
| `apiKey` | `string` | ✓ | The plaintext API key (never stored; encrypted before persisting) |
| `label` | `string` | - | Optional user-visible label for this key |
| `setAsDefault` | `boolean` | - | Set this provider as the default for the user's agents |
| `model` | `string` | - | Preferred model for the default provider config |

**Responses**

- `201`  -  Key stored successfully

---

### `DELETE` `/api/api-keys/:id`

**Delete a stored API key**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Key deleted
- `404`  -  Key not found

---

### `POST` `/api/api-keys/:id/rotate`

**Replace the plaintext for an existing API key slot**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `apiKey` | `string` | ✓ | The new plaintext API key |

**Responses**

- `200`  -  Key rotated
- `404`  -  Key not found

---

### `GET` `/api/v1/api-keys`

**List stored API keys (hints only, never plaintext)**

**Responses**

- `200`  -  List of key summaries

---

### `POST` `/api/v1/api-keys`

**Store an encrypted API key**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `provider` | `string` | ✓ | LLM provider for this key |
| `apiKey` | `string` | ✓ | The plaintext API key (never stored; encrypted before persisting) |
| `label` | `string` | - | Optional user-visible label for this key |
| `setAsDefault` | `boolean` | - | Set this provider as the default for the user's agents |
| `model` | `string` | - | Preferred model for the default provider config |

**Responses**

- `201`  -  Key stored successfully

---

### `DELETE` `/api/v1/api-keys/:id`

**Delete a stored API key**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Key deleted
- `404`  -  Key not found

---

### `POST` `/api/v1/api-keys/:id/rotate`

**Replace the plaintext for an existing API key slot**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `apiKey` | `string` | ✓ | The new plaintext API key |

**Responses**

- `200`  -  Key rotated
- `404`  -  Key not found

---

## ghcr

### `POST` `/api/ghcr/verify`

**Verify license for GHCR image pull**

Called by GitHub Packages webhook on Docker image pull. Validates the license key against account entitlements.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `licenseKey` | `string` | ✓ |  |
| `image` | `string` | - |  |

**Responses**

- `200`  -  Pull allowed
- `401`  -  Missing or invalid webhook secret
- `403`  -  Pull denied  -  no valid entitlement

---

### `GET` `/api/ghcr/status`

**Check GHCR access status for authenticated user**

Returns whether the authenticated user has GHCR pull access.

**Responses**

- `200`  -  Access status
- `401`  -  Not authenticated

---

### `POST` `/api/v1/ghcr/verify`

**Verify license for GHCR image pull**

Called by GitHub Packages webhook on Docker image pull. Validates the license key against account entitlements.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `licenseKey` | `string` | ✓ |  |
| `image` | `string` | - |  |

**Responses**

- `200`  -  Pull allowed
- `401`  -  Missing or invalid webhook secret
- `403`  -  Pull denied  -  no valid entitlement

---

### `GET` `/api/v1/ghcr/status`

**Check GHCR access status for authenticated user**

Returns whether the authenticated user has GHCR pull access.

**Responses**

- `200`  -  Access status
- `401`  -  Not authenticated

---

## maintenance

### `POST` `/api/maintenance/cleanup-orphans`

**Clean up orphaned vector data (internal cron)**

Removes orphaned Supabase vector data (agent memories, RAG documents, RAG chunks) for sites that have been soft-deleted in NeonDB. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Cleanup completed successfully
- `403`  -  Invalid cron secret
- `500`  -  Cleanup failed

---

### `POST` `/api/v1/maintenance/cleanup-orphans`

**Clean up orphaned vector data (internal cron)**

Removes orphaned Supabase vector data (agent memories, RAG documents, RAG chunks) for sites that have been soft-deleted in NeonDB. Protected by X-Cron-Secret.

**Responses**

- `200`  -  Cleanup completed successfully
- `403`  -  Invalid cron secret
- `500`  -  Cleanup failed

---

## marketplace

### `GET` `/api/marketplace/servers`

**List active marketplace servers**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `category` | `string` | - |  -  |  |
| `limit` | `string` | - |  -  |  |
| `offset` | `string` | - |  -  |  |

**Responses**

- `200`  -  List of active servers

---

### `POST` `/api/marketplace/servers`

**Publish a new MCP server**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `url` | `string (uri)` | ✓ |  |
| `category` | `string` | - |  |
| `tags` | `array` | - |  |
| `pricePerCallUsdc` | `string` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Server published
- `400`  -  Invalid request
- `401`  -  Unauthorized
- `422`  -  Invalid URL

---

### `GET` `/api/marketplace/servers/{id}`

**Get single server detail**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Server detail
- `400`  -  Invalid server ID
- `404`  -  Server not found

---

### `DELETE` `/api/marketplace/servers/{id}`

**Unpublish own server**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Server unpublished
- `400`  -  Invalid server ID
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Server not found

---

### `POST` `/api/marketplace/servers/{id}/invoke`

**Invoke an MCP server via marketplace proxy (x402 payment)**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Proxied response from MCP server
- `400`  -  Invalid request
- `402`  -  Payment required
- `404`  -  Server not found
- `502`  -  Upstream server unavailable

---

### `POST` `/api/marketplace/connect/onboard`

**Start Stripe Connect onboarding for developer**

**Responses**

- `200`  -  Onboarding link created
- `401`  -  Unauthorized

---

### `GET` `/api/marketplace/connect/return`

**Stripe Connect onboarding return callback**

**Responses**

- `200`  -  Onboarding flow completed

---

### `GET` `/api/v1/marketplace/servers`

**List active marketplace servers**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `category` | `string` | - |  -  |  |
| `limit` | `string` | - |  -  |  |
| `offset` | `string` | - |  -  |  |

**Responses**

- `200`  -  List of active servers

---

### `POST` `/api/v1/marketplace/servers`

**Publish a new MCP server**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `url` | `string (uri)` | ✓ |  |
| `category` | `string` | - |  |
| `tags` | `array` | - |  |
| `pricePerCallUsdc` | `string` | - |  |
| `metadata` | `object` | - |  |

**Responses**

- `201`  -  Server published
- `400`  -  Invalid request
- `401`  -  Unauthorized
- `422`  -  Invalid URL

---

### `GET` `/api/v1/marketplace/servers/{id}`

**Get single server detail**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Server detail
- `400`  -  Invalid server ID
- `404`  -  Server not found

---

### `DELETE` `/api/v1/marketplace/servers/{id}`

**Unpublish own server**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Server unpublished
- `400`  -  Invalid server ID
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Server not found

---

### `POST` `/api/v1/marketplace/servers/{id}/invoke`

**Invoke an MCP server via marketplace proxy (x402 payment)**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Proxied response from MCP server
- `400`  -  Invalid request
- `402`  -  Payment required
- `404`  -  Server not found
- `502`  -  Upstream server unavailable

---

### `POST` `/api/v1/marketplace/connect/onboard`

**Start Stripe Connect onboarding for developer**

**Responses**

- `200`  -  Onboarding link created
- `401`  -  Unauthorized

---

### `GET` `/api/v1/marketplace/connect/return`

**Stripe Connect onboarding return callback**

**Responses**

- `200`  -  Onboarding flow completed

---

## pricing

### `GET` `/api/pricing`

**Get pricing data**

Returns subscription tiers, credit bundles, and perpetual license pricing. Prices sourced from Stripe when configured, otherwise server-side defaults.

**Responses**

- `200`  -  Pricing data

---

### `GET` `/api/v1/pricing`

**Get pricing data**

Returns subscription tiers, credit bundles, and perpetual license pricing. Prices sourced from Stripe when configured, otherwise server-side defaults.

**Responses**

- `200`  -  Pricing data

---

## revmarket

### `GET` `/api/revmarket/agents`

**Browse published marketplace agents**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `category` | `string` | - |  -  |  |
| `search` | `string` | - |  -  |  |
| `sortBy` | `string` | - |  -  |  |
| `limit` | `string` | - |  -  |  |
| `offset` | `string` | - |  -  |  |

**Responses**

- `200`  -  List of published agents

---

### `POST` `/api/revmarket/agents`

**Publish a new marketplace agent**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `definition` | `object` | ✓ |  |
| `category` | `string` | - |  |
| `tags` | `array` | - |  |
| `pricingModel` | `string` | - |  |
| `basePriceUsdc` | `string` | - |  |
| `maxExecutionSecs` | `integer` | - |  |
| `resourceLimits` | `object` | - |  |

**Responses**

- `201`  -  Agent published
- `401`  -  Unauthorized

---

### `GET` `/api/revmarket/agents/{id}`

**Get agent detail with skills**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent detail
- `404`  -  Agent not found

---

### `PATCH` `/api/revmarket/agents/{id}`

**Update own marketplace agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `description` | `string` | - |  |
| `definition` | `object` | - |  |
| `category` | `string` | - |  |
| `tags` | `array` | - |  |
| `pricingModel` | `string` | - |  |
| `basePriceUsdc` | `string` | - |  |
| `maxExecutionSecs` | `integer` | - |  |
| `status` | `string` | - |  |

**Responses**

- `200`  -  Agent updated
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Agent not found

---

### `DELETE` `/api/revmarket/agents/{id}`

**Unpublish own marketplace agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent unpublished
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Agent not found

---

### `POST` `/api/revmarket/agents/{id}/skills`

**Add a skill to a marketplace agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `inputSchema` | `object` | - |  |
| `outputSchema` | `object` | - |  |
| `examples` | `array` | - |  |

**Responses**

- `201`  -  Skill added
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Agent not found

---

### `POST` `/api/revmarket/tasks`

**Submit a task to the agent marketplace**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `agentId` | `string` | - |  |
| `skillName` | `string` | ✓ |  |
| `input` | `object` | ✓ |  |
| `priority` | `integer` | - |  |
| `paymentMethod` | `string` | - |  |

**Responses**

- `201`  -  Task submitted
- `401`  -  Unauthorized
- `402`  -  Payment required (x402)
- `404`  -  Agent not found

---

### `GET` `/api/revmarket/tasks/{id}`

**Get task status and result**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Task detail
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Task not found

---

### `POST` `/api/revmarket/tasks/{id}/cancel`

**Cancel a pending or queued task**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Task cancelled
- `400`  -  Task cannot be cancelled
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Task not found

---

### `POST` `/api/revmarket/tasks/{id}/disputes`

**Open a dispute on a completed task**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reason` | `string` | ✓ |  |

**Responses**

- `201`  -  Dispute opened
- `400`  -  Dispute rejected

---

### `POST` `/api/revmarket/tasks/{id}/disputes/reply`

**Publisher replies once to a dispute**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reply` | `string` | ✓ |  |

**Responses**

- `200`  -  Reply recorded

---

### `POST` `/api/revmarket/tasks/{id}/disputes/decision`

**Decide a dispute**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `decision` | `string` | ✓ |  |

**Responses**

- `200`  -  Decision recorded

---

### `GET` `/api/revmarket/agents/{id}/reviews`

**List reviews for an agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `string` | - |  -  |  |
| `offset` | `string` | - |  -  |  |

**Responses**

- `200`  -  Reviews list

---

### `POST` `/api/revmarket/agents/{id}/reviews`

**Leave a review for an agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `taskId` | `string` | - |  |
| `rating` | `integer` | ✓ |  |
| `comment` | `string` | - |  |

**Responses**

- `201`  -  Review submitted
- `401`  -  Unauthorized
- `404`  -  Agent not found

---

### `GET` `/api/revmarket/tasks/{id}/progress`

**Get task execution progress**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Task progress
- `401`  -  Unauthorized
- `404`  -  Task not found

---

### `GET` `/api/revmarket/executor/status`

**Get executor status (admin)**

**Responses**

- `200`  -  Executor status
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

### `GET` `/api/v1/revmarket/agents`

**Browse published marketplace agents**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `category` | `string` | - |  -  |  |
| `search` | `string` | - |  -  |  |
| `sortBy` | `string` | - |  -  |  |
| `limit` | `string` | - |  -  |  |
| `offset` | `string` | - |  -  |  |

**Responses**

- `200`  -  List of published agents

---

### `POST` `/api/v1/revmarket/agents`

**Publish a new marketplace agent**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `definition` | `object` | ✓ |  |
| `category` | `string` | - |  |
| `tags` | `array` | - |  |
| `pricingModel` | `string` | - |  |
| `basePriceUsdc` | `string` | - |  |
| `maxExecutionSecs` | `integer` | - |  |
| `resourceLimits` | `object` | - |  |

**Responses**

- `201`  -  Agent published
- `401`  -  Unauthorized

---

### `GET` `/api/v1/revmarket/agents/{id}`

**Get agent detail with skills**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent detail
- `404`  -  Agent not found

---

### `PATCH` `/api/v1/revmarket/agents/{id}`

**Update own marketplace agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | - |  |
| `description` | `string` | - |  |
| `definition` | `object` | - |  |
| `category` | `string` | - |  |
| `tags` | `array` | - |  |
| `pricingModel` | `string` | - |  |
| `basePriceUsdc` | `string` | - |  |
| `maxExecutionSecs` | `integer` | - |  |
| `status` | `string` | - |  |

**Responses**

- `200`  -  Agent updated
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Agent not found

---

### `DELETE` `/api/v1/revmarket/agents/{id}`

**Unpublish own marketplace agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent unpublished
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Agent not found

---

### `POST` `/api/v1/revmarket/agents/{id}/skills`

**Add a skill to a marketplace agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `name` | `string` | ✓ |  |
| `description` | `string` | ✓ |  |
| `inputSchema` | `object` | - |  |
| `outputSchema` | `object` | - |  |
| `examples` | `array` | - |  |

**Responses**

- `201`  -  Skill added
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Agent not found

---

### `POST` `/api/v1/revmarket/tasks`

**Submit a task to the agent marketplace**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `agentId` | `string` | - |  |
| `skillName` | `string` | ✓ |  |
| `input` | `object` | ✓ |  |
| `priority` | `integer` | - |  |
| `paymentMethod` | `string` | - |  |

**Responses**

- `201`  -  Task submitted
- `401`  -  Unauthorized
- `402`  -  Payment required (x402)
- `404`  -  Agent not found

---

### `GET` `/api/v1/revmarket/tasks/{id}`

**Get task status and result**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Task detail
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Task not found

---

### `POST` `/api/v1/revmarket/tasks/{id}/cancel`

**Cancel a pending or queued task**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Task cancelled
- `400`  -  Task cannot be cancelled
- `401`  -  Unauthorized
- `403`  -  Forbidden
- `404`  -  Task not found

---

### `POST` `/api/v1/revmarket/tasks/{id}/disputes`

**Open a dispute on a completed task**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reason` | `string` | ✓ |  |

**Responses**

- `201`  -  Dispute opened
- `400`  -  Dispute rejected

---

### `POST` `/api/v1/revmarket/tasks/{id}/disputes/reply`

**Publisher replies once to a dispute**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `reply` | `string` | ✓ |  |

**Responses**

- `200`  -  Reply recorded

---

### `POST` `/api/v1/revmarket/tasks/{id}/disputes/decision`

**Decide a dispute**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `decision` | `string` | ✓ |  |

**Responses**

- `200`  -  Decision recorded

---

### `GET` `/api/v1/revmarket/agents/{id}/reviews`

**List reviews for an agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `string` | - |  -  |  |
| `offset` | `string` | - |  -  |  |

**Responses**

- `200`  -  Reviews list

---

### `POST` `/api/v1/revmarket/agents/{id}/reviews`

**Leave a review for an agent**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `taskId` | `string` | - |  |
| `rating` | `integer` | ✓ |  |
| `comment` | `string` | - |  |

**Responses**

- `201`  -  Review submitted
- `401`  -  Unauthorized
- `404`  -  Agent not found

---

### `GET` `/api/v1/revmarket/tasks/{id}/progress`

**Get task execution progress**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `id` | `string` | ✓ |  |

**Responses**

- `200`  -  Task progress
- `401`  -  Unauthorized
- `404`  -  Task not found

---

### `GET` `/api/v1/revmarket/executor/status`

**Get executor status (admin)**

**Responses**

- `200`  -  Executor status
- `401`  -  Unauthorized
- `403`  -  Forbidden

---

## Collaboration

### `POST` `//api/collab/update`

**Apply a Yjs binary update to a document**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Update applied successfully

---

### `GET` `//api/collab/snapshot/{documentId}`

**Get current Yjs document state as base64**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `documentId` | `string` | ✓ |  |

**Responses**

- `200`  -  Document snapshot

---

## Agent Collaboration

### `POST` `//api/collab/agent/connect`

**Get WebSocket URL for agent collaboration**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  WebSocket connection details

---

### `POST` `//api/collab/agent/edit`

**Apply server-side edit to agent document**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  Edit applied successfully

---

### `GET` `//api/collab/agent/snapshot/{documentId}`

**Get agent document state and connected clients**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `documentId` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent document snapshot

---
