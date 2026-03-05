# @revealui/core

The CMS engine. Provides config building, collections, access control, REST API handlers, license validation, feature flags, rich text, admin UI components, logging, and plugins.

```bash
npm install @revealui/core
```

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

### `createRevealUI(config: Config)`

Creates a RevealUI CMS instance from a built config. Used in app startup.

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

## Access Control

### `anyone`

Access function that allows all requests (public).

```ts
import { anyone, authenticated } from '@revealui/core'

access: { read: anyone, create: authenticated }
```

### `authenticated`

Access function that requires a valid session.

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

### `generateLicenseKey(payload: Omit<LicensePayload, 'iat' | 'exp'>, privateKey: string, expiresInSeconds?: number): Promise<string>`

Signs a new license JWT with the given private key. Default expiry is 1 year (31,536,000 seconds). Used by the RevealUI license server — not needed in app code.

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
getRequiredTier('ai')        // 'pro'
getRequiredTier('whiteLabel') // 'enterprise'
```

---

## Logging

Import from `@revealui/core/observability/logger` (server) or `@revealui/core/utils/logger/client` (browser).

### `createLogger(context: LogContext): Logger`

Creates a scoped logger instance with request/module context.

```ts
import { createLogger } from '@revealui/core/observability/logger'

const log = createLogger({ module: 'auth', requestId: req.id })
log.info('User signed in', { userId })
log.error('Sign-in failed', { error })
```

### `logger`

Global default logger instance — use when no request context is available.

```ts
import { logger } from '@revealui/core/observability/logger'

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

## Utilities

### `deepClone<T>(obj: T): T`

Deep clones an object. Safe for use with objects containing nested arrays and plain values.

### `LRUCache<K, V>`

Least-recently-used cache implementation.

```ts
import { LRUCache } from '@revealui/core'

const cache = new LRUCache<string, User>(100) // max 100 entries
cache.set('user:1', user)
const hit = cache.get('user:1')
```

### `deepMerge<T>(a: object, b: object): T`

Recursively merges two objects. Arrays are replaced (not concatenated).

---

## Rich Text

Import from `@revealui/core/richtext` or the main entry.

### `serializeLexicalState(data: SerializedEditorState | null | undefined, options?: SerializeOptions): JSX.Element | null`

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

- [`@revealui/auth`](/api/auth) — Session auth, sign in/up, rate limiting
- [`@revealui/db`](/api/db) — Drizzle ORM schema and NeonDB client
- [`@revealui/contracts`](/api/contracts) — Zod schemas and TypeScript types
- [REST API reference](/api/rest) — Full HTTP endpoint documentation
