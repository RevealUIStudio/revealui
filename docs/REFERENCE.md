---
title: "API Reference"
description: "Complete API reference for @revealui/core exports and subpath modules"
category: reference
audience: developer
---

# @revealui/core

The runtime engine. Provides config building, collections, access control, REST API handlers, entitlement and feature gating primitives, rich text, admin UI components, logging, and plugins.

Commercial note: for hosted RevealUI deployments, premium access should resolve from account or workspace entitlements first. Per-user or perpetual licenses should remain explicit secondary models for the products that actually need them.

```bash
npm install @revealui/core
```

---

## Setup

### `buildConfig<T>(config: T): T`

Validates and finalizes your RevealUI configuration. Call this in your config file — it merges in defaults, runs validation, and applies plugins.

```ts
import { buildConfig } from "@revealui/core";

export default buildConfig({
  serverURL: "http://localhost:3000",
  collections: [Posts, Users],
  plugins: [formBuilderPlugin()],
});
```

Throws `ConfigValidationError` if the config is structurally invalid.

**Defaults applied:**

- `admin.importMap.autoGenerate: true`
- `typescript.autoGenerate: true`, `outputFile: 'src/types/revealui.ts'`
- `localization.locales: ['en']`, `defaultLocale: 'en'`, `fallback: true`

---

### `createRevealUI(config: RevealConfig): Promise<RevealUIInstance>`

Creates a RevealUI instance from a config. Returns the instance with all CRUD methods attached.

```ts
import { createRevealUI } from "@revealui/core";
import config from "./revealui.config";

const revealui = await createRevealUI(config);
```

### `getRevealUI(options: { config: AcceptedConfig }): Promise<RevealUIInstance>`

Singleton alternative to `createRevealUI`. Returns the same instance on subsequent calls — safe to call at module scope in serverless functions where cold-start re-initialization would be wasteful.

```ts
import { getRevealUI } from "@revealui/core";
import config from "./revealui.config";

// Safe to call multiple times — returns cached instance after first call
const revealui = await getRevealUI({ config });
```

---

### `withRevealUI(nextConfig?, options?): NextConfig`

Next.js configuration wrapper. Merges RevealUI's webpack/Turbopack aliases, environment variables, and security headers into your `next.config.ts`. Required when using RevealUI with Next.js.

```ts
// next.config.ts
import { withRevealUI } from "@revealui/core";

export default withRevealUI(
  {
    // your existing next.config options
  },
  {
    configPath: "./revealui.config.ts", // default
    admin: true, // enable admin UI, default true
    adminRoute: "/admin", // default
    apiRoute: "/api", // default
  },
);
```

**What it does:**

- Adds webpack aliases: `@revealui/core` → core package, `@revealui/config` → your config file
- Sets Turbopack `resolveAlias` equivalents for Next.js 16+
- Injects env vars: `REVEALUI_CONFIG_PATH`, `REVEALUI_ADMIN_ENABLED`, `REVEALUI_ADMIN_ROUTE`, `REVEALUI_API_ROUTE`
- Appends security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`) to the admin route

**`WithRevealUIOptions`:**

```ts
interface WithRevealUIOptions {
  configPath?: string; // path to revealui.config.ts (relative to project root)
  admin?: boolean; // mount admin UI (default: true)
  adminRoute?: string; // admin base path (default: '/admin')
  apiRoute?: string; // API base path (default: '/api')
}
```

---

## Collections & Fields

### `defineCollection(config: CollectionConfig): CollectionConfig`

Type-safe helper for defining a collection. Pass the result to `buildConfig({ collections: [...] })`.

```ts
import { defineCollection } from "@revealui/core";

export const Posts = defineCollection({
  slug: "posts",
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "richText" },
    { name: "author", type: "relationship", relationTo: "users" },
  ],
  access: {
    read: anyone,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  hooks: {
    afterChange: [sendNotificationEmail],
  },
});
```

### `defineGlobal(config: GlobalConfig): GlobalConfig`

Type-safe helper for defining a singleton global (e.g. site settings).

```ts
import { defineGlobal } from "@revealui/core";

export const SiteSettings = defineGlobal({
  slug: "site-settings",
  fields: [
    { name: "siteName", type: "text" },
    { name: "logo", type: "upload", relationTo: "media" },
  ],
});
```

### `defineField(field: Field): Field`

Type-safe helper for defining a field outside a collection definition.

---

## Instance Methods

All methods are available on the `RevealUIInstance` returned by `createRevealUI()` / `getRevealUI()`.

### `revealui.find(options)`

Fetches multiple documents from a collection. Returns a paginated result.

```ts
const result = await revealui.find({
  collection: "posts",
  where: { status: { equals: "published" } },
  sort: "-createdAt",
  limit: 20,
  page: 1,
  depth: 1, // populate relationships 1 level deep
});

// result.docs      — array of documents
// result.totalDocs — total matching documents
// result.totalPages
// result.page, result.hasNextPage, result.nextPage
```

**`RevealFindOptions`:**

```ts
interface RevealFindOptions {
  collection: string;
  where?: RevealWhere; // filter expression
  sort?: RevealSort; // field name, prefix with '-' for descending
  limit?: number; // default: 10
  page?: number; // 1-based
  pagination?: boolean; // set false to return all docs (no pagination)
  depth?: number; // relationship population depth (default: 0)
  select?: RevealSelect; // field projection
  draft?: boolean; // include drafts
  overrideAccess?: boolean; // skip access control (server-side only)
  locale?: string;
  req?: RevealRequest; // pass to propagate auth context
}
```

**Where operators:**

```ts
// Equality
where: { slug: { equals: 'hello-world' } }

// Comparison
where: { views: { greater_than: 100 } }
where: { price: { less_than_equal: 50 } }

// Text search
where: { title: { like: 'revealui' } }
where: { title: { contains: 'guide' } }

// In / Not in
where: { status: { in: ['published', 'archived'] } }
where: { id: { not_in: [1, 2, 3] } }

// Existence
where: { publishedAt: { exists: true } }

// Compound: AND (default when multiple fields)
where: {
  status: { equals: 'published' },
  author: { equals: userId },
}

// Compound: OR
where: {
  or: [
    { status: { equals: 'published' } },
    { featured: { equals: true } },
  ],
}
```

---

### `revealui.findByID(options)`

Fetches a single document by ID. Returns `null` if not found.

```ts
const post = await revealui.findByID({
  collection: "posts",
  id: "6621f3e2a1b2c3d4e5f60001",
  depth: 2,
});
```

```ts
// Options
{
  collection: string
  id: string | number
  depth?: number
  req?: RevealRequest
}
```

---

### `revealui.create(options)`

Creates a new document. Runs `afterChange` hooks on success.

```ts
const post = await revealui.create({
  collection: "posts",
  data: {
    title: "Hello World",
    status: "draft",
    author: userId,
  },
  req, // pass to trigger access control
});
```

Throws `'Access denied'` if the collection's `access.create` function returns false.

```ts
interface RevealCreateOptions {
  collection: string;
  data: Record<string, unknown>;
  req?: RevealRequest;
}
// Returns: Promise<RevealDocument>
```

---

### `revealui.update(options)`

Updates a document by ID. Fetches the previous version, runs `afterChange` hooks with `previousDoc`.

```ts
const updated = await revealui.update({
  collection: "posts",
  id: postId,
  data: { status: "published" },
  req,
});
```

```ts
interface RevealUpdateOptions {
  collection: string;
  id: string | number;
  data: Record<string, unknown>;
  req?: RevealRequest;
}
// Returns: Promise<RevealDocument>
```

---

### `revealui.delete(options)`

Deletes a document by ID.

```ts
const deleted = await revealui.delete({
  collection: "posts",
  id: postId,
  req,
});
```

```ts
interface RevealDeleteOptions {
  collection: string;
  id: string | number;
  req?: RevealRequest;
}
// Returns: Promise<RevealDocument>   (the deleted document)
```

---

### `revealui.login(options)`

Authenticates a user and returns a signed JWT.

```ts
const { user, token } = await revealui.login({
  collection: "users",
  data: {
    email: "user@example.com",
    password: "secret",
  },
});
```

Passwords must be stored as bcrypt hashes. Plain-text passwords are rejected.

---

## Collection Hooks

Hooks run at specific lifecycle points. Attach them in `defineCollection({ hooks: { ... } })`.

### `afterChange`

Runs after a successful create or update. Receives the saved document and can return a modified version.

```ts
import type { CollectionAfterChangeHook } from '@revealui/core'

const sendWelcomeEmail: CollectionAfterChangeHook = async ({
  doc,
  operation,    // 'create' | 'update'
  previousDoc,  // undefined on create
  req,
  collection,
}) => {
  if (operation === 'create') {
    await email.send({ to: doc.email, template: 'welcome' })
  }
  return doc  // return to replace the stored doc, or undefined to keep it
}

export const Users = defineCollection({
  slug: 'users',
  fields: [...],
  hooks: {
    afterChange: [sendWelcomeEmail],
  },
})
```

**Hook args:**

```ts
interface AfterChangeHookArgs {
  doc: RevealDocument;
  operation: "create" | "update";
  previousDoc?: RevealDocument;
  req: RevealRequest;
  collection: string;
  context: {
    revealui?: RevealUIInstance;
    collection: string;
    operation: "create" | "update";
    previousDoc?: RevealDocument;
    req: RevealRequest;
  };
}
```

### `beforeChange`

Runs before the data is persisted. Use to transform or validate data.

```ts
import type { CollectionBeforeChangeHook } from "@revealui/core";

const slugify: CollectionBeforeChangeHook = async ({ data, operation }) => {
  if (operation === "create" && data.title) {
    return {
      ...data,
      slug: data.title.toLowerCase().replace(/\s+/g, "-"),
    };
  }
  return data;
};
```

### `afterRead`

Runs after a document is fetched. Use to add computed fields.

```ts
import type { CollectionAfterReadHook } from "@revealui/core";

const addComputedFields: CollectionAfterReadHook = async ({ doc }) => {
  return {
    ...doc,
    readingTime: Math.ceil((doc.body?.length ?? 0) / 1000),
  };
};
```

### `beforeValidate`

Runs before Zod schema validation. Use to coerce or normalize input before it's validated.

---

## Access Control

### `anyone`

Allows all requests (public read).

```ts
import { anyone, authenticated } from '@revealui/core'

access: { read: anyone, create: authenticated }
```

### `authenticated`

Requires a valid session (`req.user` must be present).

### `isAdmin({ req })`

Returns `true` if the user has the `'admin'` role.

```ts
import { isAdmin } from '@revealui/core'

access: { delete: isAdmin }
```

### `isSuperAdmin({ req })`

Returns `true` if the user has the `'super-admin'` role.

### `hasRole(role: string)`

Factory: returns an access function that requires a specific role.

```ts
import { hasRole } from "@revealui/core";

access: {
  update: hasRole("editor");
}
```

### `hasAnyRole(roles: string[])`

Factory: returns an access function that passes if the user has **any** of the given roles.

```ts
import { hasAnyRole } from "@revealui/core";

access: {
  create: hasAnyRole(["editor", "admin"]);
}
```

### Custom access functions

All access functions share the same signature:

```ts
type AccessFunction = (args: {
  req: RevealRequest;
}) => boolean | Promise<boolean>;

// Example: owner-only update
const isOwner: AccessFunction = ({ req }) => {
  if (!req.user) return false;
  // use req.user.id to check document ownership
  return true;
};
```

---

## REST API

### `createRESTHandlers(config: Config)`

Creates Hono route handlers for the full RevealUI REST API. Returns an object with `app` (Hono instance) ready to mount.

```ts
import { createRESTHandlers } from "@revealui/core/server";

const { app } = createRESTHandlers(config);
export default app;
```

### `handleRESTRequest(req: Request, config: Config): Promise<Response>`

Handles a single Web API `Request` and returns a `Response`. Useful for edge runtimes where you receive raw requests.

```ts
import { handleRESTRequest } from "@revealui/core/server";

export async function GET(req: Request) {
  return handleRESTRequest(req, config);
}
```

---

## Rate Limiting

Import from `@revealui/core/api/rate-limit`.

### `checkRateLimit(request, config)`

Fixed-window rate limiter. Returns `{ allowed, limit, remaining, resetTime }`.

```ts
import {
  checkRateLimit,
  RATE_LIMIT_PRESETS,
} from "@revealui/core/api/rate-limit";

const result = checkRateLimit(request, RATE_LIMIT_PRESETS.standard);
if (!result.allowed) {
  return new Response("Too Many Requests", { status: 429 });
}
```

### `createRateLimitMiddleware(config)`

Returns a Next.js-compatible middleware function that adds `X-RateLimit-*` headers and rejects over-limit requests with HTTP 429.

```ts
export const middleware = createRateLimitMiddleware({
  windowMs: 60_000, // 1 minute
  maxRequests: 100,
});
```

### `createUserRateLimit(config)` / `createAPIKeyRateLimit(config)` / `createEndpointRateLimit(config)`

Pre-keyed middleware factories:

- `createUserRateLimit` — keys by `x-user-id` header
- `createAPIKeyRateLimit` — keys by `x-api-key` header
- `createEndpointRateLimit` — keys by `IP + pathname`

### `RATE_LIMIT_PRESETS`

```ts
RATE_LIMIT_PRESETS.veryStrict; // 10 req/min
RATE_LIMIT_PRESETS.strict; // 30 req/min
RATE_LIMIT_PRESETS.standard; // 100 req/min (default)
RATE_LIMIT_PRESETS.relaxed; // 500 req/min
RATE_LIMIT_PRESETS.hourly; // 1,000 req/hr
RATE_LIMIT_PRESETS.daily; // 10,000 req/day
```

### Sliding window & token bucket

```ts
// More accurate — no boundary burst
checkSlidingWindowRateLimit(request, config);

