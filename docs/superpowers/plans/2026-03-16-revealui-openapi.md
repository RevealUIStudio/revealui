# @revealui/openapi Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `@hono/zod-openapi` and `@hono/zod-validator` into an owned monorepo package `@revealui/openapi`, then migrate `apps/api` to use it.

**Architecture:** Clean TypeScript rewrite of 265 lines of upstream glue code across 7 source files. Same API surface as `@hono/zod-openapi` — drop-in replacement. Depends on `@asteasolutions/zod-to-openapi` for the heavy schema→OpenAPI transformation. Zod and Hono are peer deps.

**Tech Stack:** TypeScript 5.9, Hono 4.12, Zod 4.3, tsup, Vitest 4

**Spec:** `docs/superpowers/specs/2026-03-16-revealui-openapi-design.md`

---

## Chunk 1: Package Foundation

### Task 1: Scaffold package

**Files:**
- Create: `packages/openapi/package.json`
- Create: `packages/openapi/tsconfig.json`
- Create: `packages/openapi/tsup.config.ts`
- Create: `packages/openapi/vitest.config.ts`

- [ ] **Step 1: Create `packages/openapi/package.json`**

```json
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
  "engines": {
    "node": ">=24.13.0"
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

- [ ] **Step 2: Create `packages/openapi/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/openapi/tsup.config.ts`**

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

- [ ] **Step 4: Create `packages/openapi/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
```

- [ ] **Step 5: Create placeholder `packages/openapi/src/index.ts`**

```ts
// @revealui/openapi — placeholder, built out in subsequent tasks
export {};
```

- [ ] **Step 6: Install dependencies and verify scaffold**

Run: `pnpm install`
Run: `pnpm --filter @revealui/openapi build`
Expected: Clean build, `dist/index.js` and `dist/index.d.ts` created.

- [ ] **Step 7: Commit**

```bash
git add packages/openapi/
git commit -m "chore(openapi): scaffold @revealui/openapi package"
```

---

### Task 2: Type guards

**Files:**
- Create: `packages/openapi/src/type-guard.ts`
- Create: `packages/openapi/src/__tests__/type-guard.test.ts`

- [ ] **Step 1: Write failing tests for type guards**

Create `packages/openapi/src/__tests__/type-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isFormContentType, isJSONContentType, isZod } from '../type-guard.js';

