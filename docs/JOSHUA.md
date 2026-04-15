---
title: "The JOSHUA Stack"
description: "Six engineering principles  -  Justifiable, Orthogonal, Sovereign, Hermetic, Unified, Adaptive"
category: philosophy
audience: developer
---

# The JOSHUA Stack

Six engineering principles that govern every architectural decision in RevealUI.

**Justifiable. Orthogonal. Sovereign. Hermetic. Unified. Adaptive.**

The JOSHUA Stack is not a prescription  -  it's a starting point. We're not claiming this is the only way to build software. We're saying it's *a* way  -  a tested, coherent set of defaults that work well together. If you're not sure what to pick, start here. As your product and team evolve, adapt the principles to fit. The best architecture is the one that grows with you.

---

## Justifiable

Every default earns its place. No magic, no hidden complexity, no decisions you can't explain to your team.

**Evidence:**
- Drizzle ORM over Prisma: explicit SQL, no hidden query generation
- Hono over Express: typed routes, standards-based, measurably faster
- Zod over io-ts: runtime validation that reads like documentation
- Biome over ESLint+Prettier: single tool, deterministic, no config sprawl
- Session auth over JWT: server-side revocation, no token-refresh complexity
- pnpm over npm/yarn: strict node_modules, workspace protocol, faster installs

**Anti-patterns:** Choosing a tool because it's popular. Adding a dependency without articulating what it replaces or why. Config files copied from templates without understanding each option.

---

## Orthogonal

Clean separation of concerns. Each package has a single responsibility. No circular dependencies. Use what you need, replace what you don't.

**Evidence:**
- 21 packages, zero circular deps  -  enforced by Turborepo dependency graph
- `@revealui/auth` knows nothing about billing; `@revealui/db` knows nothing about HTTP
- `@revealui/contracts` is the only package that every other package may depend on (types + schemas)
- `@revealui/presentation` has zero external UI dependencies (only clsx + CVA)
- Each package has its own `package.json`, `tsconfig.json`, and test suite
- `workspace:*` references  -  swap any package with a compatible alternative

**Anti-patterns:** A package importing from a sibling's internal path. Business logic in UI components. Database queries in route handlers instead of through a service layer.

---

## Sovereign

Your infrastructure, your data, your rules. Deploy anywhere. Fork anything. No vendor holds your business hostage.

**Evidence:**
- MIT license on all 18 OSS packages
- No vendor-specific APIs in core (Vercel adapters are optional, in `@revealui/cache`)
- Dual-database architecture: NeonDB (primary) + Supabase (vectors)  -  both replaceable
- Open-model AI: Ubuntu snaps, Ollama, and open source models  -  no proprietary cloud APIs
- Self-hostable: Docker Compose, Railway, bare metal  -  documented in CI/CD guide
- Stripe is the only commercial dependency in the billing path, and it's behind an interface

**Anti-patterns:** Hard-coding a cloud provider's SDK into core logic. Storing data in a format that requires a specific vendor to read. Using proprietary build steps that prevent local development.

---

## Hermetic

Auth doesn't leak into billing. Content doesn't tangle with payments. Sealed boundaries and clean contracts between every layer.

**Evidence:**
- API route splits: `content/`, `tickets/`, `billing/`, `marketplace/`, `a2a/`  -  each with isolated schemas and helpers
- `@revealui/auth` exports session utilities; billing never reaches into auth internals
- Supabase imports restricted to permitted paths (enforced by `supabase-boundary.js` hook)
- CSP, CORS, HSTS headers defined in `@revealui/security`, not scattered across route files
- Collection access control is declarative (`access: { read, create, update, delete }`) not imperative middleware chains
- Pro packages are Fair Source (FSL-1.1-MIT)  -  source-visible with runtime license enforcement

**Anti-patterns:** A billing webhook handler that directly manipulates user sessions. A UI component that makes database queries. An auth middleware that knows about product tiers.

---

## Unified

One schema defines the truth. Types, validation, and API surface flow from a single source with zero drift.

**Evidence:**
- `@revealui/contracts`  -  Zod schemas are the single source for TypeScript types, API validation, and database constraints
- Drizzle ORM schema in `@revealui/db` mirrors contracts; type adapters bridge the gap
- OpenAPI specs generated from Hono route schemas (via `@hono/zod-openapi`)
- Shared enums: `POST_STATUSES`, `TICKET_STATUSES`, `TICKET_PRIORITIES` used in both API routes and contracts
- `@revealui/config`  -  environment variables validated by Zod at startup, not at usage time
- Feature tiers (`free`, `pro`, `max`, `forge`) defined once in contracts, enforced everywhere

**Anti-patterns:** Defining the same shape in two places. Validating on the server but not the client (or vice versa). API responses that don't match the documented schema. String literals where enums exist.

---

## Adaptive

AI agents, MCP servers, and workflows are built into the foundation. The system evolves with your business  -  open-model inference, sovereign by design, extend without rebuilding.

**Evidence:**
- `@revealui/ai`  -  agent system with CRDT memory, open-model inference, task history
- `@revealui/mcp`  -  hypervisor, adapter framework, and tool discovery for external services
- Open-model inference: Ubuntu snaps, Ollama  -  your models, your hardware, zero API bills
- A2A protocol routes: agent discovery, registry, RPC, streaming  -  built into the API
- Plugin system in `@revealui/core`  -  extend collections, hooks, and admin UI without forking
- Feature gating: `isLicensed('pro')` and `isFeatureEnabled('ai')`  -  capabilities unlock progressively
- ElectricSQL sync layer: real-time collaboration without rebuilding the data access pattern

**Anti-patterns:** Hard-coding a single AI provider. Building agent features as a separate microservice instead of integrating with the data layer. Requiring a full redeploy to change LLM routing.

---

## Using JOSHUA as a decision framework

When evaluating a proposed change, ask:

1. **Is it Justifiable?** Can you explain why this dependency/pattern/default exists in one sentence?
2. **Is it Orthogonal?** Does it respect package boundaries? Does it introduce a circular dependency?
3. **Is it Sovereign?** Does it increase vendor lock-in? Can a user still self-host after this change?
4. **Is it Hermetic?** Does it leak concerns across boundaries? Does billing now know about auth internals?
5. **Is it Unified?** Is the type/schema defined in one place? Does the API match the contract?
6. **Is it Adaptive?** Can a user swap this component? Does it degrade gracefully without the Pro tier?

If a change violates a principle, it's not automatically rejected  -  but the violation must be documented and justified. The principle is the default; exceptions require reasoning.

Remember: these are starting coordinates, not a cage. The JOSHUA Stack gives you a decision you can defend on day one. When your context changes  -  and it will  -  you'll know exactly which principle you're bending and why.

---

## JOSHUA in Practice

The JOSHUA Stack principles are not just documentation  -  they are actively enforced and embodied in RevealUI's systems:

- **[The VAUGHN Protocol](./VAUGHN.md)**  -  Multi-agent coordination that embodies Orthogonal (clean agent boundaries), Hermetic (sealed coordination contracts), and Adaptive (new tools join without rebuilding)
- **[Architecture](./ARCHITECTURE.md)**  -  System design guided by all six principles
- **[@revealui/contracts](./REFERENCE.md)**  -  The Unified principle in code: one Zod schema, shared everywhere
