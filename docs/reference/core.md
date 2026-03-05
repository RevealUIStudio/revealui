# @revealui/core

The CMS engine. Provides config building, collections, access control, REST API handlers, license validation, feature flags, rich text, admin UI components, logging, and plugins.

```bash
npm install @revealui/core
```

---

## Setup

### `buildConfig<T>(config: T): T`

Validates and finalizes your RevealUI configuration. Call this in your config file — it merges in defaults, runs validation, and applies plugins.

```ts
import { buildConfig } from '@revealui/core'

export default buildConfig({
  serverURL: 'http://localhost:3000',
  collections: [Posts, Users],
  plugins: [formBuilderPlugin()],
})
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
import { createRevealUI } from '@revealui/core'
import config from './revealui.config'

const revealui = await createRevealUI(config)
```

### `getRevealUI(options: { config: AcceptedConfig }): Promise<RevealUIInstance>`

Singleton alternative to `createRevealUI`. Returns the same instance on subsequent calls — safe to call at module scope in serverless functions where cold-start re-initialization would be wasteful.

```ts
import { getRevealUI } from '@revealui/core'
import config from './revealui.config'

// Safe to call multiple times — returns cached instance after first call
const revealui = await getRevealUI({ config })
```

---

### `withRevealUI(nextConfig?, options?): NextConfig`

Next.js configuration wrapper. Merges RevealUI's webpack/Turbopack aliases, environment variables, and security headers into your `next.config.ts`. Required when using RevealUI with Next.js.

```ts
// next.config.ts
import { withRevealUI } from '@revealui/core'

export default withRevealUI({
  // your existing next.config options
}, {
  configPath: './revealui.config.ts',  // default
  admin: true,                          // enable admin UI, default true
  adminRoute: '/admin',                 // default
  apiRoute: '/api',                     // default
})
```

**What it does:**
- Adds webpack aliases: `@revealui/core` → core package, `@revealui/config` → your config file
- Sets Turbopack `resolveAlias` equivalents for Next.js 16+
- Injects env vars: `REVEALUI_CONFIG_PATH`, `REVEALUI_ADMIN_ENABLED`, `REVEALUI_ADMIN_ROUTE`, `REVEALUI_API_ROUTE`
- Appends security headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`) to the admin route

**`WithRevealUIOptions`:**
```ts
interface WithRevealUIOptions {
  configPath?: string   // path to revealui.config.ts (relative to project root)
  admin?: boolean       // mount admin UI (default: true)
  adminRoute?: string   // admin base path (default: '/admin')
  apiRoute?: string     // API base path (default: '/api')
}
```

---

## Collections & Fields

### `defineCollection(config: CollectionConfig): CollectionConfig`

Type-safe helper for defining a collection. Pass the result to `buildConfig({ collections: [...] })`.

```ts
import { defineCollection } from '@revealui/core'

export const Posts = defineCollection({
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'body', type: 'richText' },
    { name: 'author', type: 'relationship', relationTo: 'users' },
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
})
```

### `defineGlobal(config: GlobalConfig): GlobalConfig`

Type-safe helper for defining a singleton global (e.g. site settings).

```ts
import { defineGlobal } from '@revealui/core'

export const SiteSettings = defineGlobal({
  slug: 'site-settings',
  fields: [
    { name: 'siteName', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
  ],
})
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
  collection: 'posts',
  where: { status: { equals: 'published' } },
  sort: '-createdAt',
  limit: 20,
  page: 1,
  depth: 1,      // populate relationships 1 level deep
})

// result.docs      — array of documents
// result.totalDocs — total matching documents
// result.totalPages
// result.page, result.hasNextPage, result.nextPage
```

**`RevealFindOptions`:**
```ts
interface RevealFindOptions {
  collection: string
  where?: RevealWhere           // filter expression
  sort?: RevealSort             // field name, prefix with '-' for descending
  limit?: number                // default: 10
  page?: number                 // 1-based
  pagination?: boolean          // set false to return all docs (no pagination)
  depth?: number                // relationship population depth (default: 0)
  select?: RevealSelect         // field projection
  draft?: boolean               // include drafts
  overrideAccess?: boolean      // skip access control (server-side only)
  locale?: string
  req?: RevealRequest           // pass to propagate auth context
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
  collection: 'posts',
  id: '6621f3e2a1b2c3d4e5f60001',
  depth: 2,
})
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
  collection: 'posts',
  data: {
    title: 'Hello World',
    status: 'draft',
    author: userId,
  },
  req,  // pass to trigger access control
})
```

Throws `'Access denied'` if the collection's `access.create` function returns false.

```ts
interface RevealCreateOptions {
  collection: string
  data: Record<string, unknown>
  req?: RevealRequest
}
// Returns: Promise<RevealDocument>
```

---

### `revealui.update(options)`

Updates a document by ID. Fetches the previous version, runs `afterChange` hooks with `previousDoc`.

```ts
const updated = await revealui.update({
  collection: 'posts',
  id: postId,
  data: { status: 'published' },
  req,
})
```

```ts
interface RevealUpdateOptions {
  collection: string
  id: string | number
  data: Record<string, unknown>
  req?: RevealRequest
}
// Returns: Promise<RevealDocument>
```

---

### `revealui.delete(options)`

Deletes a document by ID.

```ts
const deleted = await revealui.delete({
  collection: 'posts',
  id: postId,
  req,
})
```

```ts
interface RevealDeleteOptions {
  collection: string
  id: string | number
  req?: RevealRequest
}
// Returns: Promise<RevealDocument>   (the deleted document)
```

---

### `revealui.login(options)`

Authenticates a user and returns a signed JWT.

```ts
const { user, token } = await revealui.login({
  collection: 'users',
  data: {
    email: 'user@example.com',
    password: 'secret',
  },
})
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
  doc: RevealDocument
  operation: 'create' | 'update'
  previousDoc?: RevealDocument
  req: RevealRequest
  collection: string
  context: {
    revealui?: RevealUIInstance
    collection: string
    operation: 'create' | 'update'
    previousDoc?: RevealDocument
    req: RevealRequest
  }
}
```

### `beforeChange`

Runs before the data is persisted. Use to transform or validate data.

```ts
import type { CollectionBeforeChangeHook } from '@revealui/core'

