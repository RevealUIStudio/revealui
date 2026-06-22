# @revealui/tokens

## 0.2.0

### Minor Changes

- 942c83a: New package `@revealui/tokens` (initial 0.1.0). Owns the canonical `tokens.css`, the `design-context/` brand canon (brand-meta.json, MANIFEST.sha256), and a typed semantic API at `tokens.ts` (`tokens.brand`, `tokens.surface[0..3]`, `tokens.text` including `onBrand` and `warningText`, `tokens.radius`, `tokens.type`, `tokens.status`, `tokens.shadow`, etc.). A CSS↔TS parity test asserts every `--rvui-*` declared in tokens.css is referenced in tokens.ts and vice versa, so the two cannot drift. The existing OKLab→WCAG contrast contract test moved over unchanged.

  `@revealui/presentation` 0.9.0 now depends on `@revealui/tokens`. Its build script copies `tokens.css` and `design-context/*` from the sibling package into its own `dist/`, so all existing import paths (`@revealui/presentation/tokens.css`, `@revealui/presentation/design-context/MANIFEST.sha256`, etc.) keep working. Apps, the design-system token-drift gate, and CI workflow paths require no changes. The legacy in-package generator (`scripts/build-design-context.ts`) is removed; the new canonical generator is `pnpm --filter @revealui/tokens gen:manifest`.

  Migration for downstream consumers: import from `@revealui/tokens` directly when convenient; the `@revealui/presentation` re-export shim is supported for one minor cycle.
