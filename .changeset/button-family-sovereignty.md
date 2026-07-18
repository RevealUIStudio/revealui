---
'@revealui/presentation': minor
'@revealui/tokens': minor
---

Re-author the Button family as owned RevealUI components (component sovereignty PR-2).

**Breaking (0.x minor):** the Button API is now two orthogonal axes styled entirely from `--rvui-*` design tokens:

- `variant` = semantic colour intent: `'brand' | 'neutral' | 'success' | 'warning' | 'danger'` (default `'brand'`)
- `appearance` = visual weight: `'solid' | 'outline' | 'ghost' | 'link'` (default `'solid'`)

The old flat `variant` values are replaced. Migration:

- `variant="default"` / `variant="primary"` -> `variant="brand"`
- `variant="secondary"` -> `variant="neutral"`
- `variant="destructive"` -> `variant="danger"`
- `variant="outline"` -> `appearance="outline" variant="neutral"`
- `variant="ghost"` -> `appearance="ghost" variant="neutral"`
- `variant="link"` -> `appearance="link"`

`size`, `glow`, `shine`, `isLoading`, `asChild` are unchanged. `LinkButton` follows the same two-axis API.

**Export rename:** the owned button reclaims the bare `Button` export. `ButtonCVA` remains as a deprecated alias for one minor; migrate imports to `Button`. It will be removed in the next minor.

**Retired:** the Catalyst-derived `color`/`outline`/`plain` palette button (`button-headless.tsx`) is removed. Its internal Dropdown-trigger role is now `DropdownTriggerButton` (`dropdown-trigger.tsx`, internal). `TouchTarget` now lives in `_button-shared`.

**Behaviour:** states use native CSS pseudo-classes; the focus ring is the `--ring` token (the fixed `outline-blue-500` is gone); interaction motion honours `prefers-reduced-motion` at the CSS level; `isLoading` now also sets `data-loading`.

**@revealui/tokens:** adds `--rvui-text-on-success`, `--rvui-text-on-warning`, and `--rvui-success-strong` for solid success/warning button ink at verified WCAG AA contrast.
