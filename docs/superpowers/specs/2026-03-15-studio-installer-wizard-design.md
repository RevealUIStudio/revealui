# Studio Installer & Setup Wizard — Design Spec

> **Approach:** Evolve the existing `apps/studio` Tauri 2 app. Add a deploy flow, improve the existing dev setup wizard, and make Studio the single entry point for both self-hosters and developers.

**Goal:** Turn RevealUI Studio into a unified installer + companion that gets users from zero to running — either deploying to Vercel or setting up a local dev environment — in one guided flow.

**Architecture:** Extend the existing Tauri 2 + React 19 app. Add an intent-selection screen as the new first-run gate, a 9-step deploy wizard for self-hosters, and improve the existing 7-step dev wizard to actively install (not just check status). Cross-platform from day one (Windows, macOS, Linux). Deploy flow is pure HTTP — works on all platforms immediately. Dev flow requires platform-specific implementations.

**Tech Stack:** Tauri 2, React 19, TypeScript, Tailwind v4, Rust (PlatformOps trait). Vercel API, Neon API, Stripe API/CLI, Resend API.

---

## Intent Screen

Replaces the current `SetupWizard` modal as the first-run gate. Two paths:

- **Deploy** — "I want to run RevealUI for my business" → Deploy Wizard (9 steps)
- **Develop** — "I want to contribute to RevealUI" → Existing Setup Wizard (improved)

Intent stored in `~/.config/revealui-studio/config.json` (Rust-managed, replaces `localStorage`). Dashboard adapts based on stored intent.

After first run, the intent screen is skipped. Users can switch intent from Settings.

---

## Deploy Wizard (9 Steps)

Priority: **build this first.** It's the revenue path, smaller scope (mostly HTTP), and has zero coverage today.

### Step 1: Connect Vercel

**Authentication chain** (try in order):
1. Detect `vercel` CLI → `vercel whoami` → use existing session
2. OAuth flow (open browser → localhost callback → store token)
3. Paste Vercel API token from dashboard

**Actions:**
- Validate token (list projects API call)
- Link or create 3 Vercel projects: `revealui-api`, `revealui-cms`, `revealui-marketing`
- Store: Vercel token + team/org ID in config

### Step 2: Provision Database

**NeonDB (required):**
- Detect `neonctl` CLI → `neonctl auth status`
- Fallback: paste connection string (`postgresql://...@*.neon.tech/...`)
- Action: create Neon project + database if none exists, or select existing
- Validate connection with test query (`SELECT NOW()`)
- Run `db:push` (Drizzle migrations — creates all 50 tables)
- Run `db:seed` — **mandatory**, not optional. Home page (`slug='home'`) must exist or CMS root returns 404

**Supabase (optional, gated on "Enable AI features?"):**
- Paste `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- Verify `pgvector` extension is enabled
- Store connection details

**Ordering constraint:** Database must be provisioned and migrated before any app can deploy. Schema validation runs at module load time.

### Step 3: Connect Stripe

**Authentication chain:**
1. Detect `stripe` CLI → `stripe config --list`
2. Paste secret key + publishable key from Stripe dashboard

**Actions (automated sequence):**
1. Validate keys (test API call)
2. Generate RSA-2048 key pair via `stripe:keys --write` → produces `REVEALUI_LICENSE_PRIVATE_KEY` and `REVEALUI_LICENSE_PUBLIC_KEY`
3. Run `stripe:seed` → creates 6 products (3 tiers × 2 billing models), 10+ prices, registers webhook endpoint, configures billing portal
4. Run `billing:catalog:sync` → populates `billing_catalog` table in NeonDB
5. Capture generated price IDs: `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `_MAX_PRICE_ID`, `_ENTERPRISE_PRICE_ID`
6. Capture webhook signing secret: `STRIPE_WEBHOOK_SECRET`

**Ordering constraint:** `billing:catalog:sync` requires both the database (step 2) and Stripe products (this step) to exist.

### Step 4: Connect Email

**Required for production.** Without email, password reset and email verification break.

**Provider options:**
- **Resend** (recommended): paste `RESEND_API_KEY` from resend.com
- **SMTP**: configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

**Validation:** Send a test email to the user's admin email address.

