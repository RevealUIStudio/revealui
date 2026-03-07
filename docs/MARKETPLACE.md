# MCP Marketplace

The RevealUI MCP Marketplace lets developers publish Model Context Protocol (MCP) servers with a per-call price. Callers pay in USDC on Base via the x402 protocol. RevealUI takes 20%; you earn 80%.

---

## Overview

```
Developer publishes MCP server → RevealUI marketplace
Agent discovers server via /.well-known/marketplace.json
Agent calls POST /api/marketplace/servers/:id/invoke
Agent pays in USDC (x402) → payment verified
RevealUI proxies request to your server → returns response
Revenue split: 20% platform / 80% developer
Earnings accumulate → paid out via Stripe Connect
```

---

## For developers: publishing a server

### Prerequisites

- A RevealUI account (any tier)
- An HTTPS MCP server endpoint
- (Optional) A Stripe account for automatic payouts

### 1. Publish your server

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

Your server is immediately discoverable and callable. Save the `id` — you'll use it for management operations.

### 2. Choose a category

| Category | Use for |
|----------|---------|
| `coding` | Code analysis, generation, review, testing tools |
| `data` | Data transformation, SQL generation, ETL helpers |
| `productivity` | Scheduling, email drafting, document processing |
| `analysis` | Research, summarization, classification tools |
| `writing` | Copywriting, editing, translation, proofreading |
| `other` | Anything that doesn't fit above |

### 3. Set your price

`pricePerCallUsdc` is a per-invocation price in USDC (e.g. `"0.005"` = $0.005 per call). Callers pay this amount each time they invoke your server through the marketplace.

**Guidelines:**
- Simple tools (type checking, formatting): `0.001`–`0.005`
- Medium tools (code review, analysis): `0.005`–`0.02`
- Heavy tools (multi-step reasoning, large context): `0.02`–`0.1`

### 4. Unpublish

```http
DELETE /api/marketplace/servers/mcp_abc123xyz456
Authorization: Bearer <your-session-token>
```

This sets your server to `suspended`. It stops appearing in discovery and callers can no longer invoke it.

---

## Setting up payouts (Stripe Connect)

Earnings accumulate in your marketplace balance. To receive automatic payouts:

### 1. Start onboarding

```http
POST /api/marketplace/connect/onboard
Authorization: Bearer <your-session-token>
```

**Response:**

```json
{
  "url": "https://connect.stripe.com/setup/...",
  "stripeAccountId": "acct_1abc..."
}
```

Redirect your user (or yourself) to `url`. Stripe walks you through identity verification, bank account setup, and payout preferences.

### 2. Complete onboarding

After completing the Stripe flow, you're redirected back to the CMS. Your `stripeAccountId` is stored on all your published servers.

### Payout schedule

Payouts are **batched** rather than per-call. Individual USDC micropayments are too small for immediate Stripe transfers (Stripe minimum is $0.50). Earnings accumulate in `marketplace_transactions` and are transferred on a weekly schedule once your balance crosses the minimum threshold.

---

## For callers: using marketplace servers

### Discover servers

```http
GET /api/marketplace/servers
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
      "callCount": 1234
    }
  ],
  "limit": 50,
  "offset": 0
}
```

Filter by category:

```http
GET /api/marketplace/servers?category=coding&limit=20
```

### Agent discovery

Agents can discover the marketplace automatically via the well-known endpoint:

```http
GET /.well-known/marketplace.json
```

```json
{
  "version": "1.0",
  "platform": "revealui",
  "registryUrl": "https://api.revealui.com/api/marketplace/servers",
  "publishUrl": "https://api.revealui.com/api/marketplace/servers",
  "revenueShare": { "platform": 0.2, "developer": 0.8 },
  "paymentMethods": ["x402-usdc"],
  "servers": [...]
}
```

### Invoke a server

#### Without payment (get requirements first)

```http
POST /api/marketplace/servers/mcp_abc123xyz456/invoke
Content-Type: application/json

{ "jsonrpc": "2.0", "id": 1, "method": "check_types", "params": { "file": "src/app.ts" } }
```

If you haven't paid, you receive:

```http
HTTP/1.1 402 Payment Required
X-PAYMENT-REQUIRED: <base64 PaymentRequired>
Content-Type: application/json

{
  "error": "Payment required",
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "evm:base",
    "maxAmountRequired": "5000",
    "resource": "https://api.revealui.com/api/marketplace/servers/mcp_abc123xyz456/invoke",
    "payTo": "0x...",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }]
}
```

#### With x402 payment

Pay the required amount in USDC on Base, then retry with the payment proof:

```http
POST /api/marketplace/servers/mcp_abc123xyz456/invoke
Content-Type: application/json
X-PAYMENT-PAYLOAD: <base64 signed payment proof>

{ "jsonrpc": "2.0", "id": 1, "method": "check_types", "params": { "file": "src/app.ts" } }
```

The response is the raw JSON-RPC response from the server.

#### Using the Coinbase x402 SDK

```typescript
import { withPaymentInterceptor } from '@coinbase/x402/fetch'
import { createWalletClient } from 'viem'

const wallet = createWalletClient({ /* your wallet config */ })

const fetch402 = withPaymentInterceptor(fetch, wallet)

const response = await fetch402('https://api.revealui.com/api/marketplace/servers/mcp_abc123xyz456/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'check_types',
    params: { file: 'src/app.ts' },
  }),
})

const result = await response.json()
```

The SDK handles the 402 → payment → retry cycle automatically.

---

## Revenue split

| Party | Share |
|-------|-------|
| Developer | 80% |
| RevealUI platform | 20% |

**Example:** A server priced at `0.005` USDC per call:
- Developer earns: `0.004` USDC
- Platform fee: `0.001` USDC

All transactions are recorded in `marketplace_transactions`. You can query your transaction history via the API (developer dashboard coming soon).

---

## Server requirements

Your MCP server must:

1. **Accept HTTP POST requests** at its configured URL
2. **Speak JSON-RPC 2.0** — the marketplace proxy forwards the caller's request body as-is
3. **Be reachable via HTTPS** (HTTP is only permitted in development)
4. **Respond within 30 seconds** — the proxy times out at 30s

The marketplace does not modify request or response bodies. It passes through the caller's JSON-RPC payload and returns your server's response verbatim.

### Security

- Your server's URL is **not publicly exposed** — callers invoke via the marketplace proxy at `/api/marketplace/servers/:id/invoke`
- All invocations are logged in `marketplace_transactions`
- Payment is verified by the [x402.org](https://x402.org) facilitator before your server is called

---

## Rate limits

| Endpoint | Limit |
|----------|-------|
| `GET /api/marketplace/servers` | Global (60/min) |
| `POST /api/marketplace/servers` (publish) | 10/hour |
| `POST /api/marketplace/servers/:id/invoke` | 30/min |
| `POST /api/marketplace/connect/onboard` | 5/15min |

---

## Related

- [Pro overview](./PRO.md)
- [AI agents](./AI.md)
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md)
- [x402 protocol](https://x402.org)
- [Coinbase x402 SDK](https://github.com/coinbase/x402)
