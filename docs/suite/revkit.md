---
title: "RevKit"
description: "Portable WSL development environment toolkit. Profile-based bootstrap for a RevealUI Studio-grade workstation."
category: suite
audience: developer
---

# RevKit

**Portable WSL development environment toolkit for RevealUI projects.**

> RevKit is a separate suite product. The repo is at [RevealUIStudio/revkit](https://github.com/RevealUIStudio/revkit) (product name: RevealUI DevKit). This page summarises what RevKit is; the canonical product README lives in the RevKit repo.

## What RevKit is

A bootstrap toolkit that takes a Windows host with WSL2 and turns it into a RevealUI Studio-grade workstation. Configurable via TOML profile presets:

| Profile | Tier | RAM | Cores | Docker | Studio Drive | Ollama |
|---|---|---|---|---|---|---|
| `solo-dev.toml` | T0 | 8 GB | 4 | No | No | No |
| `full-stack.toml` | T1 | 12 GB | 8 | Yes | Yes | No |
| `ai-studio.toml` | T1+ | 16 GB | 8 | Yes | Yes | Yes |
| `team.toml` | T1 | 16 GB | 8 | Yes | Yes | No |

## Quick start

```bash
# 1. Copy a profile preset
cp profiles/solo-dev.toml config.toml

# 2. Edit your identity
$EDITOR config.toml

# 3. Render templates
./scripts/render.sh --config config.toml --output ~/.revealui

# 4. Source the environment
echo 'for f in ~/.revealui/wsl/bashrc.d/*.sh; do source "$f"; done' >> ~/.bashrc
```

## What it ships

- **Bootstrap scripts** — set up WSL2, install Nix + direnv, fnm, pnpm, Node 24, base shell aliases
- **Shell config fragments** — sourced from `~/.revealui/wsl/bashrc.d/*.sh`
- **Boot optimization** — `setup-wsl-boot.sh` masks 23 hardware/desktop services, disables Docker/snap auto-start (sockets preserved); cuts cold-boot time materially
- **Editor configs** — portable Zed settings (and integrates with RevCon for the rest)
- **PowerShell module** — `RevealUI.RevStation` for Windows-side helpers (`Sync-AllRepos`, `Mount-WSLDev`, etc.)
- **Forge drive support** — optional ext4 USB mount at `/mnt/forge` for offloading Docker data, models, databases, caches off the C: drive

## How it composes with RevealUI

- **New contributor onboarding**: Joshua's standing pattern — plug a USB into a Windows host, boot WSL, run the RevKit bootstrap, you have the studio's full environment in minutes instead of hours.
- **Reproducibility**: every dev workstation in the suite builds from the same RevKit profile, so behaviour is consistent (Nix version, Node version, pnpm version, shell aliases, PATH order).
- **Pairs with RevVault**: RevKit sets up the age-identity mount path RevVault expects (`~/.age-identity/keys.txt`); RevVault provides the secrets RevKit's CI tasks need.

## Status

Active.

## See also

- [Suite overview](../SUITE) — how RevKit relates to the rest of the suite
- [Local-first setup](../LOCAL_FIRST) — running RevealUI itself locally (separate concern; RevKit is the *workstation*, LOCAL_FIRST is the *runtime*)
- [RevKit README](https://github.com/RevealUIStudio/revkit/blob/main/README.md) — canonical product docs
