---
title: "RevealUI Design Context — Claude Design Pack"
description: "Drop this folder into a Claude Design session."
visibility: internal
status: verified
audience: maintainer
---

<!-- tokens.css and MANIFEST.sha256 in this pack are generated from packages/tokens/src/tokens.css — DO NOT EDIT those two files by hand — run pnpm --filter @revealui/tokens gen:manifest -->

# RevealUI Design Context — Claude Design Pack

Drop this folder into a Claude Design session.

`tokens.css` here is a generated mirror of `packages/tokens/src/tokens.css` (canonical).
**Do NOT edit `tokens.css` or `MANIFEST.sha256` by hand** — edit the source token file and regenerate:

```bash
pnpm --filter @revealui/tokens gen:manifest
```

`README.md` and `brand.md` are hand-authored.

## What is in this pack

| File | Description |
| ---- | ----------- |
| `tokens.css` | Verbatim copy of the canonical token file |
| `brand-meta.json` | Hand-authored brand canon (name, hue, OKLCH values, type stacks) |
| `brand.md` | Hand-authored brand reference derived from `brand-meta.json` |
| `MANIFEST.sha256` | SHA-256 of the source `tokens.css` at generation time |

## Brand

**Cobalt (Electric Verdigris)**, hue 240.
Light `--rvui-brand`: `oklch(0.36 0.190 240)`.
Dark `--rvui-brand`: `oklch(0.58 0.150 240)` (lifted for WCAG AA).

> `tokens.css` and `MANIFEST.sha256` in this pack are GENERATED from packages/tokens/src/tokens.css — DO NOT EDIT those two files by hand — run pnpm --filter @revealui/tokens gen:manifest.
