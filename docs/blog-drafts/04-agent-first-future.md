# Building for the Agent-First Internet

*The web was built for browsers. The next web is being built for agents.*

---

I have been building RevealUI for the past year as an agentic business runtime -- the kind of thing where you get users, content, products, payments, and AI pre-wired, open source, and ready to deploy. The whole point is that you should not have to re-implement billing or auth or an admin every time you start a new software business.

But somewhere around the third month of building, I realized something that changed the architecture fundamentally: **the next wave of customers for software platforms are not human.**

They are AI agents. And agents do not browse websites.

## The shift from human-first to agent-first

When you build a SaaS product today, the acquisition funnel looks something like this: a developer searches Google, lands on your marketing page, reads the hero section, clicks "Get Started," creates an account, enters a credit card, and starts building. Every pixel on your landing page is optimized for that flow.

Now consider what happens when a developer asks Claude, "What platform has billing built in and supports MCP?" The agent does not open a browser. It does not read your hero banner. It does not care about your gradient backgrounds or testimonial carousel. It searches structured data sources -- package registries, OpenAPI specs, Agent Cards, tool definitions -- and evaluates them programmatically.

This is not a hypothetical future. IEEE Spectrum has reported that autonomous AI agents are becoming primary users of the web. Gartner projects that 40% of enterprise applications will embed AI agents by the end of 2026. The agent economy is projected to reach $10.91 billion in 2026, growing at 43% year-over-year.

The traditional marketing funnel is not going away. But it is being supplemented by a parallel funnel:

| Human funnel | Agent funnel |
|---|---|
| Landing page | `/.well-known/agent.json` |
| Feature comparison table | OpenAPI spec (`/openapi.json`) |
| Pricing page | `/.well-known/payment-methods.json` |
| App store listing | MCP registry (`/.well-known/marketplace.json`) |
| Sign up + credit card | x402 micropayment (USDC on Base) |
| Onboarding wizard | Tool invocation via JSON-RPC |

Both funnels serve the same product. The difference is the interface.

## RevealUI's agent storefront

Every RevealUI instance ships with four machine-readable discovery endpoints. These are not optional add-ons or plugins. They are part of the platform, deployed automatically when you deploy your API.

**`/.well-known/agent.json`** -- The A2A Agent Card. This is the equivalent of a business card for your AI agent. It tells other agents what your instance can do, what protocols it supports, and where to send tasks.

```json
{
  "name": "revealui-creator",
  "description": "RevealUI Business OS agent — manages content, users, products, and billing",
  "url": "https://api.example.com/a2a",
  "version": "1.0",
  "protocols": ["a2a-1.0", "mcp-1.0"],
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": true
  },
  "skills": [
    {
      "id": "content-management",
      "name": "Content Management",
      "description": "Create, update, and query admin collections via REST"
    },
    {
      "id": "billing-operations",
      "name": "Billing Operations",
      "description": "Create checkout sessions, manage subscriptions, process upgrades"
    },
    {
      "id": "ticket-management",
      "name": "Ticket Management",
      "description": "Create and manage support tickets across kanban boards"
    }
  ],
  "authentication": {
    "schemes": ["session-cookie", "api-key", "x402"]
  }
}
```

**`/openapi.json`** -- The machine-readable API specification, auto-generated from route definitions. Every endpoint in RevealUI's Hono API is defined with Zod schemas that produce OpenAPI 3.0 output. When an agent evaluates whether RevealUI can handle a task, it reads this spec -- not your docs site.

**`/.well-known/marketplace.json`** -- The MCP marketplace discovery document. Lists every published MCP server, its category, pricing, and invocation URL:

```json
{
  "version": "1.0",
  "platform": "revealui",
  "registryUrl": "https://api.example.com/api/marketplace/servers",
  "publishUrl": "https://api.example.com/api/marketplace/servers",
  "revenueShare": { "platform": 0.2, "developer": 0.8 },
  "paymentMethods": ["x402-usdc"],
  "servers": [
    {
      "id": "mcp_a1b2c3d4e5f6",
      "name": "Code Validator",
      "description": "Static analysis and security scanning for TypeScript projects",
      "category": "coding",
      "pricePerCallUsdc": "0.001",
      "invokeUrl": "https://api.example.com/api/marketplace/servers/mcp_a1b2c3d4e5f6/invoke"
    }
  ]
}
```

