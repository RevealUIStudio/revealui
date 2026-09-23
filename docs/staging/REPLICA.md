---
title: "GAP-343 staging replica"
description: "Hosts, cookie domain, existing staging Neon, and owner-only Stripe, Sentry, R2, and vault steps. No cloud resources are created by this document."
visibility: internal
status: verified
audience: maintainer
last_verified: 2026-09-23
---

# GAP-343 staging replica

The hosted test-mode replica stays up after the nine existing test-card paths. Production stays on Stripe live mode and its current hosts. This page names what the owner creates. It does not create DNS, Sentry, R2, Neon, Stripe webhooks, or vault entries, and it does not call those APIs.

## Hosts

| Host | App |
| --- | --- |
| `staging.revealui.com` | marketing |
| `api.staging.revealui.com` | API (`apps/server`) |
| `admin.staging.revealui.com` | admin |

## Session cookie

Request host `staging.revealui.com` or `*.staging.revealui.com` resolves to cookie domain `staging.revealui.com` (no leading dot). That includes `api.staging.revealui.com` and `admin.staging.revealui.com`.

Any other host keeps `SESSION_COOKIE_DOMAIN` exactly as before, including an omitted host and an unset or empty value (host-only cookie). Production hosts such as `revealui.com`, `admin.revealui.com`, and `api.revealui.com` are not staging hosts. Lookalikes (`evilstaging.revealui.com`, `staging.revealui.com.evil.com`) are not either.

The pure resolver is `sessionCookieDomainForHost` in `packages/core/src/session-cookie-domain.ts`. Admin `sessionCookieDomain` / `requireSessionCookieDomain` (`apps/admin/src/lib/utils/session-cookies.ts`) and API SSO `resolveSsoSessionCookieDomain` (`apps/server/src/routes/auth-sso.ts`) call it. Those callers still skip the domain outside `NODE_ENV=production`, which is the previous host-only behavior. Staging boots with `NODE_ENV=production`, so the host rule applies there. A configured production domain such as `.revealui.com` is not attached to the staging subtree.

`Host` wins over `X-Forwarded-Host` (`requestHostFromHeaders`).

## Database

Use the existing staging Neon database only. Keep the rows. Apply missing migrations forward. Do not wipe it. Do not create a second database.

The connection string belongs in vault path `revealui/staging/db/postgres-url` and is synced as `POSTGRES_URL` and `DATABASE_URL`. It is not written into this repo.

## Stripe

The webhook handler already lives on the API. It is not an admin route.

- Implementation: `apps/server/src/routes/webhooks/stripe-route.ts` (barrel `apps/server/src/routes/webhooks.ts`)
- Mount: `app.route('/api/webhooks', webhooksRoute)` in `apps/server/src/index.ts`, route path `/stripe`
- Public URL: `POST https://api.staging.revealui.com/api/webhooks/stripe`
- The same handler is also mounted at `POST /api/v1/webhooks/stripe`. Staging uses the unversioned path above.

Signature verification is the existing `stripe.webhooks.constructEventAsync` call. `getWebhookSecret` in `apps/server/src/routes/webhooks/helpers.ts` uses `STRIPE_WEBHOOK_SECRET_LIVE` when set, otherwise `STRIPE_WEBHOOK_SECRET`, with optional `STRIPE_WEBHOOK_SECRET_LIVE_PREVIOUS` during rotation. Staging leaves `STRIPE_LIVE_MODE` and `STRIPE_WEBHOOK_SECRET_LIVE` unset, so the test secret `STRIPE_WEBHOOK_SECRET` (vault `revealui/staging/stripe/webhook-secret`) is the verifier. No second signature scheme and no extra mount.

Owner, test mode only, against that staging database:

- Create the webhook endpoint at `https://api.staging.revealui.com/api/webhooks/stripe`.
- Create the test billing portal. Its id is `REVEALUI_BILLING_PORTAL_CONFIG_ID` from vault `revealui/staging/stripe/billing-portal-config-id`.
- Seed the catalog (`scripts/setup/seed-stripe.ts`, `pnpm stripe:seed`) with the staging test secret so `billing_catalog` rows are test-mode on that database only.

Do not sync the production vault or production Vercel env. This change does not run the seed and does not call Stripe.

## Sentry

Own staging project. Do not share the production DSN. Names only; do not create the project here.

| Env | Vault path | App |
| --- | --- | --- |
| `SENTRY_DSN` | `revealui/staging/sentry/dsn` | API |
| `NEXT_PUBLIC_SENTRY_DSN` | `revealui/staging/sentry/dsn-admin` | admin |
| `SENTRY_AUTH_TOKEN` | `revealui/staging/sentry/auth-token` | admin |
| `SENTRY_ORG` | `revealui/staging/sentry/org` | admin |
| `SENTRY_PROJECT` | `revealui/staging/sentry/project-admin` | admin |

## R2

Own bucket and a token scoped to that bucket. Do not reuse production write credentials. Names only; do not create the bucket here.

| Env | Vault path |
| --- | --- |
| `R2_ACCOUNT_ID` | `revealui/staging/r2/account-id` |
| `R2_ACCESS_KEY_ID` | `revealui/staging/r2/access-key-id` |
| `R2_SECRET_ACCESS_KEY` | `revealui/staging/r2/secret-access-key` |
| `R2_BUCKET` | `revealui/staging/r2/bucket` |
| `R2_PUBLIC_BASE_URL` | `revealui/staging/r2/public-base-url` |

## Mail and boot alerts

The mail sender is the production sender. Staging reuses `EMAIL_FROM` from `revealui/prod/email/from` (and `EMAIL_REPLY_TO` from `revealui/prod/email/reply-to`) so verification, receipt, and license mail can be delivered. The sender address is not written into this repo.

The boot-alert inbox lives in the staging vault at `revealui/staging/alert-email` and is synced as `REVEALUI_ALERT_EMAIL`. The address is not written into this repo. The owner writes the vault value.

## Nine test-card paths

These existing paths stay, and the replica stays up. They are the Gate 5 conversion walk, including decline and 3DS test cards. Production live mode is not flipped to walk them.

1. Marketing landing (cold visit)
2. Pricing to product selection
3. Sign-up, fresh account, verify email
4. Checkout in Stripe test mode
5. First session in the product
6. Confirmation email and license activation
7. Account and billing portal
8. Support and refund
9. Failure modes (declined card, 3DS challenge)

## Owner

The owner creates DNS for the three hosts, the staging Sentry project, the staging R2 bucket and scoped token, the Stripe test webhook, the test billing portal, the catalog seed on the existing staging database, and the vault entries named above (including the boot-alert inbox). Agents do not perform those cloud or vault writes.