// Smooth token refill
checkTokenBucketRateLimit(request, { ...config, refillRate: 10 });
```

---

## License

Import from `@revealui/core/license` or via the main entry.

### `initializeLicense(): Promise<LicenseTier>`

Reads `REVEALUI_LICENSE_KEY` and `REVEALUI_LICENSE_PUBLIC_KEY` from env, validates the JWT, and caches the result. Call once at app startup.

```ts
import { initializeLicense } from "@revealui/core";

// In your server entry point:
await initializeLicense();
```

Returns `'free'` if no key is configured or validation fails.

### `isLicensed(requiredTier: LicenseTier): boolean`

Returns `true` if the current license meets or exceeds `requiredTier`.

```ts
import { isLicensed } from "@revealui/core";

if (isLicensed("pro")) {
  // Pro, Max, and Forge only
}
```

**Tier ranking:** `free (0) < pro (1) < max (2) < enterprise/forge (3)`

### `getCurrentTier(): LicenseTier`

Returns the cached license tier synchronously. Call `initializeLicense()` first.

```ts
type LicenseTier = "free" | "pro" | "max" | "enterprise";
```

### `getLicensePayload(): LicensePayload | null`

Returns the decoded JWT payload, or `null` on free tier.

```ts
interface LicensePayload {
  tier: "pro" | "max" | "enterprise";
  customerId: string;
  domains?: string[];
  maxSites?: number;
  maxUsers?: number;
  iat?: number;
  exp?: number;
}
```

### `getMaxSites(): number`

Returns the max number of sites allowed: free=1, pro=5 (or payload value), enterprise=Infinity.

### `getMaxUsers(): number`

Returns the max number of active users allowed: free=3, pro=25 (or payload value), enterprise=Infinity.

### `validateLicenseKey(licenseKey: string, publicKey: string): Promise<LicensePayload | null>`

Verifies a license JWT using RS256/ES256. Returns the decoded payload or `null` if invalid/expired.

### `generateLicenseKey(payload, privateKey, expiresInSeconds?): Promise<string>`

Signs a new license JWT. Default expiry is 1 year. Used by the RevealUI license server — not needed in app code.

---

## Feature Flags

Import from `@revealui/core/features` or via the main entry.

### `isFeatureEnabled(feature: keyof FeatureFlags): boolean`

Returns `true` if the feature is available at the current tier.

```ts
import { isFeatureEnabled } from "@revealui/core";

if (isFeatureEnabled("ai")) {
  // Enable AI features (Pro+)
}
```

### `getFeatures(): FeatureFlags`

Returns all feature flags for the current tier.

```ts
interface FeatureFlags {
  // Pro features
  ai: boolean;
  aiMemory: boolean;
  mcp: boolean;
  editors: boolean;
  harnesses: boolean;
  payments: boolean;
  advancedSync: boolean;
  dashboard: boolean;
  customDomain: boolean;
  analytics: boolean;
  // Max features
  aiMemory: boolean;
  aiInference: boolean;
  auditLog: boolean;
  // Forge (enterprise) features
  multiTenant: boolean;
  whiteLabel: boolean;
  sso: boolean;
}
```

### `getFeaturesForTier(tier: LicenseTier): FeatureFlags`

Returns the feature flags available at a specific tier without affecting cached state.

### `getRequiredTier(feature: keyof FeatureFlags): LicenseTier`

Returns the minimum tier required for a feature.

```ts
getRequiredTier("ai"); // 'pro'
getRequiredTier("whiteLabel"); // 'enterprise'
```

---

## Logging

Import from `@revealui/core/utils/logger`.

### `createLogger(context?: LogContext): Logger`

Creates a scoped logger instance with request/module context.

```ts
import { createLogger } from "@revealui/core";

const log = createLogger({ module: "auth", requestId: req.id });
log.info("User signed in", { userId });
log.error("Sign-in failed", { error });
```

### `logger`

Global default logger instance — use when no request context is available.

```ts
import { logger } from "@revealui/core";

logger.warn("Config missing optional field");
```

**Log levels:** `debug | info | warn | error`

---

## Plugins

Import from `@revealui/core/plugins`.

### `formBuilderPlugin(config?: FormBuilderPluginConfig)`

Adds a drag-and-drop form builder collection to your admin. Creates `forms` and `form-submissions` collections automatically.

```ts
import { formBuilderPlugin } from "@revealui/core/plugins";

buildConfig({
  plugins: [
    formBuilderPlugin({
      fields: {
        text: true,
        textarea: true,
        email: true,
        select: true,
        checkbox: true,
      },
    }),
  ],
});
```

### `nestedDocsPlugin(config?: NestedDocsPluginConfig)`

Adds parent/children relationship and breadcrumb fields to a collection, enabling tree-structured content.

### `redirectsPlugin(config?: RedirectsPluginConfig)`

Adds a `redirects` collection for managing URL redirects.

---

## Storage

### `universalPostgresAdapter(config: UniversalPostgresAdapterConfig)`

PostgreSQL adapter that works with both PGlite (in-memory, for tests) and a real Postgres connection.

```ts
import { universalPostgresAdapter } from "@revealui/core";

buildConfig({
  db: universalPostgresAdapter({
    pool: { connectionString: process.env.POSTGRES_URL },
  }),
});
```

### `vercelBlobStorage()`

Storage adapter for Vercel Blob. Set `BLOB_READ_WRITE_TOKEN` in env.

```ts
import { vercelBlobStorage } from "@revealui/core";

buildConfig({
  upload: {
    useTempFiles: true,
    tempFileDir: "/tmp",
  },
  plugins: [vercelBlobStorage({ collections: { media: true } })],
});
```

---

## Rich Text

Import from `@revealui/core/richtext` or the main entry.

### `serializeLexicalState(data, options?): JSX.Element | null`

Converts a stored Lexical editor state (JSON) into a React element tree for server-side rendering. Returns `null` for empty or missing states.

```ts
import { serializeLexicalState } from '@revealui/core'

// In a React Server Component:
export default function Post({ post }: { post: { body: SerializedEditorState } }) {
  return (
    <article>
      <h1>{post.title}</h1>
      {serializeLexicalState(post.body)}
    </article>
  )
}
```

**`SerializeOptions`:**

```ts
interface SerializeOptions {
  /** Custom renderers per node type */
  customRenderers?: Record<
    string,
    (node: SerializedLexicalNode) => JSX.Element | null
  >;
}
```

### Rich text editor features

Pass to `lexicalEditor({ features: [...] })` in your field config:

```ts
import {
  lexicalEditor,
  BoldFeature,
  ItalicFeature,
  UnderlineFeature,
  HeadingFeature,
  LinkFeature,
  FixedToolbarFeature,
} from '@revealui/core'

{ name: 'body', type: 'richText', editor: lexicalEditor({
  features: [
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3'] }),
    LinkFeature(),
    FixedToolbarFeature(),
  ],
}) }
```

---

## Utilities

### `deepClone<T>(obj: T): T`

Deep clones an object. Safe for objects with nested arrays and plain values.

### `deepMerge<T>(a: object, b: object): T`

Recursively merges two objects. Arrays are replaced (not concatenated).

### `LRUCache<K, V>`

Least-recently-used cache implementation.

```ts
import { LRUCache } from "@revealui/core";

const cache = new LRUCache<string, User>(100); // max 100 entries
cache.set("user:1", user);
const hit = cache.get("user:1");
```

---

## Error Types

```ts
import { ApplicationError, ValidationError } from "@revealui/core";

throw new ApplicationError("Something went wrong", 500);
throw new ValidationError("Invalid email format", { field: "email" });
```

### Response Helpers

```ts
import {
  createSuccessResponseData,
  createErrorResponseData,
  createValidationErrorResponseData,
} from "@revealui/core";
```

---

## Related

- [`@revealui/auth`](/reference/auth) — Session auth, sign in/up, rate limiting
- [`@revealui/db`](/reference/db) — Drizzle ORM schema and NeonDB client
- [`@revealui/contracts`](/reference/contracts) — Zod schemas and TypeScript types
- [REST API reference](https://api.revealui.com/swagger) — Interactive OpenAPI documentation

---

# @revealui/contracts

Zod schemas, TypeScript types, and runtime contracts — the single source of truth for all data shapes across RevealUI. Used by every package in the monorepo.

```bash
npm install @revealui/contracts
```

## Subpath Exports

| Import path                     | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `@revealui/contracts`           | All contracts + A2A protocol         |
| `@revealui/contracts/admin`       | admin config types and helpers         |
| `@revealui/contracts/agents`    | Agent definitions and memory         |
| `@revealui/contracts/database`  | DB ↔ contract mapping utilities      |
| `@revealui/contracts/generated` | Generated row/insert/update types    |
| `@revealui/contracts/blocks`    | Content block types                  |
| `@revealui/contracts/core`      | Core entity types (User, Site, Page) |

---

## admin Configuration

Import from `@revealui/contracts/admin`.

### `defineCollection(name, config): CollectionConfig`

Type-safe helper for defining an admin collection. Pass the result to `buildConfig({ collections: [...] })`.

```ts
import { defineCollection } from "@revealui/contracts/admin";

export const Posts = defineCollection("posts", {
  fields: [
    { name: "title", type: "text", required: true },
    { name: "body", type: "richText" },
    { name: "author", type: "relationship", relationTo: "users" },
    { name: "publishedAt", type: "date" },
  ],
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => req.user?.role === "admin",
  },
  hooks: {
    beforeChange: [setPublishedAt],
    afterRead: [populateAuthor],
  },
});
```

### `defineGlobal(name, config): GlobalConfig`

Defines a singleton global (e.g. site settings, navigation).

```ts
import { defineGlobal } from "@revealui/contracts/admin";

export const SiteSettings = defineGlobal("site-settings", {
  fields: [
    { name: "siteName", type: "text" },
    { name: "favicon", type: "upload", relationTo: "media" },
    {
      name: "analytics",
      type: "group",
      fields: [{ name: "googleAnalyticsId", type: "text" }],
    },
  ],
});
```

### `defineField(name, config): Field`

Type-safe helper for defining a field. Useful when sharing field definitions across collections.

```ts
import { defineField } from "@revealui/contracts/admin";

const statusField = defineField("status", {
  type: "select",
  options: ["draft", "published", "archived"],
  defaultValue: "draft",
});
```

### `mergeCollectionConfigs(...configs): CollectionConfig`

Merges multiple collection configs. Useful for extending base configs with app-specific overrides.

---

## Validation

### `safeValidate(schema, data): ValidationResult`

Validates data against a Zod schema without throwing. Returns a discriminated union.

```ts
import { safeValidate } from "@revealui/contracts/admin";
import { UserSchema } from "@revealui/contracts";

const result = safeValidate(UserSchema, unknownData);
if (result.success) {
  console.log(result.data); // User
} else {
  console.error(result.errors); // ZodError[]
}
```

### `validateWithErrors(schema, data): { valid: boolean; errors: ValidationError[] }`

Returns a structured error list suitable for displaying in forms.

---

## Core Entities

Import from `@revealui/contracts` or `@revealui/contracts/core`.

### User

```ts
interface User {
  id: string;
  name: string;
  email: string | null;
  role: "admin" | "editor" | "viewer";
  status: "active" | "inactive";
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date | null;
}
```

- `createUser(input: CreateUserInput): User` — creates a new user entity with defaults
- `UserSchema`, `CreateUserInputSchema`, `UpdateUserInputSchema` — Zod schemas

### Site

```ts
interface Site {
  id: string;
  name: string;
  domain: string | null;
  ownerId: string;
  settings: SiteSettings;
  seo: SiteSeo;
  theme: SiteTheme;
}
```

- `createSite(input: CreateSiteInput): Site`
- `canUserPerformAction(user, action, resource): boolean` — RBAC check
- `canAgentEditSite(agent, site): boolean` — AI agent permission check

### Page

```ts
interface Page {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  path: string;
  content: Block[];
  status: "draft" | "published" | "archived";
  parentId: string | null;
  seo: PageSeo;
}
```

- `createPage(input: CreatePageInput): Page`
- `computePagePath(page): string` — computes URL path from hierarchy
- `getPageBreadcrumbs(page, pages): Page[]`
- `estimateWordCount(page): number`
- `isPageLocked(page): boolean` — collaborative editing lock
- `createPageLock(page, userId): PageLock`

---

## Content Blocks

Import from `@revealui/contracts/blocks`.

18 block types for building page content. Each block has a unique `type` discriminant.

```ts
type Block =
  | TextBlock
  | HeadingBlock
  | ImageBlock
  | CodeBlock
  | ButtonBlock
  | VideoBlock
  | EmbedBlock
  | DividerBlock
  | SpacerBlock
  | QuoteBlock
  | ListBlock
  | TableBlock
  | ColumnsBlock
  | GridBlock
  | FormBlock
  | AccordionBlock
  | TabsBlock
  | ComponentBlock;
```

### Factory Functions

```ts
import {
  createTextBlock,
  createHeadingBlock,
  createImageBlock,
} from "@revealui/contracts/blocks";

const blocks: Block[] = [
  createHeadingBlock({ text: "Getting Started", level: 2 }),
  createTextBlock({ text: "This is the intro paragraph." }),
  createImageBlock({ src: "/hero.png", alt: "Hero image" }),
];
```

### Query Utilities

```ts
import {
  findBlockById,
  walkBlocks,
  countBlocks,
} from "@revealui/contracts/blocks";

// Walk all blocks recursively (including nested containers)
walkBlocks(blocks, (block) => {
  if (block.type === "text") console.log(block.text);
});

// Count total blocks
const total = countBlocks(blocks); // includes nested

