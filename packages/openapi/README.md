---
title: "@revealui/openapi"
description: "Type-safe OpenAPI 3.x integration for Hono. Define routes with Zod schemas, get automatic spec generation, request validation, and Swagger UI - zero manual spec writing."
visibility: public
status: verified
audience: user
---

# @revealui/openapi

Type-safe OpenAPI 3.x integration for Hono. Define routes with Zod schemas, get automatic spec generation, request validation, and Swagger UI  -  zero manual spec writing.

## When to Use This

- You're building a Hono API and want OpenAPI documentation
- You want type-safe request/response validation with Zod schemas
- You need auto-generated Swagger UI at `/docs`
- You want a single route definition to drive types, validation, AND documentation

## Installation

```bash
pnpm add @revealui/openapi
```

Peer dependencies: `hono` (>=4.3.6), `zod` (>=4.0.0)

## API Reference

| Export | Type | Purpose |
|--------|------|---------|
| `OpenAPIHono` | Class | Extended Hono app with OpenAPI route registration |
| `createRoute` | Function | Define a typed route with request/response schemas |
| `zValidator` | Middleware | Validate request body/query/params against Zod schemas |
| `$` | Helper | Cast a Hono instance to `OpenAPIHono` after chaining (identity type helper; not a schema `$ref` shorthand) |
| `extendZodWithOpenApi` | Function | Add `.openapi()` method to Zod types (native implementation in this package) |
| `z` | Re-export | Zod instance for convenience |

### Types

| Type | Purpose |
|------|---------|
| `RouteConfig` | Route definition shape (method, path, request, responses) |
| `RouteHandler` | Handler function type for a given route config |
| `RouteHook` | Hook function type for route lifecycle |
| `OpenAPIHonoOptions` | Constructor options for `OpenAPIHono` |

## Usage

```typescript
import { OpenAPIHono, createRoute, zValidator, z } from '@revealui/openapi';

const route = createRoute({
  method: 'post',
  path: '/users',
  request: {
    body: { content: { 'application/json': { schema: z.object({ name: z.string() }) } } },
  },
  responses: {
    201: { description: 'User created' },
  },
});

const app = new OpenAPIHono();
app.openapi(route, (c) => c.json({ id: '1', name: 'test' }, 201));
```

## Design Principles

- **Unified**: Single schema definition drives validation, types, and OpenAPI spec
- **Orthogonal**: Decoupled from business logic  -  validates at the boundary, not inside handlers (`zValidator`, `packages/openapi/src/zod-validator.ts:63`)
- **Hermetic**: Request validation happens before handler execution, preventing invalid data from leaking through

## Contracts mirror — cross-language codegen pipeline (F8 Phase 3)

The package also ships a build-time emitter that mirrors every `@revealui/contracts` Zod schema as an OpenAPI 3.1 doc, suitable for `oapi-codegen` (Go) and `progenitor` (Rust) consumers.

```bash
pnpm --filter @revealui/openapi emit:contracts        # write contracts.openapi.json
pnpm --filter @revealui/openapi check:contracts       # exit non-zero on drift (CI gate)
```

The committed `contracts.openapi.json` is the single source of truth — Go and Rust clients regenerate type bindings from it, replacing per-language hand-mirrors with codegen from the canonical contracts. The CI gate `Contracts OpenAPI mirror drift` re-runs the emitter and fails if the regenerated output differs from the committed reference, ensuring the file stays in sync with `@revealui/contracts` schema changes.

The emitter consumes `@revealui/mcp/contracts-server`'s `getContractsCatalog()` helper (added in the same PR) so the schema list is single-sourced via the contracts MCP server's registry — no risk of the OpenAPI mirror drifting from the MCP server's resource list.

See the internal contracts-protocol-pyramid ADR (2026-05-03) §"Phase 3" for the full L3-OpenAPI rationale within the protocol-pyramid (L1 Zod → L2 MCP+A2A → L3 OpenAPI).

## Related

- Pairs well with `@revealui/contracts` for shared Zod schemas between API and clients
- Native Zod → OpenAPI extension (no `@asteasolutions/zod-to-openapi` dependency)
- Supports OpenAPI 3.0 and 3.1 spec output
- Contracts mirror consumes `@revealui/mcp/contracts-server` (F8 Phase 1 of the protocol-pyramid ADR)
