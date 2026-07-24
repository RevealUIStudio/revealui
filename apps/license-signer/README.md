# `@revealui/license-signer`

Isolated license JWT mint service (GAP-260 **P4-2**).

Holds the Ed25519 **signing private key** and exposes a single HMAC-authed mint
endpoint. Callers (api webhooks after P4-3, operator tooling) never load the
private key; they call this process with a dedicated invoke secret.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health/live` | none | liveness |
| `POST` | `/internal/mint` | HMAC | mint license JWT via `generateLicenseKey` |

## HMAC (per-call)

Headers:

- `X-RevealUI-Signer-Timestamp` — unix seconds
- `X-RevealUI-Signer-Signature` — `hex(hmac-sha256(secret, \`${ts}.${METHOD}.${path}.${body}\`))`

Skew window: 300s. **No fallback** to `REVEALUI_SECRET`.

## Env

| Variable | Required | Notes |
| --- | --- | --- |
| `REVEALUI_LICENSE_PRIVATE_KEY` | yes | PKCS#8 Ed25519 PEM |
| `REVEALUI_LICENSE_PUBLIC_KEY` | no | when set, JWT header gets `kid` |
| `REVEALUI_SIGNER_INVOKE_SECRET` | yes | vault: `revealui/prod/license/signer-invoke-secret` |
| `PORT` | no | default `8791` |

## Local run

```bash
# From monorepo root (signing bundle is private):
REVVAULT_ALLOW_PRIVATE=1 with-secrets license-signing -- \
  env REVEALUI_SIGNER_INVOKE_SECRET="$(revvault get --full revealui/prod/license/signer-invoke-secret)" \
  pnpm --filter @revealui/license-signer dev
```

Mint cutover (api → this service) is **P4-3** (`REVEALUI_LICENSE_SIGN_VIA_SIGNER`).
