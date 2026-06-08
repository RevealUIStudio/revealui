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

- `revealui-mark.svg` — full-colour logomark (cobalt R + amber "reveal" stripe).
- `revealui-mark-mono.svg` — single-colour mark (`currentColor`, no amber). In app
  code prefer the `RevealUIMark` React component from `@revealui/presentation`.
- `favicon.svg` — browser / PWA / app tile (white R on a cobalt rounded square).
- `icon-maskable.svg` — full-bleed square for PWA maskable + apple-touch.
- `revealui-logo.svg` — horizontal lockup, light surfaces (mark + wordmark).
- `revealui-logo-dark.svg` — horizontal lockup, dark surfaces.
- `icon-192.png` / `icon-512.png` — PWA raster icons (from `icon-maskable.svg`).

The wordmark in the lockups is outlined Inter Tight Bold (vector paths, no runtime
font dependency).

## Per-app deployables

`favicon.svg`, `favicon.ico` (16/32/48), `favicon.png` (32) and
`apple-touch-icon.png` (180) are copied into each app's `public/`. The admin app
also serves `revealui-logo.svg` for its header/footer.

## Regenerating

Rasters and the `.ico` are produced from these SVG masters with `sharp`; the
wordmark is outlined with `@shuding/opentype.js` against
`apps/server/src/assets/fonts/InterTight-Bold.ttf`. Edit a master, re-run the
generator, then re-copy the deployables into each app `public/`.
