# Secrets and Key Management — One Vault Is the Source of Truth

## The rule

Every secret a project depends on lives in one vault. Full stop.

- **Every secret** — API keys, database URLs, webhook secrets, JWT or
  session secrets, signing keys, license keys, hosting tokens, OAuth client
  secrets, SSH keys, anything else.
- **Lives in the vault** — not in `.env` files, not in `.env.local`, not in
  committed config, not in CI secrets UIs as the primary store (CI secrets
  are a downstream mirror, never the source).

## Why this is a hard rule, not a preference

- One encryption boundary gates every secret in the project. No per-system
  credential sprawl.
- Secrets never land on disk in plaintext outside a controlled, ephemeral
  restore path.
- Rotating a secret updates one store, and every downstream system
  (including CI) re-reads from that same source.
- The trust story for customers and reviewers is one sentence: "secrets live
  in a vault, encrypted by a key that doesn't leave the developer's machine."
  That sentence is only true if the rule is actually enforced everywhere.

## Canonical path conventions

Group secret paths by project, then by subsystem, lower-kebab:

```
<project>/<subsystem>/<name>
```

Examples: `myapp/dev/database/url`, `myapp/prod/stripe/secret-key`,
`myapp/prod/stripe/webhook-secret`, `credentials/github/token`.

## How to apply

1. **Assume the vault first.** Use the project's vault CLI or helper as the
   primary lookup, whatever that is for this stack.
2. **Fall back to env vars** only when the vault isn't available (for
   example, CI running in a hosted runner). The env-var value in CI must
   itself be mirrored from the vault by a publish step, never hand-typed.
3. **Fail fast if a secret is missing.** Never silently continue with a
   default. "Missing" should be a loud error naming the exact vault path to
   set.
4. **Never log or echo a secret value.** Debug logs can reference a path,
   never a value.

## What this rules out

- `.env` and `.env.local` files as a source of truth. They can exist as a
  local-dev convenience if they're populated from the vault at session
  start, but the vault entries are authoritative.
- Pasting secrets into a chat, an agent session, or any agent tool. Agents
  should invoke the vault directly rather than being handed a value.
- Committing any file that contains a credential-shaped value, even a "test"
  value. Use obvious placeholder patterns instead.
- Storing credentials in password managers as the primary copy. Password
  managers are fine for human-memorable entries (an unlock passphrase), not
  for the secrets themselves.

## When adding a new secret

1. Write it into the vault.
2. Add the path to the project's secrets index doc.
3. Update the code that consumes it to pull from the vault.
4. If the secret needs to be mirrored to CI, document the mirror step in
   that index, never as a one-off manual add.

## When rotating a secret

1. Write the new value to the vault.
2. Rebuild or redeploy any long-lived consumer so it picks up the new value.
3. Log the rotation in the project's security log, if one exists.

## Escape hatch

None. Exceptions break the one-sentence trust story and create
single-secret-in-two-places drift. If a case genuinely can't work with the
vault (for example, a secret that must be embedded in a signed binary at
build time), flag it in a design doc, get it reviewed, and document the
exception as a known, deliberate deviation.
