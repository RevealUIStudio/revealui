# Paying for AI API Calls with HTTP 402 and USDC

_By Joshua Vaughn  -  RevealUI Studio_

---

HTTP 402 is the status code that was never used.

It's been in the spec since 1996. The RFC says it's "reserved for future use" and the intended use was always some form of payment. For 30 years, practically nobody sent it. The web settled on subscription models and API keys  -  you authenticate with a token, and billing happens out-of-band via Stripe.

That model works fine for most APIs. But it breaks down for AI agent systems, where:

- Calls happen autonomously, not from a human clicking a button
- The caller might be a different agent than the one that holds the API key
- You want granular per-call pricing, not flat subscriptions
- Payment is better handled at the protocol level than the application level

The [x402 protocol](https://x402.org)  -  developed by Coinbase  -  finally gives 402 a real use. Here's how we implemented it in RevealUI, and why it's the right model for AI-native APIs.

---

## How x402 Works

The protocol is simple. A caller makes a request to a metered endpoint. If they haven't paid, they get a 402 with a payment descriptor in the header:

```http
HTTP/1.1 402 Payment Required
X-PAYMENT-REQUIRED: <base64-encoded PaymentRequired>
Content-Type: application/json

{
  "error": "Payment required",
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "evm:base",
    "maxAmountRequired": "10000",
    "resource": "https://api.revealui.com/a2a/my-agent/tasks/send",
    "payTo": "0x...",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }]
}
```

The `maxAmountRequired` is in the asset's smallest unit  -  for USDC (6 decimals), `10000` = $0.01. The `asset` address is USDC on Base. The `payTo` is your receiving address.

The caller pays the required amount on-chain, then retries the request with a signed payment proof in the header:

```http
POST /a2a/my-agent/tasks/send
Content-Type: application/json
X-PAYMENT-PAYLOAD: <base64-encoded signed payment proof>

{ ... }
```

The server verifies the proof against the x402 facilitator at `https://x402.org/facilitator`, and if valid, processes the request. The whole cycle takes a few seconds  -  fast enough to be invisible inside an agent loop.

---

## The Implementation

We wire x402 into the A2A task endpoints in RevealUI's API. The middleware runs after quota checking. If quota is exceeded and `X402_ENABLED` is true, we return 402 instead of 429:

```typescript
// apps/api/src/middleware/x402.ts

export function buildPaymentRequired(
  resource: string,
  customPrice?: string,
): PaymentRequiredV1 {
  const config = getX402Config();
  const price = customPrice ?? config.pricePerTask;

  // Convert USDC decimal to smallest unit (6 decimals)
  const amountUsdc = Math.round(parseFloat(price) * 1_000_000).toString();

  return {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "evm:base",
        maxAmountRequired: amountUsdc,
        resource,
        payTo: config.receivingAddress,
        asset: USDC_BASE_ADDRESS,
      },
    ],
  };
}

export async function verifyPayment(
  paymentHeader: string,
  resource: string,
): Promise<boolean> {
  const response = await fetch("https://x402.org/facilitator/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentHeader,
      resource,
    }),
  });
  const result = await response.json();
  return result.isValid === true;
}
```

The middleware on the task endpoint:

```typescript
app.post("/a2a/:agentId/tasks/send", async (c) => {
  // Check quota first
  const quotaResult = await checkTaskQuota(userId, tier);

  if (!quotaResult.allowed) {
    const x402Enabled = process.env.X402_ENABLED === "true";

    if (x402Enabled) {
      const paymentRequired = buildPaymentRequired(`${c.req.url}`);
      return c.json({ error: "Payment required", ...paymentRequired }, 402, {
        "X-PAYMENT-REQUIRED": encodePaymentRequired(paymentRequired),
      });
    }

    return c.json({ error: "Quota exceeded" }, 429);
  }

  // Check for payment proof on retry
  const paymentPayload = c.req.header("X-PAYMENT-PAYLOAD");
  if (paymentPayload) {
    const valid = await verifyPayment(paymentPayload, c.req.url);
    if (!valid) {
      return c.json({ error: "Invalid payment" }, 402);
    }
  }

  // Process the task
  // ...
});
```

From the caller side, the Coinbase x402 SDK handles the whole cycle automatically:

```typescript
import { withPaymentInterceptor } from "@coinbase/x402/fetch";
import { createWalletClient } from "viem";

const wallet = createWalletClient({
  /* your wallet config */
});
const fetch402 = withPaymentInterceptor(fetch, wallet);

// This automatically handles 402 → pay → retry
const response = await fetch402(
  "https://api.revealui.com/a2a/my-agent/tasks/send",
  {
    method: "POST",
    body: JSON.stringify({ instruction: "Analyze this ticket" }),
  },
);
```

One line of setup. The SDK intercepts 402 responses, pays on-chain, retries. The caller doesn't need to manage any of this manually.

---

## The MCP Marketplace

The cleaner application of x402 in RevealUI is the MCP Marketplace.

Developers publish Model Context Protocol servers to the marketplace with a per-call USDC price. Callers invoke them through RevealUI's proxy  -  which handles payment verification and SSRF protection  -  and the developer earns 80% of each call.

```http
POST /api/marketplace/servers
Authorization: Bearer <your-token>

{
  "name": "TypeScript Type Checker",
  "description": "Checks TypeScript types and returns diagnostics with fix suggestions.",
  "url": "https://your-mcp-server.com/rpc",
  "category": "coding",
  "pricePerCallUsdc": "0.005"
}
```

Each invocation goes through x402 automatically. The developer's actual server URL is never exposed  -  callers invoke via the RevealUI proxy, which verifies payment before forwarding. Revenue accumulates in the `marketplace_transactions` table and flows to the developer via Stripe Connect.

The price-setting logic matters. For a `pricePerCallUsdc` of `"0.005"`:

```typescript
function computeSplit(price: string) {
  const p = parseFloat(price);
  const fee = Math.round(p * 0.2 * 1_000_000) / 1_000_000; // 0.001 USDC
  const developer = Math.round((p - fee) * 1_000_000) / 1_000_000; // 0.004 USDC
  return { fee, developer };
}
```

Six-decimal precision matters at micropayment scale. A call priced at `0.001` USDC (one tenth of a cent) with 20% platform fee: developer earns `0.0008` USDC. You need to round correctly or floating-point drift accumulates across thousands of calls.

---

## Why This Matters for AI Agents

The subscription model has a fundamental mismatch with AI agents: agents make autonomous calls, and the entity paying for those calls (the person running the agent) is often different from the entity holding the API key (whoever originally set up the integration).

With x402, the wallet is the identity. An agent running inside a customer's infrastructure pays directly from the customer's wallet for each call it makes. There's no shared API key to manage. No rate limits to distribute across tenants. No billing reconciliation at the end of the month.

It also solves the "cold start" problem for API monetization. Traditionally, if you want to charge for an API, you need Stripe, a billing portal, subscription management, and an API key system  -  weeks of work before you can accept your first dollar. With x402, you add one middleware function and set a receiving address. That's it.

This is early. The tooling is still rough. Not every developer wants to deal with on-chain payments. But for AI-native infrastructure  -  where calls are autonomous, granular, and high-volume  -  it's a better model than what we've had.

---

## Activating It

In RevealUI, x402 is off by default. Enable it with two environment variables:

```bash
X402_ENABLED=true
X402_RECEIVING_ADDRESS=0x...    # your USDC receiving address on Base
X402_PRICE_PER_TASK=0.01        # default price per agent task
X402_NETWORK=base               # or base-sepolia for testnet
```

When disabled, the existing 429 quota behavior is unchanged. When enabled, quota exhaustion returns 402 with payment details instead.

The full source is in [`apps/api/src/middleware/x402.ts`](https://github.com/RevealUIStudio/revealui/blob/main/apps/api/src/middleware/x402.ts) and the marketplace implementation in [`apps/api/src/routes/marketplace.ts`](https://github.com/RevealUIStudio/revealui/blob/main/apps/api/src/routes/marketplace.ts).

---

## What This Means for Pricing

HTTP 402 and x402 are not a replacement for subscriptions. They are the missing transaction layer for an agent-first internet.

The pricing model that fits 2027-2030 is hybrid:

- account/workspace subscription for platform access
- metered agent labor for autonomous work
- protocol-level or marketplace-level payment for discrete paid calls
- explicit commerce pricing when agents complete economic actions
- premium pricing for trust, governance, and compliance

That is materially better than classic per-seat SaaS for agent systems because the thing creating value is no longer only the human seat. The value is digital labor, transaction flow, and governed autonomy.

In RevealUI, the long-term goal is to make x402 one pricing primitive among several:

- subscriptions handle recurring platform value
- meters handle predictable usage expansion
- x402 handles direct paid invocation
- marketplace and commerce rails handle transaction-linked monetization

The important constraint is ethical billing: failed or replayed calls should not be billable, and agent-spend systems need auditable controls before they deserve trust.

---

_RevealUI is an open-source business runtime for software companies. [revealui.com](https://revealui.com)_
