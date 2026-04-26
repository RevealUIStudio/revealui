---
title: "RevVault"
description: "Age-encrypted secret vault. CLI plus Tauri 2 desktop app. 100% passage-compatible. Source of truth for every secret in the RevealUI Studio Suite."
category: suite
audience: developer
---

# RevVault

**Age-encrypted secret vault with CLI and Tauri desktop app. 100% [passage](https://github.com/FiloSottile/passage)-compatible.**

> RevVault is a separate suite product, not part of the RevealUI monorepo. The repo is at [RevealUIStudio/revvault](https://github.com/RevealUIStudio/revvault). This page summarises what RevVault is and how it composes with RevealUI; the canonical product README lives in the RevVault repo.

## What RevVault is

- **Encrypted at rest.** Secrets stored as `.age` files using x25519 key exchange. The age identity (`~/.age-identity/keys.txt` by convention) gates every secret in the vault.
- **CLI**: `revvault get`, `set`, `list`, `search`, `delete`, `edit`, `export-env`. Implemented in Rust (workspace under `crates/`).
- **Desktop app**: Tauri 2 + React 19. Search, browse, create, reveal, copy, delete, with secret-shape detection.
- **Namespaces**: secrets organized by first path segment — `credentials/`, `ssh/`, `revealui/`, `revealcoin/`, etc.
- **Fuzzy search**: find secrets by partial path match.
- **Import**: migrate plaintext secret files with automatic categorisation.
- **Path validation**: directory traversal and injection attacks blocked at the API layer.

## How it composes with RevealUI

RevealUI's [secrets convention](https://github.com/RevealUIStudio/revealui/blob/main/.claude/rules/secrets.md) is hard-rule:

> Every secret the RevealUI Suite depends on lives in RevVault. Full stop.

That includes API keys, database URLs, webhook secrets, JWT/session secrets, signing keys, Solana keypairs, license keys, Vercel tokens, Railway tokens, Supabase credentials, Stripe keys, OAuth client secrets, age identities, SSH keys — anything else.

In practice:

- **Local dev**: `revvault export-env` materializes `.env`-shaped output that direnv loads at session start. The `.env` files exist as a convenience; the RevVault entry is authoritative.
- **CI**: GitHub Actions secrets are mirrored from RevVault by a publish step, never hand-typed.
- **Rotation**: each credential type has a runbook entry under [`docs/CREDENTIAL-ROTATION-RUNBOOK`](../CREDENTIAL-ROTATION-RUNBOOK). Rotation updates RevVault first; downstream re-reads from the same source.

The trust story compresses to one sentence: *"Secrets live in RevVault, encrypted by an age identity that doesn't leave the developer's machine."*

## Pro-tier integration

Per [`/docs/PRO`](../PRO), a RevealUI Pro license unlocks the **RevVault desktop app** and **rotation engine** as Pro-tier features in the Ecosystem Features table. The CLI and core crate are MIT and free for any tier.

## Status

Active. Production-grade for personal / studio use; commercial offering wraps existing RevealUI Pro tier.

## See also

- [Suite overview](../SUITE) — how RevVault relates to the rest of the suite
- [Credential rotation runbook](../CREDENTIAL-ROTATION-RUNBOOK) — RevVault paths per credential type
- [RevVault README](https://github.com/RevealUIStudio/revvault/blob/main/README.md) — canonical product docs
