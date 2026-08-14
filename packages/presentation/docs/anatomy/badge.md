# Badge anatomy (Phase 3 PR-3)

Grounding: product usage (admin status chips, /claims evidence kind, docs
showcase), WAI-ARIA APG "Status" (text that is not a widget), `@revealui/tokens`
semantic bridge. Catalyst source was not open while writing this.

## Parts

| Part | Role |
|---|---|
| Root | `<span>` (static) or `<button>` / `<a>` wrapper (`BadgeButton`) |
| Label | Required visible text. Color never encodes meaning alone (WCAG 1.4.1). |
| Hit target | `TouchTarget` on `BadgeButton` only (WCAG 2.5.5, 44px on coarse pointers). |

Not a live region by default. Callers that need announcements use `role="status"`
on the page, not on every chip.

## States

| State | How |
|---|---|
| Rest | Token fill + ink for the resolved `intent` |
| Hover | `BadgeButton` only: `group-hover:` steps the fill. Static `Badge` has no hover. |
| Focus-visible | Native `:focus-visible` ring via `focusRing` (`--ring`). |
| Disabled | `BadgeButton`: native `disabled` / `aria-disabled` + `opacity-50`. |
| Press | Native `:active` (no press-scale; chips are not primary actions). |

No Catalyst `data-hover` / `data-focus` class recipes.

## Keyboard (`BadgeButton`)

Native button / link map. Enter and Space activate the button. Disabled
controls are not in the tab order.

## Token hooks

| Intent | Fill | Ink |
|---|---|---|
| `brand` | `bg-primary/10` | `text-primary` |
| `neutral` (default) | `bg-muted` | `text-muted-foreground` |
| `muted` | same as `neutral` (metadata tags; named because call sites already use it) |
| `success` | `bg-success/10` | `text-success` |
| `warning` | `bg-warning/10` | `text-warning-foreground` |
| `danger` | `bg-destructive/10` | `text-destructive` |

Radius: `--rvui-radius-full`. Motion: `--rvui-duration-fast` / `--rvui-ease`.
No raw Tailwind palette steps.

## API

```ts
intent?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'muted'
color?: LegacyColorway | BadgeIntent  // deprecated through 0.15
```

`color` maps through `LEGACY_COLOR_TO_INTENT` (or the six intents if already
semantic) and warns once in development. The 20-swatch product-tag palette
does not survive.

## Do-not-redo

Visual weight stays a small pill. This is the API / provenance pass from the
sovereignty spec §3.5, not a new chip design.
