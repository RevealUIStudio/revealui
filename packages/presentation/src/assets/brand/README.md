---
title: "RevealUI brand assets"
description: "Canonical SVG masters for the RevealUI identity (Cobalt v4 design language)."
visibility: internal
status: verified
audience: maintainer
---

# RevealUI brand assets

Canonical SVG masters for the RevealUI identity (Cobalt v4 design language).
Every colour derives from the OKLCH design tokens in
[`packages/tokens/src/tokens.css`](../../../../tokens/src/tokens.css), re-exported as
`@revealui/presentation/tokens.css`.

**Ratified 2026-07-27** — Circuit-R emblem family, v2 trace spec. Supersedes the
2026-07-10 / 07-11 gradient-emblem canon.

## Tokens (sRGB)

| Role | Hex | OKLCH |
|------|-----|-------|
| Brand · Cobalt (light / strong) | `#003d94` | `oklch(0.36 0.190 240)` |
| Brand · Cobalt (dark / lifted)  | `#0083c9` | `oklch(0.58 0.150 240)` |
| Accent · Solar Amber            | `#eeb300` | `oklch(0.80 0.165 85)` |
| Surface 0 (dark page)           | `#060d1a` | `oklch(0.16 0.030 260)` |
| Paper (light page)              | `#f8fafd` | `oklch(0.985 0.005 250)` |

Emblem region fills (light variants): stem `#0a2c5a`, bowl `#002247`,
leg `#0e3468`. Dark variants invert the relationship — frost fills
(`#e8f1ff` / `#f8fafd`) carry navy trace ink (`#0b2a5e`) with `#082448`
via cores. Rule: **bright fill → dark ink**, never the reverse.

## Masters

The identity is a two-mark system. The **flat mark** is the primary,
canonical form. The **circuit master** is the expressive form, scoped to
large renders only.

### Flat marks (3 paths, no traces)

- `revealui-mark.svg` / `favicon.svg` — bare emblem, no background tile.
  Browser-tab favicon and general-purpose logomark. The two files are
  byte-identical; `favicon.svg` is the deployment alias.
- `icon-mark.svg` — the same glyph on a `#060d1a` rounded tile (`rx=112`),
  mark at ~70% tile coverage. Source for apple-touch / social / app-icon
  rasters, and the 22px nav mark in marketing.
- `icon-maskable.svg` — the same tile at `rx=0` for full-bleed PWA masking.
  Updated to the current emblem as of 2026-07-27.
- `revealui-mark-mono.svg` — single-colour mark (`currentColor`, no stroke).
  In app code prefer the `RevealUIMark` React component from
  `@revealui/presentation`, which renders these same paths.

### Circuit masters (77 paths, PCB routing)

- `revealui-logo.svg` / `revealui-logo-dark.svg` — the emblem with full
  circuit routing: orthogonal buses, 45° elbows, via-pads, region-aware
  trace behaviour. 512×512.

**Never render a circuit master below 96px.** The traces are ~2px in 512
space and alias to mush.

### Wordmark lockups

- `wordmark-light.svg` / `wordmark-dark.svg` — flat mark + "RevealUI",
  560×148. Cap height locked to the emblem's bowl band.

  The text is **outlined to vector paths** (Inter Tight 800, real font
  metrics, kerned, −0.02em tracking) as of 2026-07-27. There is no runtime
  font dependency and no platform fallback — the previous live-`<text>`
  defect is resolved. Static files are now safe for README badges, email
  templates, and unfurls.

  In app UI still prefer the `RevealUIWordmark` React component, which
  renders live HTML text (selectable, translatable, responsive to page
  font-size).

## Size floor

| Render size | Use |
|---|---|
| ≥96px    | Circuit masters — `revealui-logo.svg` / `-dark.svg` |
| 24–96px  | Flat mark — `favicon.svg` / `revealui-mark.svg` |
| ≤24px    | Flat mark, untiled — tiling below 24px reads as a smudge |

Verified 2026-07-27 against Chrome's light (`#dee1e6`) and dark (`#202124`)
tab strips: the untiled flat mark stays legible at 16px on both; the tiled
`icon-mark.svg` does not.

## Stroke weights

Optical, not drift — each master is tuned for its own render band:

| File | `stroke-width` |
|---|---|
| `revealui-mark.svg` / `favicon.svg` / `icon-mark.svg` / `icon-maskable.svg` | `1.6` |
| `wordmark-*.svg` | `2.4` |
| `revealui-logo*.svg` | `1.3` / `1.6` / `2` per trace class |

Do not normalise these to a single value.

## Known drift

- `icon-192.png` / `icon-512.png` are **stale** — still the pre-2026-07-27
  emblem. `gen-brand-assets.cjs` does not emit them, and no app wires them
  up (there is no `manifest.json` / `site.webmanifest` in any app). Either
  add PWA manifests and extend the generator, or delete all three maskable
  assets. Don't leave them half-wired.
- `apps/admin` still serves `revealui-logo.svg` from its own `public/` for
  the header. That's a circuit master rendered in app chrome — check the
  render size against the floor above, and switch to `RevealUIMark` +
  live text if it's under 96px.

## Per-app deployables

`gen-brand-assets.cjs` writes the rasters. The **SVGs are copied by hand** —
the generator does not sync them, so they drift silently after a master
edit. After changing any master:

```bash
B=packages/presentation/src/assets/brand
cp $B/favicon.svg        apps/marketing/public/favicon.svg
cp $B/icon-mark.svg      apps/marketing/public/icon-mark.svg
cp $B/favicon.svg        apps/docs/public/favicon.svg
cp $B/favicon.svg        apps/admin/public/favicon.svg
cp $B/revealui-logo.svg  apps/admin/public/revealui-logo.svg
```

This is the highest-risk step in the pipeline: marketing's
`<link rel="icon" type="image/svg+xml">` and `NavBar`/`Footer`'s
`<img src="/icon-mark.svg">` all read the app-local copies, so a missed
`cp` ships the old mark while every raster shows the new one. Folding these
copies into the generator is a worthwhile follow-up.

## Regenerating

Rasters and the `.ico` are produced from `favicon.svg` and `icon-mark.svg` by
[`scripts/gen-brand-assets.cjs`](../../../../../scripts/gen-brand-assets.cjs) at
the repo root, using `sharp` (resolved from `apps/admin`'s dependency, no new
package added). Edit a master, then run:

```bash
node scripts/gen-brand-assets.cjs
```

Expected output — three lines, one per app:

```
marketing: favicon.png (64), favicon.ico (16/32/48), apple-touch-icon.png (180)
docs: favicon.png (32), favicon.ico (16/32/48), apple-touch-icon.png (180)
admin: favicon.png (32), favicon.ico (16/32/48), apple-touch-icon.png (180)
```

Then run the `cp` block above.

The masters themselves are authored in the RevealUI Design System project and
land here via its `repo-drop/` folder. Type outlining uses
`@shuding/opentype.js` against Inter Tight 800; the outlining step lives in
the design-system project, not this repo.
