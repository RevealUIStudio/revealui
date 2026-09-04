---
visibility: public
---

# @revealui/mcp

MCP (Model Context Protocol) servers for RevealUI. Connect your AI agents to Stripe, Neon, Vercel, Playwright, and more via standardized tool interfaces.

> **License: Fair Source (FSL-1.1-MIT).** `@revealui/mcp` is one of the five Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`) — source-visible in the public repo, free to use commercially under the FSL non-compete, and converting to plain MIT two years after each release.

## Overview

`@revealui/mcp` ships **14 first-party MCP server launchers** under `packages/mcp/src/servers/`. The full list lives in the source; a representative sample:

| Server | Launcher | Tools provided |
|--------|----------|---------------|
| Stripe | `launchStripeMcp` | Customers, invoices, subscriptions, products, prices |
| Neon | `launchNeonMcp` | SQL queries, migrations, branching (remote endpoint at `mcp.neon.tech`) |
| Vercel | `launchVercelMcp` | Deployments, domains, env vars, logs |
| Playwright | `launchPlaywrightMcp` | Browser automation, screenshots, testing |
| Next.js DevTools | `launchNextDevtoolsMcp` | Next.js 16+ runtime diagnostics |
| RevealUI Stripe / Content / Email / Memory | (see source, `packages/mcp/src/servers/revealui-*.ts`) | First-party platform servers. These run as standalone stdio servers with a `setCredentials()` export the Hypervisor calls to inject tenant credentials before tool invocations, not via a `launch*` factory. |

## Installation

```bash
pnpm add @revealui/mcp
```

## Quick start

```typescript
import { launchStripeMcp } from '@revealui/mcp'

// Launchers return a server handle; see packages/mcp/src/index.ts and the
// per-server source files (e.g. packages/mcp/src/servers/stripe.ts) for the
// current API shape and configuration.
const handle = await launchStripeMcp({
  apiKey: process.env.STRIPE_SECRET_KEY,
})
```

## Using with an agent

The MCP-to-agent integration ships in `@revealui/ai` (Fair Source / Pro). See [`packages/ai/src/tools/mcp-adapter.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/ai/src/tools/mcp-adapter.ts) for the current adapter API. The hypervisor + metering primitives that connect MCP tool calls to your billing surface live in `@revealui/mcp` itself; see [`packages/mcp/src/hypervisor.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/mcp/src/hypervisor.ts) and [`packages/mcp/src/metering.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/mcp/src/metering.ts).

## Per-server snippets

Each launcher accepts its own configuration. The canonical reference is the source file under [`packages/mcp/src/servers/`](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp/src/servers); examples:

- `launchStripeMcp({ apiKey })` — local proxy around Stripe's official MCP package
- `launchNeonMcp({ connectionString, readOnly })` — note: the public NeonDB MCP is also available remotely at `mcp.neon.tech`
- `launchPlaywrightMcp({ browser: 'chromium', headless: true })`
- `launchVercelMcp({ apiKey })`

For tool names + parameter schemas exposed by each server, point your MCP client at the launcher and call `tools/list` per the [MCP spec](https://modelcontextprotocol.io).

## Related

- [Pro overview](/docs/PRO)
- [AI agents](/docs/AI)
- [`packages/mcp` source](https://github.com/RevealUIStudio/revealui/tree/main/packages/mcp)
