# @revealui/openapi — Design Spec

**Date:** 2026-03-16
**Status:** Draft
**Author:** wsl-terminal agent

## Summary

Port `@hono/zod-openapi@1.2.1` (234 lines JS, 218 lines types) and `@hono/zod-validator@0.7.6` (31 lines JS) into a single owned monorepo package: `@revealui/openapi`. Clean TypeScript rewrite from upstream source with identical API surface. Drop-in replacement — migration is a find-and-replace on import paths across 32 files in `apps/api` (31 importing from `@hono/zod-openapi`, 1 from `@hono/zod-validator`).

## Motivation

- **Ownership:** Zod and Hono versions locked to monorepo catalog. No upstream drift or blocking.
- **Maintainability:** 265 lines of well-understood glue code. Trivial maintenance surface.
- **Removes blocker:** Clears the "API schema: zod version mismatch" item from the workboard.
- **Future extensibility:** Natural home for RevealUI-specific OpenAPI enhancements if needed.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| API surface | Drop-in (full upstream API) | Zero-risk migration. Add features unused today rather than trim and re-add later. |
| Implementation | Clean TS rewrite from upstream source | Readable, follows monorepo conventions, types are first-class. |
| `@hono/zod-validator` | Port in (31 lines) | Too small to justify an external dep. |
| `@asteasolutions/zod-to-openapi` | Keep as dependency | 1,727 lines of schema→OpenAPI transformation. Actively maintained. Not worth forking. |
| `openapi3-ts` | Keep as dependency | TypeScript representation of the OpenAPI standard. Nothing to customize. Also a transitive dep of zod-to-openapi — forking would create type incompatibility. |
| API helper schemas | Stay in `apps/api` | App-specific conventions (error shape, pagination defaults). Not the concern of a generic OpenAPI package. |
| Zod peer dep range | `>=4.0.0` (narrower than upstream's `^3.25.0 \|\| ^4.0.0`) | Intentional — monorepo is on Zod 4.3.6 and will not downgrade. Simplifies types. |

## Package Structure

```
packages/openapi/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts              # Re-exports: OpenAPIHono, createRoute, z, $, extendZodWithOpenApi, types
│   ├── openapi-hono.ts       # OpenAPIHono class extending Hono (~100 lines)
│   ├── create-route.ts       # createRoute factory + getRoutingPath (~15 lines)
│   ├── zod-validator.ts      # Zod validation middleware ported from @hono/zod-validator (~31 lines)
│   ├── type-guard.ts         # isZod, isJSONContentType, isFormContentType (~25 lines)
│   ├── helpers.ts            # addBasePathToDocument, $ cast helper (~30 lines)
│   ├── types.ts              # All TypeScript type definitions (~120 lines)
│   └── __tests__/
│       ├── create-route.test.ts
│       ├── zod-validator.test.ts
│       ├── openapi-hono.test.ts
│       └── integration.test.ts
```

## Dependencies

```jsonc
{
  "name": "@revealui/openapi",
  "version": "0.1.0",
  "description": "OpenAPI integration for Hono with Zod validation",
  "license": "MIT",
  "type": "module",
  "dependencies": {
    "@asteasolutions/zod-to-openapi": "^8.4.0",
    "openapi3-ts": "^4.5.0"
  },
  "peerDependencies": {
    "hono": ">=4.3.6",
    "zod": ">=4.0.0"
  },
  "devDependencies": {
    "@types/node": "^25.3.0",
    "dev": "workspace:*",
    "hono": "^4.12.7",
    "tsup": "^8.5.1",
    "typescript": "^5.9.3",
    "vitest": "^4.0.18",
    "zod": "catalog:"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
  "engines": {
    "node": ">=24.13.0"
  },
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=html --coverage.reporter=text",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

### `tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

### `tsconfig.json`

Extends the shared base config from `packages/dev`:

```json
{
  "extends": "../dev/src/ts/library.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/__tests__/**", "src/**/*.test.ts"]
}
```

## Source Files

### `src/openapi-hono.ts` (~100 lines)

The `OpenAPIHono` class extending Hono. Ported from upstream `index.js` lines 35-204.

Responsibilities:
- `openAPIRegistry`: collects route definitions for OpenAPI doc generation
- `.openapi(route, handler, hook?)`: validates request parts (query, params, headers, cookies, body) via zod-validator, registers route in registry, wires handler
- `.doc(path, config)` / `.doc31(path, config)`: serves generated OpenAPI v3.0/v3.1 JSON at a given path
- `.getOpenAPIDocument(config)` / `.getOpenAPI31Document(config)`: returns OpenAPI document object
- `.route(path, app)`: overrides Hono's `route()` to merge nested OpenAPIHono registries into parent
- `.basePath(path)`: overrides to maintain registry state across basePath changes
- Content-type detection for JSON and form body validation
- Optional body handling (skips validation when content-type header absent and body not required)

### `src/create-route.ts` (~15 lines)

Factory function that takes a route config object and returns it with a non-enumerable `getRoutingPath()` method that converts OpenAPI `{param}` syntax to Hono `:param` syntax.

### `src/zod-validator.ts` (~31 lines)

Ported from `@hono/zod-validator@0.7.6`. Zod validation middleware for Hono that validates request data against a Zod schema and makes validated data available via `c.req.valid(target)`.

Targets: `json`, `query`, `param`, `header`, `cookie`, `form`.

### `src/type-guard.ts` (~25 lines)

- `isZod(x)`: checks if a value is a Zod schema (has `parse`, `safeParse`, `parseAsync`, `safeParseAsync`)
- `isJSONContentType(contentType)`: regex check for `application/*json*`
- `isFormContentType(contentType)`: checks for `multipart/form-data` or `application/x-www-form-urlencoded`

### `src/helpers.ts` (~30 lines)

- `addBasePathToDocument(document, basePath)`: prepends base path to all paths in an OpenAPI document, converting Hono `:param` syntax to OpenAPI `{param}`
- `$(app)`: identity function that casts a Hono instance to OpenAPIHono type (used after chaining `.use()` which loses the OpenAPIHono type)

### `src/types.ts` (~120 lines)

All TypeScript type definitions ported from upstream `index.d.ts`. Includes:

- `RouteConfig` — extends `@asteasolutions/zod-to-openapi`'s RouteConfig with `middleware` and `hide`
- `RouteHandler<R>` — handler type inferred from route config (params, query, body, response)
- `RouteHook<R>` — validation hook type
- `OpenAPIHonoOptions<E>` — constructor options including `defaultHook`
- Input type inference helpers: `InputTypeParam`, `InputTypeQuery`, `InputTypeHeader`, `InputTypeCookie`, `InputTypeJson`, `InputTypeForm`
- Response type inference: `RouteConfigToTypedResponse<R>`
- Content type helpers: `IsJson<T>`, `IsForm<T>`
- Middleware composition types: `MiddlewareToHandlerType`, `OfHandlerType`
- Path conversion: `ConvertPathType<T>`, `RoutingPath<P>`
- Utility types: `MaybePromise`, `DeepSimplify`, `AsArray`, `HasUndefined`

## Exports

`src/index.ts` re-exports the exact same public API as `@hono/zod-openapi`:

```ts
// Class & factory
export { OpenAPIHono } from './openapi-hono.js'
export { createRoute } from './create-route.js'

// Validation middleware (ported from @hono/zod-validator)
export { zValidator } from './zod-validator.js'

// Helpers
export { $ } from './helpers.js'  // Type cast helper: restores OpenAPIHono type after .use() chains
export { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

// Zod re-export
export { z } from 'zod'

// All types
export type {
  RouteConfig, RouteHandler, RouteHook,
  OpenAPIHonoOptions, OpenAPIObjectConfigure,
  OpenAPIGeneratorOptions, OpenAPIGeneratorConfigure,
  RouteConfigToEnv, RouteConfigToTypedResponse,
  HonoToOpenAPIHono, Hook, DeepSimplify,
  MiddlewareToHandlerType, OfHandlerType,
} from './types.js'
```

## Testing

### `create-route.test.ts` (~10 tests)

- Route config passthrough: method, path, tags, summary, description, request, responses all preserved
- `getRoutingPath()` converts `/{id}` → `/:id`, `/{orgId}/members/{userId}` → `/:orgId/members/:userId`
- `getRoutingPath` is non-enumerable (does not appear in `Object.keys()` or JSON serialization)
- Handles paths with no parameters (returns path unchanged)

### `zod-validator.test.ts` (~8 tests)

- Validates JSON body against schema, passes validated data to handler
- Returns 400 with ZodError details on invalid JSON body
- Validates query parameters with coercion (string → number)
- Validates path parameters
- Validates headers
- Custom hook receives validation result and can override error response
- Missing required body returns validation error

### `openapi-hono.test.ts` (~15 tests)

- `.openapi(route, handler)` registers route in `openAPIRegistry`
- `.openapi()` wires query, param, header validators from route config
- `.openapi()` wires JSON body validator when request body has `application/json`
- `.openapi()` wires form body validator when request body has `multipart/form-data`
- `.openapi()` skips body validation when content-type absent and body not required
- `.openapi()` with `hide: true` does not register route in registry
- `.openapi()` with per-route middleware applies middleware before validators
- `.doc('/path', config)` returns generated OpenAPI 3.0 JSON
- `.doc31('/path', config)` returns generated OpenAPI 3.1 JSON
- `.doc()` with function config receives Hono context
- `.route(path, subApp)` merges sub-app registry definitions into parent
- `.route()` prepends path to nested route definitions
- `.route()` with non-OpenAPIHono sub-app works without registry merge
- `.basePath(path)` returns new OpenAPIHono with prefixed paths in spec
- `defaultHook` applies to all routes when no per-route hook specified

### `integration.test.ts` (~5 tests)

- Full round-trip: define 3 routes → register → `.getOpenAPIDocument()` → validate OpenAPI structure has all paths, methods, schemas
- Nested apps: parent + 2 sub-apps with different base paths → spec contains all routes with correct path prefixes
- Request validation end-to-end: send invalid JSON → 400, send valid JSON → 200 with correct response
- Named schemas (`.openapi('SchemaName')`) appear in `components.schemas` section of generated doc
- Parity check: same route definitions produce equivalent OpenAPI output as `@hono/zod-openapi` (run both, deep-equal the generated specs). Note: requires `@hono/zod-openapi` as a temporary devDependency — remove after initial validation succeeds.

## Migration

### Step 1: Build the package

Create `packages/openapi/` with all source files. Port upstream JS to clean TypeScript. Write all tests. Verify build and typecheck.

### Step 2: Migrate `apps/api`

Find-and-replace across 32 files:
```
from '@hono/zod-openapi'   →  from '@revealui/openapi'   (31 files)
from '@hono/zod-validator'  →  from '@revealui/openapi'   (1 file: terminal-auth.ts)
```

Update `apps/api/package.json`:
- Add `"@revealui/openapi": "workspace:*"`
- Remove `"@hono/zod-openapi"`
- Remove `"@hono/zod-validator"`

### Step 3: Verify

```bash
pnpm --filter @revealui/openapi test     # Package tests pass
pnpm --filter api typecheck               # No type regressions
pnpm --filter api test                    # Existing API tests pass
pnpm gate                                 # Full CI green
```

### Step 4: Cleanup

- Remove `@hono/zod-openapi` and `@hono/zod-validator` from monorepo
- `pnpm install` to clean lockfile
- Update workboard — remove "API schema: zod version mismatch" blocker

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Type inference regression in API routes | Low | Parity test compares output with upstream. 272 existing `.openapi()` calls are the integration test. |
| Missing edge case in ported code | Low | Upstream source is 234 lines with no complex algorithms. Line-by-line port. |
| `@asteasolutions/zod-to-openapi` breaks on zod upgrade | Low | We pin via peerDependencies. They track zod releases actively. |
| Maintenance burden | Negligible | 265 lines of stable glue code. Upstream has had 2 releases in 6 months. |
| `zod-to-openapi` lags behind future Zod major | Low | They actively track Zod releases. If they lag, we can fork then — but not preemptively. |

## Non-Goals

- Forking `@asteasolutions/zod-to-openapi` (1,727 lines, actively maintained, no customization needed)
- Forking `openapi3-ts` (standard spec types, transitive dep of zod-to-openapi)
- Moving API helper schemas (`ErrorSchema`, `IdParam`, `PaginationQuery`) into this package
- Adding RevealUI-specific features in v0.1.0 (pure port first, enhancements later)
- Response runtime validation (spec-only, not enforced — matches upstream behavior)
