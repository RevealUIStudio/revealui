---
title: "Signed override door (software key)"
description: "Passphrase-protected Ed25519 signer and verifier for an owner override. A label is only a request. This pull request does not flip admin bypass."
visibility: internal
status: verified
audience: maintainer
---

# Signed override door (software key)

This is the software-key door (repo, PR, head SHA, gate, expiry). A signature binds those five fields. It is not a GitHub ruleset change, and it does not turn any required check off.

The live Security review gate does not call this verifier yet. Required checks stay required. This pull request does not change that gate's pass/fail outcome, does not edit the security-review workflow to skip or weaken it, and does not flip any GitHub ruleset or admin bypass.

Agents must not flip the revealui admin bypass setting. After this verifier is live and Joshua says OK, OWNER turns revealui admin bypass OFF. revdev bypass stays off and its check list is unchanged.

A label is a request only. `overrideAllowed({ labelPresent, verification })` in `scripts/gates/signed-override/signed-override.ts` returns true only when `labelPresent` is true and `verification.ok` is true. A label alone is false. A valid signature without the label is false.

## Key material

Node `crypto` generates an Ed25519 key and writes the private half as a PKCS#8 PEM encrypted with the passphrase (`aes-256-cbc`). That path does not open a TTY and does not shell out to `ssh-keygen`.

Never commit the private key, the public key, or the passphrase. `keygen` refuses to write inside the repository. Tests write keygen output only under a temporary directory.

Keep the encrypted private key and the passphrase on the owner machine (mode `0600`). The public key is what a future gate would trust. It is not embedded in the signature artifact, so an artifact cannot supply its own key.

Passphrase sources, in order:

1. `--passphrase-file` (one trailing newline is stripped)
2. `SIGNED_OVERRIDE_PASSPHRASE`

There is no interactive prompt.

## Canonical payload

The signed bytes are UTF-8 JSON with exactly these keys, sorted lexicographically, and no extra whitespace:

`expires_at`, `gate_name`, `head_sha`, `pr_number`, `repo`.

`expires_at` is an ISO-8601 timestamp. The payload is unexpired only while now is strictly before `expires_at`. `head_sha` is the lowercase full git object id (40 or 64 hex characters). `repo` is `owner/name`. `pr_number` is a positive integer. `gate_name` is the check name the signature is allowed to speak for.

Example of the signed string (not a real authorization):

```text
{"expires_at":"2026-09-24T18:00:00.000Z","gate_name":"Security review","head_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","pr_number":123,"repo":"RevealUIStudio/revealui"}
```

## Generate a key

From the revealui checkout, pick a directory that is not inside the repo (`OVERRIDE_KEY_DIR`):

```bash
mkdir -p "$OVERRIDE_KEY_DIR"
chmod 700 "$OVERRIDE_KEY_DIR"
touch "$OVERRIDE_KEY_DIR/passphrase"
chmod 600 "$OVERRIDE_KEY_DIR/passphrase"
```

Write the passphrase into that file with an editor (do not put it on the shell command line). Then:

```bash
pnpm exec tsx scripts/gates/signed-override/cli.ts keygen \
  --out-dir "$OVERRIDE_KEY_DIR" \
  --passphrase-file "$OVERRIDE_KEY_DIR/passphrase"
```

That writes `override-private.pem` (encrypted) and `override-public.pem`.

## Sign

```bash
pnpm exec tsx scripts/gates/signed-override/cli.ts sign \
  --private-key "$OVERRIDE_KEY_DIR/override-private.pem" \
  --passphrase-file "$OVERRIDE_KEY_DIR/passphrase" \
  --repo RevealUIStudio/revealui \
  --pr 123 \
  --head-sha "<40-or-64-lowercase-hex>" \
  --gate "Security review" \
  --expires 2026-09-24T18:00:00.000Z \
  --out "$OVERRIDE_KEY_DIR/signed-override.json"
```

`signed-override.json` is the artifact. It carries version `1`, algorithm `Ed25519`, the payload, and the base64 signature over the canonical payload. Formatting the file does not change what was signed: verification rebuilds the canonical JSON from the payload fields.

## Attach

Attach `signed-override.json` to the pull request (a comment, or another owner-held artifact). Do not commit the private key or the passphrase. Do not treat a label as the authorization.

Verification accepts the artifact only when all of the following hold:

- the public key is the owner key, not a key carried in the artifact
- the signature matches the canonical payload
- repo, PR, head SHA, and gate name match the pull request and the gate being asked
- `expires_at` is still in the future

It rejects a wrong SHA, a wrong gate, a wrong repo, a wrong PR, an expired payload, a bad passphrase (signing fails closed and writes no artifact), and a tampered signature.

## What this pull request does not do

- It does not call the verifier from the live Security review gate.
- It does not skip, weaken, or remove any required check.
- It does not flip the revealui admin bypass setting. Agents must not flip that setting. After this verifier is live and Joshua says OK, OWNER turns revealui admin bypass OFF.
- revdev bypass stays off and its check list is unchanged.
