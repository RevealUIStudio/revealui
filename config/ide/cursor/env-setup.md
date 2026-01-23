# RevealUI Environment Setup

## MCP Configuration

To use Vercel MCP and Stripe MCP, you need to configure the following environment variables:

### Vercel MCP Setup

1. Get your Vercel access token from [Vercel Dashboard > Account > Tokens](https://vercel.com/account/tokens)
2. Get your team ID from [Vercel Dashboard > Settings > General](https://vercel.com/account) (optional)

```bash
VERCEL_ACCESS_TOKEN=your_vercel_access_token_here
VERCEL_TEAM_ID=your_vercel_team_id_here  # Optional
```

### Stripe MCP Setup

1. Get your Stripe secret key from [Stripe Dashboard > API Keys](https://dashboard.stripe.com/apikeys)
2. Get your publishable key from the same location

```bash
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key_here
```

### OpenAI Setup (for AI features)

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

## Usage Example

```typescript
import { RevealUIMCPClient } from '@revealui/ai/mcp'

const mcpClient = new RevealUIMCPClient({
	vercel: {
		accessToken: process.env.VERCEL_ACCESS_TOKEN!,
		teamId: process.env.VERCEL_TEAM_ID
	},
	stripe: {
		secretKey: process.env.STRIPE_SECRET_KEY!,
		publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!
	}
})

await mcpClient.initialize()

// Deploy to Vercel
await mcpClient.deployToVercel('my-app', './dist')

// Create Stripe payment
await mcpClient.createPaymentIntent(1000, 'usd')
```
