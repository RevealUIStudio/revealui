---
title: "RevealUI Starter Kit — Getting Started"
description: "Launch-ready self-host config, deploy scripts, and governed-agent recipes on top of create-revealui."
visibility: private
status: verified
audience: buyer
---

# RevealUI Starter Kit

This kit is content and curation layered on top of the free, MIT-licensed
`create-revealui` scaffolder and framework, not a separate product. Everything
free in RevealUI (the scaffolder, the five app templates, the framework
packages) stays free. What this kit adds:

1. A **fixed, tested docker-compose recipe** for self-hosting the RevealUI
   backend at Free (OSS) tier, no license key required.
2. A **one-command bootstrap** that wires up the database migration step the
   free scaffolder documents but doesn't run for you.
3. An **env template with real secret-generation commands**, not just prose.
4. **Three governed-agent recipes**, each producing a cryptographically
   signed, offline-verifiable receipt of every action — the pattern the
   fleet's own Apify actor uses, generalized for use in your own app.
5. Access to the private RevealUI Substack section and lifetime kit updates
   (see your purchase confirmation for the invite).

## What "governed agent" and "receipt" mean here

Any action a sensitive tool takes — a refund, a permission grant, a step in
an autonomous loop — gets logged as an entry in an ordered action log. At the
end of a run, the whole log is signed with a fresh Ed25519 keypair generated
just for that run. The public half of the key travels with the receipt, so
**anyone can verify the receipt offline, with no network call and no
dependency on RevealUI's servers** — the receipt carries its own key.

What a receipt proves: the logged actions were not altered after signing.
What it does not prove: which machine ran the recipe, or that a specific LLM
call actually happened. Say it that way to your own users if you build on
this — overclaiming here is the fastest way to lose trust in an audit trail.

## Quick start: the governed-agent recipes (no docker required)

These are ordinary TypeScript files. From this directory:

```bash
pnpm install
pnpm recipe:action   # a single governed action, signed and verified
pnpm recipe:loop      # a multi-step, budget-capped agent loop, signed and verified
pnpm verify-receipt receipt-action.json   # verify any receipt, fully offline
```

`recipe:loop` runs in **offline demo mode** by default (a scripted stand-in
for the model, no network, no API key) so you can see the whole pattern run
end to end immediately. To use a real model:

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm recipe:loop
```

Read `src/receipts/sign.ts` and `src/receipts/verify.ts` for the primitives —
they're built entirely on `@revealui/security` (MIT, free, ships with every
RevealUI install). Nothing in the receipt mechanism requires a Pro license.

## Self-hosting the RevealUI backend (Free tier, no license key)

The docker-compose path here is a fixed, minimal version of the one in the
main `revealui` repo root, scoped to Postgres + the API + the admin
dashboard (the marketing site is a separate app; run it with
`pnpm --filter marketing dev` if you want it too).

```bash
cp .env.starter.example .env
bash scripts/generate-secrets.sh >> .env   # fills in every *_SECRET / *_KEY value
# edit .env: set REVEALUI_ADMIN_EMAIL to your real email
bash scripts/bootstrap.sh                  # starts postgres, migrates, then api + admin
```

This boots at **Free (OSS) tier by default** — `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true`
is already set in `docker-compose.starter.yml`. If you have a Fleet license,
set `REVEALUI_LICENSE_KEY` / `REVEALUI_LICENSE_PUBLIC_KEY` in `.env` instead.

Once `admin` reports healthy, log in at `http://localhost:4000/` with the
`REVEALUI_ADMIN_EMAIL` / `REVEALUI_ADMIN_PASSWORD` you set in `.env` (this
only seeds the account once — rotate the password immediately after your
first login).

`[owner: test once]` — the docker build itself (`docker compose -f
docker-compose.starter.yml build`) was not run end-to-end in the session that
built this kit, to avoid a long build inside an agent session. The compose
file's YAML and env-var interpolation were validated (`docker compose config`),
and every underlying piece (`apps/server/Dockerfile`, `apps/admin/Dockerfile`,
the `REVEALUI_ALLOW_UNLICENSED_SELF_HOST` gate) is the same code the fleet's
own Railway deployment doc verifies against. Run the actual build once before
shipping the first purchase confirmation.

## Upgrading to Pro

This kit is content-only — it does not include or require a Pro license.
Your purchase includes a coupon for **your first month of RevealUI Pro
free**; see your purchase confirmation email for the code. Apply it at
checkout when you're ready to upgrade at revealui.com/pricing.

## Support

Questions and requests go in the private RevealUI Substack section (invite
in your purchase confirmation). Kit updates ship there too.
