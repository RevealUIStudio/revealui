---
title: "GAP-233 + GAP-133 — Cloudflare zone and record sheet"
description: "DNS-only zone and record sheet for revealui.com, including media.revealui.com as the replacement for the sticky R2 public development URL. Does not change nameservers or proxy status."
visibility: internal
status: draft
audience: maintainer
---

# GAP-233 + GAP-133 — Cloudflare zone and record sheet

**Who:** Owner applies the zone, the registrar nameservers, and the `media.revealui.com` cutover. This file is the sheet. It is not an applied change.
**Scope:** GAP-233 (zone + records, including `media.revealui.com`) and GAP-133 (application hostnames on that zone). Proxy stays off on every row this sheet authorizes.
**Out of scope:** Registrar nameserver changes. Orange-cloud (Proxied) on any name. `trustedProxyCount` changes. Live Cloudflare API writes.

Snapshot below is a public DNS read on 2026-09-23. It is evidence for the owner. It is not a license to edit the live zone.

## Hard stops

- Do not change nameservers at the registrar.
- Do not set any record on this sheet to Proxied (orange cloud).
- Do not point `media` at `*.r2.dev`. Cloudflare documents that CNAME as an unsupported access path.
- Do not disable the sticky `r2.dev` public development URL from this sheet.
- Do not change `configureClientIp({ trustedProxyCount: 1 })` in `apps/server/src/index.ts` or `apps/admin/src/instrumentation-node.ts`. Orange-cloud in front of `api.revealui.com` is GAP-133 phases 5-6 and has to land in the same change as `trustedProxyCount: 2`. This sheet does not start that cutover.

## Zone

| Field | Value |
| --- | --- |
| Zone name | `revealui.com` |
| Account | The Cloudflare account that owns the R2 bucket (custom domains must be on that same account) |
| Plan action from this sheet | None. Do not create, delete, or re-delegate the zone from this document. |

Observed public delegation (2026-09-23):

| Type | Name | Content |
| --- | --- | --- |
| NS | `revealui.com` | `eugene.ns.cloudflare.com` |
| NS | `revealui.com` | `isla.ns.cloudflare.com` |

