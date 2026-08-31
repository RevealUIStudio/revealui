---
title: "Owner publish checklist — Vercel one-click template"
description: "Owner-only steps to sync GitHub twins and submit vercel.com/templates. Listing URL is not live."
visibility: public
status: verified
audience: maintainer
---

# Owner publish checklist — Vercel customer runtime template

Agent work in this monorepo is **done**: CLI templates ship `vercel.json`,
`/templates` has Deploy to Vercel buttons on the four Next.js GitHub twins,
and official submit metadata lives in `deployment/vercel/templates.json`.

This is the **runtime deploy path**, not a Studio SKU and not a Starter Kit.
Catalog stays RevealUI Free / Pro $49 / Max $99 plus Studio Hour / Architecture
/ Launch. Do not list RevDev, RevForge, RevKit, or Fleet as for sale.

Closure is **owner dashboard + twin sync**. Do not invent a
`vercel.com/templates` listing URL.

Full visitor/env detail: [`deployment/vercel/README.md`](https://github.com/RevealUIStudio/revealui/blob/test/deployment/vercel/README.md).

## 0. What is already live without a marketplace listing

A stranger can click **Deploy to Vercel** on
[revealui.com/templates](https://revealui.com/templates) today. That URL is
`https://vercel.com/new/clone?repository-url=…` pointed at:

- https://github.com/RevealUIStudio/revealui-template-basic-blog
- https://github.com/RevealUIStudio/revealui-template-e-commerce
- https://github.com/RevealUIStudio/revealui-template-portfolio
- https://github.com/RevealUIStudio/revealui-template-starter

Vercel auto-detects Next.js even before the twins gain `vercel.json`.
`starter-native` has no twin and no Deploy button.

## 1. Sync the four GitHub twins (owner git push)

The twins are separate repos. From a fresh checkout of each twin:

1. Copy `packages/cli/templates/<id>/vercel.json` from this monorepo onto the twin root.
2. Refresh the twin from the current CLI template when you next do a twin release (the twins are older snapshots and should match the monorepo CLI templates, including R2-only object storage).
3. Paste the Deploy block from [`deployment/vercel/deploy-button.md`](https://github.com/RevealUIStudio/revealui/blob/test/deployment/vercel/deploy-button.md) into that twin's README.
4. Do not add Neon or Blob `stores` to the Deploy URL. Visitors paste their own `POSTGRES_URL`.
5. Do not add a `vercel.com/templates/…` link until step 3 records a real listing.

## 2. Official marketplace submit (owner-only)

Vercel does not publish a listing from repo files. An org owner must submit.

1. Sign in as the RevealUIStudio Vercel team owner (not this agent).
2. Open **https://vercel.com/templates/submit**.
3. Submit **one** twin first (`revealui-template-starter` is the blank-canvas default). Use the row in [`deployment/vercel/templates.json`](https://github.com/RevealUIStudio/revealui/blob/test/deployment/vercel/templates.json).
4. Framework: Next.js. CSS: Tailwind. Use the Circuit-R mark already in the brand kit (navy letter, scythe, empty bowl). Do not upload a white plate, faceted R, or frost invert.
5. Demo URL: only a URL you have actually deployed from that twin. If none exists, skip demo rather than fake one.
6. Deploy URL: the `vercel.com/new/clone` href already on `/templates` for that twin.
7. If the form is closed or Vercel is not accepting community templates, record that on the gap and **stop**. Do not invent `https://vercel.com/templates/revealui` or any other listing URL.

## 3. After Vercel accepts a listing

1. Copy the **real** listing URL Vercel shows (example shape historically: `https://vercel.com/templates/next.js/<slug>`).
2. Set `listingUrl` and `listingStatus: "published"` in `deployment/vercel/templates.json`.
3. Only then add that URL to `/templates` copy. Until that commit, `listingUrl` stays `null`.

## 4. Acceptance walk (owner)

1. Clean Vercel account (not Studio prod).
2. Click Deploy to Vercel on `/templates` for `starter`.
3. Create or paste a Neon (or other Postgres) connection string into `POSTGRES_URL`.
4. Set `REVEALUI_SECRET` (32+ chars) and the two public URL vars.
5. First deploy succeeds. Set public URLs to the `*.vercel.app` host and redeploy.
6. Open the app. This is a visitor project on their Vercel + their database.

## Do not

- Buy Vercel marketplace add-ons (Neon via `stores`, Blob, or paid integrations) from this agent or as a required clone step.
- Claim a `vercel.com/templates` listing URL before Vercel publishes one.
- Restore Starter Kit $299 on `/pricing`.
- List RevDev, RevForge, RevKit, or Fleet as for sale.
- Call verify free.
- Point the Deploy button at the monorepo root (that is Studio production, Git auto-deploy off).
