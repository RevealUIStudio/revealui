# RevealUI Mainframe

Demo and showcase application — Hono SSR with React and `@revealui/router`.

## Features

- **Server-Side Rendering** — Hono serves HTML with React SSR via `@revealui/router/server`
- **Client Hydration** — React hydrates on the client with full interactivity
- **Static Assets** — Served via `@hono/node-server/serve-static`
- **Stripe Integration** — Webhook handling for payment events
- **UI Components** — Uses `@revealui/presentation` component library

## Stack

- **Server**: Hono + `@hono/node-server`
- **SSR**: `@revealui/router/server` (`createSSRHandler`)
- **UI**: React 19 + `@revealui/presentation`
- **Styling**: Tailwind CSS v4
- **Payments**: Stripe webhooks

## Development

```bash
# Start dev server (tsx watch, port 3001)
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Listen for Stripe webhooks locally
pnpm stripe:webhooks
```

## Architecture

```
apps/mainframe/
├── src/
│   ├── server.ts       # Hono app + SSR handler
│   ├── client.tsx      # Client-side hydration
│   ├── routes.ts       # Route definitions
│   ├── pages/          # Page components
│   └── styles/         # CSS
├── public/             # Static assets
└── vercel.json         # Vercel deployment config
```

The server creates a Hono app, registers static file middleware, and uses `createSSRHandler` from `@revealui/router/server` to render React components server-side with data injection.

## Deployment

Vercel project `revealui-mainframe` exists but deployment is not yet functional. Requires `@hono/vercel` adapter and an `api/index.ts` entry point.

## Related

- [Router Package](../../packages/router/README.md)
- [Presentation Package](../../packages/presentation/README.md)
- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
