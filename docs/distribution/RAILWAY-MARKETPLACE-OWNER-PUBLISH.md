# Owner publish checklist — Railway marketplace (GAP-430)

Agent work for template definition, first-boot docs, and monorepo cross-links is
**done** (`deployment/railway/*` on `test`). Closure is **owner dashboard publish**
only. Studio production hosting stays Vercel + Neon + Fly; this listing is a
customer self-host sales channel.

## 1. Account

1. Sign in to the RevealUI Railway account (Hobby paid account already used for
   early work 2026-07-27).
2. Confirm billing is active (marketplace author kickback requires a paid plan
   context as Railway documents it).
3. Optional: enable support-bonus queue / author program settings if offered.

## 2. Template source

- Config-as-code: `deployment/railway/README.md`, `api.json`, `admin.json`
- Images: `apps/server/Dockerfile`, `apps/admin/Dockerfile`, migrate image
  `ghcr.io/revealuistudio/revealui-migrate`, Postgres `pgvector/pgvector:pg16`
- Docs already cross-link from README and `docs/guides/deployment.md`

Do **not** re-author a parallel compose path. Extend `deployment/railway/` only.

## 3. Publish (dashboard)

1. Create or update a Railway **Template** from this monorepo, pointing services
   at the config in `deployment/railway/`.
2. Ensure template services match the README architecture table (postgres,
   migrate, api, admin).
3. Document required env vars in the template UI (no secrets baked in).
4. Set Free-tier path: `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true` on **both**
   api and admin when no license key is supplied (see README).
5. Publish to the marketplace; opt into author kickback / support bonus if
   separate toggles exist.
6. Wire payout (Stripe Connect or Railway payout path) for the $100 threshold.

## 4. Clean-account acceptance walk (close GAP-430)

From a **second** Railway account (or reset project):

1. Deploy template one-click.
2. Wait migrate success; api + admin healthy.
3. Open admin; seeded login works with documented defaults / env.
4. Record: marketplace listing URL, deploy project id, screenshot or log note
   of healthy services, kickback/payout status.

## 5. Record on GAP-430

Paste listing URL + smoke date into `docs/gaps/GAP-430.yml` progress, then close
when acceptance is met.

## Peers

Do not re-scaffold `deployment/railway/api.json` or `admin.json` without a new
proven residual. Owner publish is the remaining door.
