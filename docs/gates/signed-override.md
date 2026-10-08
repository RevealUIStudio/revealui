---
title: "Owner-signed gate overrides"
description: "One shared SSHSIG verifier for exact PR, commit, gate and expiry authorizations."
visibility: internal
status: draft
audience: maintainer
---

# Owner-signed gate overrides

GAP-313 uses the ratified SSHSIG contract. The owning verifier is
`@revealui/harnesses/gates`; the former Node JSON/PEM implementation has been
replaced by a thin adapter to this shared primitive. Labels request an override;
they do not authorize it. Live request-changes holds take precedence.

## Owner trust anchor

Use a dedicated, passphrase-protected Ed25519 key, separate from agent-usable
Git signing keys. The owner creates and uses it in a terminal outside agent
sessions. Keep its private key and passphrase outside ssh-agent, RevVault and CI.
The preparation helper never generates keys, reads a private key, or signs.

In that separate owner terminal, create the key interactively and choose a strong
passphrase at the prompt (do not pass it as a flag or save it to a file):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_revealfleet_override -C override@revealui.com
```

Return only the contents of `~/.ssh/id_revealfleet_override.pub` or the public
allowed-signers entry. The `.pub` suffix matters.

Set the repository Actions variable `REVEALFLEET_OVERRIDE_SIGNERS` to the public
allowed-signers entry. It has this shape (replace the placeholder with the
owner's real public key; this is not an activation value):

```text
owner@revealui.com namespaces="revealfleet-override" ssh-ed25519 PUBLIC_KEY_BASE64
```

An absent trust anchor denies override authorization. The signature cannot
supply its own trust anchor. Repository-variable administration remains an
owner action; code delivery does not activate the key or change rulesets.

### Canonical configuration cutover

Repository-variable administration owns the configuration migration. Rename the
existing GitHub Actions repository variable to `REVEALFLEET_OVERRIDE_SIGNERS`
through the supported repository-variable editor/API, preserving the identical
public allowed-signers entry. Coordinate this cutover with every consuming
repository's security-gate workflow and CLI source. Do not create a second
variable or key. There is no legacy-variable fallback in the verifier; a
consumer that has not completed its cutover remains blocked.

Validation requires each consumer's deployed workflow to supply the canonical
variable, a current exact-head owner grant to verify using the unchanged public
anchor, and legacy-only or missing configuration to deny authorization. Record
the actual repository-variable change and fresh gate results before claiming the
cutover is complete. Source tests and a merged code change do not establish
GitHub settings activation.

This is a configuration identifier migration. It does not change the canonical
payload bytes, SSHSIG namespace, comment envelope, key, owner identity, expiry,
or exact-head binding. Existing valid owner signatures remain bound to their
original context; a different PR head still requires its own owner signature.

## Prepare, sign and attach

From a normal checkout, use the maintained helper to obtain the current full
PR head and write the exact payload. Gate identifiers are `sec-review` and
`prove-red`; they are not display names. Choose an expiry after today's UTC date.

```bash
pnpm exec tsx scripts/gates/signed-override/cli.ts prepare \
  --repo RevealUIStudio/revealui --pr 123 --gate sec-review \
  --expires 2026-10-07 --out /tmp/owner-override.payload
```

The owner reviews the payload and signs it outside the observed agent session:

```bash
ssh-keygen -Y sign -f ~/.ssh/id_revealfleet_override \
  -n revealfleet-override /tmp/owner-override.payload
```

Only the public payload and signature return to the helper. Posting checks that
the PR still has the signed head, then wraps the signature in the existing
`REVEALFLEET-OVERRIDE-BEGIN` and `REVEALFLEET-OVERRIDE-END` comment envelope.

```bash
pnpm exec tsx scripts/gates/signed-override/cli.ts post \
  --repo RevealUIStudio/revealui --pr 123 --gate sec-review \
  --payload-file /tmp/owner-override.payload \
  --signature-file /tmp/owner-override.payload.sig
```

Request the normal gate reevaluation through its supported PR label event.
A new head requires a new owner signature. These payload files are disposable
public authorization artifacts, not an operational workaround.

## Verification contract

The canonical payload is one UTF-8 line with a trailing newline:

```text
revealfleet-override v1 repo=RevealUIStudio/revealui pr=123 head=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa gate=sec-review expires=2026-10-07
```

Verification uses `ssh-keygen -Y verify`, identity `owner@revealui.com`, and
namespace `revealfleet-override`. It requires the exact repository, PR number,
40-character lowercase head SHA, gate identifier, and a valid future UTC expiry
date. It rejects tampering, another key or namespace, stale heads, wrong gates,
invalid dates, expired grants and unavailable verification tooling. Comment and
subprocess bounds limit untrusted-input work; temporary public verification
files are removed after every attempt.

## Rollout evidence and existing exception inventory

The prior `scripts/gates/signed-override` implementation accepted encrypted PEM
keys and passphrases through flags/environment and emitted custom JSON artifacts.
Its durable destination is the shared SSHSIG verifier and preparation/posting
helper. Removal evidence is deletion of those signing/key-generation paths and
real synthetic SSH fixture tests, including replay and tamper rejection.

Activation remains pending until both consumer gates use the shared published
package, frozen dependency locks resolve that release, focused and required
checks pass, and the owner supplies the public trust anchor. Existing bypass
settings are separate owner dispositions after end-to-end verification. Do not
close GAP-313 on a helper-only implementation or use a label-only fallback.

## Review controller receipt

The owner SSHSIG remains a full grant, including on sensitive paths and on the review controller. A verified signed receipt can clear a normal path only when `REVIEW_RECEIPT_MODE` is `enforce`. Sensitive paths also need an independent approval. Controller paths have no receipt grant. Labels do not grant either path. See [review controller receipts](./review-controller-receipt.md).