**`/.well-known/payment-methods.json`** -- The x402 payment terms. Tells agents exactly how to pay for API calls: which network, which token, which address, what price.

These four endpoints *are* your marketing site for agent customers. When an agent evaluates RevealUI, it does not read hero banners. It reads structured data, compares it against its task requirements, and makes a programmatic decision.

## The protocols that make this possible

Four protocols converge to create the agent-first web. Each solves a different piece of the puzzle, and RevealUI implements all four.

| Protocol | Created by | Governed by | Purpose | RevealUI implementation |
|---|---|---|---|---|
| **A2A** (Agent-to-Agent) | Google | Linux Foundation (Agentic AI Foundation) | Agents discover and delegate work to other agents | Full A2A 1.0: Agent Cards, JSON-RPC task lifecycle (`tasks/send`, `tasks/get`, `tasks/cancel`), SSE streaming |
| **MCP** (Model Context Protocol) | Anthropic | Open standard | Agents use tools exposed by MCP servers | 7 MCP servers: Stripe, Supabase, Neon, Vercel, Code Validator, Playwright, Next.js DevTools |
| **x402** (HTTP 402 Payment Required) | Coinbase | Open standard | Internet-native micropayments for machine-to-machine commerce | Per-call USDC payments on Base, Coinbase facilitator verification, marketplace payment proxy |
| **OpenAPI** | OpenAPI Initiative | Linux Foundation | Machine-readable API descriptions | Auto-generated from Hono route definitions with Zod schemas |

### A2A: How agents find and talk to each other

Google's Agent-to-Agent protocol, now stewarded by the Linux Foundation's Agentic AI Foundation, defines how agents discover each other and delegate tasks. The core primitive is the **Agent Card** -- a JSON document at a well-known URL that describes what an agent can do.

RevealUI implements the full A2A 1.0 task lifecycle. An external agent can:

1. **Discover** the platform agent via `GET /.well-known/agent.json`
2. **Send a task** via `POST /a2a` with a JSON-RPC `tasks/send` request
3. **Subscribe to updates** via SSE at `/a2a/stream/:taskId`
4. **Check status** via `tasks/get`
5. **Cancel** a running task via `tasks/cancel`

Task execution is gated behind the `ai` feature flag -- you need a Pro or Forge license for agents to actually run tasks. But discovery is always public. Any agent on the internet can find your RevealUI instance and understand what it offers.

```bash
# An agent discovers your RevealUI instance
curl https://api.example.com/.well-known/agent.json

# An agent sends a task via A2A JSON-RPC
curl -X POST https://api.example.com/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "task-001",
    "method": "tasks/send",
    "params": {
      "id": "task-001",
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "text": "Create a blog post about our Q2 launch" }]
      }
    }
  }'
```

Agents use the host's configured inference path. The `createLLMClientFromEnv()` factory auto-detects the available backend (Ubuntu Inference Snaps or Ollama) — no API keys required, no vendor lock-in.

### MCP: How agents use tools

The Model Context Protocol (MCP) defines how agents invoke tools. Where A2A is about agent-to-agent communication, MCP is about agent-to-tool communication. An MCP server exposes a set of tools -- functions that an agent can call with structured inputs and get structured outputs.

RevealUI ships with seven MCP servers that cover the full infrastructure stack:

- **Stripe** -- Create checkout sessions, manage subscriptions, query payment history
- **Supabase** -- Vector storage, real-time auth, embedding operations
- **Neon** -- Database management, connection pooling, branch operations
- **Vercel** -- Deployment management, environment variables, domain configuration
- **Code Validator** -- Static analysis, security scanning, TypeScript type checking
- **Playwright** -- Browser automation, E2E testing, screenshot capture
- **Next.js DevTools** -- Route inspection, build analysis, performance profiling

These servers are open source (MIT licensed). Anyone can run them, fork them, or publish improved versions to the marketplace.

### x402: How agents pay

This is the piece most people have not seen yet, and it is the one that makes the economics work.

