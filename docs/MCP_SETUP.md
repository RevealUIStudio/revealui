# MCP Servers Setup

This guide explains how to set up and use Model Context Protocol (MCP) servers for Vercel and Stripe in your RevealUI project.

## Free MCP Servers

We use only free, open-source MCP servers:

- **Vercel MCP**: `vercel-mcp` - Community package for Vercel API access
- **Stripe MCP**: `@stripe/mcp` - Official Stripe MCP server

## Setup

1. **Install dependencies** (already done):
   ```bash
   pnpm install
   ```

2. **Configure API keys**:
   Copy `.env.example` to `.env` and fill in your API keys:
   ```bash
   cp .env.example .env
   ```

   Get your API keys from:
   - **Vercel**: https://vercel.com/account/tokens (create a token)
   - **Stripe**: https://dashboard.stripe.com/apikeys (use test secret key)

3. **Run setup check**:
   ```bash
   pnpm setup-mcp
   ```

## Usage

### Start MCP Servers

```bash
# Start individual servers
pnpm mcp:vercel  # Starts Vercel MCP server
pnpm mcp:stripe  # Starts Stripe MCP server

# Start all servers together
pnpm mcp:all
```

### Server Commands

The MCP servers use these command formats:

- **Vercel**: `VERCEL_API_KEY=<your_key>`
- **Stripe**: `--tools=all --api-key=<your_key>`

### Connect to AI Clients

Once MCP servers are running, configure your AI client to connect to them:

#### For Claude Desktop:
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "vercel": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-vercel.ts"],
      "env": {
        "VERCEL_API_KEY": "your_vercel_token"
      }
    },
    "stripe": {
      "command": "npx",
      "args": ["tsx", "scripts/mcp-stripe.ts"],
      "env": {
        "STRIPE_SECRET_KEY": "your_stripe_key"
      }
    }
  }
}
```

#### For Cursor:
Cursor should automatically detect running MCP servers.

## Available Tools

### Vercel MCP (`vercel-mcp`)
- Deploy projects
- Manage domains
- Configure environment variables
- View project analytics
- Manage teams and permissions

### Stripe MCP (`@stripe/mcp`)
- `balance.read` - Retrieve balance information
- `coupons.create` - Create a new coupon
- `coupons.read` - Read coupon information
- `customers.create` - Create a new customer
- `customers.read` - Read customer information
- `disputes.read` - Read disputes information
- `disputes.update` - Update an existing dispute
- `documentation.read` - Search Stripe documentation
- `invoiceItems.create` - Create a new invoice item
- `invoices.create` - Create a new invoice
- `invoices.read` - Read invoice information
- `invoices.update` - Update an existing invoice
- `paymentIntents.read` - Read payment intent information
- `paymentLinks.create` - Create a new payment link
- `prices.create` - Create a new price
- `prices.read` - Read price information
- `products.create` - Create a new product
- `products.read` - Read product information
- `refunds.create` - Create a new refund
- `subscriptions.read` - Read subscription information
- `subscriptions.update` - Update subscription information

## Troubleshooting

- **"Missing API key"**: Make sure your `.env` file has the correct API keys
- **"Connection refused"**: Ensure MCP servers are running with `pnpm mcp:all`
- **"Command not found"**: Run `pnpm install` to install dependencies

## Cost

All MCP servers used in this setup are **completely free**:
- No subscription fees
- No usage-based pricing
- Only your existing Vercel/Stripe API usage costs apply
