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

1. A **ready-to-run Postgres** configured the way RevealUI actually needs it
   (the `vector` extension its first migration requires), so self-hosting at
   Free (OSS) tier works on the first try.
2. A **one-command bootstrap** for that database, with the exact connection
   string to paste into your app.
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

## Self-hosting RevealUI (Free tier, no license key)

RevealUI ships on the public npm registry, so your app is an ordinary npm
install — there is no image to pull and nothing to build from source. Two
pieces: a database (this kit gives you one), and the app itself (the free
scaffolder gives you that).

**1. Start the database.**

```bash
cp .env.starter.example .env
bash scripts/generate-secrets.sh >> .env   # fills in every *_SECRET / *_KEY value
bash scripts/bootstrap.sh                  # starts postgres, waits for health
```

`bootstrap.sh` prints the exact `POSTGRES_URL` to use in the next step.

**2. Create your app.**

```bash
npm create revealui@latest my-app
cd my-app
```

Put the `POSTGRES_URL` from step 1 into `my-app/.env`, along with the
`REVEALUI_SECRET`, `REVEALUI_KEK`, and `REVEALUI_AUDIT_SIGNING_KEY` values
that `generate-secrets.sh` produced — they are the same secrets, and the app
is what reads them.

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Your app is on `http://localhost:4000/`.

This runs at **Free (OSS) tier** — no license key, nothing to activate. If you
have a Fleet license, set `REVEALUI_LICENSE_KEY` / `REVEALUI_LICENSE_PUBLIC_KEY`
in your app's `.env`.

> **Why the app is not in the compose file.** Earlier versions of this kit
> shipped a compose file that built the API and admin from the RevealUI
> monorepo's own Dockerfiles. That only worked with the full monorepo checked
> out two levels above the kit, which is not something you have. The framework
> is on npm, so the app is an npm install and the compose file covers only the
> database.

## Upgrading to Pro

This kit is content-only — it does not include or require a Pro license.
Your purchase includes a coupon for **your first month of RevealUI Pro
free**; see your purchase confirmation email for the code. Apply it at
checkout when you're ready to upgrade at revealui.com/pricing.

## Support

Questions and requests go in the private RevealUI Substack section (invite
in your purchase confirmation). Kit updates ship there too.
