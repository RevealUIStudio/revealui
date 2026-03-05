# @revealui/mcp

MCP (Model Context Protocol) servers for RevealUI Pro. Connect your AI agents to Stripe, Supabase, Neon, Vercel, and Playwright via standardized tool interfaces.

## Overview

`@revealui/mcp` provides pre-built MCP server adapters:

| Server | Tools provided |
|--------|---------------|
| `stripe` | Customers, invoices, subscriptions, products, prices |
| `supabase` | Database queries, auth, storage, realtime |
| `neon` | SQL queries, migrations, branching |
| `vercel` | Deployments, domains, env vars, logs |
| `playwright` | Browser automation, screenshots, testing |

## Installation

Requires a RevealUI Pro license.

```bash
pnpm add @revealui/mcp
```

## Quick start

```typescript
import { StripeMCPServer, VercelMCPServer } from '@revealui/mcp'

// Start Stripe MCP server
const stripe = new StripeMCPServer({
  apiKey: process.env.STRIPE_SECRET_KEY,
  port: 3020,
})

await stripe.start()
// MCP endpoint: http://localhost:3020/mcp
```

## Using with an agent

```typescript
import { createAgent } from '@revealui/ai'
import { MCPClient } from '@revealui/mcp/client'

const stripeTools = await MCPClient.loadTools('http://localhost:3020/mcp')

const agent = createAgent({
  name: 'billing-agent',
  llm,
  tools: stripeTools,
})

const result = await agent.run('List all active subscriptions created this month.')
```

## Stripe MCP server

```typescript
import { StripeMCPServer } from '@revealui/mcp'

const server = new StripeMCPServer({
  apiKey: process.env.STRIPE_SECRET_KEY,
  // Optional: restrict to specific operations
  allowedOperations: ['customers.list', 'subscriptions.list', 'invoices.retrieve'],
})
```

Available tools: `stripe_list_customers`, `stripe_get_subscription`, `stripe_create_invoice`, `stripe_list_products`, and more.

## Supabase MCP server

```typescript
import { SupabaseMCPServer } from '@revealui/mcp'

const server = new SupabaseMCPServer({
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
```

## Neon MCP server

```typescript
import { NeonMCPServer } from '@revealui/mcp'

const server = new NeonMCPServer({
  connectionString: process.env.DATABASE_URL,
  // Read-only mode for safety
  readOnly: true,
})
```

## Playwright MCP server

Enables agents to automate browsers for testing, scraping, or UI interactions.

```typescript
import { PlaywrightMCPServer } from '@revealui/mcp'

const server = new PlaywrightMCPServer({
  browser: 'chromium',
  headless: true,
})
```

Available tools: `playwright_navigate`, `playwright_click`, `playwright_fill`, `playwright_screenshot`, `playwright_extract_text`.
