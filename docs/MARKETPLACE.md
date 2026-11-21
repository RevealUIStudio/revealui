---
visibility: public
status: preview
title: "MCP server registry (preview)"
description: "Preview. The MCP marketplace is not open. First-party MCP servers ship today. Third-party publishing, charging, and payouts are off."
category: guide
audience: developer
---

> **Preview. The MCP marketplace is not open.** First-party MCP servers ship today. Third-party publishing, charging, and payouts are off. There is no revenue share today.

RevealUI keeps a small MCP server registry in the API as a dormant, operator-side capability. A self-hosting operator could use it to list MCP servers for their own instance. The flags that would let it take payments stay off by default, and RevealUI does not run a hosted registry or take a share of any call.

---

## What ships today

- **First-party MCP servers.** They ship in `@revealui/mcp`. See the [Pro guide](./PRO.md) for setup.
- **Registry routes (preview).** List, detail, publish, and delete routes are mounted on the API. Publish and delete are operator admin only.
- **Discovery document (preview).** `/.well-known/marketplace.json` returns registry metadata for agents.

## What is off

- **Third-party publishing.** Only an operator admin can publish a listing.
- **Invoke.** `POST /api/marketplace/servers/:id/invoke` returns `503` while the x402 payment rail is off (`X402_ENABLED=false`, the default).
- **Charging and payouts.** Nothing is charged and nothing accrues for payout while invoke is off.
- **Settlement.** The x402 code verifies a payment proof and does not settle it. Do not enable the rail until settlement ships.
- **Revenue share.** There is no revenue share.

---

## Registry API reference (preview)

### Prerequisites

- Operator admin only (preview)
- An HTTPS MCP server endpoint

### Publish a listing

```http
POST /api/marketplace/servers
Authorization: Bearer <your-session-token>
Content-Type: application/json

{
  "name": "TypeScript Type Checker",
  "description": "Checks TypeScript types in a given file and returns diagnostics with line numbers and fix suggestions.",
  "url": "https://your-mcp-server.com/rpc",
  "category": "coding",
  "tags": ["typescript", "linting", "diagnostics"],
  "pricePerCallUsdc": "0.005"
}
```

**Response:**

```json
{
  "server": {
    "id": "mcp_abc123xyz456",
    "name": "TypeScript Type Checker",
    "status": "active",
    "pricePerCallUsdc": "0.005",
    "callCount": 0,
    "createdAt": "2026-03-07T00:00:00Z"
  }
}
```

Active listings appear in the list endpoint. Invoke returns 503 while the payment rail is off. Save the `id` for management operations.

### Categories

| Category       | Use for                                          |
| -------------- | ------------------------------------------------ |
| `coding`       | Code analysis, generation, review, testing tools |
| `data`         | Data transformation, SQL generation, ETL helpers |
| `productivity` | Scheduling, email drafting, document processing  |
| `analysis`     | Research, summarization, classification tools    |
| `writing`      | Copywriting, editing, translation, proofreading  |
| `other`        | Anything that doesn't fit above                  |

### The price field

`pricePerCallUsdc` is stored on each listing. It is not charged while the payment rail is off.

### Unpublish

```http
DELETE /api/marketplace/servers/mcp_abc123xyz456
Authorization: Bearer <your-session-token>
```

This sets the listing to `suspended`. It stops appearing in the list endpoint.

### List listings

```http
GET /api/marketplace/servers
GET /api/marketplace/servers?category=coding&limit=20
```

```json
{
  "servers": [
    {
      "id": "mcp_abc123xyz456",
      "name": "TypeScript Type Checker",
      "description": "...",
      "category": "coding",
      "tags": ["typescript", "linting"],
      "pricePerCallUsdc": "0.005",
      "callCount": 0
    }
  ],
  "limit": 50,
  "offset": 0
}
```

### Discovery document

```http
GET /.well-known/marketplace.json
```

```json
{
  "version": "1.0",
  "platform": "revealui",
  "registryUrl": "https://api.revealui.com/api/marketplace/servers",
  "publishUrl": "https://api.revealui.com/api/marketplace/servers",
  "paymentMethods": [],
  "servers": [...]
}
```

### Invoke (off)

```http
POST /api/marketplace/servers/mcp_abc123xyz456/invoke
Content-Type: application/json

{ "jsonrpc": "2.0", "id": 1, "method": "check_types", "params": { "file": "src/app.ts" } }
```

While `X402_ENABLED` is off, this returns:

```http
HTTP/1.1 503 Service Unavailable
```

If an operator turns the rail on, the route answers an unpaid call with `402 Payment Required` and an `X-PAYMENT-REQUIRED` header, per the open [x402 standard](https://x402.org). Use any x402-compatible client library. Read the settlement note above first.

---

## Listing requirements

A listed MCP server must:

1. **Accept HTTP POST requests** at its configured URL
2. **Speak JSON-RPC 2.0.** The proxy forwards the caller's request body as-is.
3. **Be reachable over HTTPS** (HTTP is only permitted in development)
4. **Respond within 30 seconds.** The proxy times out at 30s.

The proxy does not modify request or response bodies.

### Security

- The listing URL is not returned by the list endpoint. Callers would invoke through `/api/marketplace/servers/:id/invoke`.
- Invocations are logged in `marketplace_transactions`.

---

## Rate limits

| Endpoint                                   | Limit           |
| ------------------------------------------ | --------------- |
| `GET /api/marketplace/servers`             | Global (60/min) |
| `POST /api/marketplace/servers` (publish)  | 10/hour         |
| `POST /api/marketplace/servers/:id/invoke` | 30/min          |

---

## Not built yet

These are not built. There is no date for them.

- Health checks with auto-suspend
- A disputes endpoint and an automatic refund policy
- A per-listing analytics endpoint
- A publisher review gate and a tool-safety scanner

## Tax and compliance

Tax handling for any future marketplace will be published before it opens.

---

## Related

- [Pro guide](./PRO.md)
- [AI agents](./AI.md)
- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md)
- [x402 standard](https://x402.org)
