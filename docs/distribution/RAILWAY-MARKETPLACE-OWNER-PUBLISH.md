# Owner publish checklist — customer marketplace sales channel (GAP-430)

**Filename is historical** (`RAILWAY-MARKETPLACE-…`). Studio production hosting is
**Vercel + Neon + Fly** only. This template is a **customer self-host sales channel**
under `deployment/railway/*` — not Studio production.

Agent config-as-code is **done** on `main`. Closure is **owner dashboard publish** +
clean-account deploy walk.

Full service/env/first-boot detail:

[`deployment/railway/README.md`](../../deployment/railway/README.md)
(customer marketplace path; Studio prod stays off that stack.)

## 0. Product decision (before public list)

Pick one and put it in the listing description:

1. **Licensed Fleet customers only** — visitor already has `REVEALUI_LICENSE_KEY` + public key from Studio; or
2. **Free (OSS) try path** — set `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true` on **both** `api` and `admin`, omit license keys.

Do not ship a public Deploy button that dead-ends at a license prompt for most visitors.

## 1. Account (customer marketplace dashboard)

1. Hobby (paid) account signed in on the customer marketplace host.
2. Partner / Template Queue / payout enrollment ready (Template Queue URL in the platform docs).

## 2. Clean-account compose (acceptance walk)

Create a **new** project (not Studio prod). Order:

| # | Service | Source | Config path / notes |
|---|---------|--------|---------------------|
| 1 | `postgres` | Docker `pgvector/pgvector:pg16` | **Not** plain Postgres; set `POSTGRES_*` |
| 2 | `migrate` | `ghcr.io/revealuistudio/revealui-migrate` (`latest` from `main`, or `sha-…`) | Restart policy **NEVER**; run once after postgres healthy |
| 3 | `api` | This GitHub repo, root context | Config File Path `/deployment/railway/api.json`; public domain |
| 4 | `admin` | This GitHub repo, root context | Config File Path `/deployment/railway/admin.json`; public domain |

Generate secrets with `openssl` (see README env tables). Set Free flag **or** real license keys on **api and admin**.

**Build order:** generate `api` public domain **before** first `admin` build (`NEXT_PUBLIC_API_URL` is build-time). Redeploy admin if api domain was late.

## 3. First-boot

1. `migrate` exits 0 once.
2. `api` `/health` and `admin` `/api/health` healthy.
3. Log in with `REVEALUI_ADMIN_EMAIL` / `REVEALUI_ADMIN_PASSWORD`.
4. Rotate admin password immediately.

## 4. Marketplace publish (sales channel only)

1. Project → Generate Template (or current dashboard equivalent).
2. Listing name, description, icon, category (state Free vs licensed audience).
3. Submit Template Queue for review.
4. Confirm partner kickback / payout settings.

## 5. Acceptance (close GAP-430)

1. Clean-account walk green (login works).
2. Public marketplace listing URL recorded on GAP-430 progress.
3. Payout enrollment confirmed (or explicitly deferred with reason).

## Do not

- Re-scaffold `deployment/railway/api.json` / `admin.json` without a new residual.
- Present the customer marketplace host as Studio production (Studio = Vercel + Neon + Fly).
- Use vanilla `postgres` image (vector extension fails).
- Leave migrate Restart Policy on ALWAYS/ON_FAILURE (crash loop).
