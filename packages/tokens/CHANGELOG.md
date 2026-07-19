# @revealui/tokens

## 0.3.0

### Minor Changes

- 5924269: Re-author the Button family as owned RevealUI components (component sovereignty PR-2).

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

## 0.2.0

### Minor Changes

- 942c83a: New package `@revealui/tokens` (initial 0.1.0). Owns the canonical `tokens.css`, the `design-context/` brand canon (brand-meta.json, MANIFEST.sha256), and a typed semantic API at `tokens.ts` (`tokens.brand`, `tokens.surface[0..3]`, `tokens.text` including `onBrand` and `warningText`, `tokens.radius`, `tokens.type`, `tokens.status`, `tokens.shadow`, etc.). A CSS↔TS parity test asserts every `--rvui-*` declared in tokens.css is referenced in tokens.ts and vice versa, so the two cannot drift. The existing OKLab→WCAG contrast contract test moved over unchanged.

  `@revealui/presentation` 0.9.0 now depends on `@revealui/tokens`. Its build script copies `tokens.css` and `design-context/*` from the sibling package into its own `dist/`, so all existing import paths (`@revealui/presentation/tokens.css`, `@revealui/presentation/design-context/MANIFEST.sha256`, etc.) keep working. Apps, the design-system token-drift gate, and CI workflow paths require no changes. The legacy in-package generator (`scripts/build-design-context.ts`) is removed; the new canonical generator is `pnpm --filter @revealui/tokens gen:manifest`.

  Migration for downstream consumers: import from `@revealui/tokens` directly when convenient; the `@revealui/presentation` re-export shim is supported for one minor cycle.
