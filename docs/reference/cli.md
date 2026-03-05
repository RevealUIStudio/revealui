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

| Template | Description | Tier |
|----------|-------------|------|
| `basic-blog` | Blog with posts, pages, media, and REST API | Free |
| `e-commerce` | Store with products, Stripe checkout, and license management | Free |
| `portfolio` | Portfolio site with projects and contact form | Free |


---

## Generated Project Structure

```
my-project/
├── apps/
│   ├── cms/          # Next.js admin + CMS
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

The CMS will be at `http://localhost:4000` and the API at `http://localhost:3004`.

---

## Programmatic API

The CLI can be used programmatically (e.g. in tests or custom tooling):

```ts
import { createProject } from '@revealui/cli'

await createProject({
  project: {
    projectName: 'my-app',
    projectPath: '/tmp/my-app',
    template: 'basic-blog',
  },
  database: { url: 'postgresql://localhost/myapp' },
  storage: { blobToken: '' },
  payment: { secretKey: '', publishableKey: '', webhookSecret: '' },
  devenv: { packageManager: 'pnpm', useNix: false, useDocker: false },
  skipGit: true,
  skipInstall: true,
})
```

**`CreateProjectConfig`:**
```ts
interface CreateProjectConfig {
  project: ProjectConfig
  database: DatabaseConfig
  storage: StorageConfig
  payment: PaymentConfig
  devenv: DevEnvConfig
  skipGit?: boolean      // don't run git init (default: false)
  skipInstall?: boolean  // don't run pnpm install (default: false)
}
```

---

## Related

- [Quick start guide](/guides/quick-start) — Full walkthrough with `create-revealui`
- [`@revealui/core`](/reference/core) — `buildConfig` — the config file your project generates
- [`@revealui/db`](/reference/db) — Database schema and migrations