// Find by ID
const block = findBlockById(blocks, "block-123");
```

### Type Guards

```ts
isTextBlock(block); // block is TextBlock
isHeadingBlock(block); // block is HeadingBlock
isImageBlock(block); // block is ImageBlock
isContainerBlock(block); // block is ColumnsBlock | GridBlock
isGroupField(field); // field is GroupField
isLayoutField(field); // field has sub-fields
isRelationshipField(field);
isArrayField(field);
```

---

## A2A Protocol (Agent-to-Agent)

Import from `@revealui/contracts` — these types implement the [Google A2A specification](https://github.com/google/A2A).

### Agent Cards

Agent cards are JSON discovery documents published at `/.well-known/agent.json`.

```ts
import {
  agentDefinitionToCard,
  toolDefinitionToSkill,
} from "@revealui/contracts";
import type { A2AAgentCard, A2ASkill } from "@revealui/contracts";

// Convert a RevealUI agent definition to a public discovery card
const card: A2AAgentCard = agentDefinitionToCard(
  agentDef,
  "https://api.yourapp.com",
);
```

**`A2AAgentCard`:**

```ts
interface A2AAgentCard {
  name: string;
  description: string;
  url: string; // JSON-RPC endpoint
  capabilities: A2ACapabilities;
  skills: A2ASkill[];
  provider?: A2AProvider;
  auth?: A2AAuth;
}
```

### Tasks

Agents communicate via tasks sent to the JSON-RPC endpoint.

```ts
interface A2ATask {
  id: string;
  sessionId: string;
  status: A2ATaskStatus;
  artifacts: A2AArtifact[];
  history: A2AMessage[];
  metadata?: Record<string, unknown>;
}

type A2ATaskState =
  | "submitted"
  | "working"
  | "input-required"
  | "completed"
  | "canceled"
  | "failed"
  | "unknown";
```

### Messages & Parts

```ts
interface A2AMessage {
  role: "user" | "agent";
  parts: A2APart[];
}

type A2APart =
  | { type: "text"; text: string }
  | { type: "data"; data: Record<string, unknown>; mimeType?: string }
  | { type: "file"; mimeType: string; data?: string; uri?: string };
```

### JSON-RPC Envelope

```ts
interface A2AJsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: "tasks/send" | "tasks/sendSubscribe" | "tasks/get" | "tasks/cancel";
  params: A2ASendTaskParams | { id: string };
}
```

---

## Agents

Import from `@revealui/contracts/agents`.

```ts
interface AgentDefinition {
  agentId: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  capabilities: string[];
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}
```

Factory functions:

- `createAgentMemory(input): AgentMemory`
- `createAgentContext(input): AgentContext`
- `createConversation(userId: string): Conversation`
- `createMessage(role, content): ConversationMessage`

---

## Database Bridge

Import from `@revealui/contracts/database`.

### `contractToDbInsert(contract, table): InsertObject`

Converts a contract entity to a Drizzle ORM insert shape.

### `dbRowToContract(row, contract): T`

Converts a raw database row to a contract type.

### `safeDbRowToContract(row, contract): T | ValidationError`

Validated conversion — returns a `ValidationError` instead of throwing if the row doesn't match.

---

## Generated Types

Import from `@revealui/contracts/generated`. These are auto-generated from the database schema — do not edit manually.

```ts
import type {
  UsersRow,
  UsersInsert,
  UsersUpdate,
  SitesRow,
  SitesInsert,
  SitesUpdate,
  PagesRow,
  PagesInsert,
  PagesUpdate,
  PostsRow,
  PostsInsert,
  PostsUpdate,
} from "@revealui/contracts/generated";
```

| Suffix   | Use for                              |
| -------- | ------------------------------------ |
| `Row`    | Reading from the database (`SELECT`) |
| `Insert` | Writing new records (`INSERT INTO`)  |
| `Update` | Partial updates (`UPDATE SET`)       |

---

## Extensibility

### `registerCustomFieldType(name, config): void`

Registers a custom admin field type that can be used in collection definitions.

### `registerPluginExtension(name, ext): void`

Registers a plugin field extension — adds new fields to existing collections at config-build time.

### `registerValidationRule(name, rule): void`

Registers a named validation rule that can be referenced in field definitions.

---

## Related

- [`@revealui/core`](/reference/core) — Uses contracts for config validation
- [`@revealui/db`](/reference/db) — Database schema that contracts map to
- [`@revealui/auth`](/reference/auth) — Uses `User`, `Session` contracts

---

# @revealui/db

Drizzle ORM schema, database clients, migrations, and encryption utilities. Supports two databases: NeonDB (REST content) and Supabase (vectors/auth).

```bash
npm install @revealui/db
```

## Subpath Exports

| Import path                    | Purpose                                 |
| ------------------------------ | --------------------------------------- |
| `@revealui/db`                 | Client creation + schema                |
| `@revealui/db/client`          | Database client factory                 |
| `@revealui/db/schema`          | All table definitions                   |
| `@revealui/db/schema/users`    | Users, sessions, password reset         |
| `@revealui/db/schema/sites`    | Sites and collaborators                 |
| `@revealui/db/schema/pages`    | Pages and revisions                     |
| `@revealui/db/schema/admin`      | Posts and media                         |
| `@revealui/db/schema/agents`   | Agent memories, contexts, conversations |
| `@revealui/db/schema/licenses` | License records                         |
| `@revealui/db/schema/api-keys` | User inference API keys                 |
| `@revealui/db/crypto`          | AES-256-GCM encryption                  |
| `@revealui/db/types`           | TypeScript types                        |

---

## Client API

### `createClient(config: DatabaseConfig, schema?)`

Creates a Drizzle ORM client. Auto-selects the right driver based on connection string.

```ts
import { createClient } from "@revealui/db/client";

const db = createClient({
  connectionString: process.env.POSTGRES_URL,
});
```

**Driver selection:**

- Neon HTTP driver (`@neondatabase/serverless`) — for `neon.tech` connection strings
- node-postgres (`pg`) — for Supabase, localhost, and other Postgres hosts

Returns `NeonHttpDatabase | NodePgDatabase` depending on the connection string.

---

### `getRestClient(): Database`

Returns (or lazily creates) the global NeonDB client. Reads `POSTGRES_URL` from env.

```ts
import { getRestClient } from "@revealui/db/client";

const db = getRestClient();
const posts = await db.select().from(schema.posts);
```

### `getVectorClient(): Database`

Returns (or lazily creates) the global Supabase client. Reads `SUPABASE_URL` and `SUPABASE_KEY` from env.

> Only use the vector client in designated modules (`packages/db/src/vector/`, `packages/ai/src/`). See database conventions for boundary rules.

### `getClient(type?: 'rest' | 'vector' | string): Database`

Unified client getter. Pass `'rest'` or `'vector'`, or a raw connection string for ad-hoc connections.

### `resetClient(): void`

Clears cached client singletons. Used in tests to get a clean state between test runs.

---

## Transactions

### `withTransaction<T>(db, fn): Promise<T>`

Executes a function inside a database transaction with automatic `BEGIN`/`COMMIT`/`ROLLBACK`.

```ts
import { withTransaction } from '@revealui/db'
import { getRestClient } from '@revealui/db/client'

const db = getRestClient()

const result = await withTransaction(db, async (tx) => {
  await tx.insert(schema.users).values({ ... })
  await tx.insert(schema.sites).values({ ... })
  return 'done'
})
```

> **Important:** Transactions only work with node-postgres (Supabase/localhost). The Neon HTTP driver does not support multi-statement transactions.

---

## Pool Management

### `getPoolMetrics(): PoolMetrics[]`

Returns connection pool stats for all active pools.

```ts
interface PoolMetrics {
  name: string;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}
```

### `closeAllPools(): Promise<void>`

Gracefully closes all connection pools. Call this in your shutdown handler.

---

## Schema Tables

All tables are defined with Drizzle ORM and exported from subpath modules.

### Users & Auth

```ts
import {
  users,
  sessions,
  passwordResetTokens,
} from "@revealui/db/schema/users";
```

| Table                 | Key columns                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `users`               | `id`, `email`, `name`, `password`, `role`, `status`, `createdAt`    |
| `sessions`            | `id`, `userId`, `tokenHash`, `expiresAt`, `persistent`, `ipAddress` |
| `passwordResetTokens` | `id`, `userId`, `tokenHash`, `salt`, `usedAt`, `expiresAt`          |

### Content

```ts
import { sites, siteCollaborators } from "@revealui/db/schema/sites";
import { pages, pageRevisions } from "@revealui/db/schema/pages";
import { posts, media } from "@revealui/db/schema/admin";
```

### Agents & AI

```ts
import {
  agentMemories,
  agentContexts,
  agentActions,
  conversations,
} from "@revealui/db/schema/agents";
```

### Billing

```ts
import { licenses } from "@revealui/db/schema/licenses";
import {
  userApiKeys,
  tenantProviderConfigs,
} from "@revealui/db/schema/api-keys";
```

### Audit & Monitoring

```ts
import { auditLog, appLogs, errorEvents } from "@revealui/db/schema/rest";
```

---

## Querying (Drizzle ORM)

Use standard Drizzle ORM query syntax:

```ts
import { getRestClient } from "@revealui/db/client";
import { users, sessions } from "@revealui/db/schema/users";
import { eq, and, gt } from "drizzle-orm";

const db = getRestClient();

// Select
const activeUsers = await db
  .select()
  .from(users)
  .where(eq(users.status, "active"));

// Insert
const [newUser] = await db
  .insert(users)
  .values({ id: crypto.randomUUID(), email, name, role: "editor" })
  .returning();

// Update
await db
  .update(users)
  .set({ lastActiveAt: new Date() })
  .where(eq(users.id, userId));

// Delete
await db.delete(sessions).where(eq(sessions.userId, userId));
```

---

## Encryption

Import from `@revealui/db/crypto`.

Requires `REVEALUI_KEK` env var — a 64-character hex string (32 bytes), used as the key-encryption key.

```bash
# Generate a KEK:
openssl rand -hex 32
```

### `encryptApiKey(plaintext: string): string`

Encrypts a string with AES-256-GCM. Returns a dot-separated base64url string:
`<iv>.<authTag>.<ciphertext>`

```ts
import { encryptApiKey } from "@revealui/db/crypto";

const encrypted = encryptApiKey("sk-live-...");
// Store encrypted value in database
```

### `decryptApiKey(encrypted: string): string`

Decrypts an encrypted API key. Throws if the ciphertext has been tampered with (GCM authentication tag mismatch).

```ts
import { decryptApiKey } from "@revealui/db/crypto";

const plaintext = decryptApiKey(row.encryptedKey);
```

### `redactApiKey(plaintext: string): string`

Returns a safe display hint showing only the last 4 characters: `...xxxx`.

```ts
const hint = redactApiKey("sk-live-abc123xyz");
// '...xyz'
```

---

## TypeScript Types

Import from `@revealui/db/types` or directly from schema subpaths:

```ts
import type { User, Session, Site, Page, Post } from "@revealui/db";
```

Each table has three associated types:

| Pattern      | Description                             |
| ------------ | --------------------------------------- |
| `User`       | Read type (full row from `SELECT`)      |
| `NewUser`    | Insert type (for `INSERT INTO`)         |
| `UserUpdate` | Update type (partial, for `UPDATE SET`) |

---

## Migrations

Migrations are versioned SQL files in `packages/db/migrations/`.

```bash
# Apply all pending migrations
pnpm db:migrate

# Reset and re-apply all migrations
pnpm db:reset
```

Migration files follow the pattern `NNNN_description.sql`. Run them in order against your NeonDB instance.

---

## Related

- [`@revealui/auth`](/reference/auth) — Uses `users`, `sessions`, `passwordResetTokens`
- [`@revealui/contracts`](/reference/contracts) — Zod schemas mapping to DB rows
- [Database architecture](/docs/DATABASE) — Dual-DB design, schema overview

---

# @revealui/config

Type-safe environment variable configuration with Zod validation and lazy loading via Proxy.

```bash
npm install @revealui/config
```

## Quick Start

```ts
import config from "@revealui/config";

// Access config groups — validated on first access, not on import
const dbUrl = config.database.url;
const stripeKey = config.stripe.secretKey;
const serverUrl = config.reveal.serverURL;
```

---

## Design

- **Lazy validation** — variables are validated on first property access, not at import time. This allows Next.js to import the module during build without all env vars being present.
- **Fail-fast at runtime** — if a required variable is missing at runtime, accessing it throws with a clear error message listing which variables are unset.
- **Build-time lenient mode** — during `next build` (`NEXT_PHASE=phase-production-build`) or when `SKIP_ENV_VALIDATION=1`, validation is skipped. Missing optional variables return empty strings instead of throwing.

---

## `config` Object

The default export. Groups all environment variables by concern.

```ts
import config from "@revealui/config";

