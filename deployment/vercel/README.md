# RevealUI on Vercel (customer runtime template)

This directory holds the official template metadata for a **visitor Deploy
to Vercel** path. It clones an existing public GitHub twin onto **their**
Vercel account with **their** Neon or Postgres. It is not a fourth Studio
SKU, not a Starter Kit, and not Studio production hosting.

Studio production stays on Vercel + Neon + Fly and is unchanged by anything
here. The four GitHub twins already exist:

| CLI template | Public GitHub twin |
|---|---|
| `basic-blog` | https://github.com/RevealUIStudio/revealui-template-basic-blog |
| `e-commerce` | https://github.com/RevealUIStudio/revealui-template-e-commerce |
| `portfolio` | https://github.com/RevealUIStudio/revealui-template-portfolio |
| `starter` | https://github.com/RevealUIStudio/revealui-template-starter |

`starter-native` (Vite + `@revealui/router`) has no GitHub twin and no
Deploy button. Scaffold it with `npx create-revealui@latest --template starter-native`.

## What a stranger gets

1. Click **Deploy to Vercel** on [revealui.com/templates](https://revealui.com/templates) (or the twin README after the owner syncs it).
2. Vercel clones the GitHub twin into their Git account and creates a project on their Vercel team.
3. They paste `POSTGRES_URL` from their own Neon (or any Postgres 16+) plus `REVEALUI_SECRET` and the two public URL vars.
4. First deploy lands on their `*.vercel.app`. Then they set the public URL vars to that host and redeploy.

This flow does **not** buy a Vercel marketplace add-on, does **not** provision Neon through Vercel `stores`, and does **not** use Vercel Blob. Media later uses Cloudflare R2 on the visitor account.

Required env (clone form):

- `POSTGRES_URL`
- `REVEALUI_SECRET`
- `REVEALUI_PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_SERVER_URL`

## Official `vercel.com/templates` listing

**Not published.** `listingUrl` in `templates.json` is `null`. Do not invent
`https://vercel.com/templates/revealui` or any other listing URL.

Marketplace publish is owner-only. Exact steps:

[docs/distribution/VERCEL-TEMPLATE-OWNER-PUBLISH.md](../../docs/distribution/VERCEL-TEMPLATE-OWNER-PUBLISH.md)

## Files

| Piece | Location |
|---|---|
| Official submit metadata | [templates.json](./templates.json) |
| README Deploy-button snippet for GitHub twins | [deploy-button.md](./deploy-button.md) |
| In-monorepo CLI `vercel.json` | `packages/cli/templates/{starter,basic-blog,e-commerce,portfolio,starter-native}/vercel.json` |
| Public Deploy buttons | `apps/marketing/app/content/templates.ts` |

## Residual (owner)

The four GitHub twins do not yet carry `vercel.json` or a Deploy button in
their README. Vercel still auto-detects Next.js, so `/templates` Deploy
buttons work against the twins as they stand. Sync the monorepo
`vercel.json` plus [deploy-button.md](./deploy-button.md) into each twin
when you next refresh those repos from the CLI templates.