Adding the zone in the Cloudflare dashboard, and any registrar nameserver edit, stays with the owner. If the registrar already publishes the pair above, leave it. Do not replace it with a new pair, and do not move the zone to Vercel nameservers (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`).

## Proxy column

Every record this sheet authorizes is **DNS only** (grey cloud). TTL: Auto.

Cloudflare's R2 **Connect Domain** action writes a read-only Proxied record for the custom domain. That click is the owner cutover for `media.revealui.com`. It is not part of applying this sheet, and this document does not authorize it.

## Application hostnames (DNS only)

Source of names: `.claude/skills/revealui-deploy/SKILL.md` app matrix, plus `www` as the marketing alias.

Before writing a value, open the matching Vercel project → Settings → Domains and copy **that** domain card. Vercel's general-purpose apex A is often `76.76.21.21`, and a subdomain CNAME is a project-specific name such as `cname.vercel-dns-0.com` or `<hash>.vercel-dns-017.com`. The card wins. Do not reuse one project's CNAME on another project.

| App | Name | Type | Content | Proxy |
| --- | --- | --- | --- | --- |
| marketing | `@` | A | Domain card for `revealui.com` on the marketing project | DNS only |
| marketing | `www` | CNAME | Domain card for `www.revealui.com` on the marketing project | DNS only |
| api | `api` | CNAME | Domain card for `api.revealui.com` on the api project | DNS only |
| admin | `admin` | CNAME | Domain card for `admin.revealui.com` on the admin project | DNS only |
| docs | `docs` | CNAME | Domain card for `docs.revealui.com` on the docs project | DNS only |
| marketing (test) | `test` | CNAME | Domain card for `test.revealui.com` on the marketing project | DNS only |
| api (test) | `test.api` | CNAME | Domain card for `test.api.revealui.com` on the api project | DNS only |
| admin (test) | `test.admin` | CNAME | Domain card for `test.admin.revealui.com` on the admin project | DNS only |
| docs (test) | `test.docs` | CNAME | Domain card for `test.docs.revealui.com` on the docs project | DNS only |

Project ids live in `.github/vercel-projects.json` (`api`, `admin`, `marketing`, `docs`). This sheet does not change them.

## `media.revealui.com` (replaces the sticky `r2.dev` URL)

The sticky URL is the bucket's **Public Development URL**: `https://pub-<id>.r2.dev`. The id is assigned when that toggle is enabled and stays until the owner disables it. Keep the id in the R2 dashboard and in revvault. Do not copy it into git.

Replacement public base, after the owner cutover: `https://media.revealui.com`.

| Field | Sheet value |
| --- | --- |
| Name | `media` |
| Type | `CNAME` |
| Content | Do not set from this sheet. Do not CNAME `media` to `pub-<id>.r2.dev` or any other `r2.dev` name. |
| Proxy | DNS only. Do not orange-cloud. |
| Bucket | The live `R2_BUCKET` (docs examples use `revealui-media`; confirm in the R2 dashboard and in revvault `revealui/prod/r2`) |
| Public base after owner cutover | `https://media.revealui.com` |
| Env after owner cutover | `R2_PUBLIC_BASE_URL=https://media.revealui.com` on revvault `revealui/prod/r2`, then the Vercel sync in [`vercel-env-sync.md`](./vercel-env-sync.md) for admin and api |

Runtime already treats that base as the custom-domain form (`packages/core/src/storage/r2.ts`, `packages/core/src/storage/types.ts`). New object URLs are `{R2_PUBLIC_BASE_URL}/{key}`. Rows already stored with the `r2.dev` host keep that host until they are rewritten. Disabling the public development URL before those rows move makes existing media 404. That disable is owner cutover, not this sheet.

Owner cutover order, when the owner chooses to do it (not now):

1. Confirm the zone for `revealui.com` is on the same Cloudflare account as the bucket.
2. R2 → bucket → Settings → Public access → Custom Domains → Connect Domain → `media.revealui.com`. Review the record Cloudflare will add. That product path publishes a read-only Proxied record. This sheet does not perform that click.
3. Fetch an existing object key on `https://media.revealui.com/<key>` and confirm the bytes match the object.
4. Set `R2_PUBLIC_BASE_URL=https://media.revealui.com` and redeploy admin + api.
5. Only after stored media URLs no longer need `r2.dev`, disable Public Development URL on the bucket.

## Mail and verification (preserve, DNS only)

Do not delete or rewrite these while editing application records. Do not paste a replacement DKIM key from this file. The live `google._domainkey` TXT stays as published.

| Type | Name | Content (observed 2026-09-23) | Proxy |
| --- | --- | --- | --- |
| MX | `@` | `1 smtp.google.com` | DNS only (required) |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | n/a |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | n/a |
| TXT | `google._domainkey` | Existing DKIM key. Preserve the published value. | n/a |

CAA was present on the apex (issue / issuewild for `ssl.com`, `comodoca.com`, `digicert.com`, `letsencrypt.org`, `pki.goog`, and issue for `sectigo.com`, some with `cansignhttpexchanges=yes`). Preserve the published CAA set. Do not replace it from this sheet.

## Names that already answer, and are not retargeted here

A public lookup on 2026-09-23 returned Cloudflare anycast addresses `104.21.51.74` and `172.67.177.63` (and the matching `2606:4700:3036::` AAAA pair) for the application names above, for `media`, `app`, `status`, `mail`, and `chat.revbot`, and for an unmatched label (`this-should-not-exist-gap233.revealui.com`). An unmatched label answering is a proxied wildcard or an equivalent catch-all. HTTPS on `https://media.revealui.com` and `https://api.revealui.com/health` returned a Cloudflare challenge page (`cf-mitigated: challenge`), so this read could not see an origin.

This sheet does not add, remove, or orange-cloud a wildcard. It does not retarget `app`, `status`, `mail`, or `chat.revbot`. The owner confirms those names in the dashboard before any later edit.

## Owner checklist

- [ ] Zone `revealui.com` exists on the Cloudflare account that owns the R2 bucket.
- [ ] Registrar nameservers are unchanged (observed pair: `eugene.ns.cloudflare.com`, `isla.ns.cloudflare.com`).
- [ ] Every row in the application table is DNS only, with the target copied from that Vercel project's domain card.
- [ ] MX, SPF, DKIM, DMARC, and CAA still match the preserve table.
- [ ] `media` is not a CNAME to `r2.dev`, and its proxy is still off, until the owner runs the cutover above.
- [ ] `R2_PUBLIC_BASE_URL` still points at the sticky `r2.dev` URL until that cutover. This sheet does not flip the env var.
- [ ] `trustedProxyCount` is still `1` on the API and admin boot paths.

## What this pull request does not do

- It does not call the Cloudflare API.
- It does not change registrar nameservers.
- It does not create or edit live DNS records.
- It does not orange-cloud any hostname.
- It does not connect `media.revealui.com` to the bucket.
- It does not change `R2_PUBLIC_BASE_URL`.
- It does not bump `trustedProxyCount`.