interface Config {
  database: DatabaseConfig;
  stripe: StripeConfig;
  storage: StorageConfig;
  reveal: RevealConfig;
  branding: BrandingConfig;
  optional: OptionalConfig;
}
```

---

## Config Groups

### `config.database`

NeonDB / Postgres connection.

```ts
interface DatabaseConfig {
  url: string; // POSTGRES_URL or DATABASE_URL or SUPABASE_DATABASE_URI
  connectionString: string; // same as url
}
```

**Env vars:** `POSTGRES_URL`, `DATABASE_URL`, `SUPABASE_DATABASE_URI` (first non-empty wins)

---

### `config.reveal`

Core RevealUI server settings.

```ts
interface RevealConfig {
  secret: string; // REVEALUI_SECRET — application secret (session signing, CSRF, HMAC operations)
  serverURL: string; // NEXT_PUBLIC_SERVER_URL — public-facing URL
  publicServerURL: string; // REVEALUI_PUBLIC_SERVER_URL
  adminEmail?: string; // REVEALUI_ADMIN_EMAIL
  adminPassword?: string; // REVEALUI_ADMIN_PASSWORD
  corsOrigins?: string[]; // REVEALUI_CORS_ORIGINS (comma-separated)
}
```

---

### `config.stripe`

Stripe payment processing.

```ts
interface StripeConfig {
  secretKey: string; // STRIPE_SECRET_KEY
  publishableKey: string; // NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  webhookSecret: string; // STRIPE_WEBHOOK_SECRET
  proxy?: boolean; // STRIPE_PROXY=1 — route via proxy
}
```

---

### `config.storage`

File upload storage.

```ts
interface StorageConfig {
  blobToken: string; // BLOB_READ_WRITE_TOKEN — Vercel Blob
}
```

---

### `config.branding`

White-label branding (Forge tier, planned).

```ts
interface BrandingConfig {
  name: string; // REVEALUI_BRAND_NAME (default: 'RevealUI')
  logoUrl?: string; // REVEALUI_LOGO_URL
  primaryColor?: string; // REVEALUI_PRIMARY_COLOR (hex)
  showPoweredBy: boolean; // REVEALUI_SHOW_POWERED_BY (default: true)
}
```

On free/pro tiers, `name` and `showPoweredBy` cannot be changed — the badge is always shown.

---

### `config.optional`

Third-party integrations — all optional, no error thrown if unset.

```ts
interface OptionalConfig {
  sentryDsn?: string; // SENTRY_DSN
  supabaseUrl?: string; // NEXT_PUBLIC_SUPABASE_URL
  supabaseAnonKey?: string; // NEXT_PUBLIC_SUPABASE_ANON_KEY
}
```

---

## Standalone Functions

Import individual config getters if you need them outside the main `config` proxy.

```ts
import {
  getDatabaseConfig,
  getRevealConfig,
  getStripeConfig,
} from "@revealui/config";

const dbConfig = getDatabaseConfig(process.env);
const revealConfig = getRevealConfig(process.env);
const stripeConfig = getStripeConfig(process.env);
```

---

## Config Instance API

### `getConfig(strict?: boolean): Config`

Returns the resolved `Config` object. Equivalent to importing `config` directly, but useful when you need to call it as a function (e.g. in a factory or DI container). Pass `strict: false` to disable throwing on missing vars (same as build-time lenient mode).

```ts
import { getConfig } from "@revealui/config";

const cfg = getConfig(); // throws if required vars missing
const cfg = getConfig(false); // lenient — returns partial config
```

### `resetConfig(): void`

Clears the cached config instance. Forces re-validation on the next access. Useful in tests to reset between cases with different env vars.

```ts
import { resetConfig } from "@revealui/config";

beforeEach(() => {
  process.env.POSTGRES_URL = "postgresql://test-db";
  resetConfig();
});
```

---

## Environment Detection

### `detectEnvironment(): Environment`

Returns the current environment string: `'development'`, `'test'`, `'staging'`, or `'production'`. Reads `NODE_ENV` with fallback logic.

### `loadEnvironment(): Record<string, string>`

Merges `process.env` with any `.env` file found in the current working directory. Returns the merged env record. Called automatically by `getConfig()` on first access.

```ts
import { detectEnvironment, loadEnvironment } from "@revealui/config";

const env = detectEnvironment(); // 'development' | 'test' | 'staging' | 'production'
const vars = loadEnvironment(); // { POSTGRES_URL: '...', ... }
```

---

## Validation

### `validateEnvVars(env): ValidationResult`

Validates all required env vars. Returns a result object — does not throw.

```ts
import { validateEnvVars } from "@revealui/config";

const result = validateEnvVars(process.env);
if (!result.success) {
  console.error("Missing env vars:", result.errors);
}
```

### `validateAndThrow(env): void`

Validates and throws `ConfigValidationError` if any required variables are missing.

```ts
import { validateAndThrow } from "@revealui/config";

// Call at app startup to catch misconfigurations early:
validateAndThrow(process.env);
```

### `formatValidationErrors(errors): string`

Returns a human-readable summary of validation errors.

---

## Environment Reference

Minimum required variables for a working RevealUI deployment:

```bash
# Core
REVEALUI_SECRET=your-application-secret
NEXT_PUBLIC_SERVER_URL=https://your-admin.com

# Database (one of:)
POSTGRES_URL=postgresql://...
DATABASE_URL=postgresql://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Optional
SENTRY_DSN=https://...@sentry.io/...
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

See `.env.template` in the repo root for the full list with descriptions.

---

## Related

- [`@revealui/core`](/reference/core) — Reads config via `buildConfig({ serverURL, ... })`
- [`@revealui/db`](/reference/db) — Uses `config.database.url` for the client
- [`@revealui/auth`](/reference/auth) — Uses `config.reveal.secret` for session signing

---

# @revealui/presentation

52 native UI components for building RevealUI apps. Zero external UI dependencies — only `clsx` and `cva`.

```bash
npm install @revealui/presentation
```

## Subpath Exports

| Import path                     | Environment | Purpose                               |
| ------------------------------- | ----------- | ------------------------------------- |
| `@revealui/presentation`        | Both        | All components, primitives, utilities |
| `@revealui/presentation/server` | Server only | RSC-safe subset (no client hooks)     |

---

## Component Reference

### Layout

#### `StackedLayout`

Full-page layout with a fixed navbar and scrollable content area.

```tsx
import { StackedLayout } from "@revealui/presentation";

<StackedLayout navbar={<Navbar />} sidebar={<Sidebar />}>
  {children}
</StackedLayout>;
```

#### `SidebarLayout`

Split layout with a collapsible sidebar panel and main content.

```tsx
import { SidebarLayout } from "@revealui/presentation";

<SidebarLayout sidebar={<AppSidebar />}>{children}</SidebarLayout>;
```

#### `AuthLayout`

Centered layout for sign-in and sign-up pages.

```tsx
import { AuthLayout } from "@revealui/presentation";

<AuthLayout title="Sign in to your account" logo={<Logo />}>
  <SignInForm />
</AuthLayout>;
```

---

### Navigation

#### `Navbar`

Horizontal navigation bar with logo, links, and actions slots.

```tsx
import {
  Navbar,
  NavbarSection,
  NavbarItem,
  NavbarLabel,
} from "@revealui/presentation";

<Navbar>
  <NavbarSection>
    <NavbarItem href="/">Home</NavbarItem>
    <NavbarItem href="/docs">Docs</NavbarItem>
  </NavbarSection>
  <NavbarSection className="ml-auto">
    <NavbarItem href="/login">Sign in</NavbarItem>
  </NavbarSection>
</Navbar>;
```

#### `Sidebar`

Vertical navigation sidebar with sections and items.

```tsx
import {
  Sidebar,
  SidebarSection,
  SidebarItem,
  SidebarLabel,
} from "@revealui/presentation";

<Sidebar>
  <SidebarSection>
    <SidebarLabel>Main</SidebarLabel>
    <SidebarItem href="/dashboard" current>
      Dashboard
    </SidebarItem>
    <SidebarItem href="/posts">Posts</SidebarItem>
  </SidebarSection>
</Sidebar>;
```

#### `Breadcrumb`

Breadcrumb trail with configurable separators.

```tsx
import { Breadcrumb } from "@revealui/presentation";

<Breadcrumb
  items={[
    { label: "Home", href: "/" },
    { label: "Blog", href: "/blog" },
    { label: "Getting Started" },
  ]}
/>;
```

#### `Tabs`

Horizontal tab navigation.

```tsx
import {
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
} from "@revealui/presentation";

<Tabs defaultValue="overview">
  <TabList>
    <Tab value="overview">Overview</Tab>
    <Tab value="settings">Settings</Tab>
  </TabList>
  <TabPanels>
    <TabPanel value="overview">
      <Overview />
    </TabPanel>
    <TabPanel value="settings">
      <Settings />
    </TabPanel>
  </TabPanels>
</Tabs>;
```

---

### Inputs

#### `Button`

Primary interactive element. Supports variants, sizes, and loading state.

```tsx
import { Button } from '@revealui/presentation'

<Button variant="primary" size="md" disabled={loading}>
  Save changes
</Button>
<Button variant="secondary" href="/docs">View docs</Button>
<Button variant="destructive" onClick={handleDelete}>Delete</Button>
```

**Props:** `variant` (`primary | secondary | outline | ghost | destructive`), `size` (`sm | md | lg`), `href`, `disabled`, `loading`

#### `Input`

Text input with optional label, description, and error state.

```tsx
import { Input } from "@revealui/presentation";

<Input
  label="Email address"
  type="email"
  placeholder="you@example.com"
  description="We'll never share your email."
  error={errors.email}
/>;
```

#### `Textarea`

Multi-line text input.

```tsx
import { Textarea } from "@revealui/presentation";

<Textarea label="Message" rows={4} placeholder="Your message..." />;
```

#### `Select`

Dropdown select with label and error state.

```tsx
import { Select } from "@revealui/presentation";

<Select label="Role" value={role} onChange={setRole}>
  <option value="admin">Admin</option>
  <option value="editor">Editor</option>
  <option value="viewer">Viewer</option>
</Select>;
```

#### `Checkbox`

Single checkbox with label and description.

```tsx
import { Checkbox } from "@revealui/presentation";

<Checkbox
  label="Subscribe to updates"
  description="Get notified about new releases."
/>;
```

#### `Fieldset`

Groups related form inputs with a legend.

```tsx
import { Fieldset, Legend, Field, Label } from "@revealui/presentation";

<Fieldset>
  <Legend>Notification preferences</Legend>
  <Field>
    <Label>Email</Label>
    <Input type="email" />
  </Field>
</Fieldset>;
```

#### `FormLabel`

Standalone label with optional required indicator.

```tsx
import { FormLabel } from "@revealui/presentation";

<FormLabel htmlFor="name" required>
  Full name
</FormLabel>;
```

#### `Slider`

Range slider input.

```tsx
import { Slider } from "@revealui/presentation";

<Slider min={0} max={100} step={5} value={volume} onChange={setVolume} />;
```

#### `Switch`

Toggle switch for boolean settings.

```tsx
import { Switch } from "@revealui/presentation";

<Switch checked={enabled} onChange={setEnabled} label="Enable notifications" />;
```

#### `Radio`

Radio button group.

```tsx
import { Radio, RadioGroup, RadioField } from "@revealui/presentation";

<RadioGroup value={plan} onChange={setPlan}>
  <RadioField>
    <Radio value="free" label="Free" />
  </RadioField>
  <RadioField>
    <Radio value="pro" label="Pro" />
  </RadioField>
</RadioGroup>;
```

#### `Combobox`

Searchable dropdown (autocomplete).

```tsx
import { Combobox } from "@revealui/presentation";

<Combobox
  options={users}
  displayValue={(u) => u.name}
  onChange={setSelectedUser}
  placeholder="Search users..."
/>;
```

#### `Listbox`

Accessible multi-option listbox.

---

### Feedback

#### `Alert`

Informational banner. Variants match intent.

```tsx
import { Alert } from '@revealui/presentation'

<Alert variant="info" title="Heads up">Your trial expires in 3 days.</Alert>
<Alert variant="success">Changes saved.</Alert>
<Alert variant="warning" title="Action required">Verify your email.</Alert>
<Alert variant="error">Something went wrong.</Alert>
```

#### `Callout`

Highlighted block for important inline notes.

```tsx
import { Callout } from "@revealui/presentation";

<Callout type="warning">This action cannot be undone.</Callout>;
```

#### `Badge`

Inline status chip.

```tsx
import { Badge } from '@revealui/presentation'

<Badge color="green">Active</Badge>
<Badge color="red">Failed</Badge>
<Badge color="yellow">Pending</Badge>
```

#### `Progress`

Linear progress bar.

```tsx
import { Progress } from "@revealui/presentation";

<Progress value={72} max={100} label="Upload progress" />;
```

#### `Skeleton`

Loading placeholder.

```tsx
import { Skeleton } from '@revealui/presentation'

<Skeleton className="h-4 w-48" />
<Skeleton className="h-32 w-full rounded-xl" />
```

#### `Toast`

Transient notification. Use with `useToast()`.

```tsx
import { useToast } from "@revealui/presentation";

const { toast } = useToast();
toast.success("Saved!", { description: "Your changes were saved." });
toast.error("Failed", { description: "Please try again." });
```

#### `Rating`

Star rating display or input.

```tsx
import { Rating } from "@revealui/presentation";

<Rating value={4} max={5} readOnly />;
```

---

### Overlays

#### `Dialog`

Modal dialog with backdrop.

```tsx
import { Dialog } from "@revealui/presentation";

<Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Delete post">
  <p>Are you sure? This cannot be undone.</p>
  <div className="mt-4 flex gap-2">
    <Button variant="destructive" onClick={handleDelete}>
      Delete
    </Button>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
  </div>
</Dialog>;
```

#### `Drawer`

Side panel that slides in from the edge.

```tsx
import { Drawer } from "@revealui/presentation";

<Drawer
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Settings"
  side="right"
>
  <SettingsPanel />
</Drawer>;
```

#### `Dropdown`

Context menu / action menu.

```tsx
import {
  Dropdown,
  DropdownButton,
  DropdownMenu,
  DropdownItem,
} from "@revealui/presentation";

<Dropdown>
  <DropdownButton>Actions</DropdownButton>
  <DropdownMenu>
    <DropdownItem onClick={handleEdit}>Edit</DropdownItem>
    <DropdownItem onClick={handleDelete} destructive>
      Delete
    </DropdownItem>
  </DropdownMenu>
</Dropdown>;
```

#### `Tooltip`

Floating label on hover.

```tsx
import { Tooltip } from "@revealui/presentation";

<Tooltip content="Copy to clipboard">
  <Button>Copy</Button>
</Tooltip>;
```

---

### Data Display

#### `Card`

Content container with optional padding and border.

```tsx
import { Card } from "@revealui/presentation";

<Card>
  <h2 className="text-lg font-semibold">Revenue</h2>
  <p className="text-3xl font-bold">$12,400</p>
</Card>;
```

#### `Stat`

KPI / metric display with label, value, and trend.

```tsx
import { Stat } from "@revealui/presentation";

<Stat label="Monthly revenue" value="$12,400" change="+8.2%" trend="up" />;
```

