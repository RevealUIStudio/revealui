# @revealui/openapi

Type-safe OpenAPI 3.x integration for Hono. Define routes with Zod schemas, get automatic spec generation, request validation, and Swagger UI — zero manual spec writing.

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
| `$` | Helper | Shorthand for OpenAPI schema references |
| `extendZodWithOpenApi` | Function | Add `.openapi()` method to Zod types (re-exported from `@asteasolutions/zod-to-openapi`) |
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

## JOSHUA Alignment

- **Unified**: Single schema definition drives validation, types, and OpenAPI spec
- **Orthogonal**: Decoupled from business logic — validates at the boundary, not inside handlers
- **Hermetic**: Request validation happens before handler execution, preventing invalid data from leaking through

## Related

- Pairs well with `@revealui/contracts` for shared Zod schemas between API and clients
- Built on `@asteasolutions/zod-to-openapi` for Zod → OpenAPI schema generation
- Supports OpenAPI 3.0 and 3.1 spec output
