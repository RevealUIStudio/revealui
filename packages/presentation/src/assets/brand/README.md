---
title: "RevealUI brand assets"
description: "Canonical SVG masters for the RevealUI identity (Cobalt v4 design language)."
visibility: internal
status: verified
audience: maintainer
---

# RevealUI brand assets

One Circuit-R family. Every colour derives from the OKLCH design tokens in
[`packages/tokens/src/tokens.css`](../../../../tokens/src/tokens.css), re-exported as
`@revealui/presentation/tokens.css`.

**Locked 2026-08-26** — this scythe Circuit-R is the only RevealUI letter.
Variants are that same letterform. There is no second R, no white plate, and
no inverted frost-fill twin. Never steepen the leg.

**Locked 2026-08-31** — optical-center **placement** of that same v2 curved-leg
Circuit-R. The group is `translate(256,256) scale(1.06) translate(-290,-320)`
so letter mass sits on canvas x=256. Do not put the stem on 256 if it crops
the scythe tip. The stem, bowl, curved scythe-leg, frost traces, amber vias,
and clipPaths `cs` / `cb` / `cl` are the v2 drawing.

**Locked 2026-08-31 (light + dark)** — the same scythe, two surfaces. Light
and dark are first-class colorways of one letter (Linear: same system, not an
afterthought). Dark is not a remade R and not a frost-fill invert. Traces on
dark are lighter (`#e8f1ff`) so they hold like Linear dark-theme icons. Do
not add chrome or extra circuit noise. Never a white plate behind the mark.

**Locked 2026-08-31 (bowl counter)** — the eye of the R is a true hole. Inner
path `M238,192 C300,190 345,196 360,222 C368,242 366,260 352,278 C334,300
290,300 238,300 Z` is punched with a `userSpaceOnUse` mask (white letter,
black hole) on the letter group. Do not rely on `clip-rule="evenodd"` alone.
No traces, pale fill, or horizontal lines in the counter.

## Tokens (sRGB)

| Role | Hex | OKLCH |
|------|-----|-------|
| Brand · Cobalt (light / strong) | `#003d94` | `oklch(0.36 0.190 240)` |
| Brand · Cobalt (dark / lifted)  | `#0083c9` | `oklch(0.58 0.150 240)` |
| Accent · Solar Amber            | `#eeb300` | `oklch(0.80 0.165 85)` |
| Surface 0 (dark page)           | `#060d1a` | `oklch(0.16 0.030 260)` |
| Paper (light page)              | `#f8fafd` | `oklch(0.985 0.005 250)` |

Light emblem fills: stem `#0a2c5a`, bowl `#002247`, leg `#0e3468`. Frost traces
`#9fc9ff`. Amber vias `#f0b519`.

Dark emblem fills (same paths): stem `#164687`, bowl `#0d3169`, leg `#1e57a8`.
Frost traces `#e8f1ff` (lifted for contrast on dark). Via cores `#dfeeff`.
Hairline `#082448`. Amber vias `#f0b519`.

## Masters (one letter, two surfaces)

- `revealui-logo.svg` — light Circuit-R. Navy region fills, frost traces, amber
  vias. Transparent (no plate). 512×512, locked `scale(1.06)` and inner origin
  `translate(-290,-320)`. This is the letter on a light page — not a white tile.
- `revealui-logo-dark.svg` — the same scythe, origin, and clip `cl`
  (`M219.6,335.1` / tip `488.0,484.0`), recolored for dark surfaces. Not a
  second R.

Public chrome (marketing nav, docs headers, admin auth when no tenant logo is
set) renders the light master at **≥96px**. Never redraw the letter. Never
steepen the leg. Never put a white plate behind the mark.

## Variants (same letterform only)

Derived from the master. Do not invent a second R.

- `revealui-mark.svg` / `favicon.svg` — the same 3 region paths, no traces.
  Browser-tab favicon and any render **≤96px**. The two files are
  byte-identical; `favicon.svg` is the deployment alias.
- `icon-mark.svg` — the same Circuit-R on a `#060d1a` rounded plate (`rx=112`),
  inset at `scale(0.742)` (70% of the overshooting 1.06 master) so a circular
  crop does not clip the stem or the leg tip. Source for GitHub, apple-touch,
  and PWA `any` rasters. Never put this mark on white.