**Store:** `RESEND_API_KEY` or SMTP credentials in config.

### Step 5: Connect Blob Storage

**Vercel Blob (required for CMS media uploads):**
- Guide user to Vercel project → Storage → Create Blob Store
- Paste `BLOB_READ_WRITE_TOKEN`
- Validate token has read + write permissions

Without this, media uploads fail with 500 errors.

### Step 6: Generate Secrets

**Auto-generated (user never sees raw values):**
- `REVEALUI_SECRET` — 48 random chars (session encryption)
- `REVEALUI_KEK` — 48 random chars (field-level encryption key)
- `REVEALUI_CRON_SECRET` — 48 random chars (cron endpoint auth)

**From step 3:**
- `REVEALUI_LICENSE_PRIVATE_KEY` (RSA PEM)
- `REVEALUI_LICENSE_PUBLIC_KEY` (RSA PEM)

All values stored in Vercel project env vars via API (never committed to git, never shown to user).

### Step 7: Configure Domain & CORS

**User enters their domain** (e.g., `acme.com`).

**Auto-derived:**
- `NEXT_PUBLIC_SERVER_URL` → `https://cms.acme.com`
- `REVEALUI_PUBLIC_SERVER_URL` → `https://api.acme.com`
- `CMS_URL` → `https://cms.acme.com`
- `CORS_ORIGIN` → `https://cms.acme.com,https://acme.com`
- Cookie domain: `.acme.com` (cross-subdomain session sharing)

**DNS records to create** (displayed as copyable table):
| Type | Name | Value |
|------|------|-------|
| CNAME | api | cname.vercel-dns.com |
| CNAME | cms | cname.vercel-dns.com |
| CNAME | @ | cname.vercel-dns.com |
| CNAME | docs | cname.vercel-dns.com |

**Optional configuration:**
- `REVEALUI_SIGNUP_OPEN` — default: `true` (installer sets this explicitly)
- `REVEALUI_SIGNUP_WHITELIST` — comma-separated allowed emails
- `REVEALUI_BRAND_NAME` — custom brand name (default: "RevealUI")
- `REVEALUI_BRAND_PRIMARY_COLOR` — hex color (default: `#ea580c`)
- `REVEALUI_BRAND_LOGO_URL` — URL to logo image

### Step 8: Deploy

**Actions:**
1. Push all env vars to each Vercel project via API (per-app matrix):
   - API needs ~15 vars
   - CMS needs ~12 vars
   - Marketing needs ~5 vars
2. Deploy all 3 apps in parallel via Vercel API
3. Wait for all deployments to reach "READY" status
4. Configure Vercel Cron jobs (added to `apps/api/vercel.json`):
   - `POST /api/billing/support-renewal-check` — `0 9 * * *` (daily 9 AM UTC)
   - `POST /api/billing/report-agent-overage` — `*/5 * * * *` (every 5 minutes)

**Warnings displayed:**
- Job queue requires cron-based worker or external process for long-running tasks (Vercel serverless has request timeouts)
- SSL certificates are auto-provisioned by Vercel (may take a few minutes)

### Step 9: Bootstrap & Verify

**Admin user creation:**
- Form: email + password (≥12 chars)
- Sets `REVEALUI_ADMIN_EMAIL` and `REVEALUI_ADMIN_PASSWORD` env vars
- First user automatically becomes admin

**Automated verification checklist:**
- [ ] API health check (`/health/ready`) returns 200
- [ ] CMS renders login page (HTTP 200 on root)
- [ ] Marketing page renders (HTTP 200)
- [ ] Stripe webhook test event fires and is received
- [ ] Database connection works (via health endpoint)
- [ ] CORS allows CMS → API requests
- [ ] Session cookie works cross-subdomain
- [ ] Email delivery works (test email to admin)
- [ ] Signup flow works end-to-end (if `REVEALUI_SIGNUP_OPEN=true`)

**Final screen:** 3 deployment URLs, all green checks, "Your RevealUI instance is live" message.

---

## Develop Wizard (Improved Existing)

Lower priority — existing wizard works today. Improvements:

