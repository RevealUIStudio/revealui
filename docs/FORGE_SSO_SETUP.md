---
visibility: public
status: verified
title: "Enterprise SSO setup (OIDC + SAML)"
description: "Operator guide for Enterprise-tier OIDC and SAML SP-initiated federation"
category: guide
audience: operator
gap: GAP-464
public-tracker: RevealUIStudio/revealui#449
---

# Enterprise SSO setup

**Status:** operator preview on `test`. Not customer-walked.
[#449](https://github.com/RevealUIStudio/revealui/issues/449) is still open.
SCIM is not built.

Enterprise accounts with the `sso` feature gate can attach an OIDC or SAML
identity provider (Okta, Azure AD / Entra ID, Google Workspace, Keycloak, and
compatible IdPs). Session cookies stay RevealUI sessions; federation only
establishes who the user is.

**Code map (code-over-docs):**

| Surface | Path |
|---------|------|
| Schema | `packages/db/src/schema/sso.ts` (`account_sso_providers`, `sso_identities`) |
| OIDC pure | `packages/auth/src/server/sso/oidc.ts` |
| SAML pure | `packages/auth/src/server/sso/saml.ts` |
| Login routes | `apps/server/src/routes/auth-sso.ts` (`/api/auth/sso/...`) |
| Admin API | `apps/server/src/routes/sso-providers.ts` |
| Admin UI | Admin → Settings → Enterprise SSO (`apps/admin/.../settings/sso`) |

Feature gate: paywall `sso` at Enterprise (`packages/paywall` / contracts
`FEATURE_LABELS.sso`). Server routes call `accountHasSsoFeature` and fail closed.

## Prerequisites

1. Account on the **Enterprise** tier (or an entitlement that includes `sso`).
2. Owner or admin membership on that account (mutations require owner/admin).
3. Shared `REVEALUI_SECRET` for SSO state cookies (same secret as other HMAC duties).
4. For OIDC: client ID + **secret reference** (env var name or revvault path), never a pasted secret value in Admin.
5. For SAML: IdP metadata URL and/or metadata XML; optional SP entity ID override.

## Admin configuration

1. Sign in to Admin as account owner/admin.
2. Open **Settings → Enterprise SSO**.
3. **Add provider** and choose **OIDC** or **SAML**.
4. Fill fields (see below), run **Test connection**, then enable only after a green test (or explicit confirm).

### OIDC fields

| Field | Purpose |
|-------|---------|
| Display name | Admin label |
| Issuer | OIDC issuer URL |
| Discovery URL | Optional; defaults to `{issuer}/.well-known/openid-configuration` |
| Client ID | IdP application client id |
| Client secret reference | Env var or revvault path only |
| Group claim | Default `groups` |
| Default role | `viewer` / `member` / `editor` / `admin` when no group maps |
| Require group match | Reject login when no group maps |

### SAML fields

| Field | Purpose |
|-------|---------|
| Display name | Admin label |
| IdP entity ID (issuer) | Must match IdP metadata `entityID` when possible |
| IdP metadata URL | Fetched for test-connection and entryPoint/cert |
| IdP metadata XML | Optional if URL set; public IdP metadata |
| SP entity ID | Optional override (else ACS callback URL / `REVEALUI_SSO_SP_ENTITY_ID`) |
| Group claim | Attribute used for role mapping |

Protocol cannot change after create; remove and re-add to switch OIDC ↔ SAML.

## Login URLs (runtime)

Mounted under `/api/auth` (and `/api/v1/auth`):

| Method | Path | Role |
|--------|------|------|
| GET | `/api/auth/sso/:providerId/init?accountId=&redirectTo=` | Start SP-initiated login |
| GET | `/api/auth/sso/:providerId/callback` | OIDC authorization-code return |
| POST | `/api/auth/sso/:providerId/callback` | SAML ACS (HTTP-POST) |
| GET | `/api/auth/sso/saml/metadata?accountId=&providerId=` | SP metadata XML for the IdP |

`redirectTo` must be a relative path starting with `/` (open-redirect hardline).

Example init link (user-facing):

```text
/api/auth/sso/<providerId>/init?accountId=<accountId>&redirectTo=/admin
```

## IdP checklist

### OIDC

1. Create a confidential client; redirect URI = your API origin +
   `/api/auth/sso/<providerId>/callback`.
2. Enable authorization code (+ PKCE when the IdP supports it).
3. Issue scopes that include `openid` and email/profile as needed.
4. Put the client secret in env/revvault; store only the **reference** in Admin.

### SAML (SP-initiated)

1. Register RevealUI as a service provider.
2. ACS URL = API origin + `/api/auth/sso/<providerId>/callback` (POST).
3. Entity ID = SP entity ID from Admin or the SP metadata document.
4. Download SP metadata from
   `/api/auth/sso/saml/metadata?accountId=…&providerId=…` when the provider is enabled.
5. Map NameID / email attributes consistently with JIT user creation.

## Security hardlines

- Provider rows load with **accountId + id** (no cross-tenant provider id alone).
- Entitlement checked on init and callback.
- OIDC: JWKS signature validation of `id_token` (issuer, audience, exp).
- SAML: signed assertion validation via `@node-saml/node-saml` (no skip path).
- Signed `sso_state` cookie (HMAC via `REVEALUI_SECRET`).
- Client secrets never logged; Admin never accepts raw secret paste as the stored value.
- Group maps cannot assign `owner`.

## Residual / non-goals

Still out of scope for this guide (see public tracker [#449](https://github.com/RevealUIStudio/revealui/issues/449)):

- SCIM provisioning
- IdP-initiated SAML deep linking as the primary MVP path
- Social OAuth (GitHub / Google / Vercel) replacement
- Automatic IdP certificate rotation

## Related

- [Authentication](./AUTH.md)
- Design: private gap GAP-464 / `.jv` spec `2026-08-02-enterprise-sso.md`
- Public tracker: [revealui#449](https://github.com/RevealUIStudio/revealui/issues/449)