- `icon-maskable.svg` — the same navy plate at `rx=0` for full-bleed PWA
  masking. The letter stays inside the maskable spec's central 80% safe zone.
- `revealui-mark-mono.svg` — the same 3 paths, `currentColor`, no stroke. In
  app code prefer `RevealUIMark` from `@revealui/presentation`.
- `wordmark-light.svg` / `wordmark-dark.svg` — this R plus outlined "RevealUI"
  type (Inter Tight 800). No live `<text>`. In app UI prefer
  `RevealUIWordmark`, which renders live HTML text.

A dark page uses `revealui-logo-dark.svg` (or the navy-plate icon-mark). An
inverted frost-fill R is a different identity — do not bring it back.

## Size floor

| Render size | Use |
|---|---|
| ≥96px    | Circuit master — `revealui-logo.svg` (light page) or `revealui-logo-dark.svg` (dark page) |
| ≤96px    | Flat mark — `favicon.svg` / `revealui-mark.svg` |

**Circuit never below 96px.** The traces are ~2px in 512 space and alias to mush.

## Stroke weights

Optical, not drift — each file is tuned for its own render band:

| File | `stroke-width` |
|---|---|
| `revealui-mark.svg` / `favicon.svg` | `1.6` |
| `wordmark-*.svg` | `2.4` |
| `revealui-logo.svg` / `revealui-logo-dark.svg` and navy-plate variants | `1.3` / `1.6` / `2` per trace class |

Do not normalise these to a single value.

## Known drift

- No service worker, so Chrome's "Install app" prompt does not fire on any
  app — installability criteria require a fetch-handling worker. Home-screen
  icons, `theme_color`, and chromeless launch on manual add-to-home all work
  today. Adding a worker is a separate, much larger job; don't bolt one on
  without an offline/caching strategy, or it will serve stale builds.

## Per-app deployables

`gen-brand-assets.cjs` writes everything each app serves — the SVG copies as
well as the rasters. Nothing here is copied by hand. Navy-plate SVGs and
favicon/PWA rasters are derived from the **light** master on each run. The
dark master is copied as itself.

| App | Serves |
|---|---|
| marketing | `revealui-logo.svg`, `revealui-logo-dark.svg`, `favicon.svg`, `icon-mark.svg`, `favicon.png` (64), `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` |
| docs | `revealui-logo.svg`, `revealui-logo-dark.svg`, `favicon.svg`, `favicon.png` (32), `favicon.ico`, `apple-touch-icon.png`, `icon-192/512.png`, `icon-maskable-512.png` |
| admin | same as docs |

The SVG sync is load-bearing: marketing and docs chrome read
`/revealui-logo.svg` from the app-local copy, and favicon/PWA copies read the
app-local files, not the masters. **Do not reintroduce hand-copying.**

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

Rasters and the `.ico` are produced from `favicon.svg` and the derived navy
plates by
[`scripts/gen-brand-assets.cjs`](../../../../../scripts/gen-brand-assets.cjs) at
the repo root, using `sharp` (resolved from `apps/admin`'s dependency, no new
package added). Edit the master, then run:

```bash
node scripts/gen-brand-assets.cjs
```

Expected output — four lines:

```
brand: icon-192.png, icon-512.png
marketing: favicon.svg, icon-mark.svg, revealui-logo.svg, revealui-logo-dark.svg, favicon.png (64), favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png
docs: favicon.svg, revealui-logo.svg, revealui-logo-dark.svg, favicon.png (32), favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png
admin: favicon.svg, revealui-logo.svg, revealui-logo-dark.svg, favicon.png (32), favicon.ico (16/32/48), apple-touch-icon.png (180), icon-192/512.png, icon-maskable-512.png
```

That is the whole pipeline — there is no follow-up copy step.

The master is authored in the RevealUI Design System project and lands here
via its `repo-drop/` folder. Type outlining uses `@shuding/opentype.js`
against Inter Tight 800; the outlining step lives in the design-system
project, not this repo.