const slugify: CollectionBeforeChangeHook = async ({ data, operation }) => {
  if (operation === 'create' && data.title) {
    return {
      ...data,
      slug: data.title.toLowerCase().replace(/\s+/g, '-'),
    }
  }
  return data
}
```

### `afterRead`

Runs after a document is fetched. Use to add computed fields.

```ts
import type { CollectionAfterReadHook } from '@revealui/core'

const addComputedFields: CollectionAfterReadHook = async ({ doc }) => {
  return {
    ...doc,
    readingTime: Math.ceil((doc.body?.length ?? 0) / 1000),
  }
}
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
import { hasRole } from '@revealui/core'

access: { update: hasRole('editor') }
```

### `hasAnyRole(roles: string[])`

Factory: returns an access function that passes if the user has **any** of the given roles.

```ts
import { hasAnyRole } from '@revealui/core'

access: { create: hasAnyRole(['editor', 'admin']) }
```

### Custom access functions

All access functions share the same signature:

```ts
type AccessFunction = (args: { req: RevealRequest }) => boolean | Promise<boolean>

// Example: owner-only update
const isOwner: AccessFunction = ({ req }) => {
  if (!req.user) return false
  // use req.user.id to check document ownership
  return true
}
```

---

## REST API

### `createRESTHandlers(config: Config)`

Creates Hono route handlers for the full RevealUI REST API. Returns an object with `app` (Hono instance) ready to mount.

```ts
import { createRESTHandlers } from '@revealui/core/server'

const { app } = createRESTHandlers(config)
export default app
```

### `handleRESTRequest(req: Request, config: Config): Promise<Response>`

Handles a single Web API `Request` and returns a `Response`. Useful for edge runtimes where you receive raw requests.

```ts
import { handleRESTRequest } from '@revealui/core/server'

export async function GET(req: Request) {
  return handleRESTRequest(req, config)
}
```

---

## Rate Limiting

Import from `@revealui/core/api/rate-limit`.

### `checkRateLimit(request, config)`

Fixed-window rate limiter. Returns `{ allowed, limit, remaining, resetTime }`.

```ts
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@revealui/core/api/rate-limit'

const result = checkRateLimit(request, RATE_LIMIT_PRESETS.standard)
if (!result.allowed) {
  return new Response('Too Many Requests', { status: 429 })
}
```

### `createRateLimitMiddleware(config)`

Returns a Next.js-compatible middleware function that adds `X-RateLimit-*` headers and rejects over-limit requests with HTTP 429.

```ts
export const middleware = createRateLimitMiddleware({
  windowMs: 60_000,   // 1 minute
  maxRequests: 100,
})
```

### `createUserRateLimit(config)` / `createAPIKeyRateLimit(config)` / `createEndpointRateLimit(config)`

Pre-keyed middleware factories:
- `createUserRateLimit` — keys by `x-user-id` header
- `createAPIKeyRateLimit` — keys by `x-api-key` header
- `createEndpointRateLimit` — keys by `IP + pathname`

### `RATE_LIMIT_PRESETS`

```ts
RATE_LIMIT_PRESETS.veryStrict  // 10 req/min
RATE_LIMIT_PRESETS.strict      // 30 req/min
RATE_LIMIT_PRESETS.standard    // 100 req/min (default)
RATE_LIMIT_PRESETS.relaxed     // 500 req/min
RATE_LIMIT_PRESETS.hourly      // 1,000 req/hr
RATE_LIMIT_PRESETS.daily       // 10,000 req/day
```

### Sliding window & token bucket

```ts
// More accurate — no boundary burst
checkSlidingWindowRateLimit(request, config)

