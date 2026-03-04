# API Reference

Complete API reference for all RevealUI packages.

## OSS Packages

### Core Framework

| Package | Description | Reference |
|---------|-------------|-----------|
| `@revealui/core` | CMS engine, collections, fields, access control, rich text, admin UI | [→ core](/reference/core) |
| `@revealui/contracts` | Zod schemas, TypeScript types — the single source of truth | [→ contracts](/reference/contracts) |
| `@revealui/db` | Drizzle ORM schema, NeonDB client, migrations | [→ db](/reference/db) |
| `@revealui/auth` | Session-based auth, sign in/up, rate limiting, RBAC | [→ auth](/reference/auth) |

### UI & Routing

| Package | Description | Reference |
|---------|-------------|-----------|
| `@revealui/presentation` | 50+ native UI components (zero external deps) | [→ presentation](/api/presentation) |
| `@revealui/router` | Lightweight file-based router with SSR | [→ router](/api/router) |

### Infrastructure

| Package | Description | Reference |
|---------|-------------|-----------|
| `@revealui/config` | Type-safe env config with Zod + lazy Proxy | [→ config](/api/config) |
| `@revealui/utils` | Logger, DB helpers, validation utilities | [→ utils](/api/utils) |
| `@revealui/cli` | `create-revealui` scaffolding tool | [→ cli](/api/cli) |
| `@revealui/setup` | Environment setup utilities | [→ setup](/api/setup) |
| `@revealui/sync` | ElectricSQL real-time sync | [→ sync](/api/sync) |
| `@revealui/dev` | Shared configs (Biome, TypeScript, Tailwind) | [→ dev](/api/dev) |
| `@revealui/test` | Playwright E2E specs, Vitest fixtures, mocks | [→ test](/api/test) |

## Pro Packages

Pro packages require a [RevealUI Pro license](https://revealui.com/pricing).

| Package | Description | Reference |
|---------|-------------|-----------|
| `@revealui/ai` | AI agents, LLM providers, CRDT memory, A2A protocol | [→ ai](/api/ai) |
| `@revealui/mcp` | MCP servers (Stripe, Supabase, Neon, Vercel, Playwright) | [→ mcp](/api/mcp) |
| `@revealui/editors` | Editor daemon (Zed, VS Code, Neovim adapters) | [→ editors](/api/editors) |
| `@revealui/services` | Stripe + Supabase integrations | [→ services](/api/services) |

## REST API

The RevealUI API server (`apps/api`) exposes a REST API at `https://api.revealui.com`.

- [OpenAPI spec](https://api.revealui.com/swagger) — interactive documentation
- [A2A Agent Protocol](/api/a2a) — Google A2A-compatible agent communication

## Related

- [Architecture overview](/architecture/ARCHITECTURE)
- [Database schema](/docs/DATABASE)
- [Authentication reference](/docs/AUTH)