HTTP status code 402 -- Payment Required -- has been reserved since 1997 but never had a standard implementation. Coinbase's x402 protocol fills that gap. When an agent makes a request and the server requires payment, it returns HTTP 402 with an `X-PAYMENT-REQUIRED` header containing the price and payment details. The agent pays in USDC on Base (an Ethereum L2), then retries with a signed payment proof in the `X-PAYMENT-PAYLOAD` header.

Here is what the flow looks like in practice when an agent invokes a marketplace MCP server:

```
Agent                          RevealUI Marketplace             MCP Server
  |                                    |                            |
  |  POST /servers/mcp_abc/invoke     |                            |
  |  (no payment header)              |                            |
  | --------------------------------> |                            |
  |                                    |                            |
  |  HTTP 402 Payment Required        |                            |
  |  X-PAYMENT-REQUIRED: base64(...)  |                            |
  | <-------------------------------- |                            |
  |                                    |                            |
  |  [Agent pays 0.001 USDC on Base]  |                            |
  |                                    |                            |
  |  POST /servers/mcp_abc/invoke     |                            |
  |  X-PAYMENT-PAYLOAD: base64(...)   |                            |
  | --------------------------------> |                            |
  |                                    |  POST (proxied request)   |
  |                                    | ------------------------> |
  |                                    |                            |
  |                                    |  Response                 |
  |                                    | <------------------------ |
  |  HTTP 200 (proxied response)      |                            |
  | <-------------------------------- |                            |
```

The payment is verified by Coinbase's public facilitator at `x402.org/facilitator`. No API key required for verification. The entire flow is stateless from the agent's perspective -- pay, prove, get access.

RevealUI's marketplace uses x402 as the payment rail for all per-call MCP server invocations. The default price is $0.001 USDC per call, but each server sets its own price.

### OpenAPI: The foundation layer

Every route in RevealUI's API is defined using `@revealui/openapi` -- a thin wrapper around Hono's OpenAPI integration with Zod schema validation. This means the `/openapi.json` endpoint is always accurate, always complete, and always in sync with the actual API.

Agents that support OpenAPI (which is most of them) can consume your entire API without any custom integration. The spec includes request schemas, response schemas, authentication requirements, and rate limit documentation.

## The marketplace as an agent ecosystem

The MCP marketplace is where the agent-first architecture becomes an economy.

**For developers:** You build an MCP server that does something useful -- code analysis, data transformation, document processing, whatever. You publish it to RevealUI's marketplace with a per-call price. The marketplace handles discovery, payment, and proxying.

```bash
# Publish an MCP server to the marketplace
curl -X POST https://api.example.com/api/marketplace/servers \
  -H "Content-Type: application/json" \
  -H "Cookie: revealui-session=..." \
  -d '{
    "name": "TypeScript Analyzer",
    "description": "Deep static analysis for TypeScript codebases with security scanning",
    "url": "https://my-mcp-server.example.com/mcp",
    "category": "coding",
    "pricePerCallUsdc": "0.005",
    "tags": ["typescript", "security", "analysis"]
  }'
```

**For agents:** Other agents discover your server via the marketplace registry or A2A protocol, evaluate its capabilities from the structured metadata, and invoke it with x402 payment.

**The economics:** Developers earn 80% of each call's revenue. RevealUI takes 20%. Payouts happen via Stripe Connect -- developers onboard once, and transfers are batched automatically. At $0.001 per call, a server handling 100,000 calls per month generates $80 for the developer and $20 for the platform. At $0.005 per call, those numbers are $400 and $100.

This is the first combined MCP + A2A registry. Smithery, mcpt, OpenTools, and Glama.ai list MCP servers. The a2a-registry.org lists A2A agents. RevealUI's marketplace is the first to combine both -- agents that are discoverable via A2A *and* tools that are invocable via MCP, with a payment layer that lets the economics work without manual billing integration. Registration on external registries (a2a-registry.org, Smithery, mcpt, OpenTools, Glama.ai) is planned for hard launch.

The marketplace is secured against common attack vectors. Developer-supplied MCP server URLs are validated against an SSRF guard that blocks loopback, link-local, and private RFC-1918 ranges. Proxied requests have a 30-second timeout. Rate limiting prevents probe abuse (30 invocations per minute per caller). And the x402 payment itself acts as an economic rate limiter -- every call costs real money, which naturally deters spam.

