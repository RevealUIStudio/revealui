# Secrets Architecture

## One-sentence summary

**All secrets in the RevealUI Suite live in revvault, encrypted by an
age identity that doesn't leave the developer's machine.**

If that sentence ever becomes false — even for one secret — we have a
trust story that doesn't hold up under scrutiny. This doc is the
architectural contract that keeps it true.

## The rule

Every secret the suite depends on is stored in revvault. No secret
lives in a `.env`, a `.env.local`, a CI environment variable as its
primary store, a password manager as its primary store, or committed
config. Revvault is canonical; everything downstream is a mirror.

Full cross-suite rule: see `~/.claude/rules/secrets.md`.

## What counts as a secret

| Category | Examples |
|---|---|
| Database credentials | `POSTGRES_URL` (Neon), Supabase direct-connection URL, `DATABASE_URL` |
| Auth | `REVEALUI_SECRET` (JWT / session), OAuth client secrets, session-cookie signing keys |
| Third-party API keys | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY` |
| Sync infrastructure | `ELECTRIC_SERVICE_URL`, `ELECTRIC_SECRET`, `ELECTRIC_SOURCE_ID` |
| Deployment | Vercel token, Railway token, Cloudflare token |
| Blockchain | RevealCoin Solana keypairs (mint authority, allocations, vesting custody) |
| Licenses | `REVEALUI_LICENSE_KEY`, RVUI-format keys |
| SSH / signing | Age identity, SSH keys, PGP/GPG keys, code-signing certs |

If in doubt — it's a secret. Put it in revvault.

## Canonical path conventions

Paths are lower-kebab, grouped by project, then by subsystem.

### Revealui

Local development (for running `pnpm dev:admin`, probes, scripts):

```
revealui/dev/admin-base-url
revealui/dev/admin-session-cookie
revealui/dev/electric/service-url
revealui/dev/electric/secret
revealui/dev/neon/postgres-url
revealui/dev/supabase/direct-url
revealui/dev/supabase/service-role-key   # service_role key for admin ops
revealui/dev/stripe/secret-key           # sk_test_*
revealui/dev/stripe/webhook-secret
revealui/dev/stripe/publishable-key      # pk_test_*
revealui/dev/revealui-secret             # JWT/session, ≥32 chars
revealui/dev/revealui-admin-api-key      # API admin auth
revealui/dev/blob/read-write-token       # Vercel Blob file uploads
revealui/dev/google/client-id            # OAuth SSO
revealui/dev/google/client-secret
revealui/dev/google/service-account-email # Gmail API email provider (service account)
revealui/dev/google/service-account-from # From address (Workspace user w/ domain-wide delegation)
revealui/dev/google/private-key          # Gmail API service-account PKCS8 PEM
revealui/dev/github/client-id            # OAuth SSO
revealui/dev/github/client-secret
revealui/dev/admin/bootstrap/email       # CLI admin bootstrap
revealui/dev/admin/bootstrap/password    # CLI admin bootstrap (≥12 chars)
revealui/dev/admin/bootstrap/name        # optional, defaults to "Super Admin"
revealui/dev/admin/bootstrap/force-rotate # optional, default true
revealui/dev/x402/receiving-address      # Sepolia EVM USDC receiving wallet (testnet) — X402_RECEIVING_ADDRESS
revealui/dev/rvui/receiving-wallet       # Solana devnet RVC receiving wallet — RVUI_RECEIVING_WALLET
```

Production (what CI + Vercel pull from when deploying):

```
revealui/prod/electric/service-url
revealui/prod/electric/secret
revealui/prod/railway/token
revealui/prod/neon/postgres-url
revealui/prod/supabase/direct-url
revealui/prod/supabase/service-role-key
revealui/prod/stripe/secret-key          # sk_live_*
revealui/prod/stripe/webhook-secret
revealui/prod/stripe/publishable-key     # pk_live_*
revealui/prod/vercel/api-token
revealui/prod/revealui-secret
revealui/prod/revealui-cron-secret
revealui/prod/revealui-admin-api-key
revealui/prod/blob/read-write-token
revealui/prod/google/client-id           # OAuth SSO
revealui/prod/google/client-secret
revealui/prod/google/service-account-email # Gmail API email provider (service account)
revealui/prod/google/service-account-from # From address (Workspace user w/ domain-wide delegation)
revealui/prod/google/private-key         # Gmail API service-account PKCS8 PEM
revealui/prod/github/client-id
revealui/prod/github/client-secret
revealui/prod/sentry/auth-token          # CI/CD error tracking
revealui/prod/x402/receiving-address     # Base mainnet EVM USDC receiving wallet — X402_RECEIVING_ADDRESS
revealui/prod/rvui/receiving-wallet      # Solana mainnet RVC receiving wallet (post-launch) — RVUI_RECEIVING_WALLET
```

### Revealcoin

```
revealcoin/community-governance.json
revealcoin/ecosystem-rewards.json
revealcoin/liquidity-provision.json
revealcoin/mint-authority.json
revealcoin/mint.json
revealcoin/protocol-treasury.json
revealcoin/public-distribution.json
revealcoin/strategic-partners.json
revealcoin/team-founders.json
revealcoin/vesting/*.json
revealcoin/devnet-addresses              # operational, not a keypair
```

### RevDev

```
revdev/license-signing-key               # when Ed25519 format lands (see license.ts TODO)
revdev/github-token                      # perpetual license GitHub provisioning
```

### Licensing (RevealUI)

```
revealui/license/private-key             # RS256 license signing key
revealui/license/public-key              # RS256 license verification key
```

### LLM / AI providers

```
credentials/openai/api-key              # AI features + test setup
credentials/groq/api-key                # Groq inference
credentials/huggingface/token           # HF model access
credentials/tavily/api-key              # Tavily search
credentials/exa/api-key                 # Exa search
```

### Solana / RevealCoin infrastructure

```
revealcoin/jupiter/api-key              # Jupiter aggregator
revealcoin/solana-rpc-url               # RPC endpoint
```

### CI / publishing

```
credentials/npm/token                   # npm package publishing
credentials/sentry/auth-token           # error tracking (CI + runtime)
```

### Shared / cross-project credentials

```
credentials/github/personal-access-token
credentials/github/actions-secrets-mirror
credentials/anthropic/api-key
credentials/ssh/github                   # if distinct from system SSH
```

## Reading secrets — consumer patterns

### From a Node / TypeScript script

```ts
import { spawnSync } from 'node:child_process';

function revvault(path: string): string {
  const bin = process.env.REVVAULT ?? `${process.env.HOME}/suite/revvault/target/release/revvault`;
  const r = spawnSync(bin, ['get', '--full', path], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`revvault path '${path}' missing; set with: echo <val> | revvault set ${path}`);
  }
  return r.stdout.trimEnd();
}

const electricUrl = revvault('revealui/dev/electric/service-url');
```

### From a shell script

```bash
#!/usr/bin/env bash
set -euo pipefail
ELECTRIC_URL=$(revvault get --full revealui/dev/electric/service-url)
```

### From the Next.js admin app (runtime)

The admin app reads from `process.env` at runtime (Next.js contract).
Env vars are populated from revvault at deploy time via a mirror step,
not hand-typed in the Vercel UI:

```bash
# One-off mirror (or automate as a deploy step):
revvault export-env --prefix revealui/prod | vercel env import --environment production
```

## Writing a new secret

1. Generate or receive the secret value.
2. Pick the canonical path (add it to this doc under the right section
   if it's new).
3. Store:
   ```bash
   echo "<value>" | revvault set <path>
   ```
   Or interactively: `revvault set <path>` and paste.
4. Update the consuming code to pull from revvault via the pattern
   above.
5. If it needs to mirror into CI or a deploy platform, document the
   mirror step here.

## Rotating a secret

1. Generate the new value.
2. `revvault set --force <path>` — overwrite.
3. Redeploy long-lived consumers (Vercel, Railway). They pick up the
   new env on next invocation.
4. Log the rotation in `docs/SECURITY.md` or the relevant security log.
5. If the old value was leaked: `revvault delete <path>` after
   rotation, audit logs for usage, follow incident-response in
   `docs/SECURITY.md`.

## What this rules out

- `.env` and `.env.local` as sources of truth. They're acceptable as
  **local-dev convenience files that are populated from revvault at
  session start** (via `revvault export-env` or a wrapper), but the
  revvault entries are authoritative.
- Pasting secrets into chat, AI tools, issues, docs, or anywhere
  except revvault itself.
- Committing any credential-shaped string. Tests may use obvious
  placeholder patterns (see `revdev/.gitleaks.toml` for the per-repo
  allowlist).
- Using a password manager as the primary store for system secrets.
  Password managers are for human-memorable entries (the revvault
  unlock passphrase) and emergency break-glass only.

## Age identity — the key that gates everything else

The revvault store is unlocked by a single X25519 age identity at
`$HOME/.age-identity/keys.txt` (or `REVVAULT_IDENTITY`). Losing that
file means losing every secret in the suite.

Backup policy for the age identity is documented in
[`SECURITY.md`](./SECURITY.md#age-identity-backup). Summary:

1. Passphrase-encrypted `.age` blob on an offline USB drive.
2. Passphrase stored in a password manager under a memorable label.
3. Paper copy of the raw identity in a geographically separate
   location (printer / handwritten, stored in a safe or trusted
   offsite).

Each copy gets an annual "can we still restore?" audit. Losing two
out of three isn't recoverable.

## Known deviations / escape hatches

None currently. Any exception to this architecture must land here with
a rationale, a review date, and a named owner.