1. **Active installation, not just status checks.** Each step detects → installs → verifies. Progress bars for long installs (Nix takes ~5 min).
2. **Platform-adaptive.** Detect OS and adjust steps:
   - Windows: WSL2 → Nix → pnpm → clone repo → DevPod
   - macOS: Homebrew → Nix → pnpm → clone repo
   - Linux: Nix → pnpm → clone repo
3. **Step recovery.** Store step completion in config file. Resume from last completed step on restart.
4. **macOS and Linux platform implementations.** Current stubs in `platform/macos.rs` and `platform/linux.rs` need real implementations.

---

## Adaptive Dashboard

After wizard completion, the dashboard adapts based on intent:

**Deploy intent → Deployment Dashboard:**
- Deployment health (3 apps: green/yellow/red)
- Stripe webhook status (last received, success rate)
- Database connection status
- Recent signups / active users
- Billing summary (MRR, active subscriptions)

**Develop intent → Dev Companion** (existing dashboard, unchanged):
- WSL/system status
- DevPod mount status
- Repository sync
- App launcher
- Terminal / SSH

---

## Persistent Configuration

Replace `localStorage` with Rust-managed config at `~/.config/revealui-studio/config.json`:

```typescript
interface StudioConfig {
  intent: 'deploy' | 'develop' | null;
  setupComplete: boolean;
  completedSteps: string[];  // For resume-from-failure
  deploy?: {
    vercelToken: string;
    vercelTeamId: string;
    domain: string;
    apps: { api: string; cms: string; marketing: string };  // Vercel project IDs
    neonProjectId: string;
    supabaseEnabled: boolean;
    emailProvider: 'resend' | 'smtp';
  };
  develop?: {
    repoPath: string;
    wslDistro: string;
    nixInstalled: boolean;
  };
}
```

Managed via new Rust commands: `get_config`, `set_config`, `reset_config`.

---

## New Rust Commands

| Command | Purpose |
|---------|---------|
| `get_config` / `set_config` | Persistent config read/write |
| `vercel_auth_oauth` | Start OAuth flow, return token |
| `vercel_deploy` | Deploy app via Vercel API |
| `vercel_set_env` | Push env vars to Vercel project |
| `vercel_get_deployments` | Check deployment status |
| `neon_create_project` | Create NeonDB project via API |
| `neon_test_connection` | Validate connection string |
| `stripe_validate_keys` | Test Stripe API keys |
| `stripe_seed` | Run stripe:seed script |
| `stripe_generate_keys` | Generate RSA key pair |
| `resend_test` | Send test email via Resend |
| `generate_secret` | Crypto-random string generation |
| `generate_rsa_keypair` | RSA-2048 key pair generation |
| `run_db_migrate` | Execute Drizzle migrations |
| `run_db_seed` | Execute database seed |
| `health_check` | HTTP health check on deployed URL |

---

## Known Limitations (Disclosed to User)

1. **Job queue in serverless:** Vercel serverless has request timeouts. Long-running background jobs need a cron-based trigger or external worker process.
2. **Pro features:** AI agents, MCP servers, and The Creator require a commercial license. Source code is not in the public repo.
3. **License cache:** Revoked licenses may remain active for up to 24 hours due to server-side caching.
4. **Rate limiting latency:** Database-backed rate limiting adds ~30-50ms per auth request. Acceptable at launch scale.
5. **ElectricSQL:** Real-time sync is not configured by the deploy wizard. Available as a post-deploy add-on.
6. **Analytics:** No analytics integration is configured. Users can add PostHog, Plausible, etc. post-deploy.

---

## Build & Distribution

- **Binary size target:** ~15-25MB (Tauri 2 + WebKit)
- **Distribution:** GitHub Releases (`.msi` for Windows, `.dmg` for macOS, `.AppImage` for Linux)
- **Auto-update:** Tauri's built-in updater (checks GitHub Releases)
- **CI:** GitHub Actions workflow builds for all 3 platforms on tag push

---

## Success Criteria

1. A user with zero RevealUI knowledge can go from downloading the installer to a live deployment in under 30 minutes.
2. Every step validates its own success before allowing "Next."
3. Wizard can resume from any failed step without re-doing completed steps.
4. No credentials are ever committed to git or shown in logs.
5. The deploy wizard uses the existing Zod schema (`packages/config/src/schema.ts`) for env var validation — no parallel validation logic.