// Smooth token refill
checkTokenBucketRateLimit(request, { ...config, refillRate: 10 })
```

---

## License

Import from `@revealui/core/license` or via the main entry.

### `initializeLicense(): Promise<LicenseTier>`

Reads `REVEALUI_LICENSE_KEY` and `REVEALUI_LICENSE_PUBLIC_KEY` from env, validates the JWT, and caches the result. Call once at app startup.

```ts
import { initializeLicense } from '@revealui/core'

// In your server entry point:
await initializeLicense()
```

Returns `'free'` if no key is configured or validation fails.

### `isLicensed(requiredTier: LicenseTier): boolean`

Returns `true` if the current license meets or exceeds `requiredTier`.

```ts
import { isLicensed } from '@revealui/core'

if (isLicensed('pro')) {
  // Pro and Enterprise only
}
```

**Tier ranking:** `free (0) < pro (1) < enterprise (2)`

### `getCurrentTier(): LicenseTier`

Returns the cached license tier synchronously. Call `initializeLicense()` first.

```ts
type LicenseTier = 'free' | 'pro' | 'enterprise'
```

### `getLicensePayload(): LicensePayload | null`

Returns the decoded JWT payload, or `null` on free tier.

```ts
interface LicensePayload {
  tier: 'pro' | 'enterprise'
  customerId: string
  domains?: string[]
  maxSites?: number
  maxUsers?: number
  iat?: number
  exp?: number
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
import { isFeatureEnabled } from '@revealui/core'

if (isFeatureEnabled('ai')) {
  // Enable AI features (Pro+)
}
```

### `getFeatures(): FeatureFlags`

Returns all feature flags for the current tier.

```ts
interface FeatureFlags {
  // Pro features
  ai: boolean
  aiMemory: boolean
  mcp: boolean
  editors: boolean
  harnesses: boolean
  payments: boolean
  advancedSync: boolean
  dashboard: boolean
  customDomain: boolean
  analytics: boolean
  // Enterprise features
  multiTenant: boolean
  whiteLabel: boolean
  sso: boolean
  auditLog: boolean
}
```

### `getFeaturesForTier(tier: LicenseTier): FeatureFlags`

Returns the feature flags available at a specific tier without affecting cached state.

### `getRequiredTier(feature: keyof FeatureFlags): LicenseTier`

Returns the minimum tier required for a feature.

```ts
getRequiredTier('ai')         // 'pro'
getRequiredTier('whiteLabel') // 'enterprise'
```

---

## Logging

Import from `@revealui/core/utils/logger`.

### `createLogger(context?: LogContext): Logger`

Creates a scoped logger instance with request/module context.

```ts
import { createLogger } from '@revealui/core'

const log = createLogger({ module: 'auth', requestId: req.id })
log.info('User signed in', { userId })
log.error('Sign-in failed', { error })
```

### `logger`

Global default logger instance — use when no request context is available.

```ts
import { logger } from '@revealui/core'

logger.warn('Config missing optional field')
```

**Log levels:** `debug | info | warn | error`

---

## Plugins

Import from `@revealui/core/plugins`.

### `formBuilderPlugin(config?: FormBuilderPluginConfig)`

Adds a drag-and-drop form builder collection to your CMS. Creates `forms` and `form-submissions` collections automatically.

```ts
import { formBuilderPlugin } from '@revealui/core/plugins'

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
})
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
import { universalPostgresAdapter } from '@revealui/core'

buildConfig({
  db: universalPostgresAdapter({
    pool: { connectionString: process.env.POSTGRES_URL },
  }),
})
```

### `vercelBlobStorage()`

Storage adapter for Vercel Blob. Set `BLOB_READ_WRITE_TOKEN` in env.

```ts
import { vercelBlobStorage } from '@revealui/core'

buildConfig({
  upload: {
    useTempFiles: true,
    tempFileDir: '/tmp',
  },
  plugins: [vercelBlobStorage({ collections: { media: true } })],
})
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
  customRenderers?: Record<string, (node: SerializedLexicalNode) => JSX.Element | null>
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
import { LRUCache } from '@revealui/core'

const cache = new LRUCache<string, User>(100) // max 100 entries
cache.set('user:1', user)
const hit = cache.get('user:1')
```

---

## Error Types

```ts
import { ApplicationError, ValidationError } from '@revealui/core'

throw new ApplicationError('Something went wrong', 500)
throw new ValidationError('Invalid email format', { field: 'email' })
```

### Response Helpers

```ts
import {
  createSuccessResponseData,
  createErrorResponseData,
  createValidationErrorResponseData,
} from '@revealui/core'
```

---

## Related

- [`@revealui/auth`](/reference/auth) — Session auth, sign in/up, rate limiting
- [`@revealui/db`](/reference/db) — Drizzle ORM schema and NeonDB client
- [`@revealui/contracts`](/reference/contracts) — Zod schemas and TypeScript types
- [REST API reference](https://api.revealui.com/swagger) — Interactive OpenAPI documentation
