# @revealui/config

Type-safe environment variable configuration with Zod validation and lazy loading via Proxy.

```bash
npm install @revealui/config
```

## Quick Start

```ts
import { config } from '@revealui/config'

// Access config groups — validated on first access, not on import
const dbUrl = config.database.url
const stripeKey = config.stripe.secretKey
const serverUrl = config.reveal.serverURL
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
import { config } from '@revealui/config'

interface Config {
  database: DatabaseConfig
  stripe: StripeConfig
  storage: StorageConfig
  reveal: RevealConfig
  branding: BrandingConfig
  optional: OptionalConfig
}
```

---

## Config Groups

### `config.database`

NeonDB / Postgres connection.

```ts
interface DatabaseConfig {
  url: string               // POSTGRES_URL or DATABASE_URL or SUPABASE_DATABASE_URI
  connectionString: string  // same as url
}
```

**Env vars:** `POSTGRES_URL`, `DATABASE_URL`, `SUPABASE_DATABASE_URI` (first non-empty wins)

---

### `config.reveal`

Core RevealUI server settings.

```ts
interface RevealConfig {
  secret: string            // REVEALUI_SECRET — JWT signing key
  serverURL: string         // NEXT_PUBLIC_SERVER_URL — public-facing URL
  publicServerURL: string   // REVEALUI_PUBLIC_SERVER_URL
  adminEmail?: string       // REVEALUI_ADMIN_EMAIL
  adminPassword?: string    // REVEALUI_ADMIN_PASSWORD
  corsOrigins?: string[]    // REVEALUI_CORS_ORIGINS (comma-separated)
}
```

---

### `config.stripe`

Stripe payment processing.

```ts
interface StripeConfig {
  secretKey: string         // STRIPE_SECRET_KEY
  publishableKey: string    // NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  webhookSecret: string     // STRIPE_WEBHOOK_SECRET
  proxy?: boolean           // STRIPE_PROXY=1 — route via proxy
}
```

---

### `config.storage`

File upload storage.

```ts
interface StorageConfig {
  blobToken: string         // BLOB_READ_WRITE_TOKEN — Vercel Blob
}
```

---

### `config.branding`

White-label branding (Enterprise tier).

```ts
interface BrandingConfig {
  name: string              // REVEALUI_BRAND_NAME (default: 'RevealUI')
  logoUrl?: string          // REVEALUI_LOGO_URL
  primaryColor?: string     // REVEALUI_PRIMARY_COLOR (hex)
  showPoweredBy: boolean    // REVEALUI_SHOW_POWERED_BY (default: true)
}
```

On free/pro tiers, `name` and `showPoweredBy` cannot be changed — the badge is always shown.

---

### `config.optional`

Third-party integrations — all optional, no error thrown if unset.

```ts
interface OptionalConfig {
  sentryDsn?: string        // SENTRY_DSN
  supabaseUrl?: string      // NEXT_PUBLIC_SUPABASE_URL
  supabaseAnonKey?: string  // NEXT_PUBLIC_SUPABASE_ANON_KEY
}
```

---

## Standalone Functions

Import individual config getters if you need them outside the main `config` proxy.

```ts
import { getDatabaseConfig, getRevealConfig, getStripeConfig } from '@revealui/config'

const dbConfig = getDatabaseConfig(process.env)
const revealConfig = getRevealConfig(process.env)
const stripeConfig = getStripeConfig(process.env)
```

---

## Validation

### `validateEnvVars(env): ValidationResult`

Validates all required env vars. Returns a result object — does not throw.

```ts
import { validateEnvVars } from '@revealui/config'

const result = validateEnvVars(process.env)
if (!result.success) {
  console.error('Missing env vars:', result.errors)
}
```

### `validateAndThrow(env): void`

Validates and throws `ConfigValidationError` if any required variables are missing.

```ts
import { validateAndThrow } from '@revealui/config'

// Call at app startup to catch misconfigurations early:
validateAndThrow(process.env)
```

### `formatValidationErrors(errors): string`

Returns a human-readable summary of validation errors.

---

## Environment Reference

Minimum required variables for a working RevealUI deployment:

```bash
# Core
REVEALUI_SECRET=your-jwt-signing-secret
NEXT_PUBLIC_SERVER_URL=https://your-cms.com

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