#### `Table`

Responsive data table.

```tsx
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@revealui/presentation";

<Table>
  <TableHead>
    <TableRow>
      <TableHeader>Name</TableHeader>
      <TableHeader>Status</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    {rows.map((row) => (
      <TableRow key={row.id}>
        <TableCell>{row.name}</TableCell>
        <TableCell>
          <Badge>{row.status}</Badge>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>;
```

#### `Avatar` / `AvatarGroup`

User avatar with fallback initials.

```tsx
import { Avatar, AvatarGroup } from '@revealui/presentation'

<Avatar src={user.avatar} name={user.name} size="md" />
<AvatarGroup users={team} max={4} />
```

#### `DescriptionList`

Label-value pair list for detail views.

```tsx
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "@revealui/presentation";

<DescriptionList>
  <DescriptionTerm>Plan</DescriptionTerm>
  <DescriptionDetails>Pro — $49/month</DescriptionDetails>
  <DescriptionTerm>Renewal</DescriptionTerm>
  <DescriptionDetails>March 15, 2026</DescriptionDetails>
</DescriptionList>;
```

#### `Timeline`

Vertical chronological list.

```tsx
import { Timeline, TimelineItem } from "@revealui/presentation";

<Timeline>
  <TimelineItem
    date="Mar 4"
    title="Deployment"
    description="v1.2.0 deployed to production."
  />
  <TimelineItem date="Mar 3" title="Review" description="PR #42 approved." />
</Timeline>;
```

#### `Stepper`

Multi-step progress indicator.

```tsx
import { Stepper } from "@revealui/presentation";

<Stepper steps={["Account", "Project", "Database", "Done"]} currentStep={2} />;
```

#### `Pagination`

Page navigation controls.

```tsx
import { Pagination } from "@revealui/presentation";

<Pagination
  currentPage={page}
  totalPages={Math.ceil(total / perPage)}
  onPageChange={setPage}
/>;
```

#### `CodeBlock`

Syntax-highlighted code display with a copy button.

```tsx
import { CodeBlock } from "@revealui/presentation";

<CodeBlock
  code={`const x = 1`}
  language="typescript"
  filename="example.ts"
  showCopy
/>;
```

#### `Kbd`

Keyboard shortcut display.

```tsx
import { Kbd } from "@revealui/presentation";

<Kbd>⌘K</Kbd>;
```

#### `EmptyState`

Placeholder for empty lists or search results.

```tsx
import { EmptyState } from "@revealui/presentation";

<EmptyState
  title="No posts yet"
  description="Create your first post to get started."
  action={<Button href="/posts/new">New post</Button>}
/>;
```

---

### Accordion

Collapsible content sections.

```tsx
import { Accordion, AccordionItem } from "@revealui/presentation";

<Accordion>
  <AccordionItem title="What is RevealUI?">
    RevealUI is an open-source business runtime for software companies.
  </AccordionItem>
  <AccordionItem title="Is it free?">
    The core framework is MIT licensed and free to use.
  </AccordionItem>
</Accordion>;
```

---

### Divider

Horizontal rule with optional label.

```tsx
import { Divider } from '@revealui/presentation'

<Divider />
<Divider label="or continue with" />
```

---

## Primitives

Low-level layout primitives that accept any Tailwind classes.

```tsx
import { Box, Flex, Grid, Heading, Text } from '@revealui/presentation'

<Flex gap={4} align="center">
  <Box className="w-12 h-12 rounded-full bg-zinc-200" />
  <Box>
    <Heading level={3}>Jane Smith</Heading>
    <Text color="muted">Admin</Text>
  </Box>
</Flex>

<Grid cols={3} gap={6}>
  {items.map((item) => <Card key={item.id}>{item.name}</Card>)}
</Grid>
```

---

## Utilities

### `cn(...classes)`

Merges Tailwind classes with `clsx`. Use this instead of string concatenation.

```ts
import { cn } from '@revealui/presentation'

<div className={cn('rounded px-4 py-2', isActive && 'bg-blue-600 text-white')} />
```

---

## Headless Primitives

Behaviour-only versions of form controls — bring your own styles.

| Export             | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `ButtonHeadless`   | Accessible button with keyboard handling |
| `InputHeadless`    | Uncontrolled input with validation       |
| `CheckboxHeadless` | Accessible checkbox                      |
| `SelectHeadless`   | Accessible select                        |
| `TextareaHeadless` | Uncontrolled textarea                    |

---

## Related

- [`@revealui/core`](/reference/core) — Uses `presentation` for admin UI components
- [Component catalog](/docs/COMPONENT_CATALOG) — Visual index of all 58 components

---

# @revealui/utils

Shared utilities used across the RevealUI monorepo — structured logging, database helpers, and validation.

```bash
npm install @revealui/utils
```

## Subpath Exports

All exports are available from the main entry:

```ts
import {
  createLogger,
  logger,
  logError,
  logAudit,
  logQuery,
} from "@revealui/utils";
import { getSSLConfig, validateSSLConfig } from "@revealui/utils";
import { passwordSchema } from "@revealui/utils";
```

---

## Logging

A structured logger with configurable levels, destinations, and request context. Used throughout the monorepo — do not use `console.*` in production code; use this instead.

### `logger`

Global default logger instance. Use when no request context is available.

```ts
import { logger } from "@revealui/utils";

logger.info("Server started", { port: 3000 });
logger.warn("Config missing optional field", { field: "adminEmail" });
logger.error("Unhandled exception", { error });
```

---

### `createLogger(context)`

Creates a scoped logger with persistent context fields attached to every log entry.

```ts
import { createLogger } from "@revealui/utils";

const log = createLogger({ module: "auth", requestId: req.id });
log.info("User signed in", { userId: user.id });
log.error("Sign-in failed", { email, reason: "invalid-password" });
```

Every entry produced by this logger will include `module` and `requestId` automatically.

---

### `Logger` class

Full logger class for advanced usage.

```ts
import { Logger } from "@revealui/utils";

const log = new Logger({
  level: "debug",
  pretty: true, // human-readable output in dev
  destination: "console", // 'console' | 'file' | 'remote'
  remoteUrl: "https://...", // required when destination='remote'
  onLog: (entry) => {
    /* custom handler */
  },
});

// Methods: debug, info, warn, error, fatal
log.debug("Processing request", { path });
log.info("Collection queried", { slug, count });
log.warn("Rate limit approaching", { key, remaining: 5 });
log.error("DB query failed", { query, error });
log.fatal("Unrecoverable error — shutting down");
```

**`LoggerConfig`:**

```ts
interface LoggerConfig {
  level?: LogLevel; // minimum level to output (default: 'info')
  enabled?: boolean; // set false to silence (default: true)
  pretty?: boolean; // human-readable vs JSON output
  includeTimestamp?: boolean; // prepend ISO timestamp (default: true)
  includeStack?: boolean; // include stack traces on errors
  destination?: "console" | "file" | "remote";
  remoteUrl?: string; // required when destination='remote'
  onLog?: (entry: LogEntry) => void;
}
```

---

### `logger.child(context)`

Creates a child logger that inherits all parent configuration and context, merging in additional fields.

```ts
const requestLog = logger.child({ requestId: req.id, userId: session.userId });
requestLog.info("Request received", { method: req.method, path: req.url });
```

Child loggers share parent handlers (e.g. remote transport).

---

### `logError(error, context?)`

Convenience function — logs an `Error` at `error` level with the stack trace.

```ts
import { logError } from '@revealui/utils'

try {
  await db.query(...)
} catch (err) {
  logError(err as Error, { query: sql, userId })
}
```

---

### `logAudit(action, context?)`

Logs an audit event at `info` level. Use for security-sensitive operations.

```ts
import { logAudit } from "@revealui/utils";

logAudit("user.password_changed", { userId, ipAddress });
logAudit("admin.collection_deleted", { userId, collection: "posts" });
```

---

### `logQuery(query, duration, context?)`

Logs a database query at `debug` level with execution time.

```ts
import { logQuery } from "@revealui/utils";

const start = performance.now();
const result = await db.select().from(posts);
logQuery("SELECT * FROM posts", performance.now() - start, {
  count: result.length,
});
```

---

### Types

```ts
type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogContext {
  [key: string]: unknown;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: { name: string; message: string; stack?: string };
  metadata?: Record<string, unknown>;
}
```

---

## Database Utilities

### `getSSLConfig(connectionString?)`

Returns an SSL config object suitable for passing to node-postgres. Handles Neon, Supabase, and standard Postgres connection strings.

```ts
import { getSSLConfig } from "@revealui/utils";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: getSSLConfig(process.env.POSTGRES_URL),
});
```

**`SSLConfig`:**

```ts
interface SSLConfig {
  rejectUnauthorized: boolean;
  ca?: string;
}
```

---

### `validateSSLConfig(config)`

Validates an SSL config object. Throws if the config is malformed.

```ts
import { validateSSLConfig } from "@revealui/utils";

validateSSLConfig({ rejectUnauthorized: true });
```

---

## Validation

### `passwordSchema`

Zod schema for validating password strength. Used by `@revealui/auth`.

```ts
import { passwordSchema } from "@revealui/utils";

const result = passwordSchema.safeParse(userInput);
if (!result.success) {
  // result.error.issues → list of failing rules
}
```

**Rules enforced:**

- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

```ts
type Password = z.infer<typeof passwordSchema>;
```

---

## Related

- [`@revealui/core`](/reference/core) — Re-exports `createLogger` and `logger` for app-level use
- [`@revealui/auth`](/reference/auth) — Uses `passwordSchema` and `logAudit`
- [`@revealui/db`](/reference/db) — Uses `getSSLConfig` for connection pool setup

---

# @revealui/auth

Session-based authentication for RevealUI apps. Provides sign in/up, session management, OAuth account linking, brute-force protection, rate limiting, and password reset — all backed by PostgreSQL.

```bash
npm install @revealui/auth
```

## Subpath Exports

| Import path             | Environment | Purpose                                   |
| ----------------------- | ----------- | ----------------------------------------- |
| `@revealui/auth`        | Both        | Re-exports server + react + types         |
| `@revealui/auth/server` | Server only | All server-side auth functions            |
| `@revealui/auth/react`  | Client only | React hooks (useSession, useSignIn, etc.) |

---

## Authentication

### `signIn(email, password, options?)`

Authenticates a user with email and password. Records failed attempts for brute-force protection.

```ts
import { signIn } from "@revealui/auth/server";

const result = await signIn("user@example.com", "password123", {
  userAgent: req.headers.get("user-agent") ?? undefined,
  ipAddress: "127.0.0.1",
});

if (result.success) {
  // Set session cookie with result.sessionToken
}
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `email` | `string` | User's email address |
| `password` | `string` | Plain-text password to verify |
| `options.userAgent` | `string?` | Browser user-agent for session tracking |
| `options.ipAddress` | `string?` | Client IP for session tracking |

**Returns:** `Promise<SignInResult>`

```ts
interface SignInResult {
  success: boolean;
  user?: User;
  sessionToken?: string;
  error?: string;
}
```

---

### `signUp(email, password, name, options?)`

Creates a new user account with hashed password. Returns a session token on success.

```ts
import { signUp } from "@revealui/auth/server";

const result = await signUp("user@example.com", "SecureP@ss1", "Jane Doe", {
  tosAcceptedAt: new Date(),
  tosVersion: "2025-01",
});
```

**Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `email` | `string` | Email address (must be unique) |
| `password` | `string` | Password (validated against strength rules) |
| `name` | `string` | Display name |
| `options.userAgent` | `string?` | Browser user-agent |
| `options.ipAddress` | `string?` | Client IP |
| `options.tosAcceptedAt` | `Date?` | Timestamp of ToS acceptance |
| `options.tosVersion` | `string?` | Version of accepted ToS |

**Returns:** `Promise<SignUpResult>`

---

### `isSignupAllowed(email)`

Checks if an email is allowed to register (not blocked, not already taken).

```ts
import { isSignupAllowed } from "@revealui/auth/server";

if (!isSignupAllowed("user@example.com")) {
  throw new Error("Registration not allowed for this email");
}
```

**Returns:** `boolean`

---

## Sessions

### `createSession(userId, options?)`

Creates a new session and returns the raw token (to set as a cookie).

```ts
import { createSession } from "@revealui/auth/server";

const { token, session } = await createSession(user.id, {
  persistent: true, // 7-day expiry (vs 1-day for non-persistent)
  userAgent: "Mozilla/5.0...",
  ipAddress: "192.168.1.1",
});

// Set cookie: revealui-session=<token>
```

**Returns:** `Promise<{ token: string; session: Session }>`

---

### `getSession(headers)`

Retrieves the current session from the `revealui-session` cookie in the request headers.

```ts
import { getSession } from "@revealui/auth/server";

const session = await getSession(request.headers);
if (!session) {
  return new Response("Unauthorized", { status: 401 });
}
// session.user, session.session available
```

**Returns:** `Promise<SessionData | null>`

```ts
interface SessionData {
  session: Session;
  user: User;
}
```

---

### `deleteSession(headers)`

Deletes the session identified by the cookie in the request headers.

```ts
import { deleteSession } from "@revealui/auth/server";

await deleteSession(request.headers); // returns true if deleted
```

**Returns:** `Promise<boolean>`

---

### `deleteAllUserSessions(userId)`

Deletes all sessions for a user (e.g., after password change or account compromise).

```ts
import { deleteAllUserSessions } from "@revealui/auth/server";

await deleteAllUserSessions(user.id);
```

---

## OAuth

### `buildAuthUrl(provider, redirectUri, state)`

Builds the OAuth authorization URL for a given provider.

```ts
import { buildAuthUrl, generateOAuthState } from "@revealui/auth/server";

