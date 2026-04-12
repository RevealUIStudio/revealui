# RevealUI API

Centralized backend API server for RevealUI  -  built with Hono.

**Live at:** https://api.revealui.com

## Features

- **Hono Framework**  -  Fast, lightweight, edge-ready
- **OpenAPI + Swagger**  -  Auto-generated API docs via `@hono/zod-openapi` + `@hono/swagger-ui`
- **Type-Safe Validation**  -  Zod schemas for all request/response payloads
- **A2A Protocol**  -  Google Agent-to-Agent protocol with JSON-RPC 2.0 dispatcher
- **API Key Storage**  -  Encrypted credential storage (AES-256-GCM) for model endpoints
- **Billing**  -  Stripe checkout, account billing, subscription management, metered commercial flows, webhooks
- **Entitlements**  -  Subscription-backed access control, optional license validation for perpetual products
- **Real-Time Collab**  -  Yjs CRDT sync over WebSocket
- **Observability**  -  Structured log ingestion, error reporting endpoints
- **CORS**  -  Configured for cross-subdomain requests (`.revealui.com`)

## Stack

- **Framework**: Hono + `@hono/node-server`
- **Validation**: Zod + `@hono/zod-validator`
- **Database**: Drizzle ORM (`@revealui/db`) on NeonDB
- **Auth**: `@revealui/auth` (session validation)
- **AI**: Optional Pro integration via `@revealui/ai` (agent dispatch, A2A protocol)
- **Payments**: Stripe SDK
- **CRDT**: Yjs + y-protocols

## Development

```bash
# Start dev server (tsx watch, port 3004)
pnpm dev

# Build for production (tsup)
pnpm build

# Start production server
pnpm start

# Type check
pnpm typecheck

# Run tests
pnpm test

# Tests with coverage
pnpm test:coverage
```

## API Endpoints

### Health

| Method | Path            | Purpose                       |
| ------ | --------------- | ----------------------------- |
| GET    | `/health`       | Service health status         |
| GET    | `/health/ready` | Readiness check (includes DB) |

### A2A (Agent-to-Agent)

| Method | Path                                 | Purpose                 |
| ------ | ------------------------------------ | ----------------------- |
| GET    | `/.well-known/agent.json`            | Default agent card      |
| GET    | `/.well-known/agents/:id/agent.json` | Agent card by ID        |
| POST   | `/a2a`                               | JSON-RPC 2.0 dispatcher |
| GET    | `/a2a/agents`                        | List registered agents  |
| POST   | `/a2a/agents`                        | Register agent          |
| PUT    | `/a2a/agents/:id`                    | Update agent            |
| DELETE | `/a2a/agents/:id`                    | Delete agent            |
| GET    | `/a2a/stream/:taskId`                | SSE task stream         |

### Billing and Entitlements

| Method | Path                    | Purpose                           |
| ------ | ----------------------- | --------------------------------- |
| POST   | `/billing/checkout`     | Create Stripe checkout            |
| GET    | `/billing/subscription` | Get account subscription status   |
| POST   | `/billing/portal`       | Create billing portal session     |
| POST   | `/billing/upgrade`      | Upgrade account subscription tier |

### API Keys

| Method | Path                   | Purpose                     |
| ------ | ---------------------- | --------------------------- |
| POST   | `/api-keys`            | Store encrypted API key     |
| GET    | `/api-keys`            | List user's keys (redacted) |
| DELETE | `/api-keys/:id`        | Delete key                  |
| POST   | `/api-keys/:id/rotate` | Rotate key                  |

### License

| Method | Path                | Purpose                                      |
| ------ | ------------------- | -------------------------------------------- |
| GET    | `/license/validate` | Validate perpetual or deployment license key |

## Commercial model

The API should converge on an account or workspace billing model, not a pure per-user license model.

Target commercial layers:

- platform subscriptions for account access
- metered agent execution and paid API usage
- optional commerce-linked fees for transaction paths
- trust and governance controls as premium commercial features

Per-user or perpetual licenses remain valid for narrowly scoped products, but hosted premium access should resolve through account entitlements.

### Observability

| Method | Path          | Purpose                |
| ------ | ------------- | ---------------------- |
| POST   | `/api/logs`   | Ingest structured logs |
| POST   | `/api/errors` | Report client errors   |

### Webhooks

| Method | Path               | Purpose              |
| ------ | ------------------ | -------------------- |
| POST   | `/webhooks/stripe` | Stripe event handler |

### Collaboration

| Method | Path      | Purpose       |
| ------ | --------- | ------------- |
| WS     | `/collab` | Yjs CRDT sync |

## Deployment

Deployed to Vercel as `revealui-api` (serverless). Uses tsup to bundle workspace packages.

Key bundling patterns:

- `noExternal: [/^@revealui\//]` bundles all workspace deps
- Always import subpaths (not main entry) to avoid pulling in client-side code
- `pg` and Node builtins are externalized

## Related

- [Architecture Guide](../../docs/ARCHITECTURE.md)
- [Contracts Package](../../packages/contracts/README.md)
- [Auth Package](../../packages/auth/README.md)
- [AI Package](../../packages/ai/README.md)

## License

MIT