## What this means for developers using RevealUI

If you deploy a RevealUI instance today, you get agent-native infrastructure without any extra configuration. Here is what that means in practice:

**Your API is already agent-readable.** The OpenAPI spec at `/openapi.json` is auto-generated from your route definitions. Any agent that supports OpenAPI can consume your API today. You do not need to write a separate "agent integration."

**Your instance is already discoverable.** The Agent Card at `/.well-known/agent.json` advertises your instance's capabilities to the A2A network. Other agents can find you and evaluate whether you can handle their tasks.

**Feature gating works for both audiences.** When a human user hits a Pro feature, they see the billing page and can upgrade. When an agent hits a Pro feature without a license, it gets a structured JSON error with the pricing URL. When x402 is enabled, agents can pay per-call instead of subscribing -- the same feature, two access patterns.

**You can earn money from MCP servers while you sleep.** Publish an MCP server to the marketplace, set a per-call price, onboard with Stripe Connect, and agent calls generate passive revenue. The marketplace handles discovery, payment verification, proxying, transaction recording, and developer payouts.

**The same code serves both audiences.** This is the key architectural insight. You do not build a "human API" and an "agent API." You build one API with Zod schemas and OpenAPI definitions. Humans consume it via the admin dashboard. Agents consume it via the OpenAPI spec and A2A protocol. The code is identical.

## How to make your RevealUI instance agent-discoverable

Here is the concrete, four-step process.

**Step 1: Deploy.**

That is it for the basics. The Agent Card (`/.well-known/agent.json`) and OpenAPI spec (`/openapi.json`) are generated automatically from your route definitions. The marketplace discovery document (`/.well-known/marketplace.json`) is always available with your published servers. The payment methods document (`/.well-known/payment-methods.json`) activates when you set `X402_ENABLED=true` and configure a receiving wallet.

**Step 2: Verify your Agent Card.**

```bash
curl -s https://your-api.example.com/.well-known/agent.json | jq .
```

The response describes your instance's capabilities, supported protocols, and available skills. This is what other agents read when they evaluate your platform. Make sure the skills list matches what your instance actually offers.

**Step 3: Publish MCP servers to the marketplace.**

If you have built custom MCP servers, publish them to the marketplace for other agents to discover and use. Each server needs a name, description, category, HTTPS URL, and per-call price.

After publishing, verify your server appears in the marketplace registry:

```bash
curl -s https://your-api.example.com/.well-known/marketplace.json | jq '.servers'
```

**Step 4: Add `AGENTS.md` to your repository.**

The Agentic AI Foundation (the same organization governing A2A) has standardized the `AGENTS.md` file as the equivalent of `README.md` for AI coding agents. It tells agents like Claude Code, Cursor, and Copilot how to work with your codebase -- what the project does, how to build and test it, what conventions to follow.

RevealUI already has a `CLAUDE.md` that serves this purpose. An `AGENTS.md` in your repository root makes the same information available to all coding agents, not just Claude.

## The long view

We are in the early innings of the agent-first internet. Most platforms today are built exclusively for human users. The ones that will win the next decade are the ones building for both audiences simultaneously.

This does not require exotic technology. It requires structured data at well-known URLs. It requires machine-readable API specifications. It requires payment flows that do not assume a human is clicking buttons. And it requires the discipline to treat agents as first-class customers, not afterthoughts.

RevealUI is built on this thesis. Every endpoint is defined with schemas that produce both human-readable documentation and machine-readable specifications. Every feature is gated with logic that works for both session-authenticated humans and x402-paying agents. Every MCP server is discoverable via both the marketplace registry and the A2A protocol.

The user interface for the future has yet to reveal itself. But we know one thing: it will not be a browser for every user. Some users will be agents. And the platforms that serve them well will be the ones that thought about it from the start.

---

*RevealUI is the open-source agentic business runtime. Users, content, products, payments, and AI -- pre-wired and ready to deploy. Learn more at [revealui.com](https://revealui.com).*

*Follow the project on [GitHub](https://github.com/RevealUIStudio/revealui).*