const { state, cookieValue } = generateOAuthState("github", "/dashboard");
const url = buildAuthUrl(
  "github",
  "https://app.example.com/auth/callback/github",
  state,
);
// Redirect user to url, set state cookie to cookieValue
```

**Supported providers:** `github`, `google`, `vercel`

---

### `generateOAuthState(provider, redirectTo)` / `verifyOAuthState(state, cookieValue)`

CSRF protection for OAuth flows. Generate a state param before redirect, verify it on callback.

```ts
import { generateOAuthState, verifyOAuthState } from "@revealui/auth/server";

// Before redirect
const { state, cookieValue } = generateOAuthState("github", "/dashboard");

// On callback
const verified = verifyOAuthState(callbackState, storedCookieValue);
if (!verified) throw new Error("Invalid OAuth state");
// verified.provider, verified.redirectTo
```

---

### `exchangeCode(provider, code, redirectUri)`

Exchanges an authorization code for an access token.

**Returns:** `Promise<string>` — the access token

---

### `fetchProviderUser(provider, accessToken)`

Fetches the authenticated user's profile from the OAuth provider.

**Returns:** `Promise<ProviderUser>`

```ts
interface ProviderUser {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
}
```

---

### `upsertOAuthUser(provider, providerUser)`

Creates or updates a user from OAuth login. If the email already exists, links the OAuth account to the existing user.

**Returns:** `Promise<User>`

---

### `linkOAuthAccount(userId, provider, providerUser)` / `unlinkOAuthAccount(userId, provider)`

Link or unlink an OAuth provider to an existing authenticated user's account.

```ts
import { linkOAuthAccount, unlinkOAuthAccount } from "@revealui/auth/server";

// Link GitHub to current user
await linkOAuthAccount(user.id, "github", providerUser);

// Unlink GitHub
await unlinkOAuthAccount(user.id, "github");
```

---

### `getLinkedProviders(userId)`

Returns all OAuth providers linked to a user account.

```ts
import { getLinkedProviders } from "@revealui/auth/server";

const providers = await getLinkedProviders(user.id);
// [{ provider: 'github', providerEmail: 'user@github.com', providerName: 'Jane' }]
```

**Returns:** `Promise<Array<{ provider: string; providerEmail: string | null; providerName: string | null }>>`

---

## Brute-Force Protection

### `recordFailedAttempt(email, config?)`

Records a failed login attempt. After `maxAttempts` within the window, the account is locked.

```ts
import { recordFailedAttempt, isAccountLocked } from "@revealui/auth/server";

await recordFailedAttempt("user@example.com");

const status = await isAccountLocked("user@example.com");
if (status.locked) {
  // Account locked until status.lockUntil
}
```

**Config defaults:**

```ts
interface BruteForceConfig {
  maxAttempts: number; // default: 5
  lockDurationMs: number; // default: 15 minutes
  windowMs: number; // default: 15 minutes
}
```

---

### `clearFailedAttempts(email)`

Clears all failed attempts for an email (call after successful login).

---

### `getFailedAttemptCount(email)`

Returns the current number of failed attempts.

**Returns:** `Promise<number>`

---

## Rate Limiting

### `checkRateLimit(key, config?)`

Checks if a rate limit key has remaining capacity.

```ts
import { checkRateLimit } from "@revealui/auth/server";

const limit = await checkRateLimit(`login:${ip}`, {
  maxAttempts: 10,
  windowMs: 60_000, // 1 minute
});

if (!limit.allowed) {
  return new Response("Too many requests", { status: 429 });
}
```

**Returns:** `Promise<{ allowed: boolean; remaining: number; resetAt: number }>`

---

### `resetRateLimit(key)`

Resets a rate limit counter.

---

### `getRateLimitStatus(key, config?)`

Returns current rate limit status without consuming an attempt.

**Returns:** `Promise<{ count: number; remaining: number; resetAt: number }>`

---

## Password Reset

### `generatePasswordResetToken(email)`

Generates a password reset token and stores it in the database. Send the token to the user via email.

```ts
import { generatePasswordResetToken } from "@revealui/auth/server";

const result = await generatePasswordResetToken("user@example.com");
if (result.success) {
  // Send email with result.token and result.tokenId
}
```

**Returns:** `Promise<PasswordResetResult>`

---

### `validatePasswordResetToken(tokenId, token)`

Validates a password reset token without consuming it. Returns the user ID if valid.

**Returns:** `Promise<string | null>` — user ID or null

---

### `resetPasswordWithToken(tokenId, token, newPassword)`

Resets the user's password and invalidates the token.

```ts
import { resetPasswordWithToken } from "@revealui/auth/server";

const result = await resetPasswordWithToken(tokenId, token, "NewSecureP@ss1");
if (result.success) {
  // Password updated, redirect to login
}
```

---

### `invalidatePasswordResetToken(tokenId, token)`

Manually invalidates a password reset token.

---

## Password Validation

### `validatePasswordStrength(password)`

Validates password against strength requirements (min 8 chars, uppercase, lowercase, digit, special char).

```ts
import { validatePasswordStrength } from "@revealui/auth/server";

const result = validatePasswordStrength("weak");
// { valid: false, errors: ['at least 8 characters', 'at least one uppercase letter', ...] }
```

**Returns:** `PasswordValidationResult`

```ts
interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

### `meetsMinimumPasswordRequirements(password)`

Quick boolean check — returns `true` if the password passes all strength requirements.

---

## React Hooks

### `useSession()`

Returns the current authenticated session, with loading and error states.

```tsx
import { useSession } from "@revealui/auth/react";

function ProfileButton() {
  const { data, isLoading } = useSession();

  if (isLoading) return <Spinner />;
  if (!data) return <a href="/login">Sign in</a>;

  return <span>Hello, {data.user.name}</span>;
}
```

**Returns:** `UseSessionResult`

```ts
interface UseSessionResult {
  data: AuthSession | null; // { session, user }
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

---

### `useSignIn()`

Provides a `signIn` function for email/password authentication.

```tsx
import { useSignIn } from "@revealui/auth/react";

