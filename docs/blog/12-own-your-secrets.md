---
title: "Your Secrets Don't Belong in a .env File"
description: "The default bargain puts your credentials in a vendor dashboard or a plaintext .env file. RevVault keeps them age-encrypted on hardware you control."
visibility: public
status: narrative
audience: user
author: Joshua Vaughn
---

The `.env` file is where security quietly rots.

It starts innocently. You paste a Stripe key into `.env.local` to get a feature working. A teammate copies it into Slack to unblock themselves. CI needs it, so it goes into the provider dashboard too. Six months later your most sensitive credentials exist in plaintext in four places, none of them encrypted, and nobody remembers all four. The day one of them leaks, you find out from a billing alert.

RevealUI refuses that bargain. Every project in the fleet keeps its secrets in **RevVault**, an age-encrypted local secret store, and nothing lives in plaintext on disk.

## What RevVault is

RevVault is a Rust command-line tool plus a Tauri desktop app. It encrypts your secrets with [age](https://age-encryption.org/), keeps them on your own filesystem, and never phones home. The encrypted store is git-friendly, so a team can version it like any other file, and it is compatible with the `passage` format, so you are not locked into a bespoke vault you cannot leave.

The model is simple. Secrets are encrypted at rest. They are decrypted on demand, in memory, by a key that stays on your machine. They are never written back to disk in the clear, and they never transit a third-party server you do not control.

```bash
# Store a secret (prompts for the value, never echoed)
revvault set my-project/stripe/secret-key

# Read it back
revvault get my-project/stripe/secret-key

# Load a whole namespace into your shell environment
revvault export-env my-project > /dev/null   # used by .envrc, not a file
```

## How a RevealUI project actually uses it

The point of RevVault is that you stop thinking about secrets day to day, and they are still never exposed.

Every RevealUI project ships an `.envrc` that calls RevVault at shell entry. When you `cd` into the project, your credentials are decrypted into the environment for that session, used by the running process, and gone when the shell exits. No `.env.local` full of live keys sits on disk waiting to be committed by accident.

```bash
# .envrc
eval "$(revvault export-env my-project)"
```

Contrast that with the standard pattern: secrets in a provider's secret manager, secrets in a `.env` checked into a "private" repo, secrets pasted into a CI settings page. All three hand values that should only exist on hardware you control to someone else, and all three are one misconfiguration away from public.

## The desktop app, for when the CLI is not enough

Not everyone wants to live in a terminal. The RevVault desktop app gives you a visual view of your namespaces, lets you add and rotate secrets without memorizing commands, and keeps the same age-encrypted store underneath. The CLI and the app are two front doors to one vault, not two systems to keep in sync.

## The honest part

RevVault is Beta. It is what the entire fleet runs on every day, which is the strongest test we can give it, but a few things are worth knowing before you adopt it.

You hold the age identity key. That is the whole point, and it is also a responsibility: lose the key with no backup and you lose the secrets it protects, exactly as it should be for something nobody else can decrypt. The CLI is intentionally conservative about destructive operations, so renaming and bulk deletion are deliberate rather than one keystroke away. And like the rest of RevFleet, it is open, so you can read precisely what it does with your data before you trust it with any.

The trade you are making is real surface area, your own key and your own store, in exchange for the one thing a vendor dashboard can never give you: secrets that only ever exist where you put them.

---

*RevealUI is the open runtime for businesses that run their own AI. RevVault is part of the RevFleet family; read the source and get started on [GitHub](https://github.com/RevealUIStudio/revvault).*
