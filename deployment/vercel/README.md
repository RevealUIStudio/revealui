# RevealUI on Vercel (buyer one-click)

This directory is the listing metadata for the **buyer** Deploy to Vercel path.
The buyer clones the existing starter onto **their** Vercel account and a Neon
database **they** control.

This is not Studio production hosting. Studio production stays Vercel + Neon +
Fly on RevealUI's own projects. This is not the $299 Starter Kit. This is not a
fourth studio invoice. Studio SKUs stay Hour $300 / Architecture artifact
bundle and review $3,500 / Launch $7,500.

Railway GAP-430 remains a leftover customer marketplace path. Do not finish
Railway here. Vercel is the chosen one-click.

## Source

Prefer the existing starter, not a new product:

| Surface | URL |
|---------|-----|
| CLI | `npx create-revealui@latest --template starter` (create-revealui 0.5.22) |
| GitHub twin | https://github.com/RevealUIStudio/revealui-template-starter |
| Live catalog | https://revealui.com/templates |

`packages/cli/templates/starter/vercel.json` is the scaffold copy of
[`vercel.json`](./vercel.json). [`template.json`](./template.json) is the
Deploy Button metadata Vercel currently requires (`repository-url`, `env`,
`stores` for Neon).

## Deploy to Vercel

The clone URL is built from `template.json`:

1. Open https://revealui.com/templates and click **Deploy to Vercel**, or
2. Open the clone URL documented on that page.

The flow signs the buyer into **their** Vercel account, clones
`revealui-template-starter` into a repo they own, prompts for
`REVEALUI_SECRET`, public URLs, and first-admin credentials, and offers Neon
from the Vercel Marketplace (`stores`: neon / neon / storage).

Neon injects `DATABASE_URL`. RevealUI accepts that as a `POSTGRES_URL`
fallback. After the first deploy, set `REVEALUI_PUBLIC_SERVER_URL` and
`NEXT_PUBLIC_SERVER_URL` to the project's Vercel URL.

This is the RevealUI runtime on Vercel and Neon you control. Not managed
hosting. Not SSO shipped. Not a claim of paying customers.

## Official button (README of the twin)

```markdown
[![Deploy with Vercel](https://vercel.com/button)](CLONE_URL)
```

Use the official Vercel button asset. Do not redraw the Circuit-R.

## Leftover (owner)

See [VERCEL-TEMPLATE-OWNER-PUBLISH.md](../../docs/distribution/VERCEL-TEMPLATE-OWNER-PUBLISH.md).
Vercel Marketplace / `vercel.com/templates` publish is an owner dashboard
step. Do not invent a live listing URL.