function LoginForm() {
  const { signIn, isLoading } = useSignIn();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const result = await signIn({ email, password });
    if (result.success) router.push("/dashboard");
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

### `useSignUp()`

Provides a `signUp` function for new account registration.

```tsx
import { useSignUp } from "@revealui/auth/react";

function RegisterForm() {
  const { signUp, isLoading } = useSignUp();

  const result = await signUp({
    email: "user@example.com",
    password: "SecureP@ss1",
    name: "Jane Doe",
    tosAccepted: true,
  });
}
```

---

### `useSignOut()`

Provides a `signOut` function that deletes the current session.

```tsx
import { useSignOut } from "@revealui/auth/react";

function LogoutButton() {
  const { signOut, isLoading } = useSignOut();
  return (
    <button onClick={signOut} disabled={isLoading}>
      Sign out
    </button>
  );
}
```

---

## Error Classes

| Class                       | Code                     | When                                          |
| --------------------------- | ------------------------ | --------------------------------------------- |
| `AuthError`                 | varies                   | Base class for all auth errors                |
| `AuthenticationError`       | `AUTHENTICATION_ERROR`   | Invalid credentials                           |
| `SessionError`              | `SESSION_ERROR`          | Invalid or expired session                    |
| `TokenError`                | `TOKEN_ERROR`            | Invalid reset/verification token              |
| `DatabaseError`             | `DATABASE_ERROR`         | Database operation failed                     |
| `OAuthAccountConflictError` | `OAUTH_ACCOUNT_CONFLICT` | OAuth email already linked to another account |

All error classes extend `AuthError` which extends `Error`. Each includes a `code` string and optional `statusCode` number.

```ts
import { AuthenticationError, SessionError } from "@revealui/auth/server";

try {
  await signIn(email, password);
} catch (err) {
  if (err instanceof AuthenticationError) {
    // Invalid credentials
  }
}
```

---

## Types

### `User`

```ts
interface User {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  preferences: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date | null;
}
```

### `Session`

```ts
interface Session {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  persistent: boolean | null;
  lastActivityAt: Date;
  createdAt: Date;
  expiresAt: Date;
}
```

### `AuthSession`

```ts
interface AuthSession {
  session: Session;
  user: User;
}
```

---

## Architecture Notes

- **Session-only auth** — no JWT tokens. Sessions are stored in PostgreSQL and identified by a `revealui-session` cookie containing an opaque `randomBytes(32).toString('hex')` token.
- **Cookie domain** — `.revealui.com` for cross-subdomain support (admin, API, marketing all share sessions).
- **Password hashing** — bcrypt with automatic salt generation.
- **Token hashing** — session tokens and reset tokens are hashed with SHA-256 before storage.
- **OAuth state** — CSRF-protected with HMAC-signed state parameters.

---

## Related

- [`@revealui/core`](/reference/core) — Runtime engine, uses auth for admin access control
- [`@revealui/contracts`](/reference/contracts) — `passwordSchema` Zod schema for validation
- [`@revealui/db`](/reference/db) — `users`, `sessions`, `passwordResetTokens`, `oauthAccounts` tables

---

# @revealui/router

Lightweight client-side router with SSR support. Built on `path-to-regexp` — no heavy dependencies.

```bash
npm install @revealui/router
```

## Subpath Exports

| Import path               | Environment | Purpose                         |
| ------------------------- | ----------- | ------------------------------- |
| `@revealui/router`        | Both        | Components, hooks, Router class |
| `@revealui/router/server` | Server only | SSR rendering utilities         |

---

## Setup

```tsx
import { Router, RouterProvider, Routes } from "@revealui/router";

const router = new Router({ basePath: "" });

router.registerRoutes([
  { path: "/", component: HomePage },
  { path: "/about", component: AboutPage },
  { path: "/posts/:id", component: PostPage },
]);

export function App() {
  return (
    <RouterProvider router={router}>
      <Routes />
    </RouterProvider>
  );
}
```

---

## Core Class

### `new Router(options?)`

Creates a router instance. Pass it to `<RouterProvider>`.

```ts
import { Router } from "@revealui/router";

const router = new Router({
  basePath: "/app", // optional URL prefix
});
```

**`RouterOptions`:**

```ts
interface RouterOptions {
  basePath?: string; // strip this prefix from all matched paths
}
```

---

### `router.register(route)`

Registers a single route.

```ts
router.register({
  path: "/posts/:id",
  component: PostPage,
  loader: async ({ params }) => {
    return fetch(`/api/posts/${params.id}`).then((r) => r.json());
  },
});
```

**`Route`:**

```ts
interface Route {
  path: string;
  component: React.ComponentType;
  loader?: (match: RouteMatch) => Promise<unknown>;
}
```

---

### `router.registerRoutes(routes)`

Registers multiple routes at once.

```ts
router.registerRoutes([
  { path: "/", component: Home },
  { path: "/about", component: About },
]);
```

---

### `router.match(url)`

Matches a URL string against registered routes. Returns a `RouteMatch` or `null`.

```ts
const match = router.match("/posts/42");
// { route: { path: '/posts/:id', ... }, params: { id: '42' } }
```

**`RouteMatch`:**

```ts
interface RouteMatch {
  route: Route;
  params: RouteParams; // e.g. { id: '42' }
}
```

---

### `router.navigate(url, options?)`

Programmatically navigate to a URL. Updates `window.history`.

```ts
router.navigate("/dashboard");
router.navigate("/login", { replace: true }); // replaces history entry
router.navigate("/settings", { state: { tab: "billing" } });
```

**`NavigateOptions`:**

```ts
interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}
```

---

### `router.subscribe(listener)` / `router.unsubscribe(listener)`

Listen for route changes (e.g. to sync with external state).

```ts
const cleanup = router.subscribe(() => {
  console.log("Route changed to", window.location.pathname);
});

// Later:
cleanup();
```

---

## React Components

### `<RouterProvider router={router}>`

Provides the router instance to all child components via context. Wrap your entire app.

```tsx
import { RouterProvider } from "@revealui/router";

<RouterProvider router={router}>
  <App />
</RouterProvider>;
```

---

### `<Routes />`

Renders the component matched by the current URL. Place this where you want page content to appear.

```tsx
import { Routes } from "@revealui/router";

function Layout() {
  return (
    <div>
      <Navbar />
      <main>
        <Routes />
      </main>
    </div>
  );
}
```

---

### `<Link href>`

Client-side navigation link. Intercepts clicks to use `router.navigate()` instead of full page reloads.

```tsx
import { Link } from '@revealui/router'

<Link href="/dashboard">Dashboard</Link>
<Link href="/posts/42" className="text-blue-500">Read post</Link>
```

---

### `<Navigate to>`

Declarative redirect. Navigates on render.

```tsx
import { Navigate } from "@revealui/router";

if (!user) {
  return <Navigate to="/login" />;
}
```

---

## React Hooks

### `useRouter()`

Returns the `Router` instance from context.

```ts
import { useRouter } from "@revealui/router";

const router = useRouter();
router.navigate("/settings");
```

---

### `useNavigate()`

Returns a `navigate` function bound to the current router.

```ts
import { useNavigate } from "@revealui/router";

const navigate = useNavigate();

function handleSubmit() {
  await savePost();
  navigate("/posts");
}
```

---

### `useParams()`

Returns the dynamic route parameters from the current match.

```ts
import { useParams } from "@revealui/router";

// Route: /posts/:id
const { id } = useParams<{ id: string }>();
```

---

### `useMatch()`

Returns the current `RouteMatch` object (route + params).

```ts
import { useMatch } from "@revealui/router";

const match = useMatch();
// { route: { path: '/posts/:id', ... }, params: { id: '42' } }
```

---

### `useData()`

Returns the data resolved by the current route's `loader` function.

```ts
import { useData } from "@revealui/router";

// Route loader: async ({ params }) => fetchPost(params.id)
const post = useData<Post>();
```

---

## Server-Side Rendering

Import from `@revealui/router/server`. The router integrates with Hono for SSR.

### `createSSRHandler(routes, options?): HonoHandler`

Creates a Hono request handler that matches the URL, runs the route loader, renders to an HTML string (or streams), and inlines loader data for hydration. Uses `react-dom/server` under the hood.

```ts
import { createSSRHandler } from "@revealui/router/server";
import { Hono } from "hono";
import { routes } from "./routes";

const app = new Hono();
app.get(
  "*",
  createSSRHandler(routes, {
    template: (html, data) => `<!DOCTYPE html>
<html><head><title>${data?.title ?? "App"}</title></head>
<body><div id="root">${html}</div>
<script type="module" src="/src/client.tsx"></script>
</body></html>`,
  }),
);
```

**`SSROptions`:**

```ts
interface SSROptions {
  /** HTML template function — receives rendered HTML + loader data */
  template?: (html: string, data?: Record<string, unknown>) => string;
  /** Enable streaming SSR via renderToPipeableStream */
  streaming?: boolean;
  /** Error handler */
  onError?: (error: Error, context: Context) => void;
}
```

---

### `createDevServer(routes, options?): Promise<void>`

Starts a local development server with HMR support. Wraps Hono + Vite middleware.

```ts
import { createDevServer } from "@revealui/router/server";
import { routes } from "./routes";

await createDevServer(routes, { port: 3000 });
```

---

### `hydrate(router?, rootElement?): Promise<void>`

Hydrates the server-rendered HTML on the client. Call this in your client entry point.

```ts
// src/client.tsx
import { hydrate } from "@revealui/router/server";

await hydrate(); // auto-detects router + #root element
```

---

## Types

```ts
import type {
  Route,
  RouteMatch,
  RouteParams,
  RouterOptions,
  NavigateOptions,
} from "@revealui/router";
```

---

## Related

- [`@revealui/core`](/reference/core) — Uses the router for admin UI routing
- [`@revealui/presentation`](/reference/presentation) — `Link`, `Navbar`, and `Sidebar` integrate with the router

---

# @revealui/cli

`create-revealui` scaffolding tool. Generates a new RevealUI project from a template with interactive prompts for database, storage, payments, and dev environment configuration.

```bash
npm install -g @revealui/cli
# or use directly with npx:
npx create-revealui my-project
```

---

## Usage

### `create-revealui [project-name]`

Interactive wizard that creates a new RevealUI project.

```bash
npx create-revealui my-saas-app
```

If `project-name` is omitted, it is prompted interactively.

---

## Interactive Prompts

The CLI walks through five configuration steps:

### 1. Project

- **Project name** — directory name (lowercase letters, numbers, hyphens only; must not already exist)
- **Template** — starter template to use

### 2. Database

- **Database URL** — Postgres connection string (NeonDB, Supabase, or any Postgres)

### 3. Storage

- **Storage provider** — Vercel Blob (default) or local filesystem

### 4. Payments

- **Stripe keys** — publishable key, secret key, and webhook secret
- Can be skipped to configure later via `.env.local`

### 5. Dev environment

- **Package manager** — `pnpm` (recommended), `npm`, or `yarn`
- **Dev shell** — Nix flakes + direnv (optional)
- **Docker Compose** — generates a `docker-compose.yml` for local Postgres

---

## Templates

| Template     | Description                                                  | Tier |
| ------------ | ------------------------------------------------------------ | ---- |
| `basic-blog` | Blog with posts, pages, media, and REST API                  | Free |
| `e-commerce` | Store with products, Stripe checkout, and license management | Free |
| `portfolio`  | Portfolio site with projects and contact form                | Free |

---

## Generated Project Structure

```
my-project/
├── apps/
│   ├── admin/          # Next.js admin + admin
│   └── api/          # Hono REST API
├── packages/
│   └── db/           # Project-local schema extensions
├── .env.local        # Pre-filled with your config answers
├── .env.template     # Full env var reference
├── package.json      # Workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── README.md         # Getting-started instructions
```

---

## Generated Files

### `.env.local`

Pre-populated with all values you entered during setup. Contains:

```bash
# Core
REVEALUI_SECRET=<generated-64-char-hex>
NEXT_PUBLIC_SERVER_URL=http://localhost:3004

# Database
POSTGRES_URL=postgresql://...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

Any values you skipped are left as `PLACEHOLDER` — fill them in before running `pnpm dev`.

### `README.md`

Auto-generated getting-started guide specific to your project configuration.

### `devbox.json` (optional)

Generated if you selected Nix/Devbox during setup. Pre-configures the development shell with Node.js, pnpm, and project tools.

### `.devcontainer/` (optional)

Generated if you selected Docker Compose. Provides a ready-to-use VS Code / GitHub Codespaces dev container.

---

## Post-Scaffold Steps

```bash
cd my-project

# 1. Install dependencies
pnpm install

# 2. Apply database migrations
pnpm db:migrate

# 3. Seed sample data (optional)
pnpm db:seed

# 4. Start all services
pnpm dev
```

The admin will be at `http://localhost:4000` and the API at `http://localhost:3004`.

---

## Programmatic API

The CLI can be used programmatically (e.g. in tests or custom tooling):

```ts
import { createProject } from "@revealui/cli";

await createProject({
  project: {
    projectName: "my-app",
    projectPath: "/tmp/my-app",
    template: "basic-blog",
  },
  database: { url: "postgresql://localhost/myapp" },
  storage: { blobToken: "" },
  payment: { secretKey: "", publishableKey: "", webhookSecret: "" },
  devenv: { packageManager: "pnpm", useNix: false, useDocker: false },
  skipGit: true,
  skipInstall: true,
});
```

**`CreateProjectConfig`:**

```ts
interface CreateProjectConfig {
  project: ProjectConfig;
  database: DatabaseConfig;
  storage: StorageConfig;
  payment: PaymentConfig;
  devenv: DevEnvConfig;
  skipGit?: boolean; // don't run git init (default: false)
  skipInstall?: boolean; // don't run pnpm install (default: false)
}
```

---

## Related

- [Quick start guide](/guides/quick-start) — Full walkthrough with `create-revealui`
- [`@revealui/core`](/reference/core) — `buildConfig` — the config file your project generates
- [`@revealui/db`](/reference/db) — Database schema and migrations

---

# @revealui/setup

Environment setup utilities for RevealUI projects — secret generation, env file parsing, validation, and interactive setup orchestration.

```bash
npm install @revealui/setup
```

## Subpath Exports

| Import path                   | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `@revealui/setup`             | All exports (environment, utils, validators)             |
| `@revealui/setup/environment` | Secret generators, env file parsing, setup orchestration |
| `@revealui/setup/utils`       | Logger utility                                           |
| `@revealui/setup/validators`  | Env variable validation, built-in validators             |

---

## Secret Generation

Import from `@revealui/setup` or `@revealui/setup/environment`.

### `generateSecret(length?: number): string`

Generates a cryptographically secure random hex string using `crypto.randomBytes`.

| Parameter | Type     | Default | Description                                 |
| --------- | -------- | ------- | ------------------------------------------- |
| `length`  | `number` | `32`    | Length in bytes (output is 2x in hex chars) |

**Returns:** `string` — hex-encoded random secret.

```ts
import { generateSecret } from "@revealui/setup";

const secret = generateSecret(); // 64 hex chars (32 bytes)
const short = generateSecret(16); // 32 hex chars (16 bytes)
```

---

### `generatePassword(length?: number): string`

Generates a random password with alphanumeric and special characters using `crypto.randomBytes`.

| Parameter | Type     | Default | Description                   |
| --------- | -------- | ------- | ----------------------------- |
| `length`  | `number` | `16`    | Password length in characters |

**Returns:** `string` — random password containing `a-zA-Z0-9!@#$%^&*`.

```ts
import { generatePassword } from "@revealui/setup";

const password = generatePassword(); // 16-char password
const strong = generatePassword(32); // 32-char password
```

---

## Env File Utilities

### `updateEnvValue(content: string, key: string, value: string): string`

Replaces or appends an environment variable in `.env` file content. If the key exists, its value is replaced in-place. If it does not exist, a new line is appended.

| Parameter | Type     | Description                  |
| --------- | -------- | ---------------------------- |
| `content` | `string` | Original `.env` file content |
| `key`     | `string` | Environment variable name    |
| `value`   | `string` | New value                    |

**Returns:** `string` — updated `.env` file content.

```ts
import { updateEnvValue } from "@revealui/setup";

let env = "DB_URL=old_value\nAPI_KEY=abc";
env = updateEnvValue(env, "DB_URL", "postgresql://localhost/myapp");
// DB_URL=postgresql://localhost/myapp
// API_KEY=abc
```

---

### `parseEnvContent(content: string): Record<string, string>`

Parses `.env` file content into a key-value object. Skips comments (`#`) and empty lines.

| Parameter | Type     | Description             |
| --------- | -------- | ----------------------- |
| `content` | `string` | Raw `.env` file content |

**Returns:** `Record<string, string>` — parsed environment variables.

```ts
import { parseEnvContent } from "@revealui/setup";

const env = parseEnvContent(
  "DB_URL=postgresql://...\n# comment\nAPI_KEY=abc123",
);
// { DB_URL: 'postgresql://...', API_KEY: 'abc123' }
```

---

## Validation

Import from `@revealui/setup` or `@revealui/setup/validators`.

### `validateEnv(required: EnvVariable[], env: Record<string, string | undefined>): ValidationResult`

Validates environment variables against a list of required variable definitions.

| Parameter  | Type                                  | Description                                                            |
| ---------- | ------------------------------------- | ---------------------------------------------------------------------- |
| `required` | `EnvVariable[]`                       | Variable definitions with names, descriptions, and optional validators |
| `env`      | `Record<string, string \| undefined>` | Environment object to validate (e.g. `process.env`)                    |

**`EnvVariable`:**

```ts
interface EnvVariable {
  name: string;
  description: string;
  required: boolean;
  validator?: (value: string) => boolean;
}
```

**Returns:**

```ts
interface ValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
}
```

```ts
import { validateEnv } from "@revealui/setup";

const result = validateEnv(
  [{ name: "DB_URL", description: "Database URL", required: true }],
  process.env,
);

if (!result.valid) {
  console.error("Missing:", result.missing);
  console.error("Invalid:", result.invalid);
}
```

---

### `REQUIRED_ENV_VARS`

Pre-defined list of required environment variables for RevealUI projects.

| Variable                             | Description                       | Validator              |
| ------------------------------------ | --------------------------------- | ---------------------- |
| `REVEALUI_SECRET`                    | Secret key for session encryption | `minLength(32)`        |
| `POSTGRES_URL`                       | PostgreSQL connection string      | `postgresUrl`          |
| `BLOB_READ_WRITE_TOKEN`              | Vercel Blob storage token         | —                      |
| `STRIPE_SECRET_KEY`                  | Stripe secret key                 | `stripeSecretKey`      |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key            | `stripePublishableKey` |

### `OPTIONAL_ENV_VARS`

Pre-defined list of optional environment variables.

| Variable                        | Description            | Validator       |
| ------------------------------- | ---------------------- | --------------- |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook secret  | —               |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL   | `url`           |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | —               |
| `REVEALUI_ADMIN_EMAIL`          | Initial admin email    | `email`         |
| `REVEALUI_ADMIN_PASSWORD`       | Initial admin password | `minLength(12)` |

---

## Setup Orchestration

### `setupEnvironment(options: SetupEnvironmentOptions): Promise<SetupEnvironmentResult>`

Interactive (or non-interactive) environment setup wizard. Copies `.env.template`, auto-generates secrets, prompts for missing values, and validates the result.

| Parameter                 | Type            | Default                                | Description                         |
| ------------------------- | --------------- | -------------------------------------- | ----------------------------------- |
| `options.projectRoot`     | `string`        | —                                      | Project root directory (required)   |
| `options.templatePath`    | `string`        | `<projectRoot>/.env.template`          | Path to template file               |
| `options.outputPath`      | `string`        | `<projectRoot>/.env.development.local` | Output path                         |
| `options.force`           | `boolean`       | `false`                                | Overwrite existing output file      |
| `options.generateOnly`    | `boolean`       | `false`                                | Only generate secrets, skip prompts |
| `options.interactive`     | `boolean`       | `true`                                 | Prompt for missing values           |
| `options.customVariables` | `EnvVariable[]` | `REQUIRED_ENV_VARS`                    | Custom variable definitions         |
| `options.logger`          | `Logger`        | Default logger                         | Logger instance                     |

**Returns:**

```ts
interface SetupEnvironmentResult {
  success: boolean;
  envPath: string;
  missing: string[];
  invalid: string[];
}
```

```ts
import { setupEnvironment } from "@revealui/setup";

const result = await setupEnvironment({
  projectRoot: "/path/to/project",
  interactive: false,
  generateOnly: true,
});

if (result.success) {
  console.log(`Env written to ${result.envPath}`);
}
```

---

## Logger

Import from `@revealui/setup` or `@revealui/setup/utils`.

### `createLogger(options?: LoggerOptions): Logger`

Creates a structured logger with color support, level filtering, and progress bars.

| Parameter            | Type                                                 | Default                             | Description                   |
| -------------------- | ---------------------------------------------------- | ----------------------------------- | ----------------------------- |
| `options.level`      | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` | `process.env.LOG_LEVEL` or `'info'` | Minimum log level             |
| `options.prefix`     | `string`                                             | `''`                                | Prefix label (e.g. `'Setup'`) |
| `options.colors`     | `boolean`                                            | Auto-detected from TTY              | Enable ANSI colors            |
| `options.timestamps` | `boolean`                                            | `false`                             | Include ISO timestamps        |

**Returns:**

```ts
interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  success(msg: string, ...args: unknown[]): void;
  header(msg: string): void;
  divider(): void;
  table(data: Record<string, unknown>[]): void;
  group(label: string): void;
  groupEnd(): void;
  progress(current: number, total: number, label?: string): void;
}
```

```ts
import { createLogger } from "@revealui/setup";

