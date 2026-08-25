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
  rasters. Public chrome (marketing nav, docs header) uses the untiled
  Circuit-R (`RevealUIMark` / `revealui-mark.svg`) at ~36px, not this tile.
- `icon-maskable.svg` — the same tile at `rx=0` for full-bleed PWA masking.
  Updated to the current emblem as of 2026-07-27. Rasterized to
  `icon-maskable-512.png` per app; the mark sits at ~70% coverage, inside
  the maskable spec's central 80% safe zone.
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

- No service worker, so Chrome's "Install app" prompt does not fire on any
  app — installability criteria require a fetch-handling worker. Home-screen
  icons, `theme_color`, and chromeless launch on manual add-to-home all work
  today. Adding a worker is a separate, much larger job; don't bolt one on
  without an offline/caching strategy, or it will serve stale builds.

## Per-app deployables

`gen-brand-assets.cjs` writes everything each app serves — the SVG copies as
well as the rasters. Nothing here is copied by hand.

| App | Serves |
|---|---|
| marketing | `favicon.svg`, `icon-mark.svg`, `favicon.png` (64), `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` |
| docs | `favicon.svg`, `favicon.png` (32), `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` |
| admin | same as docs, plus `revealui-logo-dark.svg` (auth brand panel, ≥96px) |

The SVG sync is load-bearing: marketing's
`<link rel="icon" type="image/svg+xml">` and favicon/PWA copies read the
app-local files, not the masters. Public chrome uses `RevealUIMark`
(same paths as `revealui-mark.svg`), not the tiled `icon-mark.svg`.
Before the generator synced them, a master edit shipped the old mark
alongside new rasters. **Do not reintroduce hand-copying.**

## PWA manifests

| App | File | `display` | Why |
|---|---|---|---|
| marketing | `public/site.webmanifest` | `browser` | Public site. Gives home-screen icons and address-bar tint without offering to install a brochure. |
| docs | `public/site.webmanifest` | `standalone` | Reasonable to keep open as an app window. |
| admin | `src/app/manifest.ts` | `standalone` | Operator console. |

Admin's is a **Next dynamic route, not a static file** — the app is
white-labelled via `REVEALUI_BRAND_NAME` / `REVEALUI_TENANT_NAME`, and a
static manifest would pin every tenant kit's home-screen label to
"RevealUI admin". It derives `name` exactly as
`(frontend)/layout.tsx`'s `generateMetadata` does; keep the two in step.
Next injects `<link rel="manifest">` itself, so admin's layout needs no
icon wiring. The Vite apps declare theirs in `index.html` alongside a
`<meta name="theme-color" content="#060d1a">`.

All three point at the same four icon entries — `favicon.svg` (`any`),
`icon-192/512.png` (`any`), `icon-maskable-512.png` (`maskable`).

## Regenerating

Rasters and the `.ico` are produced from `favicon.svg` and `icon-mark.svg` by
[`scripts/gen-brand-assets.cjs`](../../../../../scripts/gen-brand-assets.cjs) at
the repo root, using `sharp` (resolved from `apps/admin`'s dependency, no new
package added). Edit a master, then run:

```bash
node scripts/gen-brand-assets.cjs
```

Expected output — four lines:

```
brand: icon-192.png, icon-512.png
marketing: favicon.svg, icon-mark.svg, favicon.png (64), favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png
docs: favicon.svg, favicon.png (32), favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png
admin: favicon.svg, favicon.png (32), favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png
```

That is the whole pipeline — there is no follow-up copy step.

The masters themselves are authored in the RevealUI Design System project and
land here via its `repo-drop/` folder. Type outlining uses
`@shuding/opentype.js` against Inter Tight 800; the outlining step lives in
the design-system project, not this repo.
