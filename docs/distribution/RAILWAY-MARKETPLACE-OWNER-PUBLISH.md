# Owner publish checklist — customer marketplace sales channel (GAP-430)

**Filename is historical** (`RAILWAY-MARKETPLACE-…`). Studio production hosting is
**Vercel + Neon + Fly** only. This template is a **customer self-host sales channel**
under `deployment/railway/*` — not Studio production.

Repo SoT for the customer marketplace listing is
[`deployment/railway/marketplace-template.json`](../../deployment/railway/marketplace-template.json)
plus the per-service builder files
[`deployment/railway/api.json`](../../deployment/railway/api.json) /
[`deployment/railway/admin.json`](../../deployment/railway/admin.json).
Closure is still **owner dashboard republish** + clean-account deploy walk —
the live listing does not read those files by itself.

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
| 3 | `api` | This GitHub repo, root context | Variable `RAILWAY_DOCKERFILE_PATH=apps/server/Dockerfile` (and/or Builder = Dockerfile with that path). Public domain. **Do not** rely on Config File Path — new Railway services cannot opt into Config as Code, so `/deployment/railway/api.json` is never applied on a fresh Deploy Now. |
| 4 | `admin` | This GitHub repo, root context | Variable `RAILWAY_DOCKERFILE_PATH=apps/admin/Dockerfile` (and/or Builder = Dockerfile with that path). Public domain. Same Config File Path caveat as `api` (`deployment/railway/admin.json` is not applied on Deploy Now). |

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

## 4b. Republish after Railpack smoke FAIL (required)

2026-09-15 customer marketplace Deploy Now from https://railway.com/deploy/revealui (template
`5a37bb0e-83bf-4ff7-b327-42c8ae3be350`) built `api` and `admin` with Railpack
and empty `startCommand`. Both failed with **No start command detected.**
`/health` and `/api/health` returned HTTP 404. Postgres and migrate were fine.

The published `manifest.json` had `rootDirectory: null`, `startCommand: null`,
and no Dockerfile path — so it never picked up `deployment/railway/*.json`.

**Joshua (owner) dashboard republish — do this on the existing listing, do not
create a second RevealUI template:**

1. Open the RevealUI template editor (Workspace → Templates → RevealUI), or
   open a clean-account project that already has the four services and
   **Update Template** / Generate Template from that project.
2. On **api** → Variables: set `RAILWAY_DOCKERFILE_PATH` =
   `apps/server/Dockerfile`. Keep `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true`.
   If the Settings tab still exposes Builder, set Builder = Dockerfile and
   Dockerfile path to the same value. Leave start command empty (the image
   `CMD` is `node dist/worker.js`).
3. On **admin** → Variables: set `RAILWAY_DOCKERFILE_PATH` =
   `apps/admin/Dockerfile`. Same Free-tier flag. Same Builder/Dockerfile
   settings if the UI has them. Leave start command empty (`CMD` is
   `node apps/admin/server.js` with `RUNTIME_INIT=1`).
4. Save / publish the template update (republish the existing slug `revealui`).
5. Open the customer marketplace https://railway.com/deploy/revealui/manifest.json and confirm both
   `api` and `admin` list `RAILWAY_DOCKERFILE_PATH` on that marketplace listing (or a non-null Dockerfile
   builder path). If they still look Railpack-shaped, the republish did not
   stick.
6. Fresh customer marketplace Deploy Now. Build logs must say Railway is using a Dockerfile, not
   Railpack **No start command**. Then TemplateCI can validate.

Copy values from
[`deployment/railway/marketplace-template.json`](../../deployment/railway/marketplace-template.json)
if the dashboard fields are unclear.

## 5. Acceptance (close GAP-430)

1. Clean-account walk green (login works).
2. Public marketplace listing URL recorded on GAP-430 progress.
3. Payout enrollment confirmed (or explicitly deferred with reason).
4. `manifest.json` shows Dockerfile wiring on api + admin (step 4b).

## Do not

- Re-scaffold `deployment/railway/api.json` / `admin.json` without a new residual.
- Present the customer marketplace host as Studio production (Studio = Vercel + Neon + Fly).
- Use vanilla `postgres` image (vector extension fails).
- Leave migrate Restart Policy on ALWAYS/ON_FAILURE (crash loop).
- Republish the customer marketplace listing without `RAILWAY_DOCKERFILE_PATH` on api and admin (Railpack **No start command** returns).
- Treat Config File Path as enough for Deploy Now (new services cannot opt into Config as Code).
