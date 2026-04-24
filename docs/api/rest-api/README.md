# REST API Reference

**Version:** 1.0.0

**Base URL (production):** `https://api.revealui.com/api`

**Interactive docs:** Start the API server (`pnpm dev:api`) and open [http://localhost:3004](http://localhost:3004) for full Swagger UI with request builder.

> **Note:** This reference is generated from `examples/api/openapi.json`. To regenerate from the live API spec, run:
> ```bash
> curl http://localhost:3004/openapi.json > examples/api/openapi.json
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
- [billing](#billing)
- [webhooks](#webhooks)
- [provenance](#provenance)
- [boards](#boards)
- [tickets](#tickets)
- [comments](#comments)
- [labels](#labels)
- [agent-tasks](#agent-tasks)
- [agent](#agent)
- [content](#content)
- [rag](#rag)
- [Inference Keys](#inference-keys)
- [maintenance](#maintenance)
- [marketplace](#marketplace)
- [pricing](#pricing)
- [Collaboration](#collaboration)
- [Agent Collaboration](#agent-collaboration)

---

## a2a

### `GET` `/.well-known/agent.json`

**Platform-level agent card**

**Responses**

- `200`  -  Agent card
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Agent not found

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
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Agent not found

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

### `GET` `/a2a/agents`

**List all registered agents as A2A agent cards**

**Responses**

- `200`  -  Agent card list
- `403`  -  AI feature requires Pro or Forge license

---

### `POST` `/a2a/agents`

**Register a new agent from an AgentDefinition**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `201`  -  Agent registered
- `400`  -  Invalid request
- `403`  -  AI feature requires Pro or Forge license
- `409`  -  Agent already registered

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
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Agent not found

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
| `name` | `string` |  -  |  |
| `description` | `string` |  -  |  |
| `systemPrompt` | `string` |  -  |  |
| `model` | `string` |  -  |  |
| `temperature` | `number` |  -  |  |
| `maxTokens` | `number` |  -  |  |
| `capabilities` | `any` |  -  |  |

**Responses**

- `200`  -  Updated agent card
- `400`  -  Invalid request
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Agent not found

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
- `403`  -  Built-in agents cannot be retired or AI feature requires Pro or Forge license
- `404`  -  Agent not found

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
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Agent not found

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

### `GET` `/a2a/stream/{taskId}`

**SSE stream for a running task**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `taskId` | `string` | ✓ | Task ID |

**Responses**

- `200`  -  SSE event stream
- `403`  -  AI feature requires Pro or Forge license

---

### `POST` `/a2a`

**A2A JSON-RPC dispatcher**

**Request body** (JSON)

See API schema for request body shape.

**Responses**

- `200`  -  JSON-RPC response
- `400`  -  Parse error or invalid request
- `403`  -  AI feature requires Pro or Forge license

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
| `level` | `string` |  -  |  |
| `message` | `string` | ✓ |  |
| `stack` | `string` |  -  |  |
| `app` | `string` | ✓ |  |
| `context` | `string` |  -  |  |
| `environment` | `string` |  -  |  |
| `url` | `string` |  -  |  |
| `requestId` | `string` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `level` | `string` |  -  |  |
| `message` | `string` | ✓ |  |
| `stack` | `string` |  -  |  |
| `app` | `string` | ✓ |  |
| `context` | `string` |  -  |  |
| `environment` | `string` |  -  |  |
| `url` | `string` |  -  |  |
| `requestId` | `string` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `expiresIn` | `integer` |  -  |  |

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
| `categories` | `array` |  -  |  |
| `reason` | `string` |  -  |  |

**Responses**

- `201`  -  Deletion request created
- `400`  -  Invalid request body
- `401`  -  Authentication required

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
| `expiresIn` | `integer` |  -  |  |

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
| `categories` | `array` |  -  |  |
| `reason` | `string` |  -  |  |

**Responses**

- `201`  -  Deletion request created
- `400`  -  Invalid request body
- `401`  -  Authentication required

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
| `environment` | `string` |  -  |  |
| `requestId` | `string` |  -  |  |
| `data` | `object` |  -  |  |

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
| `environment` | `string` |  -  |  |
| `requestId` | `string` |  -  |  |
| `data` | `object` |  -  |  |

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
| `licenseKey` | `string` | ✓ | JWT license key to verify |

**Responses**

- `200`  -  License verification result
- `400`  -  Missing license key

---

### `POST` `/api/license/generate`

**Generate a license key (admin only)**

Creates a signed JWT license key for a customer. Requires REVEALUI_LICENSE_PRIVATE_KEY and admin API key.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `tier` | `string` | ✓ | License tier to generate |
| `customerId` | `string` | ✓ | Stripe customer ID or internal customer identifier |
| `domains` | `array` |  -  | Licensed domains (optional) |
| `maxSites` | `integer` |  -  | Maximum sites (defaults: Pro=5, Forge=unlimited) |
| `maxUsers` | `integer` |  -  | Maximum users (defaults: Pro=25, Forge=unlimited) |
| `expiresInDays` | `integer` |  -  | License duration in days (default: 365, max: 10 years) |

**Responses**

- `201`  -  License key generated
- `401`  -  Unauthorized  -  missing or invalid admin API key
- `500`  -  Server error  -  missing private key configuration

---

### `GET` `/api/license/features`

**List features by tier**

Returns which features are available at each license tier.

**Responses**

- `200`  -  Feature comparison by tier

---

### `POST` `/api/v1/license/verify`

**Verify a license key**

Validates a JWT license key and returns the tier, features, and limits.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `licenseKey` | `string` | ✓ | JWT license key to verify |

**Responses**

- `200`  -  License verification result
- `400`  -  Missing license key

---

### `POST` `/api/v1/license/generate`

**Generate a license key (admin only)**

Creates a signed JWT license key for a customer. Requires REVEALUI_LICENSE_PRIVATE_KEY and admin API key.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `tier` | `string` | ✓ | License tier to generate |
| `customerId` | `string` | ✓ | Stripe customer ID or internal customer identifier |
| `domains` | `array` |  -  | Licensed domains (optional) |
| `maxSites` | `integer` |  -  | Maximum sites (defaults: Pro=5, Forge=unlimited) |
| `maxUsers` | `integer` |  -  | Maximum users (defaults: Pro=25, Forge=unlimited) |
| `expiresInDays` | `integer` |  -  | License duration in days (default: 365, max: 10 years) |

**Responses**

- `201`  -  License key generated
- `401`  -  Unauthorized  -  missing or invalid admin API key
- `500`  -  Server error  -  missing private key configuration

---

### `GET` `/api/v1/license/features`

**List features by tier**

Returns which features are available at each license tier.

**Responses**

- `200`  -  Feature comparison by tier

---

## billing

### `POST` `/api/billing/checkout`

**Create a checkout session**

Creates a Stripe checkout session for subscription purchase. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` |  -  | Stripe price ID for the subscription |
| `tier` | `string` |  -  | License tier (defaults to pro) |

**Responses**

- `200`  -  Checkout session created
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

### `POST` `/api/billing/upgrade`

**Upgrade subscription tier**

Upgrades an active subscription to a new price/tier mid-cycle. Prorations are created automatically. Requires an existing active subscription.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` |  -  | Stripe price ID for the target tier |
| `targetTier` | `string` | ✓ | Tier to upgrade to |

**Responses**

- `200`  -  Subscription upgraded  -  Stripe will fire customer.subscription.updated
- `400`  -  No active subscription or no billing account
- `401`  -  Not authenticated

---

### `POST` `/api/billing/downgrade`

**Downgrade to free tier**

Cancels the active subscription at the end of the current billing period. The user retains Pro/Forge access until then.

**Responses**

- `200`  -  Subscription scheduled for cancellation at end of billing period
- `400`  -  No active subscription found
- `401`  -  Not authenticated

---

### `POST` `/api/billing/checkout-perpetual`

**Create a perpetual license checkout session**

Creates a one-time Stripe payment session for a perpetual license. Includes 1 year of support. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` |  -  | Stripe price ID for the perpetual license product |
| `tier` | `string` | ✓ | Perpetual license tier |
| `githubUsername` | `string` |  -  | GitHub username for revealui-pro team access provisioning |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated

---

### `GET` `/api/billing/usage`

**Agent task usage**

Returns agent task usage for the current billing cycle.

**Responses**

- `200`  -  Current cycle usage
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

Marks non-perpetual licenses whose expiresAt is in the past as expired, then clears the DB status cache. Protected by X-Cron-Secret.

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
| `paymentIntentId` | `string` |  -  | Stripe PaymentIntent ID to refund. Provide either this or chargeId. |
| `chargeId` | `string` |  -  | Stripe Charge ID to refund. Provide either this or paymentIntentId. |
| `amount` | `integer` |  -  | Amount to refund in cents. Omit for full refund. |
| `reason` | `string` |  -  | Reason for the refund (Stripe enum) |

**Responses**

- `200`  -  Refund created
- `400`  -  Invalid request (missing payment reference)
- `401`  -  Not authenticated
- `403`  -  Admin access required

---

### `POST` `/api/billing/rvui-payment`

**Pay for subscription with RevealCoin**

Verifies an on-chain RVC (RevealCoin) payment transaction and activates the subscription tier. Applies the 15% RVC discount. Requires wallet address and transaction signature.

> **Note:** The route path `/api/billing/rvui-payment` uses the internal project codename (`$RVUI`). The on-chain token symbol is **RVC**. Both refer to the same token.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `txSignature` | `string` | ✓ |  |
| `tier` | `string` | ✓ |  |
| `walletAddress` | `string` | ✓ |  |
| `network` | `string` |  -  |  |

**Responses**

- `200`  -  Payment verified and subscription activated
- `400`  -  Validation failed
- `401`  -  Authentication required
- `403`  -  Payment rejected by safeguards

---

### `GET` `/api/billing/metrics`

**Revenue metrics (admin)**

Returns aggregate revenue metrics for the admin dashboard. Requires admin or owner role.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `from` | `string` |  -  |  -  | Start of date range for recent events (ISO 8601). Defaults to 30 days ago. |
| `to` | `string` |  -  |  -  | End of date range for recent events (ISO 8601). Defaults to now. |

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
| `priceId` | `string` |  -  | Stripe price ID for the subscription |
| `tier` | `string` |  -  | License tier (defaults to pro) |

**Responses**

- `200`  -  Checkout session created
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

### `POST` `/api/v1/billing/upgrade`

**Upgrade subscription tier**

Upgrades an active subscription to a new price/tier mid-cycle. Prorations are created automatically. Requires an existing active subscription.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` |  -  | Stripe price ID for the target tier |
| `targetTier` | `string` | ✓ | Tier to upgrade to |

**Responses**

- `200`  -  Subscription upgraded  -  Stripe will fire customer.subscription.updated
- `400`  -  No active subscription or no billing account
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/downgrade`

**Downgrade to free tier**

Cancels the active subscription at the end of the current billing period. The user retains Pro/Forge access until then.

**Responses**

- `200`  -  Subscription scheduled for cancellation at end of billing period
- `400`  -  No active subscription found
- `401`  -  Not authenticated

---

### `POST` `/api/v1/billing/checkout-perpetual`

**Create a perpetual license checkout session**

Creates a one-time Stripe payment session for a perpetual license. Includes 1 year of support. Requires authentication.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `priceId` | `string` |  -  | Stripe price ID for the perpetual license product |
| `tier` | `string` | ✓ | Perpetual license tier |
| `githubUsername` | `string` |  -  | GitHub username for revealui-pro team access provisioning |

**Responses**

- `200`  -  Checkout session created
- `401`  -  Not authenticated

---

### `GET` `/api/v1/billing/usage`

**Agent task usage**

Returns agent task usage for the current billing cycle.

**Responses**

- `200`  -  Current cycle usage
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

Marks non-perpetual licenses whose expiresAt is in the past as expired, then clears the DB status cache. Protected by X-Cron-Secret.

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
| `paymentIntentId` | `string` |  -  | Stripe PaymentIntent ID to refund. Provide either this or chargeId. |
| `chargeId` | `string` |  -  | Stripe Charge ID to refund. Provide either this or paymentIntentId. |
| `amount` | `integer` |  -  | Amount to refund in cents. Omit for full refund. |
| `reason` | `string` |  -  | Reason for the refund (Stripe enum) |

**Responses**

- `200`  -  Refund created
- `400`  -  Invalid request (missing payment reference)
- `401`  -  Not authenticated
- `403`  -  Admin access required

---

### `POST` `/api/v1/billing/rvui-payment`

**Pay for subscription with RevealCoin**

Verifies an on-chain RVC (RevealCoin) payment transaction and activates the subscription tier. Applies the 15% RVC discount. Requires wallet address and transaction signature.

> **Note:** The route path uses the internal project codename (`$RVUI`). The on-chain token symbol is **RVC**.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `txSignature` | `string` | ✓ |  |
| `tier` | `string` | ✓ |  |
| `walletAddress` | `string` | ✓ |  |
| `network` | `string` |  -  |  |

**Responses**

- `200`  -  Payment verified and subscription activated
- `400`  -  Validation failed
- `401`  -  Authentication required
- `403`  -  Payment rejected by safeguards

---

### `GET` `/api/v1/billing/metrics`

**Revenue metrics (admin)**

Returns aggregate revenue metrics for the admin dashboard. Requires admin or owner role.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `from` | `string` |  -  |  -  | Start of date range for recent events (ISO 8601). Defaults to 30 days ago. |
| `to` | `string` |  -  |  -  | End of date range for recent events (ISO 8601). Defaults to now. |

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
| `authorType` | `string` |  -  |  -  |  |
| `reviewStatus` | `string` |  -  |  -  |  |
| `filePathPrefix` | `string` |  -  |  -  |  |
| `limit` | `integer` |  -  |  -  |  |
| `offset` | `integer` |  -  |  -  |  |

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
| `functionName` | `string` |  -  |  |
| `lineStart` | `integer` |  -  |  |
| `lineEnd` | `integer` |  -  |  |
| `aiModel` | `string` |  -  |  |
| `aiSessionId` | `string` |  -  |  |
| `gitCommitHash` | `string` |  -  |  |
| `gitAuthor` | `string` |  -  |  |
| `confidence` | `number` |  -  |  |
| `linesOfCode` | `integer` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `filePath` | `string` |  -  |  |
| `functionName` | `string` |  -  |  |
| `lineStart` | `integer` |  -  |  |
| `lineEnd` | `integer` |  -  |  |
| `authorType` | `string` |  -  |  |
| `aiModel` | `string` |  -  |  |
| `aiSessionId` | `string` |  -  |  |
| `gitCommitHash` | `string` |  -  |  |
| `gitAuthor` | `string` |  -  |  |
| `confidence` | `number` |  -  |  |
| `reviewStatus` | `string` |  -  |  |
| `linesOfCode` | `integer` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `reviewerId` | `string` |  -  |  |
| `comment` | `string` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `authorType` | `string` |  -  |  -  |  |
| `reviewStatus` | `string` |  -  |  -  |  |
| `filePathPrefix` | `string` |  -  |  -  |  |
| `limit` | `integer` |  -  |  -  |  |
| `offset` | `integer` |  -  |  -  |  |

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
| `functionName` | `string` |  -  |  |
| `lineStart` | `integer` |  -  |  |
| `lineEnd` | `integer` |  -  |  |
| `aiModel` | `string` |  -  |  |
| `aiSessionId` | `string` |  -  |  |
| `gitCommitHash` | `string` |  -  |  |
| `gitAuthor` | `string` |  -  |  |
| `confidence` | `number` |  -  |  |
| `linesOfCode` | `integer` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `filePath` | `string` |  -  |  |
| `functionName` | `string` |  -  |  |
| `lineStart` | `integer` |  -  |  |
| `lineEnd` | `integer` |  -  |  |
| `authorType` | `string` |  -  |  |
| `aiModel` | `string` |  -  |  |
| `aiSessionId` | `string` |  -  |  |
| `gitCommitHash` | `string` |  -  |  |
| `gitAuthor` | `string` |  -  |  |
| `confidence` | `number` |  -  |  |
| `reviewStatus` | `string` |  -  |  |
| `linesOfCode` | `integer` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `reviewerId` | `string` |  -  |  |
| `comment` | `string` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `description` | `string` |  -  |  |
| `isDefault` | `boolean` |  -  |  |

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `description` | `string` |  -  |  |

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
| `wipLimit` | `integer` |  -  |  |
| `color` | `string` |  -  |  |

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `position` | `integer` |  -  |  |
| `wipLimit` | `integer` |  -  |  |
| `color` | `string` |  -  |  |

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
| `description` | `string` |  -  |  |
| `isDefault` | `boolean` |  -  |  |

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `description` | `string` |  -  |  |

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
| `wipLimit` | `integer` |  -  |  |
| `color` | `string` |  -  |  |

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `position` | `integer` |  -  |  |
| `wipLimit` | `integer` |  -  |  |
| `color` | `string` |  -  |  |

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
| `status` | `string` |  -  |  -  |  |
| `priority` | `string` |  -  |  -  |  |
| `type` | `string` |  -  |  -  |  |
| `assigneeId` | `string` |  -  |  -  |  |
| `columnId` | `string` |  -  |  -  |  |

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
| `description` | `object` |  -  |  |
| `columnId` | `string` |  -  |  |
| `parentTicketId` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `priority` | `string` |  -  |  |
| `type` | `string` |  -  |  |
| `assigneeId` | `string` |  -  |  |
| `reporterId` | `string` |  -  |  |
| `dueDate` | `string (date-time)` |  -  |  |
| `estimatedEffort` | `integer` |  -  |  |

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
| `title` | `string` |  -  |  |
| `description` | `object` |  -  |  |
| `status` | `string` |  -  |  |
| `priority` | `string` |  -  |  |
| `type` | `string` |  -  |  |
| `assigneeId` | `string` |  -  |  |
| `reporterId` | `string` |  -  |  |
| `columnId` | `string` |  -  |  |
| `dueDate` | `string (date-time)` |  -  |  |
| `estimatedEffort` | `integer` |  -  |  |
| `sortOrder` | `number` |  -  |  |

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
| `status` | `string` |  -  |  -  |  |
| `priority` | `string` |  -  |  -  |  |
| `type` | `string` |  -  |  -  |  |
| `assigneeId` | `string` |  -  |  -  |  |
| `columnId` | `string` |  -  |  -  |  |

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
| `description` | `object` |  -  |  |
| `columnId` | `string` |  -  |  |
| `parentTicketId` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `priority` | `string` |  -  |  |
| `type` | `string` |  -  |  |
| `assigneeId` | `string` |  -  |  |
| `reporterId` | `string` |  -  |  |
| `dueDate` | `string (date-time)` |  -  |  |
| `estimatedEffort` | `integer` |  -  |  |

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
| `title` | `string` |  -  |  |
| `description` | `object` |  -  |  |
| `status` | `string` |  -  |  |
| `priority` | `string` |  -  |  |
| `type` | `string` |  -  |  |
| `assigneeId` | `string` |  -  |  |
| `reporterId` | `string` |  -  |  |
| `columnId` | `string` |  -  |  |
| `dueDate` | `string (date-time)` |  -  |  |
| `estimatedEffort` | `integer` |  -  |  |
| `sortOrder` | `number` |  -  |  |

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
| `authorId` | `string` |  -  |  |

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
| `authorId` | `string` |  -  |  |

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
| `color` | `string` |  -  |  |
| `description` | `string` |  -  |  |

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `color` | `string` |  -  |  |
| `description` | `string` |  -  |  |

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
| `color` | `string` |  -  |  |
| `description` | `string` |  -  |  |

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `color` | `string` |  -  |  |
| `description` | `string` |  -  |  |

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

Creates a ticket from the instruction, dispatches an AI agent with admin tools to resolve it, and returns the result.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` | ✓ | Board to create the ticket on |
| `priority` | `string` |  -  |  |

**Responses**

- `200`  -  Agent task completed
- `400`  -  Bad request
- `403`  -  AI feature requires Pro or Forge license

---

### `POST` `/api/agent-tasks/{ticketId}/dispatch`

**Dispatch an agent for an existing ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `ticketId` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent dispatch completed
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Ticket not found

---

### `POST` `/api/v1/agent-tasks`

**Submit a natural language task for an agent to execute**

Creates a ticket from the instruction, dispatches an AI agent with admin tools to resolve it, and returns the result.

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` | ✓ | Board to create the ticket on |
| `priority` | `string` |  -  |  |

**Responses**

- `200`  -  Agent task completed
- `400`  -  Bad request
- `403`  -  AI feature requires Pro or Forge license

---

### `POST` `/api/v1/agent-tasks/{ticketId}/dispatch`

**Dispatch an agent for an existing ticket**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `ticketId` | `string` | ✓ |  |

**Responses**

- `200`  -  Agent dispatch completed
- `403`  -  AI feature requires Pro or Forge license
- `404`  -  Ticket not found

---

## agent

### `POST` `/api/agent-stream`

**Stream agent execution via SSE**

Streams agent execution events in real-time using Server-Sent Events. Client-side: use fetch + ReadableStream (not EventSource  -  it does not support POST).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` |  -  |  |
| `workspaceId` | `string` |  -  |  |
| `priority` | `string` |  -  |  |
| `provider` | `string` |  -  |  |
| `model` | `string` |  -  |  |

**Responses**

- `200`  -  SSE stream of agent execution events (text/event-stream)
- `400`  -  Missing instruction or invalid provider
- `403`  -  AI feature requires Pro or Forge license

---

### `POST` `/api/v1/agent-stream`

**Stream agent execution via SSE**

Streams agent execution events in real-time using Server-Sent Events. Client-side: use fetch + ReadableStream (not EventSource  -  it does not support POST).

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `instruction` | `string` | ✓ |  |
| `boardId` | `string` |  -  |  |
| `workspaceId` | `string` |  -  |  |
| `priority` | `string` |  -  |  |
| `provider` | `string` |  -  |  |
| `model` | `string` |  -  |  |

**Responses**

- `200`  -  SSE stream of agent execution events (text/event-stream)
- `400`  -  Missing instruction or invalid provider
- `403`  -  AI feature requires Pro or Forge license

---

## content

### `GET` `/api/content/posts`

**List posts**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |
| `authorId` | `string` |  -  |  -  |  |

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
| `excerpt` | `string` |  -  |  |
| `content` | `any` |  -  |  |
| `featuredImageId` | `string` |  -  |  |
| `authorId` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `meta` | `object` |  -  |  |
| `categories` | `array` |  -  |  |

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
| `title` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `excerpt` | `string` |  -  |  |
| `content` | `any` |  -  |  |
| `featuredImageId` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `published` | `boolean` |  -  |  |
| `meta` | `object` |  -  |  |
| `categories` | `array` |  -  |  |
| `publishedAt` | `string (date-time)` |  -  |  |

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

### `GET` `/api/content/media`

**List media**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `mimeType` | `string` |  -  |  -  |  |

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
| `alt` | `string` |  -  |  |
| `focalPoint` | `object` |  -  |  |

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
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |

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
| `description` | `string` |  -  |  |
| `status` | `string` |  -  |  |

**Responses**

- `201`  -  Site created

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `description` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `favicon` | `string` |  -  |  |

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

### `GET` `/api/content/sites/{siteId}/pages`

**List pages for a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` |  -  |  -  |  |

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
| `status` | `string` |  -  |  |
| `parentId` | `string` |  -  |  |
| `templateId` | `string` |  -  |  |
| `blocks` | `array` |  -  |  |
| `seo` | `object` |  -  |  |

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
| `title` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `path` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `parentId` | `string` |  -  |  |
| `templateId` | `string` |  -  |  |
| `blocks` | `array` |  -  |  |
| `seo` | `object` |  -  |  |
| `publishedAt` | `string (date-time)` |  -  |  |

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

### `GET` `/api/content/search`

**Full-text search across published content**

Uses PostgreSQL full-text search with plainto_tsquery. Searches published posts and/or pages.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `q` | `string` | ✓ |  -  |  |
| `type` | `string` |  -  | `all` |  |
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |

**Responses**

- `200`  -  Search results sorted by relevance
- `400`  -  Invalid query parameters

---

### `GET` `/api/content/users`

**List users (admin-only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `page` | `integer` |  -  | `1` |  |
| `limit` | `integer` |  -  | `10` |  |
| `status` | `string` |  -  |  -  |  |
| `role` | `string` |  -  |  -  |  |
| `search` | `string` |  -  |  -  |  |

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
| `name` | `string` |  -  |  |
| `email` | `string (email)` |  -  |  |
| `role` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `avatarUrl` | `string` |  -  |  |

**Responses**

- `200`  -  User updated
- `404`  -  Not found

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

---

### `GET` `/api/content/products`

**List products**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |

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
| `description` | `string` |  -  |  |
| `priceInCents` | `integer` |  -  |  |
| `currency` | `string` |  -  |  |
| `stripeProductId` | `string` |  -  |  |
| `stripePriceId` | `string` |  -  |  |
| `active` | `boolean` |  -  |  |
| `status` | `string` |  -  |  |
| `images` | `array` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `title` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `description` | `string` |  -  |  |
| `priceInCents` | `integer` |  -  |  |
| `currency` | `string` |  -  |  |
| `stripeProductId` | `string` |  -  |  |
| `stripePriceId` | `string` |  -  |  |
| `active` | `boolean` |  -  |  |
| `status` | `string` |  -  |  |
| `images` | `array` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |

**Responses**

- `200`  -  Order list

---

### `POST` `/api/content/orders`

**Create an order**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `items` | `array` | ✓ |  |
| `currency` | `string` |  -  |  |
| `shippingAddress` | `object` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `metadata` | `object` |  -  |  |

**Responses**

- `200`  -  Order updated
- `404`  -  Not found

---

### `POST` `/api/content/batch/create`

**Batch create items in a collection**

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
| `format` | `string` |  -  | `json` |  |
| `status` | `string` |  -  |  -  |  |

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
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |
| `authorId` | `string` |  -  |  -  |  |

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
| `excerpt` | `string` |  -  |  |
| `content` | `any` |  -  |  |
| `featuredImageId` | `string` |  -  |  |
| `authorId` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `meta` | `object` |  -  |  |
| `categories` | `array` |  -  |  |

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
| `title` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `excerpt` | `string` |  -  |  |
| `content` | `any` |  -  |  |
| `featuredImageId` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `published` | `boolean` |  -  |  |
| `meta` | `object` |  -  |  |
| `categories` | `array` |  -  |  |
| `publishedAt` | `string (date-time)` |  -  |  |

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

### `GET` `/api/v1/content/media`

**List media**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `mimeType` | `string` |  -  |  -  |  |

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
| `alt` | `string` |  -  |  |
| `focalPoint` | `object` |  -  |  |

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
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |

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
| `description` | `string` |  -  |  |
| `status` | `string` |  -  |  |

**Responses**

- `201`  -  Site created

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
| `name` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `description` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `favicon` | `string` |  -  |  |

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

### `GET` `/api/v1/content/sites/{siteId}/pages`

**List pages for a site**

**Path parameters**

| Name | Type | Required | Description |
|------|------|:--------:|-------------|
| `siteId` | `string` | ✓ |  |

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `status` | `string` |  -  |  -  |  |

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
| `status` | `string` |  -  |  |
| `parentId` | `string` |  -  |  |
| `templateId` | `string` |  -  |  |
| `blocks` | `array` |  -  |  |
| `seo` | `object` |  -  |  |

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
| `title` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `path` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `parentId` | `string` |  -  |  |
| `templateId` | `string` |  -  |  |
| `blocks` | `array` |  -  |  |
| `seo` | `object` |  -  |  |
| `publishedAt` | `string (date-time)` |  -  |  |

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

### `GET` `/api/v1/content/search`

**Full-text search across published content**

Uses PostgreSQL full-text search with plainto_tsquery. Searches published posts and/or pages.

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `q` | `string` | ✓ |  -  |  |
| `type` | `string` |  -  | `all` |  |
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |

**Responses**

- `200`  -  Search results sorted by relevance
- `400`  -  Invalid query parameters

---

### `GET` `/api/v1/content/users`

**List users (admin-only)**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `page` | `integer` |  -  | `1` |  |
| `limit` | `integer` |  -  | `10` |  |
| `status` | `string` |  -  |  -  |  |
| `role` | `string` |  -  |  -  |  |
| `search` | `string` |  -  |  -  |  |

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
| `name` | `string` |  -  |  |
| `email` | `string (email)` |  -  |  |
| `role` | `string` |  -  |  |
| `status` | `string` |  -  |  |
| `avatarUrl` | `string` |  -  |  |

**Responses**

- `200`  -  User updated
- `404`  -  Not found

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

---

### `GET` `/api/v1/content/products`

**List products**

**Query parameters**

| Name | Type | Required | Default | Description |
|------|------|:--------:|---------|-------------|
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |

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
| `description` | `string` |  -  |  |
| `priceInCents` | `integer` |  -  |  |
| `currency` | `string` |  -  |  |
| `stripeProductId` | `string` |  -  |  |
| `stripePriceId` | `string` |  -  |  |
| `active` | `boolean` |  -  |  |
| `status` | `string` |  -  |  |
| `images` | `array` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `title` | `string` |  -  |  |
| `slug` | `string` |  -  |  |
| `description` | `string` |  -  |  |
| `priceInCents` | `integer` |  -  |  |
| `currency` | `string` |  -  |  |
| `stripeProductId` | `string` |  -  |  |
| `stripePriceId` | `string` |  -  |  |
| `active` | `boolean` |  -  |  |
| `status` | `string` |  -  |  |
| `images` | `array` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `limit` | `integer` |  -  | `20` |  |
| `offset` | `integer` |  -  | `0` |  |
| `status` | `string` |  -  |  -  |  |

**Responses**

- `200`  -  Order list

---

### `POST` `/api/v1/content/orders`

**Create an order**

**Request body** (JSON)

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `items` | `array` | ✓ |  |
| `currency` | `string` |  -  |  |
| `shippingAddress` | `object` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `metadata` | `object` |  -  |  |

**Responses**

- `200`  -  Order updated
- `404`  -  Not found

---

### `POST` `/api/v1/content/batch/create`

**Batch create items in a collection**

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
| `format` | `string` |  -  | `json` |  |
| `status` | `string` |  -  |  -  |  |

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
| `collection` | `string` | ✓ | admin collection name |

**Responses**

- `200`  -  Indexing completed
- `400`  -  Invalid collection name
- `403`  -  AI feature requires Pro or Forge license
- `502`  -  admin fetch error

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
- `403`  -  AI feature requires Pro or Forge license

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
| `collection` | `string` | ✓ | admin collection name |

**Responses**

- `200`  -  Indexing completed
- `400`  -  Invalid collection name
- `403`  -  AI feature requires Pro or Forge license
- `502`  -  admin fetch error

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
- `403`  -  AI feature requires Pro or Forge license

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

## Inference Keys

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
| `label` | `string` |  -  | Optional user-visible label for this key |
| `setAsDefault` | `boolean` |  -  | Set this provider as the default for the user's agents |
| `model` | `string` |  -  | Preferred model for the default provider config |

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
| `label` | `string` |  -  | Optional user-visible label for this key |
| `setAsDefault` | `boolean` |  -  | Set this provider as the default for the user's agents |
| `model` | `string` |  -  | Preferred model for the default provider config |

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
| `category` | `string` |  -  |  -  |  |
| `limit` | `string` |  -  |  -  |  |
| `offset` | `string` |  -  |  -  |  |

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
| `category` | `string` |  -  |  |
| `tags` | `array` |  -  |  |
| `pricePerCallUsdc` | `string` |  -  |  |
| `metadata` | `object` |  -  |  |

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
| `category` | `string` |  -  |  -  |  |
| `limit` | `string` |  -  |  -  |  |
| `offset` | `string` |  -  |  -  |  |

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
| `category` | `string` |  -  |  |
| `tags` | `array` |  -  |  |
| `pricePerCallUsdc` | `string` |  -  |  |
| `metadata` | `object` |  -  |  |

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