const logger = createLogger({ level: "info", prefix: "MyScript" });
logger.info("Starting process...");
logger.success("Done!");
logger.progress(3, 10, "Processing files");
```

---

## Related

- [`@revealui/cli`](/reference/cli) — Uses `@revealui/setup` for project scaffolding
- [`@revealui/config`](/reference/config) — Type-safe env config (consumed after setup)

---

# @revealui/sync

Real-time collaboration and sync primitives. Provides Yjs-based collaborative editing (WebSocket) and ElectricSQL shape subscriptions for live data sync. Reads use ElectricSQL; writes use REST mutations via `/api/sync/*`.

```bash
npm install @revealui/sync
```

## Subpath Exports

| Import path                    | Purpose                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `@revealui/sync`               | All client-side exports (hooks, provider, collab)                                    |
| `@revealui/sync/provider`      | `ElectricProvider`, `useElectricConfig`                                              |
| `@revealui/sync/collab`        | `CollabProvider`, `useCollaboration`, `useCollabDocument`                            |
| `@revealui/sync/collab/server` | Server-side: `AgentCollabClient`, `createAgentClient`, `createAndConnectAgentClient` |

---

## ElectricSQL Provider

### `ElectricProvider`

React context provider that supplies ElectricSQL configuration to all child sync hooks.

```tsx
import { ElectricProvider } from "@revealui/sync";

function App() {
  return (
    <ElectricProvider proxyBaseUrl="https://admin.revealui.com" debug={false}>
      <MyApp />
    </ElectricProvider>
  );
}
```

| Prop           | Type        | Default | Description                                         |
| -------------- | ----------- | ------- | --------------------------------------------------- |
| `children`     | `ReactNode` | —       | Child components (required)                         |
| `serviceUrl`   | `string`    | `null`  | Direct Electric service URL (stored for future use) |
| `proxyBaseUrl` | `string`    | `''`    | Base URL for authenticated admin proxy routes         |
| `debug`        | `boolean`   | `false` | Enable debug mode                                   |

---

### `useElectricConfig(): ElectricContextValue`

Accesses the ElectricSQL configuration from the nearest `ElectricProvider`.

**Returns:**

```ts
interface ElectricContextValue {
  serviceUrl: string | null;
  proxyBaseUrl: string;
  debug: boolean;
}
```

---

## Collaborative Editing

Yjs-based real-time collaboration over WebSocket.

### `CollabProvider`

WebSocket-backed Yjs sync provider for browser clients. Manages document synchronization and user awareness (cursors, presence).

```ts
import { CollabProvider } from "@revealui/sync";
import * as Y from "yjs";

const doc = new Y.Doc();
const provider = new CollabProvider(serverUrl, documentId, doc, {
  initialState: savedState, // optional Uint8Array
});

provider.setLocalIdentity({ name: "Alice", color: "#ff0000", type: "human" });
provider.connect();
```

**Constructor:**

```ts
new CollabProvider(
  serverUrl: string,
  documentId: string,
  doc: Y.Doc,
  options?: { initialState?: Uint8Array | null },
)
```

**Events:** `sync` (boolean), `status` ({ status: string }), `awareness` (Map of UserPresence).

**`UserPresence`:**

```ts
interface UserPresence {
  name: string;
  color: string;
  type: "human" | "agent";
  agentModel?: string;
  cursor?: { index: number; length: number };
}
```

---

### `useCollaboration(options: UseCollaborationOptions): UseCollaborationResult`

React hook that manages a collaborative editing session. Creates a Yjs document, connects a `CollabProvider`, and tracks sync state and connected users.

| Parameter              | Type                    | Default | Description                      |
| ---------------------- | ----------------------- | ------- | -------------------------------- |
| `options.documentId`   | `string`                | —       | Document identifier (required)   |
| `options.serverUrl`    | `string`                | —       | WebSocket server URL (required)  |
| `options.enabled`      | `boolean`               | `true`  | Enable/disable the connection    |
| `options.initialState` | `Uint8Array \| null`    | `null`  | Initial Yjs document state       |
| `options.identity`     | `CollaborationIdentity` | —       | Local user identity for presence |

**`CollaborationIdentity`:**

```ts
interface CollaborationIdentity {
  name: string;
  color: string;
  type?: "human" | "agent";
  agentModel?: string;
}
```

**Returns:**

```ts
interface UseCollaborationResult {
  doc: Y.Doc | null;
  provider: CollabProvider | null;
  synced: boolean;
  status: string; // 'disconnected' | 'connecting' | 'connected'
  error: Error | null;
  connectedUsers: Map<number, UserPresence>;
}
```

```tsx
import { useCollaboration } from "@revealui/sync";

function Editor({ docId }: { docId: string }) {
  const { doc, synced, connectedUsers } = useCollaboration({
    documentId: docId,
    serverUrl: "wss://collab.revealui.com",
    identity: { name: "Alice", color: "#ff6600" },
  });

  if (!synced) return <p>Connecting...</p>;

  return <RichTextEditor yDoc={doc} />;
}
```

---

### `useCollabDocument(documentId: string): CollabDocumentState`

React hook that fetches a collaborative document's persisted state via ElectricSQL shape subscription. Use the returned `initialState` to hydrate a `CollabProvider` or `useCollaboration`.

| Parameter    | Type     | Description          |
| ------------ | -------- | -------------------- |
| `documentId` | `string` | UUID of the document |

**Returns:**

```ts
interface CollabDocumentState {
  initialState: Uint8Array | null;
  connectedClients: number;
  isLoading: boolean;
  error: Error | null;
}
```

```tsx
import { useCollabDocument, useCollaboration } from "@revealui/sync";

function LiveEditor({ docId }: { docId: string }) {
  const { initialState, isLoading } = useCollabDocument(docId);
  const { doc, synced } = useCollaboration({
    documentId: docId,
    serverUrl: "wss://collab.revealui.com",
    enabled: !isLoading,
    initialState,
  });

  // ...
}
```

---

## Agent Collaboration Client (Pro)

Server-side Node.js client for AI agents to participate in collaborative editing sessions. Uses the `ws` package for WebSocket connections.

Import from `@revealui/sync/collab/server`.

### `AgentCollabClient`

Full-featured Yjs collaboration client for server-side agents. Supports document editing, awareness (presence), auto-reconnect, and sync waiting.

```ts
import { AgentCollabClient } from "@revealui/sync/collab/server";

const client = new AgentCollabClient({
  serverUrl: "wss://collab.revealui.com",
  documentId: "doc-uuid",
  identity: {
    type: "agent",
    name: "Claude",
    model: "claude-opus-4",
    color: "#8B5CF6",
  },
  authToken: "session-token",
  autoReconnect: true,
  defaultTextName: "content",
});

client.connect();
await client.waitForSync(5000);

// Read and write
const content = client.getTextContent();
client.replaceAll("New document content");
client.insertText(0, "Prefix: ");
client.deleteText(0, 8);

// Listen for remote changes
const unsub = client.onUpdate((update) => {
  /* ... */
});

// Cleanup
client.destroy();
```

**Constructor options:**

| Parameter         | Type            | Default     | Description                            |
| ----------------- | --------------- | ----------- | -------------------------------------- |
| `serverUrl`       | `string`        | —           | WebSocket server URL (required)        |
| `documentId`      | `string`        | —           | Document UUID (required)               |
| `identity`        | `AgentIdentity` | —           | Agent identity for presence (required) |
| `authToken`       | `string`        | —           | Authentication token                   |
| `autoReconnect`   | `boolean`       | `true`      | Auto-reconnect on disconnect           |
| `defaultTextName` | `string`        | `'content'` | Default Yjs Text type name             |

**Key methods:**

| Method                              | Returns                                | Description                                       |
| ----------------------------------- | -------------------------------------- | ------------------------------------------------- |
| `connect()`                         | `void`                                 | Open WebSocket connection                         |
| `disconnect()`                      | `void`                                 | Close connection                                  |
| `waitForSync(timeoutMs?)`           | `Promise<void>`                        | Wait for initial sync (default 5s timeout)        |
| `getText(name?)`                    | `Y.Text`                               | Get a named Yjs Text type                         |
| `getTextContent(name?)`             | `string`                               | Get text content as string                        |
| `insertText(index, content, name?)` | `void`                                 | Insert text at position                           |
| `deleteText(index, length, name?)`  | `void`                                 | Delete text at position                           |
| `replaceAll(content, name?)`        | `void`                                 | Replace all text content (transactional)          |
| `onUpdate(callback)`                | `() => void`                           | Subscribe to remote updates (returns unsubscribe) |
| `getConnectedUsers()`               | `Map<number, Record<string, unknown>>` | Get connected users from awareness                |
| `getDocument()`                     | `Y.Doc`                                | Access the underlying Yjs document                |
| `destroy()`                         | `void`                                 | Clean up all resources                            |

---

### `createAgentClient(options: CreateAgentClientOptions): AgentCollabClient`

Factory function that creates an `AgentCollabClient` with sensible defaults.

| Parameter                 | Type      | Default      | Description                     |
| ------------------------- | --------- | ------------ | ------------------------------- |
| `options.serverUrl`       | `string`  | —            | WebSocket server URL (required) |
| `options.documentId`      | `string`  | —            | Document UUID (required)        |
| `options.name`            | `string`  | `'AI Agent'` | Agent display name              |
| `options.model`           | `string`  | `'unknown'`  | LLM model identifier            |
| `options.color`           | `string`  | `'#8B5CF6'`  | Presence cursor color           |
| `options.authToken`       | `string`  | —            | Authentication token            |
| `options.autoReconnect`   | `boolean` | `true`       | Auto-reconnect on disconnect    |
| `options.defaultTextName` | `string`  | `'content'`  | Default Yjs Text type name      |

```ts
import { createAgentClient } from "@revealui/sync/collab/server";

const client = createAgentClient({
  serverUrl: "wss://collab.revealui.com",
  documentId: "doc-uuid",
  name: "Claude",
  model: "claude-opus-4",
  authToken: "session-token",
});

client.connect();
await client.waitForSync();
```

---

### `createAndConnectAgentClient(options): Promise<AgentCollabClient>`

Convenience wrapper that creates a client, connects, and waits for sync in one call. Accepts all `CreateAgentClientOptions` plus an optional `syncTimeoutMs` (default: 5000).

```ts
import { createAndConnectAgentClient } from "@revealui/sync/collab/server";

const client = await createAndConnectAgentClient({
  serverUrl: "wss://collab.revealui.com",
  documentId: "doc-uuid",
  name: "Claude",
  model: "claude-opus-4",
  syncTimeoutMs: 10_000,
});

const content = client.getTextContent();
```

---

## Sync Data Hooks (Pro)

React hooks for real-time data subscriptions via ElectricSQL shapes. Reads are live-updating; writes go through REST mutations at `/api/sync/*`. All hooks require an `ElectricProvider` ancestor.

### `useSyncMutations<TCreate, TUpdate, TRecord>(endpoint: string)`

Low-level hook that returns `create`, `update`, and `remove` mutation functions for a given sync API endpoint. Used internally by the data hooks below.

**Returns:**

```ts
{
  create: (data: TCreate) => Promise<MutationResult<TRecord>>;
  update: (id: string, data: TUpdate) => Promise<MutationResult<TRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}

interface MutationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

---

### `useConversations(userId: string): UseConversationsResult`

Subscribes to the current user's conversations via ElectricSQL. The `userId` parameter is kept for API compatibility; actual filtering is enforced server-side by the session cookie.

**Returns:**

```ts
interface UseConversationsResult {
  conversations: ConversationRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (
    data: CreateConversationInput,
  ) => Promise<MutationResult<ConversationRecord>>;
  update: (
    id: string,
    data: UpdateConversationInput,
  ) => Promise<MutationResult<ConversationRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}
```

```tsx
import { useConversations } from "@revealui/sync";

function ChatList({ userId }: { userId: string }) {
  const { conversations, create, isLoading } = useConversations(userId);

  const handleNew = async () => {
    await create({ agent_id: "claude", title: "New Chat" });
  };

  return (
    <ul>
      {conversations.map((c) => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  );
}
```

---

### `useAgentMemory(agentId: string): UseAgentMemoryResult`

Subscribes to an agent's memory records via ElectricSQL. Validates `agentId` format (alphanumeric, hyphens, underscores).

**Returns:**

```ts
interface UseAgentMemoryResult {
  memories: AgentMemoryRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (
    data: CreateAgentMemoryInput,
  ) => Promise<MutationResult<AgentMemoryRecord>>;
  update: (
    id: string,
    data: UpdateAgentMemoryInput,
  ) => Promise<MutationResult<AgentMemoryRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}
```

```tsx
import { useAgentMemory } from "@revealui/sync";

function MemoryViewer({ agentId }: { agentId: string }) {
  const { memories, isLoading } = useAgentMemory(agentId);

  return (
    <ul>
      {memories.map((m) => (
        <li key={m.id}>
          {m.type}: {m.content}
        </li>
      ))}
    </ul>
  );
}
```

---

### `useAgentContexts(): UseAgentContextsResult`

Subscribes to agent context records via ElectricSQL. No parameters required; filtering is session-scoped server-side.

**Returns:**

```ts
interface UseAgentContextsResult {
  contexts: AgentContextRecord[];
  isLoading: boolean;
  error: Error | null;
  create: (
    data: CreateAgentContextInput,
  ) => Promise<MutationResult<AgentContextRecord>>;
  update: (
    id: string,
    data: UpdateAgentContextInput,
  ) => Promise<MutationResult<AgentContextRecord>>;
  remove: (id: string) => Promise<MutationResult<void>>;
}
```

---

## Related

- [`@revealui/core`](/reference/core) — Runtime engine that hosts the sync proxy routes
- [`@revealui/db`](/reference/db) — Database schema for conversations, agent memory, and contexts
- [`@revealui/ai`](/reference/ai) — AI agents that use `AgentCollabClient` for collaborative editing
