---
title: "GAP-432 — PikaPods and Elest.io listing drafts"
description: "Owner-send drafts and checklist for PikaPods and Elest.io. Resource floor and submission evidence stay blank until Joshua fills them."
visibility: internal
status: narrative
audience: maintainer
last_verified: 2026-09-23
owner: joshua
---

# GAP-432 — PikaPods and Elest.io listing drafts

Catalog requests are **not sent**. Listing URLs are blank. This file is the
copy Joshua sends himself after the image workflow on `main` can tag each
image with its own package version.

Checked 2026-09-23 against GHCR anonymous pulls and the public vendor docs
linked below. No outreach draft existed in this repo before this file.

## Owner still does

1. Dispatch **Build & Push Forge Docker Images** from `main` after
   `.github/workflows/docker.yml` on `main` tags each image from its own
   `package.json` (landed on `test` in
   [#2926](https://github.com/RevealUIStudio/revealui/pull/2926)). Today's
   `main` workflow publishes `:latest` and `:sha-` only, plus one manual
   `inputs.version` shared by every image. Server is `0.2.0` and admin is
   `0.4.0`, so one shared version tag is the wrong label.
2. Paste measured CPU, memory, and disk into [Resource floor](#resource-floor).
3. Send the PikaPods request and the Elest.io request himself.
4. Paste the send record into [Submission evidence](#submission-evidence).

An agent does not email `hello@pikapods.com`, post on
[PikaPods Feedback](https://feedback.pikapods.com/), email `info@elest.io`, or
sign either request.

## What the drafts may claim

| Fact | Value |
|------|--------|
| Product | Self-hosted business runtime (people, content, offers, payments, agents) |
| Repo | https://github.com/RevealUIStudio/revealui |
| Site | https://revealui.com |
| Docs | https://docs.revealui.com |
| Support | support@revealui.com and https://github.com/RevealUIStudio/revealui/discussions |
| Studio production | Vercel + Fly + Neon. Studio does not operate a customer VM |
| Free self-host | `REVEALUI_DEPLOYMENT_MODE=forge` and `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true` on **api and admin**. Omit license key and public key |
| License | MIT for the OSS packages. Pro packages in the images are FSL-1.1-MIT (self-host is allowed; each release converts to MIT after two years) |

GHCR images, anonymous manifest check 2026-09-23:

| Image | `:latest` | `:v0.2.0` | `:v0.4.0` |
|-------|-----------|-----------|-----------|
| `ghcr.io/revealuistudio/revealui-api` | HTTP 200 | HTTP 404 | HTTP 404 |
| `ghcr.io/revealuistudio/revealui-admin` | HTTP 200 | HTTP 404 | HTTP 404 |
| `ghcr.io/revealuistudio/revealui-migrate` | HTTP 200 | HTTP 404 | HTTP 404 |

Postgres for this stack is `pgvector/pgvector:pg16`. A plain Postgres image
fails migration `0000` (`CREATE EXTENSION vector`).

Services in `docker-compose.forge.yml`:

| Service | Port | Health | Restart |
|---------|------|--------|---------|
| postgres | 5432, internal | `pg_isready` | unless-stopped |
| migrate | none | exits 0 once | `no` |
| api | 3004 | `GET /health` | unless-stopped |
| admin | 4000 | `GET /api/health` | unless-stopped |

Boot env for the Free forge path (api and admin), from
`REQUIRED_IN_PRODUCTION_FORGE` with the license pair omitted:

- `NODE_ENV=production`
- `POSTGRES_URL` (or `DATABASE_URL`)
- `REVEALUI_SECRET` (32+ characters)
- `REVEALUI_KEK`
- `REVEALUI_AUDIT_SIGNING_KEY` (Ed25519 PKCS#8 PEM)
- `REVEALUI_PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_SERVER_URL`
- `CORS_ORIGIN`
- `REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true`
- `REVEALUI_DEPLOYMENT_MODE=forge`

Admin also needs `NEXT_PUBLIC_API_URL` pointed at the **api** origin. The
browser bundle reads that value. `apps/admin/Dockerfile.forge` does not declare
`NEXT_PUBLIC_*` build-args (`SKIP_ENV_VALIDATION=true` at build). Confirm a
pod can set the admin browser's API origin before describing the listing as
one-click.

`/templates` stays silent on both hosts. Marketing tests reject the names
until a real listing URL exists.

## Fit

### PikaPods

Source: https://docs.pikapods.com/faq/apps (Adding new apps), checked 2026-09-23.
Author follow-up they have used: `hello@pikapods.com`.
Homepage: https://www.pikapods.com/

| Their criterion | This stack |
|-----------------|------------|
| Web app, one HTTPS port | Admin is `:4000` and API is `:3004`. Two HTTP ports. |
| Official container image | Three GHCR images plus `pgvector/pgvector:pg16`. `:latest` pulls. Version tags do not. |
| License allows self-host | MIT OSS packages and FSL Pro packages both allow running the software |
| Author paid hosting | Studio does not sell a customer VM |
| Abuse / heavy CPU by design | No transcoding, proxy, or VPN workload in the default boot |
| Actively maintained | Public GitHub repo |

PikaPods deploys one image per app. This repo has no single-container pod.
The request states that mismatch and asks them whether they will package the
four-service stack.

### Elest.io

Sources, checked 2026-09-23:

- Catalog criteria: https://docs.elest.io/books/supported-softwares
- Compose template shape: https://docs.elest.io/books/cicd-pipelines/page/create-your-own-template-elestioyml
- Partnership email on https://elest.io/contact : `info@elest.io`

Their catalog entries are managed docker-compose lifecycles (setup, backup,
restore, upgrade). There is no `elestio.yml` in this repo. Root
`docker-compose.yml` builds from Dockerfiles and reads a `.env` file. The
request asks for a catalog entry and describes the four GHCR/pgvector
services. It does not claim a template is already published.

## Resource floor

Paste measured values only. Empty cells mean Joshua has not pasted a run.
Leave them empty in the outbound email until then.

| Service | CPU | Memory | Disk | Measured on (date, image tag, digest) |
|---------|-----|--------|------|----------------------------------------|
| api | | | | |
| admin | | | | |
| migrate | | | | |
| postgres | | | | |
| stack total | | | | |

## Submission evidence

| Vendor | Sent at | Channel | Message id or URL | Reply | Catalog URL |
|--------|---------|---------|-------------------|-------|-------------|
| PikaPods | | | | | |
| Elest.io | | | | | |

## Draft — PikaPods

Channel: email to `hello@pikapods.com`. Joshua sends it.

```
Subject: RevealUI — author request to list the self-hosted runtime

Hello,

I maintain RevealUI, a self-hosted business runtime (people, content,
offers, payments, and agents).

Repo: https://github.com/RevealUIStudio/revealui
Site: https://revealui.com
Docs: https://docs.revealui.com

I would like PikaPods to consider listing it. A few facts that match
your adding-apps criteria, and two that do not yet:

- Self-hosting is allowed. The OSS packages are MIT. Pro packages in
  the images are FSL-1.1-MIT.
- RevealUI Studio does not operate customer VMs. Customers run the
  software themselves.
- Official images (anonymous pull of :latest checked 2026-09-23):
  ghcr.io/revealuistudio/revealui-api:latest
  ghcr.io/revealuistudio/revealui-admin:latest
  ghcr.io/revealuistudio/revealui-migrate:latest
  Database image: pgvector/pgvector:pg16
  Per-image version tags are not published yet. I will send those
  tags after the main-branch image workflow is dispatched.
- The stack is four services, not one HTTPS port: postgres, a one-shot
  migrate container, api on port 3004 (GET /health), and admin on
  port 4000 (GET /api/health). I do not have a single-container image.
  Please tell me if you can package that stack, or if you need one
  image and one HTTPS port first.
- Free boot: REVEALUI_DEPLOYMENT_MODE=forge and
  REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true on both api and admin.
  Required secrets are generated per pod (REVEALUI_SECRET,
  REVEALUI_KEK, REVEALUI_AUDIT_SIGNING_KEY). The admin browser needs
  NEXT_PUBLIC_API_URL pointed at that pod's api origin.

Measured CPU, memory, and disk: not in this email. I will follow up
with figures from a timed run.

Support for the app itself: support@revealui.com and
https://github.com/RevealUIStudio/revealui/discussions

Joshua
RevealUI Studio
```

## Draft — Elest.io

Channel: email to `info@elest.io`. Joshua sends it.

```
Subject: RevealUI — request to add the self-hosted runtime to the catalog

Hello,

I maintain RevealUI, a self-hosted business runtime (people, content,
offers, payments, and agents). I am asking for a fully managed catalog
entry, not a one-off CI/CD deploy of the monorepo.

Repo: https://github.com/RevealUIStudio/revealui
Site: https://revealui.com
Docs: https://docs.revealui.com

Proposed stack (no elestio.yml is in the repo yet):

- postgres: pgvector/pgvector:pg16 (plain Postgres cannot load the
  vector extension our first migration creates)
- migrate: ghcr.io/revealuistudio/revealui-migrate:latest
  (one-shot, restart policy no, must finish before api and admin)
- api: ghcr.io/revealuistudio/revealui-api:latest
  port 3004, GET /health
- admin: ghcr.io/revealuistudio/revealui-admin:latest
  port 4000, GET /api/health
  public web UI

Anonymous pull of those three :latest tags returned HTTP 200 on
2026-09-23. Per-image version tags are not published yet. I will send
them after the main-branch image workflow is dispatched.

Free boot: REVEALUI_DEPLOYMENT_MODE=forge and
REVEALUI_ALLOW_UNLICENSED_SELF_HOST=true on both api and admin.
Per-instance secrets: REVEALUI_SECRET (32+ characters), REVEALUI_KEK,
REVEALUI_AUDIT_SIGNING_KEY (Ed25519 PKCS#8 PEM). The admin browser
calls NEXT_PUBLIC_API_URL. Our admin image Dockerfile does not take
NEXT_PUBLIC_* build-args, so a catalog template needs a way to set
that origin for the pod.

License: MIT for the OSS packages. Pro packages in the images are
FSL-1.1-MIT. Self-hosting is allowed. RevealUI Studio does not
operate customer VMs.

Measured CPU, memory, and disk: not in this email. I will follow up
with figures from a timed run.

Support: support@revealui.com and
https://github.com/RevealUIStudio/revealui/discussions

Joshua
RevealUI Studio
```

## Checklist

- [x] Draft both requests in this file
- [x] Record GHCR `:latest` HTTP 200 and version-tag HTTP 404 (2026-09-23)
- [x] Record the one-port and `NEXT_PUBLIC_*` build-arg gaps in both drafts
- [ ] Versioned image workflow dispatched from `main` after the per-image tag step is on `main`
- [ ] Resource floor filled from a pasted measurement
- [ ] PikaPods request sent by Joshua
- [ ] Elest.io request sent by Joshua
- [ ] Submission evidence filled
- [ ] `/templates` updated only after a real catalog URL exists

## Do not

- Send either request from an agent account or sign it as the founder from automation.
- Fill the resource floor from guesses, Docker defaults, or another host's plan sizes.
- Add PikaPods or Elest.io to marketing copy, `/templates`, or a public docs page before a catalog URL is real.
- Publish a root `elestio.yml` that builds the monorepo Dockerfiles and presents it as the catalog template.
- Treat either catalog as Studio production (Studio production stays Vercel + Fly + Neon).
