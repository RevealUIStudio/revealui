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
| `@revealui/presentation` | 50+ native UI components (zero external deps) | [→ presentation](/reference/presentation) |
| `@revealui/router` | Lightweight file-based router with SSR | [→ router](/reference/router) |

### Infrastructure

| Package | Description | Reference |
|---------|-------------|-----------|
| `@revealui/config` | Type-safe env config with Zod + lazy Proxy | [→ config](/reference/config) |
| `@revealui/utils` | Logger, DB helpers, validation utilities | [→ utils](/reference/utils) |
| `@revealui/cli` | `create-revealui` scaffolding tool | [→ cli](/reference/cli) |
| `@revealui/setup` | Environment setup utilities | — |
| `@revealui/sync` | ElectricSQL real-time sync | — |
| `@revealui/dev` | Shared configs (Biome, TypeScript, Tailwind) | — |
| `@revealui/test` | Playwright E2E specs, Vitest fixtures, mocks | — |

## Pro Packages

Pro packages require a [RevealUI Pro license](https://revealui.com/pricing).

| Package | Description | Reference |
|---------|-------------|-----------|
| `@revealui/ai` | AI agents, LLM providers, CRDT memory, A2A protocol | [→ Pro docs](/pro/ai) |
| `@revealui/mcp` | MCP servers (Stripe, Supabase, Neon, Vercel, Playwright) | [→ Pro docs](/pro/mcp) |
| `@revealui/editors` | Editor daemon (Zed, VS Code, Neovim adapters) | [→ Pro docs](/pro/editors) |
| `@revealui/services` | Stripe + Supabase integrations | — |

## REST API

The RevealUI API server (`apps/api`) exposes a REST API at `https://api.revealui.com`.

- [OpenAPI spec](https://api.revealui.com/swagger) — interactive documentation (includes A2A agent protocol endpoints)

## Related

- [Architecture overview](/docs/ARCHITECTURE)
- [Database schema](/docs/DATABASE)
- [Authentication reference](/docs/AUTH)
