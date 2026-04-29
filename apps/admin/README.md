# RevealUI Dashboard

Admin dashboard with content, account billing, and system monitoring  -  powered by Next.js 16.

## Features

- **Content Management**  -  Collection-based CRUD with field hooks, access control, and rich text (Lexical)
- **Admin Dashboard**  -  System monitoring, error tracking, structured logging
- **Authentication**  -  Session-based auth with password reset, rate limiting, brute force protection
- **Billing**  -  Stripe checkout, account subscription management, optional license flows, and tier-gated features
- **AI Agents**  -  A2A agent cards, MCP server registry, open-model inference configuration
- **Real-Time Sync**  -  ElectricSQL shape-based sync for conversations, agent contexts, and memories
- **GDPR Compliance**  -  Data export and deletion endpoints

## Stack

- **Framework**: Next.js 16 (Turbopack)
- **Styling**: Tailwind CSS v4
- **Database**: Drizzle ORM (NeonDB)
- **Auth**: `@revealui/auth` (bcrypt, sessions, rate limiting)
- **UI Components**: `@revealui/presentation` (57 native components)
- **Rich Text**: Lexical editor
- **Payments**: Stripe (checkout, billing portal, webhooks)
- **Monitoring**: Sentry

## Development

```bash
# Start dev server (port 4000)
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test
```

## Admin Routes

| Route                      | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `/login`                   | Authentication                              |
| `/admin`                   | Dashboard home                              |
| `/admin/monitoring`        | System monitoring (Pro)                     |
| `/admin/errors`            | Error tracking (Pro)                        |
| `/admin/logs`              | Structured log viewer (Pro)                 |
| `/admin/agents`            | AI agent cards + MCP tools (Pro)            |
| `/admin/agents/new`        | Agent scaffolding wizard (Pro)              |
| `/admin/settings/api-keys` | Inference key management (Pro)              |
| `/account/billing`         | Account subscription and billing management |
| `/account/license`         | Perpetual or deployment license details     |

## Commercial model

The dashboard should present billing and premium access as account-level entitlements first, with optional user or deployment licenses only where they are the actual product being sold.

Target commercial layers:

- platform subscription for the workspace or account
- metered agent execution and paid automation
- optional commerce-linked fees where RevealUI powers transactions
- trust and governance controls for audit, approval, and compliance needs

## API Routes

| Endpoint                        | Purpose             |
| ------------------------------- | ------------------- |
| `POST /api/auth/sign-in`        | Sign in             |
| `POST /api/auth/sign-up`        | Sign up             |
| `POST /api/auth/sign-out`       | Sign out            |
| `GET /api/auth/session`         | Session check       |
| `GET /api/auth/me`              | Current user        |
| `POST /api/auth/password-reset` | Password reset      |
| `GET /api/health`               | Health check        |
| `GET /api/health/ready`         | Readiness check     |
| `GET /api/health/live`          | Liveness check      |
| `GET /api/health-monitoring`    | System metrics      |
| `POST /api/chat`                | AI chat             |
| `GET /api/mcp/servers`          | MCP server registry |
| `POST /api/gdpr/export`         | GDPR data export    |
| `POST /api/gdpr/delete`         | GDPR data deletion  |

## Deployment

Deployed to Vercel as `revealui-admin`. GitHub auto-deploy is enabled.

```bash
# Vercel build uses a custom chain to build workspace dependencies first
pnpm vercel-build
```

## Related

- [Architecture Guide](../../docs/ARCHITECTURE.md)
- [Database Guide](../../docs/DATABASE.md)
- [Auth Package](../../packages/auth/README.md)
- [Core Package](../../packages/core/README.md)

## License

MIT
