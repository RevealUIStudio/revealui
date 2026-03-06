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
├── api/
│   └── index.js        # Vercel serverless entry (wraps dist/index.js)
├── src/
│   ├── server.ts       # Dev server (tsx watch)
│   ├── app.ts          # Hono app + SSR handler (builds to dist/index.js)
│   ├── client.tsx      # Client-side hydration (builds to public/assets/)
│   ├── routes.tsx      # Route definitions
│   ├── components/     # Page components
│   └── styles/         # CSS
├── public/             # Static assets (favicons + build output)
└── vercel.json         # Vercel deployment config
```

**Build pipeline:** `vite build` → `public/assets/client.{js,css}` (client bundle);
`tsup` → `dist/index.js` (SSR server bundle). `api/index.js` wraps the SSR bundle
as a Vercel Node.js serverless function. All requests are rewritten to `/api` in production.

## Deployment

Vercel project `revealui-mainframe` is linked in `.vercel/project.json`. Build and
serverless adapter are wired and verified. To deploy:

```bash
cd apps/mainframe
vercel deploy --prod
```

No environment variables are required for the current routes (all pages are
static/in-memory — no live API calls).

## Related

- [Router Package](../../packages/router/README.md)
- [Presentation Package](../../packages/presentation/README.md)
- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
