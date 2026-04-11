---
title: "MCP Marketplace"
description: "MCP server marketplace  -  discovery, publishing, invocation, and monetization"
category: guide
audience: developer
---

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

Your server is immediately discoverable and callable. Save the `id`  -  you'll use it for management operations.

### 2. Choose a category

| Category       | Use for                                          |
| -------------- | ------------------------------------------------ |
| `coding`       | Code analysis, generation, review, testing tools |
| `data`         | Data transformation, SQL generation, ETL helpers |
| `productivity` | Scheduling, email drafting, document processing  |
| `analysis`     | Research, summarization, classification tools    |
| `writing`      | Copywriting, editing, translation, proofreading  |
| `other`        | Anything that doesn't fit above                  |

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

After completing the Stripe flow, you're redirected back to the admin. Your `stripeAccountId` is stored on all your published servers.

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
import { withPaymentInterceptor } from "@coinbase/x402/fetch";
import { createWalletClient } from "viem";

const wallet = createWalletClient({
  /* your wallet config */
});

const fetch402 = withPaymentInterceptor(fetch, wallet);

const response = await fetch402(
  "https://api.revealui.com/api/marketplace/servers/mcp_abc123xyz456/invoke",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "check_types",
      params: { file: "src/app.ts" },
    }),
  },
);

const result = await response.json();
```

The SDK handles the 402 → payment → retry cycle automatically.

---

## Revenue split

| Party             | Share |
| ----------------- | ----- |
| Developer         | 80%   |
| RevealUI platform | 20%   |

**Example:** A server priced at `0.005` USDC per call:

- Developer earns: `0.004` USDC

---

## 2027-2030 pricing direction

The marketplace should not be treated as a flat-fee curiosity attached to a SaaS product. It should be treated as one leg of a larger agent-commerce pricing model.

The long-term commercial model is:

- base platform subscription at the account/workspace level
- metered agent execution for workflow and tool usage
- explicit marketplace and commerce monetization tied to completed economic activity
- separate trust/governance pricing for spend controls, approvals, audit, provenance, and compliance

That means the current `80/20` split is a workable launch policy, but not the full future model. From 2027 onward, RevealUI should be able to support:

- per-call pricing for simple marketplace tools
- outcome or transaction-linked fees for commerce actions
- contracted or committed usage for high-volume agent operators
- premium trust controls for customers who need agent spend governance

The moral rule is simple: do not bill for failed, duplicated, reversed, or replayed agent actions. Marketplace monetization only works if developers and buyers both trust the ledger.

- Platform fee: `0.001` USDC

All transactions are recorded in `marketplace_transactions`. You can query your transaction history via the API (developer dashboard coming soon).

---

## Server requirements

Your MCP server must:

1. **Accept HTTP POST requests** at its configured URL
2. **Speak JSON-RPC 2.0**  -  the marketplace proxy forwards the caller's request body as-is
3. **Be reachable via HTTPS** (HTTP is only permitted in development)
4. **Respond within 30 seconds**  -  the proxy times out at 30s

The marketplace does not modify request or response bodies. It passes through the caller's JSON-RPC payload and returns your server's response verbatim.

### Security

- Your server's URL is **not publicly exposed**  -  callers invoke via the marketplace proxy at `/api/marketplace/servers/:id/invoke`
- All invocations are logged in `marketplace_transactions`
- Payment is verified by the [x402.org](https://x402.org) facilitator before your server is called

---

## Rate limits

| Endpoint                                   | Limit           |
| ------------------------------------------ | --------------- |
| `GET /api/marketplace/servers`             | Global (60/min) |
| `POST /api/marketplace/servers` (publish)  | 10/hour         |
| `POST /api/marketplace/servers/:id/invoke` | 30/min          |
| `POST /api/marketplace/connect/onboard`    | 5/15min         |

---

## Testing your server

Before publishing, verify your server works with the marketplace proxy:

### Local testing

```bash
# Start the API server locally
pnpm dev:api

# Publish a test server pointing to your local MCP server
curl -X POST http://localhost:3004/api/marketplace/servers \
  -H "Content-Type: application/json" \
  -H "Cookie: revealui-session=<your-session>" \
  -d '{
    "name": "Test Server",
    "url": "http://localhost:8080/rpc",
    "category": "coding",
    "pricePerCallUsdc": "0.001"
  }'

# Invoke it (payment is skipped in development mode)
curl -X POST http://localhost:3004/api/marketplace/servers/<id>/invoke \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "your_method", "params": {}}'
```

### Health checks

The marketplace proxy checks your server's availability before listing it. If your server is unreachable for 3 consecutive health checks (every 5 minutes), it is automatically suspended. Restore it by fixing the endpoint and calling:

```http
POST /api/marketplace/servers/<id>/restore
Authorization: Bearer <your-session-token>
```

---

## Disputes and refunds

### Caller disputes

If a caller believes a server returned an incorrect or incomplete response, they can file a dispute:

```http
POST /api/marketplace/disputes
Authorization: Bearer <your-session-token>
Content-Type: application/json

{
  "transactionId": "txn_abc123",
  "reason": "Server returned an error instead of the expected analysis"
}
```

Disputes are reviewed manually. If upheld, the caller is credited and the amount is deducted from the developer's balance.

### Automatic refunds

The marketplace automatically refunds callers when:

- The server returns an HTTP 5xx error
- The server times out (>30 seconds)
- The proxy fails to reach the server

These refunds are immediate and do not count against the developer.

---

## Tax and compliance

### For developers

- You are responsible for reporting marketplace income to your local tax authority
- RevealUI does not withhold taxes on marketplace payouts
- If you exceed $600 USD in annual payouts (US), Stripe Connect will collect a W-9 and issue a 1099-K
- International developers receive payouts per Stripe's cross-border transfer policies

### For callers

- Marketplace payments are in USDC (a stablecoin) via the x402 protocol
- x402 payments are on-chain transactions on Base (Ethereum L2)
- Consult your tax advisor regarding cryptocurrency transaction reporting in your jurisdiction

### Platform obligations

- All transactions are recorded in `marketplace_transactions` with full audit trail
- RevealUI reports platform revenue per standard SaaS accounting practices
- GDPR: developer and caller data is handled per the [RevealUI Privacy Policy](https://revealui.com/privacy)

---

## Server analytics

Track your server's performance via the developer dashboard or API:

```http
GET /api/marketplace/servers/<id>/analytics?period=30d
Authorization: Bearer <your-session-token>
```

```json
{
  "calls": 1234,
  "revenue": "6.17",
  "avgResponseTimeMs": 420,
  "errorRate": 0.02,
  "uniqueCallers": 89,
  "topMethods": [
    { "method": "check_types", "calls": 890 },
    { "method": "lint_file", "calls": 344 }
  ]
}
```

---

## Related

- [Pro overview](./PRO.md)
- [AI agents](./AI.md)
- [Environment Variables Guide](./ENVIRONMENT_VARIABLES_GUIDE.md)
- [x402 protocol](https://x402.org)
- [Coinbase x402 SDK](https://github.com/coinbase/x402)
