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

The package also ships a build-time emitter that mirrors the registered `@revealui/contracts` Zod schemas as an OpenAPI 3.1 document. Go and Rust consumers must qualify their pinned generators against this dialect and the actual schema features before adopting a refreshed mirror.

```bash
pnpm --filter @revealui/openapi emit:contracts        # write contracts.openapi.json
pnpm --filter @revealui/openapi check:contracts       # exit non-zero on drift (CI gate)
```

The committed `contracts.openapi.json` is the versioned mirror for cross-language consumers. The CI gate `Contracts OpenAPI mirror drift` re-runs the emitter and fails if the regenerated output differs from the committed reference. Review schema semantics and consumer compatibility before refreshing that reference; passing emitter tests alone does not qualify generated Go or Rust bindings.

The emitter consumes `@revealui/mcp/contracts-server`'s `getContractsCatalog()` helper (added in the same PR) so the schema list is single-sourced via the contracts MCP server's registry — no risk of the OpenAPI mirror drifting from the MCP server's resource list.

### Conversion and refresh policy

- Request and database-insert schemas use Zod input conversion. Response and entity schemas use output conversion. Input conversion preserves pre-transform constraints; it does not implement normalization. Ordinary Zod objects accept and strip unknown input keys, so input JSON Schema does not impose output's `additionalProperties: false`.
- The ten explicitly selected Date-bearing schemas describe `Date.toJSON()` strings. They keep nullable/optional structure and use a syntax pattern, with `x-revealui-runtime-type: Date`. JavaScript supports signed six-digit years, so this projection deliberately omits RFC3339 `format: date-time`. Calendar validity, Date bounds and business refinements require runtime validation. This is a serialization description: `validatePayload` still requires Date objects and retains its refinements. Other unsupported types and unreviewed Date checks remain conversion failures.
- Component-local pointers and recursion are rebased to their owning component. Identified `$id` resources keep their base; external references remain unchanged and are not fetched. Only schema-valued keywords are traversed, leaving example/default data intact. Unresolved local pointers, serialization-error placeholders and unsupported dynamic-reference keywords stop emission.
- Site output requires `visibility`; a JSON Schema `default` does not supply a missing property. Tighter timestamp patterns, request input openness, Date projections, primitive unions and added fields need consumer review. In particular, verify the pinned generator's OpenAPI 3.1 support, recursion/`$defs`, string Date handling, optionality and unknown-field behavior.

The generator repair does not refresh the committed contract. The drift gate remains active until the semantic and consumer checks support a separate reference update.

See the internal contracts-protocol-pyramid ADR (2026-05-03) §"Phase 3" for the full L3-OpenAPI rationale within the protocol-pyramid (L1 Zod → L2 MCP+A2A → L3 OpenAPI).

## Related

- Pairs well with `@revealui/contracts` for shared Zod schemas between API and clients
- Native Zod → OpenAPI extension (no `@asteasolutions/zod-to-openapi` dependency)
- Supports OpenAPI 3.0 and 3.1 spec output
- Contracts mirror consumes `@revealui/mcp/contracts-server` (F8 Phase 1 of the protocol-pyramid ADR)