describe('isZod', () => {
  it('returns true for a Zod schema', () => {
    expect(isZod(z.string())).toBe(true);
  });

  it('returns true for a Zod object schema', () => {
    expect(isZod(z.object({ name: z.string() }))).toBe(true);
  });

  it('returns false for null', () => {
    expect(isZod(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isZod(undefined)).toBe(false);
  });

  it('returns false for a plain object', () => {
    expect(isZod({ parse: 'not a function' })).toBe(false);
  });

  it('returns false for a number', () => {
    expect(isZod(42)).toBe(false);
  });
});

describe('isJSONContentType', () => {
  it('matches application/json', () => {
    expect(isJSONContentType('application/json')).toBe(true);
  });

  it('matches application/vnd.api+json', () => {
    expect(isJSONContentType('application/vnd.api+json')).toBe(true);
  });

  it('matches application/json; charset=utf-8', () => {
    expect(isJSONContentType('application/json; charset=utf-8')).toBe(true);
  });

  it('does not match text/plain', () => {
    expect(isJSONContentType('text/plain')).toBe(false);
  });

  it('does not match multipart/form-data', () => {
    expect(isJSONContentType('multipart/form-data')).toBe(false);
  });
});

describe('isFormContentType', () => {
  it('matches multipart/form-data', () => {
    expect(isFormContentType('multipart/form-data')).toBe(true);
  });

  it('matches application/x-www-form-urlencoded', () => {
    expect(isFormContentType('application/x-www-form-urlencoded')).toBe(true);
  });

  it('matches multipart/form-data with boundary', () => {
    expect(isFormContentType('multipart/form-data; boundary=----WebKitFormBoundary')).toBe(true);
  });

  it('does not match application/json', () => {
    expect(isFormContentType('application/json')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/openapi test`
Expected: FAIL — module `../type-guard.js` not found.

- [ ] **Step 3: Implement type guards**

Create `packages/openapi/src/type-guard.ts`:

```ts
/**
 * Checks if a value is a Zod schema by duck-typing its core methods.
 */
export function isZod(x: unknown): boolean {
  if (!x) return false;
  if (typeof x !== 'object') return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.parse === 'function' &&
    typeof obj.safeParse === 'function' &&
    typeof obj.parseAsync === 'function' &&
    typeof obj.safeParseAsync === 'function'
  );
}

/**
 * Checks if a content type string represents JSON.
 * Matches: application/json, application/vnd.api+json, etc.
 */
export function isJSONContentType(contentType: string): boolean {
  return /^application\/([a-z-\.]+\+)?json/.test(contentType);
}

/**
 * Checks if a content type string represents form data.
 * Matches: multipart/form-data, application/x-www-form-urlencoded
 */
export function isFormContentType(contentType: string): boolean {
  return (
    contentType.startsWith('multipart/form-data') ||
    contentType.startsWith('application/x-www-form-urlencoded')
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @revealui/openapi test`
Expected: All 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/openapi/src/type-guard.ts packages/openapi/src/__tests__/type-guard.test.ts
git commit -m "feat(openapi): add type guard utilities"
```

---

### Task 3: createRoute factory

**Files:**
- Create: `packages/openapi/src/create-route.ts`
- Create: `packages/openapi/src/__tests__/create-route.test.ts`

- [ ] **Step 1: Write failing tests for createRoute**

Create `packages/openapi/src/__tests__/create-route.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRoute } from '../create-route.js';

describe('createRoute', () => {
  it('preserves all route config properties', () => {
    const route = createRoute({
      method: 'get',
      path: '/users',
      tags: ['users'],
      summary: 'List users',
      description: 'Returns all users',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ users: z.array(z.string()) }),
            },
          },
          description: 'Success',
        },
      },
    });

    expect(route.method).toBe('get');
    expect(route.path).toBe('/users');
    expect(route.tags).toEqual(['users']);
    expect(route.summary).toBe('List users');
    expect(route.description).toBe('Returns all users');
    expect(route.responses).toBeDefined();
  });

  it('converts {param} to :param in getRoutingPath', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      responses: { 200: { description: 'OK' } },
    });

    expect(route.getRoutingPath()).toBe('/users/:id');
  });

  it('converts multiple params in getRoutingPath', () => {
    const route = createRoute({
      method: 'get',
      path: '/orgs/{orgId}/members/{userId}',
      responses: { 200: { description: 'OK' } },
    });

    expect(route.getRoutingPath()).toBe('/orgs/:orgId/members/:userId');
  });

  it('returns path unchanged when no params', () => {
    const route = createRoute({
      method: 'get',
      path: '/health',
      responses: { 200: { description: 'OK' } },
    });

    expect(route.getRoutingPath()).toBe('/health');
  });

  it('makes getRoutingPath non-enumerable', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      responses: { 200: { description: 'OK' } },
    });

    expect(Object.keys(route)).not.toContain('getRoutingPath');
  });

  it('getRoutingPath does not appear in JSON serialization', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      responses: { 200: { description: 'OK' } },
    });

    const json = JSON.parse(JSON.stringify(route));
    expect(json.getRoutingPath).toBeUndefined();
  });

  it('preserves request config with params and body', () => {
    const route = createRoute({
      method: 'post',
      path: '/users/{id}',
      request: {
        params: z.object({ id: z.string() }),
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
        },
      },
      responses: { 201: { description: 'Created' } },
    });

    expect(route.request).toBeDefined();
    expect(route.request?.params).toBeDefined();
    expect(route.request?.body).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/openapi test`
Expected: FAIL — module `../create-route.js` not found.

- [ ] **Step 3: Implement createRoute**

Create `packages/openapi/src/create-route.ts`:

```ts
import type { RouteConfig, RoutingPath } from './types.js';

/**
 * Creates a route definition with a non-enumerable `getRoutingPath()` method
 * that converts OpenAPI `{param}` syntax to Hono `:param` syntax.
 */
export const createRoute = <
  P extends string,
  R extends Omit<RouteConfig, 'path'> & { path: P },
>(
  routeConfig: R,
): R & { getRoutingPath(): RoutingPath<R['path']> } => {
  const route = {
    ...routeConfig,
    getRoutingPath() {
      return routeConfig.path.replaceAll(/\/{(.+?)}/g, '/:$1') as RoutingPath<R['path']>;
    },
  };
  return Object.defineProperty(route, 'getRoutingPath', {
    enumerable: false,
  });
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @revealui/openapi test`
Expected: All tests PASS (type-guard + create-route).

- [ ] **Step 5: Commit**

```bash
git add packages/openapi/src/create-route.ts packages/openapi/src/__tests__/create-route.test.ts
git commit -m "feat(openapi): add createRoute factory"
```

---

## Chunk 2: Validator, Helpers, Types

### Task 4: Zod validator middleware

**Files:**
- Create: `packages/openapi/src/zod-validator.ts`
- Create: `packages/openapi/src/__tests__/zod-validator.test.ts`

- [ ] **Step 1: Write failing tests for zod validator**

Create `packages/openapi/src/__tests__/zod-validator.test.ts`:

```ts
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zValidator } from '../zod-validator.js';

describe('zValidator', () => {
  it('validates JSON body and passes data to handler', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post('/test', zValidator('json', schema), (c) => {
      const data = c.req.valid('json');
      return c.json({ received: data.name });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 'Alice' });
  });

  it('returns 400 on invalid JSON body', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post('/test', zValidator('json', schema), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });

    expect(res.status).toBe(400);
  });

  it('validates query parameters', async () => {
    const app = new Hono();
    const schema = z.object({ page: z.coerce.number() });

    app.get('/test', zValidator('query', schema), (c) => {
      const data = c.req.valid('query');
      return c.json({ page: data.page });
    });

    const res = await app.request('/test?page=3');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 3 });
  });

  it('validates path parameters', async () => {
    const app = new Hono();
    const schema = z.object({ id: z.string() });

    app.get('/users/:id', zValidator('param', schema), (c) => {
      const data = c.req.valid('param');
      return c.json({ id: data.id });
    });

    const res = await app.request('/users/abc123');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'abc123' });
  });

  it('validates headers (case-insensitive key mapping)', async () => {
    const app = new Hono();
    const schema = z.object({ 'x-api-key': z.string() });

    app.get('/test', zValidator('header', schema), (c) => {
      const data = c.req.valid('header');
      return c.json({ key: data['x-api-key'] });
    });

    const res = await app.request('/test', {
      headers: { 'X-API-Key': 'secret123' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ key: 'secret123' });
  });

  it('invokes custom hook on validation failure', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post(
      '/test',
      zValidator('json', schema, (result, c) => {
        if (!result.success) {
          return c.json({ custom: 'error' }, 422);
        }
      }),
      (c) => {
        return c.json({ ok: true });
      },
    );

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ custom: 'error' });
  });

  it('invokes custom hook on validation success', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post(
      '/test',
      zValidator('json', schema, (result, c) => {
        if (result.success) {
          // Hook does nothing on success — falls through to handler
        }
      }),
      (c) => {
        const data = c.req.valid('json');
        return c.json({ received: data.name });
      },
    );

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 'Bob' });
  });

  it('returns 400 when required body is missing', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post('/test', zValidator('json', schema), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/openapi test`
Expected: FAIL — module `../zod-validator.js` not found.

- [ ] **Step 3: Implement zod validator**

Create `packages/openapi/src/zod-validator.ts`:

Ported from `@hono/zod-validator@0.7.6`. The core is a Hono `validator()` middleware wrapper that runs Zod `safeParseAsync` on the request data.

```ts
import type { Context, Env, Input, MiddlewareHandler, ValidationTargets } from 'hono';
import { validator } from 'hono/validator';
import type { ZodType } from 'zod';

type Hook<T, E extends Env, P extends string> = (
  result: ({ success: true; data: T } | { success: false; error: unknown; data: T }) & {
    target: keyof ValidationTargets;
  },
  c: Context<E, P>,
) => Response | void | Promise<Response | void>;

/**
 * Zod validation middleware for Hono.
 * Validates request data against a Zod schema and makes validated data
 * available via `c.req.valid(target)`.
 *
 * Ported from @hono/zod-validator@0.7.6
 */
interface ZodValidatorOptions<T extends ZodType> {
  validationFunction?: (schema: T, value: unknown) => Promise<{ success: boolean; data?: unknown; error?: unknown }> | { success: boolean; data?: unknown; error?: unknown };
}

export function zValidator<
  T extends ZodType,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
>(
  target: Target,
  schema: T,
  hook?: Hook<unknown, E, P>,
  options?: ZodValidatorOptions<T>,
): MiddlewareHandler<E, P, Input> {
  return validator(target, async (value: unknown, c: Context) => {
    let validatorValue = value;

    // Header keys are case-insensitive — map them to schema's expected casing
    if (target === 'header' && isZodObject(schema)) {
      const schemaKeys = getSchemaKeys(schema);
      const caseInsensitiveKeymap = Object.fromEntries(
        schemaKeys.map((key) => [key.toLowerCase(), key]),
      );
      validatorValue = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, val]) => [
          caseInsensitiveKeymap[key] ?? key,
          val,
        ]),
      );
    }

    const result = options?.validationFunction
      ? await options.validationFunction(schema, validatorValue)
      : await schema.safeParseAsync(validatorValue);

    if (hook) {
      const hookResult = await hook(
        { data: validatorValue, ...result, target } as Parameters<typeof hook>[0],
        c as Parameters<typeof hook>[1],
      );
      if (hookResult) {
        if (hookResult instanceof Response) return hookResult;
        if ('response' in hookResult) return (hookResult as { response: Response }).response;
      }
    }

    if (!result.success) {
      return c.json(result, 400);
    }

    return result.data;
  }) as unknown as MiddlewareHandler<E, P, Input>;
}

/** Duck-type check for Zod object schema (has .shape or .in.shape) */
function isZodObject(schema: ZodType): boolean {
  const s = schema as Record<string, unknown>;
  return '_def' in s || '_zod' in s;
}

/** Extract keys from a Zod object schema */
function getSchemaKeys(schema: ZodType): string[] {
  const s = schema as Record<string, unknown>;
  if ('in' in s && s.in && typeof s.in === 'object' && 'shape' in (s.in as object)) {
    return Object.keys((s.in as { shape: Record<string, unknown> }).shape);
  }
  if ('shape' in s && s.shape && typeof s.shape === 'object') {
    return Object.keys(s.shape as Record<string, unknown>);
  }
  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @revealui/openapi test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/openapi/src/zod-validator.ts packages/openapi/src/__tests__/zod-validator.test.ts
git commit -m "feat(openapi): add zod validator middleware"
```

---

### Task 5: Helpers

**Files:**
- Create: `packages/openapi/src/helpers.ts`
- Create: `packages/openapi/src/__tests__/helpers.test.ts`

- [ ] **Step 1: Write failing tests for helpers**

Create `packages/openapi/src/__tests__/helpers.test.ts`:

```ts
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { describe, expect, it } from 'vitest';
import { $, addBasePathToDocument } from '../helpers.js';

describe('addBasePathToDocument', () => {
  const makeDoc = (paths: Record<string, unknown>): OpenAPIObject =>
    ({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths,
    }) as OpenAPIObject;

  it('prepends base path to all document paths', () => {
    const doc = makeDoc({
      '/users': { get: {} },
      '/posts': { get: {} },
    });

    const result = addBasePathToDocument(doc, '/api/v1');

    expect(Object.keys(result.paths)).toEqual(['/api/v1/users', '/api/v1/posts']);
  });

  it('converts Hono :param syntax to OpenAPI {param} in base path', () => {
    const doc = makeDoc({
      '/members': { get: {} },
    });

    const result = addBasePathToDocument(doc, '/orgs/:orgId');

    expect(Object.keys(result.paths)).toEqual(['/orgs/{orgId}/members']);
  });

  it('preserves all other document properties', () => {
    const doc = makeDoc({ '/test': { get: {} } });

    const result = addBasePathToDocument(doc, '/api');

    expect(result.openapi).toBe('3.0.0');
    expect(result.info).toEqual({ title: 'Test', version: '1.0.0' });
  });

  it('handles empty paths object', () => {
    const doc = makeDoc({});

    const result = addBasePathToDocument(doc, '/api');

    expect(result.paths).toEqual({});
  });
});

describe('$', () => {
  it('returns the same object (identity function)', () => {
    const obj = { test: true };

    expect($(obj)).toBe(obj);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/openapi test`
Expected: FAIL — module `../helpers.js` not found.

- [ ] **Step 3: Implement helpers**

Create `packages/openapi/src/helpers.ts`:

```ts
import type { Hono } from 'hono';
import { mergePath } from 'hono/utils/url';
import type { OpenAPIObject } from 'openapi3-ts/oas30';

import type { HonoToOpenAPIHono } from './types.js';

/**
 * Prepends a base path to all paths in an OpenAPI document.
 * Converts Hono `:param` syntax to OpenAPI `{param}` in the base path.
 */
export function addBasePathToDocument(
  document: OpenAPIObject,
  basePath: string,
): OpenAPIObject {
  const updatedPaths: Record<string, unknown> = {};

  for (const path of Object.keys(document.paths)) {
    const newPath = mergePath(basePath.replaceAll(/:([^/]+)/g, '{$1}'), path);
    updatedPaths[newPath] = document.paths[path];
  }

  return {
    ...document,
    paths: updatedPaths,
  };
}

/**
 * Identity function that casts a Hono instance to OpenAPIHono type.
 * Use after chaining methods like `.use()` which lose the OpenAPIHono type.
 *
 * @example
 * ```ts
 * const app = $(new OpenAPIHono().use(middleware))
 * app.openapi(route, handler) // type-safe
 * ```
 */
export const $ = <T extends Hono<any, any, any>>(app: T): HonoToOpenAPIHono<T> => {
  return app as HonoToOpenAPIHono<T>;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @revealui/openapi test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/openapi/src/helpers.ts packages/openapi/src/__tests__/helpers.test.ts
git commit -m "feat(openapi): add helper utilities"
```

---

### Task 6: TypeScript type definitions

**Files:**
- Create: `packages/openapi/src/types.ts`

No tests for this file — it's pure type definitions. Correctness is verified by typecheck and by the integration tests in Task 8.

- [ ] **Step 1: Create types file**

Create `packages/openapi/src/types.ts`:

Port all type definitions from the upstream `@hono/zod-openapi/dist/index.d.ts`. These are the type-level inference helpers that make `createRoute` + `app.openapi()` fully type-safe.

```ts
import type {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  RouteConfig as BaseRouteConfig,
  ZodContentObject,
  ZodMediaTypeObject,
  ZodRequestBody,
} from '@asteasolutions/zod-to-openapi';
import type {
  Context,
  Env,
  ErrorHandler,
  Handler,
  Hono,
  Input,
  MiddlewareHandler,
  NotFoundHandler,
  Schema,
  ToSchema,
  TypedResponse,
  ValidationTargets,
} from 'hono';
import type { H, MergePath, MergeSchemaPath } from 'hono/types';
import type {
  ClientErrorStatusCode,
  InfoStatusCode,
  RedirectStatusCode,
  ServerErrorStatusCode,
  StatusCode,
  SuccessStatusCode,
} from 'hono/utils/http-status';
import type { JSONParsed, RemoveBlankRecord } from 'hono/utils/types';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import type { OpenAPIObject as OpenAPIObject31 } from 'openapi3-ts/oas31';
import type { ZodError, ZodType, z } from 'zod';

// ---------------------------------------------------------------------------
// Route config
// ---------------------------------------------------------------------------

export type RouteConfig = BaseRouteConfig & {
  middleware?: H | H[];
  hide?: boolean;
};

export interface RequestTypes {
  body?: ZodRequestBody;
  params?: ZodType;
  query?: ZodType;
  cookies?: ZodType;
  headers?: ZodType | ZodType[];
}

// ---------------------------------------------------------------------------
// Content-type inference
// ---------------------------------------------------------------------------

export type IsJson<T> = T extends string
  ? T extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? 'json'
      : never
    : never
  : never;

export type IsForm<T> = T extends string
  ? T extends
      | `multipart/form-data${infer _Rest}`
      | `application/x-www-form-urlencoded${infer _Rest}`
    ? 'form'
    : never
  : never;

// ---------------------------------------------------------------------------
// Status code helpers
// ---------------------------------------------------------------------------

export interface StatusCodeRangeDefinitions {
  '1XX': InfoStatusCode;
  '2XX': SuccessStatusCode;
  '3XX': RedirectStatusCode;
  '4XX': ClientErrorStatusCode;
  '5XX': ServerErrorStatusCode;
}

export type RouteConfigStatusCode = keyof StatusCodeRangeDefinitions | StatusCode;

export type ExtractStatusCode<T extends RouteConfigStatusCode> =
  T extends keyof StatusCodeRangeDefinitions ? StatusCodeRangeDefinitions[T] : T;

// ---------------------------------------------------------------------------
// Input type inference
// ---------------------------------------------------------------------------

export type MaybePromise<T> = Promise<T> | T;

export type HasUndefined<T> = undefined extends T ? true : false;

type RequestPart<R extends RouteConfig, Part extends string> = Part extends keyof R['request']
  ? R['request'][Part]
  : object;

type InputTypeBase<
  R extends RouteConfig,
  Part extends string,
  Type extends keyof ValidationTargets,
> = R['request'] extends RequestTypes
  ? RequestPart<R, Part> extends ZodType
    ? {
        in: {
          [K in Type]: HasUndefined<ValidationTargets[K]> extends true
            ? { [K2 in keyof z.input<RequestPart<R, Part>>]?: z.input<RequestPart<R, Part>>[K2] }
            : { [K2 in keyof z.input<RequestPart<R, Part>>]: z.input<RequestPart<R, Part>>[K2] };
        };
        out: { [K in Type]: z.output<RequestPart<R, Part>> };
      }
    : object
  : object;

export type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, 'params', 'param'>;
export type InputTypeQuery<R extends RouteConfig> = InputTypeBase<R, 'query', 'query'>;
export type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, 'headers', 'header'>;
export type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, 'cookies', 'cookie'>;

export type InputTypeJson<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends ZodContentObject
      ? IsJson<keyof R['request']['body']['content']> extends never
        ? object
        : R['request']['body']['content'][keyof R['request']['body']['content']] extends Record<
              'schema',
              ZodType<any>
            >
          ? {
              in: {
                json: z.input<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
              out: {
                json: z.output<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
            }
          : object
      : object
    : object
  : object;

export type InputTypeForm<R extends RouteConfig> = R['request'] extends RequestTypes
  ? R['request']['body'] extends ZodRequestBody
    ? R['request']['body']['content'] extends ZodContentObject
      ? IsForm<keyof R['request']['body']['content']> extends never
        ? object
        : R['request']['body']['content'][keyof R['request']['body']['content']] extends Record<
              'schema',
              ZodType<any>
            >
          ? {
              in: {
                form: z.input<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
              out: {
                form: z.output<
                  R['request']['body']['content'][keyof R['request']['body']['content']]['schema']
                >;
              };
            }
          : object
      : object
    : object
  : object;

// ---------------------------------------------------------------------------
// Response type inference
// ---------------------------------------------------------------------------

type ExtractContent<T> = T extends { [K in keyof T]: infer A }
  ? A extends Record<'schema', ZodType>
    ? z.infer<A['schema']>
    : never
  : never;

type ReturnJsonOrTextOrResponse<
  ContentType,
  Content,
  Status extends keyof StatusCodeRangeDefinitions | StatusCode,
> = ContentType extends string
  ? ContentType extends `application/${infer Start}json${infer _End}`
    ? Start extends '' | `${string}+` | `vnd.${string}+`
      ? TypedResponse<JSONParsed<Content>, ExtractStatusCode<Status>, 'json'>
      : never
    : ContentType extends `text/plain${infer _Rest}`
      ? TypedResponse<Content, ExtractStatusCode<Status>, 'text'>
      : Response
  : never;

type DefinedStatusCodes<R extends RouteConfig> = keyof R['responses'] & RouteConfigStatusCode;

export type RouteConfigToTypedResponse<R extends RouteConfig> =
  | {
      [Status in DefinedStatusCodes<R>]: R['responses'][Status] extends { content: infer Content }
        ? undefined extends Content
          ? never
          : ReturnJsonOrTextOrResponse<
              keyof R['responses'][Status]['content'],
              ExtractContent<R['responses'][Status]['content']>,
              Status
            >
        : TypedResponse<object, ExtractStatusCode<Status>, string>;
    }[DefinedStatusCodes<R>]
  | ('default' extends keyof R['responses']
      ? R['responses']['default'] extends { content: infer Content }
        ? undefined extends Content
          ? never
          : ReturnJsonOrTextOrResponse<
              keyof Content,
              ExtractContent<Content>,
              Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>
            >
        : TypedResponse<
            object,
            Exclude<StatusCode, ExtractStatusCode<DefinedStatusCodes<R>>>,
            string
          >
      : never);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type Hook<T, E extends Env, P extends string, R> = (
  result: { target: keyof ValidationTargets } & (
    | { success: true; data: T }
    | { success: false; error: ZodError }
  ),
  c: Context<E, P>,
) => R;

// ---------------------------------------------------------------------------
// Middleware composition
// ---------------------------------------------------------------------------

export type AsArray<T> = T extends undefined ? [] : T extends unknown[] ? T : [T];

export type DeepSimplify<T> = {
  [KeyType in keyof T]: T[KeyType] extends Record<string, unknown>
    ? DeepSimplify<T[KeyType]>
    : T[KeyType];
} & object;

export type OfHandlerType<T extends MiddlewareHandler> = T extends MiddlewareHandler<
  infer E,
  infer P,
  infer I
>
  ? { env: E; path: P; input: I }
  : never;

export type MiddlewareToHandlerType<M extends MiddlewareHandler<any, any, any>[]> = M extends [
  infer First,
  infer Second,
  ...infer Rest,
]
  ? First extends MiddlewareHandler<any, any, any>
    ? Second extends MiddlewareHandler<any, any, any>
      ? Rest extends MiddlewareHandler<any, any, any>[]
        ? MiddlewareToHandlerType<
            [
              MiddlewareHandler<
                DeepSimplify<OfHandlerType<First>['env'] & OfHandlerType<Second>['env']>,
                OfHandlerType<First>['path'],
                OfHandlerType<First>['input']
              >,
              ...Rest,
            ]
          >
        : never
      : never
    : never
  : M extends [infer Last]
    ? Last
    : MiddlewareHandler<Env>;

type RouteMiddlewareParams<R extends RouteConfig> = OfHandlerType<
  MiddlewareToHandlerType<AsArray<R['middleware']>>
>;

export type RouteConfigToEnv<R extends RouteConfig> = RouteMiddlewareParams<R> extends never
  ? Env
  : RouteMiddlewareParams<R>['env'];

// ---------------------------------------------------------------------------
// Path conversion
// ---------------------------------------------------------------------------

export type ConvertPathType<T extends string> =
  T extends `${infer Start}/{${infer Param}}${infer Rest}`
    ? `${Start}/:${Param}${ConvertPathType<Rest>}`
    : T;

export type RoutingPath<P extends string> =
  P extends `${infer Head}/{${infer Param}}${infer Tail}`
    ? `${Head}/:${Param}${RoutingPath<Tail>}`
    : P;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export type RouteHandler<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>,
> = Handler<
  E,
  P,
  I,
  R extends {
    responses: {
      [statusCode: number]: { content: { [mediaType: string]: ZodMediaTypeObject } };
    };
  }
    ? MaybePromise<RouteConfigToTypedResponse<R>>
    : MaybePromise<RouteConfigToTypedResponse<R>> | MaybePromise<Response>
>;

export type RouteHook<
  R extends RouteConfig,
  E extends Env = RouteConfigToEnv<R>,
  I extends Input = InputTypeParam<R> &
    InputTypeQuery<R> &
    InputTypeHeader<R> &
    InputTypeCookie<R> &
    InputTypeForm<R> &
    InputTypeJson<R>,
  P extends string = ConvertPathType<R['path']>,
> = Hook<
  I,
  E,
  P,
  | RouteConfigToTypedResponse<R>
  | Response
  | Promise<Response>
  | void
  | Promise<void>
>;

// ---------------------------------------------------------------------------
// OpenAPI config
// ---------------------------------------------------------------------------

export type OpenAPIObjectConfig = Parameters<
  InstanceType<typeof OpenApiGeneratorV3>['generateDocument']
>[0];

export type OpenAPIObjectConfigure<E extends Env, P extends string> =
  | OpenAPIObjectConfig
  | ((context: Context<E, P>) => OpenAPIObjectConfig);

export type OpenAPIGeneratorOptions = ConstructorParameters<typeof OpenApiGeneratorV3>[1];

export type OpenAPIGeneratorConfigure<E extends Env, P extends string> =
  | OpenAPIGeneratorOptions
  | ((context: Context<E, P>) => OpenAPIGeneratorOptions);

// ---------------------------------------------------------------------------
// OpenAPIHono options
// ---------------------------------------------------------------------------

export interface OpenAPIHonoOptions<E extends Env> {
  defaultHook?: Hook<any, E, any, any>;
}

export type HonoInit<E extends Env> = ConstructorParameters<typeof Hono>[0] &
  OpenAPIHonoOptions<E>;

export type HonoToOpenAPIHono<T> = T extends Hono<infer E, infer S, infer B>
  ? import('./openapi-hono.js').OpenAPIHono<E, S, B>
  : T;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm --filter @revealui/openapi typecheck`
Expected: Clean — no type errors.

- [ ] **Step 3: Commit**

```bash
git add packages/openapi/src/types.ts
git commit -m "feat(openapi): add TypeScript type definitions"
```

---

## Chunk 3: OpenAPIHono Class, Index, Integration

### Task 7: OpenAPIHono class

**Files:**
- Create: `packages/openapi/src/openapi-hono.ts`
- Create: `packages/openapi/src/__tests__/openapi-hono.test.ts`

- [ ] **Step 1: Write failing tests for OpenAPIHono**

Create `packages/openapi/src/__tests__/openapi-hono.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRoute } from '../create-route.js';
import { OpenAPIHono } from '../openapi-hono.js';

describe('OpenAPIHono', () => {
  it('creates an instance with an empty registry', () => {
    const app = new OpenAPIHono();
    expect(app.openAPIRegistry).toBeDefined();
    expect(app.openAPIRegistry.definitions).toEqual([]);
  });

  it('registers a route in the registry via .openapi()', () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const registered = app.openAPIRegistry.definitions.filter((d) => d.type === 'route');
    expect(registered).toHaveLength(1);
  });

  it('does not register route when hide is true', () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/hidden',
      hide: true,
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const registered = app.openAPIRegistry.definitions.filter((d) => d.type === 'route');
    expect(registered).toHaveLength(0);
  });

  it('validates query params from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      request: {
        query: z.object({ page: z.coerce.number() }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const { page } = c.req.valid('query');
      return c.json({ page });
    });

    const res = await app.request('/test?page=5');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 5 });
  });

  it('returns 400 on invalid query params', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      request: {
        query: z.object({ page: z.coerce.number().min(1) }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const res = await app.request('/test?page=0');
    expect(res.status).toBe(400);
  });

  it('validates JSON body from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'post',
      path: '/test',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          required: true,
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const body = c.req.valid('json');
      return c.json({ received: body.name });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 'Alice' });
  });

  it('skips body validation when content-type absent and body not required', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'post',
      path: '/test',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          // required is NOT set (defaults to false)
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      return c.json({ ok: true });
    });

    // Send request with no content-type and no body
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('generates OpenAPI 3.0 document via .doc()', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/users',
      tags: ['users'],
      summary: 'List users',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ users: z.array(z.string()) }),
            },
          },
          description: 'Success',
        },
      },
    });

    app.openapi(route, (c) => c.json({ users: [] }));
    app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } });

    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);

    const doc = await res.json();
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info.title).toBe('Test');
    expect(doc.paths['/users']).toBeDefined();
    expect(doc.paths['/users'].get).toBeDefined();
    expect(doc.paths['/users'].get.tags).toEqual(['users']);
  });

  it('merges sub-app registries via .route()', async () => {
    const parent = new OpenAPIHono();
    const child = new OpenAPIHono();

    const childRoute = createRoute({
      method: 'get',
      path: '/items',
      responses: { 200: { description: 'OK' } },
    });

    child.openapi(childRoute, (c) => c.json({ items: [] }));
    parent.route('/api', child);

    parent.doc('/openapi.json', {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
    });

    const res = await parent.request('/openapi.json');
    const doc = await res.json();

    expect(doc.paths['/api/items']).toBeDefined();
  });

  it('works with non-OpenAPIHono sub-app', async () => {
    const { Hono } = await import('hono');
    const parent = new OpenAPIHono();
    const child = new Hono();

    child.get('/plain', (c) => c.json({ ok: true }));

    // Should not throw — Hono sub-app works, just no registry merge
    parent.route('/legacy', child);

    expect(parent.openAPIRegistry.definitions).toHaveLength(0);
  });

  it('preserves basePath in generated spec', async () => {
    const app = new OpenAPIHono().basePath('/api/v1');

    const route = createRoute({
      method: 'get',
      path: '/health',
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ status: 'ok' }));
    app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } });

    const res = await app.request('/api/v1/openapi.json');
    const doc = await res.json();

    expect(doc.paths['/api/v1/health']).toBeDefined();
  });

  it('applies defaultHook to all routes', async () => {
    const app = new OpenAPIHono({
      defaultHook: (result, c) => {
        if (!result.success) {
          return c.json({ defaultError: true }, 422);
        }
      },
    });

    const route = createRoute({
      method: 'post',
      path: '/test',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          required: true,
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ defaultError: true });
  });

  it('applies per-route middleware before validators', async () => {
    const app = new OpenAPIHono();
    const order: string[] = [];

    const route = createRoute({
      method: 'get',
      path: '/test',
      middleware: [
        async (c: any, next: any) => {
          order.push('middleware');
          await next();
        },
      ] as any,
      request: {
        query: z.object({ q: z.string() }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      order.push('handler');
      return c.json({ order });
    });

    await app.request('/test?q=hello');

    expect(order).toEqual(['middleware', 'handler']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @revealui/openapi test`
Expected: FAIL — module `../openapi-hono.js` not found.

- [ ] **Step 3: Implement OpenAPIHono class**

Create `packages/openapi/src/openapi-hono.ts`:

```ts
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
  getOpenApiMetadata,
} from '@asteasolutions/zod-to-openapi';
import { Hono } from 'hono';
import type { Env, Schema } from 'hono';
import { mergePath } from 'hono/utils/url';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import type { OpenAPIObject as OpenAPIObject31 } from 'openapi3-ts/oas31';
import { z } from 'zod';

import { isFormContentType, isJSONContentType, isZod } from './type-guard.js';
import type {
  HonoInit,
  OpenAPIGeneratorConfigure,
  OpenAPIGeneratorOptions,
  OpenAPIObjectConfigure,
  OpenAPIObjectConfig,
  RouteConfig,
} from './types.js';
import { zValidator } from './zod-validator.js';
import { addBasePathToDocument } from './helpers.js';

// Extend Zod with OpenAPI metadata methods (.openapi())
extendZodWithOpenApi(z);

/**
 * OpenAPI-aware Hono instance.
 * Extends Hono with route registry, validation wiring, and OpenAPI doc generation.
 */
export class OpenAPIHono<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {
  openAPIRegistry: OpenAPIRegistry;
  defaultHook?: HonoInit<E>['defaultHook'];

  constructor(init?: HonoInit<E>) {
    super(init);
    this.openAPIRegistry = new OpenAPIRegistry();
    this.defaultHook = init?.defaultHook;
  }

  /**
   * Register an OpenAPI route with automatic request validation.
   */
  openapi = (
    { middleware: routeMiddleware, hide, ...route }: RouteConfig & { middleware?: unknown | unknown[]; hide?: boolean },
    handler: unknown,
    hook: unknown = this.defaultHook,
  ) => {
    if (!hide) {
      this.openAPIRegistry.registerPath(route as any);
    }

    const validators: unknown[] = [];

    if (route.request?.query) {
      validators.push(zValidator('query', route.request.query as any, hook as any));
    }
    if (route.request?.params) {
      validators.push(zValidator('param', route.request.params as any, hook as any));
    }
    if (route.request?.headers) {
      validators.push(zValidator('header', route.request.headers as any, hook as any));
    }
    if (route.request?.cookies) {
      validators.push(zValidator('cookie', route.request.cookies as any, hook as any));
    }

    const bodyContent = route.request?.body?.content;
    if (bodyContent) {
      for (const mediaType of Object.keys(bodyContent)) {
        if (!bodyContent[mediaType]) continue;
        const schema = bodyContent[mediaType].schema;
        if (!isZod(schema)) continue;

        if (isJSONContentType(mediaType)) {
          const validator = zValidator('json', schema as any, hook as any);
          if (route.request?.body?.required) {
            validators.push(validator);
          } else {
            // Skip JSON validation when content-type is absent
            const mw = async (c: any, next: any) => {
              const ct = c.req.header('content-type');
              if (ct && isJSONContentType(ct)) {
                return await (validator as any)(c, next);
              }
              c.req.addValidatedData('json', {});
              await next();
            };
            validators.push(mw);
          }
        }

        if (isFormContentType(mediaType)) {
          const validator = zValidator('form', schema as any, hook as any);
          if (route.request?.body?.required) {
            validators.push(validator);
          } else {
            const mw = async (c: any, next: any) => {
              const ct = c.req.header('content-type');
              if (ct && isFormContentType(ct)) {
                return await (validator as any)(c, next);
              }
              c.req.addValidatedData('form', {});
              await next();
            };
            validators.push(mw);
          }
        }
      }
    }

    const middleware = routeMiddleware
      ? Array.isArray(routeMiddleware)
        ? routeMiddleware
        : [routeMiddleware]
      : [];

    (this as any).on(
      [route.method],
      [route.path.replaceAll(/\/{(.+?)}/g, '/:$1')],
      ...middleware,
      ...validators,
      handler,
    );

    return this;
  };

  /**
   * Generate an OpenAPI 3.0 document from registered routes.
   */
  getOpenAPIDocument = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
  ): OpenAPIObject => {
    const document = new OpenApiGeneratorV3(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    return (this as any)._basePath
      ? addBasePathToDocument(document, (this as any)._basePath)
      : document;
  };

  /**
   * Generate an OpenAPI 3.1 document from registered routes.
   */
  getOpenAPI31Document = (
    objectConfig: OpenAPIObjectConfig,
    generatorConfig?: OpenAPIGeneratorOptions,
  ): OpenAPIObject31 => {
    const document = new OpenApiGeneratorV31(
      this.openAPIRegistry.definitions,
      generatorConfig,
    ).generateDocument(objectConfig);
    return (this as any)._basePath
      ? (addBasePathToDocument(document as unknown as OpenAPIObject, (this as any)._basePath) as unknown as OpenAPIObject31)
      : document;
  };

  /**
   * Serve OpenAPI 3.0 JSON at a given path.
   */
  doc = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
  ) => {
    return this.get(path, (c: any) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject;
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator;
      try {
        const document = this.getOpenAPIDocument(objectConfig, generatorConfig);
        return c.json(document);
      } catch (e) {
        return c.json(e, 500);
      }
    });
  };

  /**
   * Serve OpenAPI 3.1 JSON at a given path.
   */
  doc31 = <P extends string>(
    path: P,
    configureObject: OpenAPIObjectConfigure<E, P>,
    configureGenerator?: OpenAPIGeneratorConfigure<E, P>,
  ) => {
    return this.get(path, (c: any) => {
      const objectConfig =
        typeof configureObject === 'function' ? configureObject(c) : configureObject;
      const generatorConfig =
        typeof configureGenerator === 'function' ? configureGenerator(c) : configureGenerator;
      try {
        const document = this.getOpenAPI31Document(objectConfig, generatorConfig);
        return c.json(document);
      } catch (e) {
        return c.json(e, 500);
      }
    });
  };

  /**
   * Override Hono's route() to merge OpenAPI registries from sub-apps.
   */
  route<SubPath extends string>(path: SubPath, app?: Hono<any, any, any>) {
    if (!app) return super.route(path) as any;

    const pathForOpenAPI = path.replaceAll(/:([^/]+)/g, '{$1}');
    super.route(path, app);

    if (!(app instanceof OpenAPIHono)) return this;

    for (const def of app.openAPIRegistry.definitions) {
      switch (def.type) {
        case 'component':
          this.openAPIRegistry.registerComponent(
            (def as any).componentType,
            (def as any).name,
            (def as any).component,
          );
          break;
        case 'route':
          this.openAPIRegistry.registerPath({
            ...(def as any).route,
            path: mergePath(
              pathForOpenAPI,
              ((app as any)._basePath || '').replaceAll(/:([^/]+)/g, '{$1}'),
              (def as any).route.path,
            ),
          });
          break;
        case 'webhook':
          this.openAPIRegistry.registerWebhook({
            ...(def as any).webhook,
            path: mergePath(
              pathForOpenAPI,
              ((app as any)._basePath || '').replaceAll(/:([^/]+)/g, '{$1}'),
              (def as any).webhook.path,
            ),
          });
          break;
        case 'schema': {
          const meta = getOpenApiMetadata((def as any).schema);
          this.openAPIRegistry.register((meta as any)?._internal?.refId, (def as any).schema);
          break;
        }
        case 'parameter': {
          const meta = getOpenApiMetadata((def as any).schema);
          this.openAPIRegistry.registerParameter(
            (meta as any)?._internal?.refId,
            (def as any).schema,
          );
          break;
        }
        default: {
          const exhaustive: never = def as never;
          throw new Error(`Unknown registry type: ${exhaustive}`);
        }
      }
    }

    return this;
  }

  /**
   * Override basePath to return an OpenAPIHono with preserved registry state.
   */
  basePath<SubPath extends string>(path: SubPath) {
    return new OpenAPIHono({
      ...(super.basePath(path) as any),
      defaultHook: this.defaultHook,
    }) as any;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @revealui/openapi test`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/openapi/src/openapi-hono.ts packages/openapi/src/__tests__/openapi-hono.test.ts
git commit -m "feat(openapi): add OpenAPIHono class"
```

---

### Task 8: Index re-exports and integration tests

**Files:**
- Modify: `packages/openapi/src/index.ts`
- Create: `packages/openapi/src/__tests__/integration.test.ts`

- [ ] **Step 1: Write the index file with all re-exports**

Replace `packages/openapi/src/index.ts`:

```ts
// Class & factory
export { OpenAPIHono } from './openapi-hono.js';
export { createRoute } from './create-route.js';

// Validation middleware
export { zValidator } from './zod-validator.js';

// Helpers
export { $ } from './helpers.js';
export { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Zod re-export (convenience — consumers can import from either place)
export { z } from 'zod';

// Types — matches upstream public API surface
export type {
  RouteConfig,
  RouteHandler,
  RouteHook,
  OpenAPIHonoOptions,
  OpenAPIObjectConfigure,
  OpenAPIGeneratorOptions,
  OpenAPIGeneratorConfigure,
  RouteConfigToEnv,
  RouteConfigToTypedResponse,
  HonoToOpenAPIHono,
  Hook,
  DeepSimplify,
  MiddlewareToHandlerType,
  OfHandlerType,
} from './types.js';
```

- [ ] **Step 2: Write integration tests**

Create `packages/openapi/src/__tests__/integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OpenAPIHono, createRoute } from '../index.js';

describe('integration', () => {
  it('full round-trip: define routes → generate OpenAPI doc', async () => {
    const app = new OpenAPIHono();

    const listRoute = createRoute({
      method: 'get',
      path: '/users',
      tags: ['users'],
      summary: 'List users',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ users: z.array(z.string()) }),
            },
          },
          description: 'Success',
        },
      },
    });

    const getRoute = createRoute({
      method: 'get',
      path: '/users/{id}',
      tags: ['users'],
      summary: 'Get user',
      request: {
        params: z.object({ id: z.string() }),
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ id: z.string(), name: z.string() }),
            },
          },
          description: 'Success',
        },
        404: { description: 'Not found' },
      },
    });

    const createUserRoute = createRoute({
      method: 'post',
      path: '/users',
      tags: ['users'],
      summary: 'Create user',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          required: true,
        },
      },
      responses: {
        201: {
          content: {
            'application/json': {
              schema: z.object({ id: z.string(), name: z.string() }),
            },
          },
          description: 'Created',
        },
      },
    });

    app.openapi(listRoute, (c) => c.json({ users: ['Alice'] }));
    app.openapi(getRoute, (c) => c.json({ id: '1', name: 'Alice' }));
    app.openapi(createUserRoute, (c) => c.json({ id: '2', name: 'Bob' }, 201));

    const doc = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
    });

    // Verify paths
    expect(Object.keys(doc.paths)).toContain('/users');
    expect(Object.keys(doc.paths)).toContain('/users/{id}');

    // Verify methods
    expect(doc.paths['/users'].get).toBeDefined();
    expect(doc.paths['/users'].post).toBeDefined();
    expect(doc.paths['/users/{id}'].get).toBeDefined();

    // Verify tags
    expect(doc.paths['/users'].get.tags).toEqual(['users']);
  });

  it('nested apps with base paths produce correct spec', async () => {
    const parent = new OpenAPIHono();
    const usersApp = new OpenAPIHono();
    const postsApp = new OpenAPIHono();

    usersApp.openapi(
      createRoute({
        method: 'get',
        path: '/list',
        responses: { 200: { description: 'OK' } },
      }),
      (c) => c.json([]),
    );

    postsApp.openapi(
      createRoute({
        method: 'get',
        path: '/list',
        responses: { 200: { description: 'OK' } },
      }),
      (c) => c.json([]),
    );

    parent.route('/users', usersApp);
    parent.route('/posts', postsApp);

    const doc = parent.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
    });

    expect(doc.paths['/users/list']).toBeDefined();
    expect(doc.paths['/posts/list']).toBeDefined();
  });

  it('request validation end-to-end', async () => {
    const app = new OpenAPIHono();

    app.openapi(
      createRoute({
        method: 'post',
        path: '/items',
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({ name: z.string().min(1), count: z.number().int().positive() }),
              },
            },
            required: true,
          },
        },
        responses: { 200: { description: 'OK' } },
      }),
      (c) => {
        const body = c.req.valid('json');
        return c.json({ created: body.name, count: body.count });
      },
    );

    // Valid request
    const validRes = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Widget', count: 5 }),
    });
    expect(validRes.status).toBe(200);
    expect(await validRes.json()).toEqual({ created: 'Widget', count: 5 });

    // Invalid request
    const invalidRes = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', count: -1 }),
    });
    expect(invalidRes.status).toBe(400);
  });

  it('exports match expected public API', async () => {
    const mod = await import('../index.js');
    expect(mod.OpenAPIHono).toBeDefined();
    expect(mod.createRoute).toBeDefined();
    expect(mod.zValidator).toBeDefined();
    expect(mod.$).toBeDefined();
    expect(mod.extendZodWithOpenApi).toBeDefined();
    expect(mod.z).toBeDefined();
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `pnpm --filter @revealui/openapi test`
Expected: All tests PASS (type-guard + create-route + zod-validator + helpers + openapi-hono + integration).

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @revealui/openapi build`
Expected: `dist/index.js` and `dist/index.d.ts` generated with all exports.

- [ ] **Step 5: Verify typecheck**

Run: `pnpm --filter @revealui/openapi typecheck`
Expected: Clean — no type errors.

- [ ] **Step 6: Commit**

```bash
git add packages/openapi/src/index.ts packages/openapi/src/__tests__/integration.test.ts
git commit -m "feat(openapi): add index re-exports and integration tests"
```

---

## Chunk 4: Migration & Cleanup

### Task 9: Migrate apps/api imports

**Files:**
- Modify: `apps/api/package.json`
- Modify: all 31 files importing from `@hono/zod-openapi` in `apps/api/src/`
- Modify: any files importing from `@hono/zod-validator` in `apps/api/src/`

- [ ] **Step 1: Add @revealui/openapi to api dependencies**

In `apps/api/package.json`, add to dependencies:
```json
"@revealui/openapi": "workspace:*"
```

Remove from dependencies:
```json
"@hono/zod-openapi": "^1.2.1"
```

Remove from dependencies (if present):
```json
"@hono/zod-validator": "..."
```

- [ ] **Step 2: Find-and-replace @hono/zod-openapi imports**

Run across all files in `apps/api/src/`:

Replace all occurrences of:
```ts
from '@hono/zod-openapi'
```
With:
```ts
from '@revealui/openapi'
```

This affects 31 files. The import shapes (`{ createRoute, OpenAPIHono, z }`) remain identical.

- [ ] **Step 3: Find-and-replace @hono/zod-validator imports**

Replace all occurrences of:
```ts
from '@hono/zod-validator'
```
With:
```ts
from '@revealui/openapi'
```

This affects at least 1 file (`terminal-auth.ts`). The import shape (`{ zValidator }`) is now exported from `@revealui/openapi`.

- [ ] **Step 4: Install updated dependencies**

Run: `pnpm install`

- [ ] **Step 5: Verify API typecheck**

Run: `pnpm --filter api typecheck`
Expected: Clean — no type errors. The import shapes are identical.

- [ ] **Step 6: Verify API tests**

Run: `pnpm --filter api test`
Expected: All existing API tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/
git commit -m "refactor(api): migrate to @revealui/openapi"
```

---

### Task 10: Full gate verification and cleanup

**Files:**
- Modify: root `package.json` or `pnpm-lock.yaml` (via pnpm install after removal)

- [ ] **Step 1: Remove upstream packages**

Verify no remaining imports of `@hono/zod-openapi` or `@hono/zod-validator` exist anywhere:

Run: `grep -r "@hono/zod-openapi" apps/ packages/ --include="*.ts" --include="*.tsx" -l`
Expected: No results.

Run: `grep -r "@hono/zod-validator" apps/ packages/ --include="*.ts" --include="*.tsx" -l`
Expected: No results.

- [ ] **Step 2: Clean lockfile**

Run: `pnpm install`
Verify `@hono/zod-openapi` and `@hono/zod-validator` are no longer in `node_modules/`.

- [ ] **Step 3: Run full gate**

Run: `pnpm gate`
Expected: All phases pass — lint, typecheck, test, build.

- [ ] **Step 4: Commit cleanup**

```bash
git add pnpm-lock.yaml
git commit -m "chore: remove @hono/zod-openapi and @hono/zod-validator"
```

- [ ] **Step 5: Update workboard**

Edit `~/projects/revealui-jv/.claude/workboard.md`:
- Remove "API schema: zod version mismatch blocks hono-openapi full replacement (upstream dep)" from Remaining
- Add to Recent: `@revealui/openapi package created, API migrated, upstream deps removed`
