---
title: "RevealUI brand assets"
description: "Canonical SVG masters for the RevealUI identity (Cobalt v4 design language)."
visibility: internal
status: verified
audience: maintainer
---

# RevealUI brand assets

Canonical SVG masters for the RevealUI identity (Cobalt v4 design language).
Every colour derives from the OKLCH design tokens in [`../../tokens.css`](../../tokens.css).

## Tokens (sRGB)

| Role | Hex | OKLCH |
|------|-----|-------|
| Brand · Cobalt (light / strong) | `#003d94` | `oklch(0.36 0.190 240)` |
| Brand · Cobalt (dark / lifted)  | `#0083c9` | `oklch(0.58 0.150 240)` |
| Accent · Solar Amber            | `#eeb300` | `oklch(0.80 0.165 85)` |
| Surface 0 (dark page)           | `#060d1a` | `oklch(0.16 0.030 260)` |
| Paper (light page)              | `#f8fafd` | `oklch(0.985 0.005 250)` |

## Masters

Canon adopted 2026-07-10 (owner decision): the design-system project's emblem
family, gradient cobalt fills with a Solar Amber outline stroke, no separate
pupil shape.

- `revealui-mark.svg` / `favicon.svg` — bare emblem, no background tile. This
  is the browser-tab favicon and the general-purpose logomark; both files are
  identical copies of the canonical source.
- `icon-mark.svg` — the same glyph as a white letterform on a `#003d94`
  rounded tile. Source for apple-touch / social / app-icon rasters.
- `revealui-mark-mono.svg` — single-colour mark (`currentColor`, no amber
  stroke). In app code prefer the `RevealUIMark` React component from
  `@revealui/presentation`, which renders this same glyph.
- `revealui-logo.svg` / `revealui-logo-dark.svg` — horizontal lockups (mark +
  wordmark). **Not yet updated to the new emblem** — the wordmark lockup is a
  separate, still-open decision, so these two files still carry the prior
  glyph. Treat as known drift until that decision lands.
- `icon-maskable.svg`, `icon-192.png`, `icon-512.png` — full-bleed PWA
  maskable icon + its rasters. **Not yet updated to the new emblem** and,
  as of 2026-07-10, unreferenced by any app (no `manifest.json` /
  `site.webmanifest` wires them up). Known drift; update or remove in a
  follow-up.

The wordmark in the lockups is outlined Inter Tight Bold (vector paths, no runtime
font dependency).

## Per-app deployables

`favicon.svg` (bare emblem), `favicon.ico` (16/32/48), `favicon.png` and
`apple-touch-icon.png` (180, from `icon-mark.svg`) are copied into each app's
`public/`. Marketing additionally serves `icon-mark.svg` directly. The admin
app also serves `revealui-logo.svg` for its header/footer (unrelated wordmark
decision, see above).

## Regenerating

Rasters and the `.ico` are produced from `favicon.svg` and `icon-mark.svg` by
[`scripts/gen-brand-assets.cjs`](../../../../scripts/gen-brand-assets.cjs) at
the repo root, using `sharp` (resolved from `apps/admin`'s dependency, no new
package added). Edit a master, then run:

```bash
node scripts/gen-brand-assets.cjs
```

This regenerates every per-app raster in place. The wordmark lockups
(`revealui-logo.svg` / `revealui-logo-dark.svg`) are outlined separately with
`@shuding/opentype.js` against `apps/server/src/assets/fonts/InterTight-Bold.ttf`
and are not touched by this script.
