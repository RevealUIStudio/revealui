# Contributing to `@revealui/presentation`

This is the package-level contribution guide for the design system. The repo-wide guide lives at the [root `CONTRIBUTING.md`](../../CONTRIBUTING.md) — read that first for general repo conventions (type system, lint, error codes, commit style).

This file covers what's specific to the design system: adding components, the dual-pattern requirement, accessibility floor, showcases, and the token-versioning contract.

## What ships from this package

`@revealui/presentation` is the **fully featured + artifacted design system** for RevealUI. It exports:

- **Components** under `./components` and the main barrel — over 50 production components
- **Primitives** under `./primitives` — `Slot`, `Box`, `Flex`, `Grid`, `Heading`, `Text`
- **Hooks** under `./hooks` — `useTheme`, controllable state, focus trap, escape-key, etc.
- **Animations** under `./animations` — `useSpring`, `useStagger`, `usePresence`, `useGesture`
- **Tokens** as `./tokens.css` — OKLCH-based design tokens, dark-first with manual `data-theme` override
- **Server-safe** subset under `./server` and **client-only** subset under `./client`

Distribution is npm-published, ESM-only, with full TypeScript declarations and source maps.

## Adding a new component

Every new component goes through five steps. Skipping any of these blocks merge.

### 1. File location and dual-pattern

Components live under `src/components/`. Two patterns coexist:

- **Headless** (`button-headless.tsx`) — bare functionality with no styling. Useful when consumers need to bring their own visual treatment.
- **CVA** (`Button.tsx`) — opinionated styled variant powered by CVA (`class-variance-authority` clone in `utils/cn.ts`). Most consumers use this.

The CVA component should accept the same props as the headless one plus a `variant` and `size` (or component-specific equivalents). Re-export both from `src/components/index.ts` and `src/server.ts` (server-safe subset) or `src/client.ts` (client-only).

### 2. Token usage

**No hardcoded colors, spacing, or radii.** Every visual value comes from `--rvui-*` CSS variables defined in `src/tokens.css`. If you need a value that doesn't exist, add it to the token file in the appropriate group (Spacing, Radius, Surfaces, Status, Motion, Typography, etc.) before referencing it.

The token system is dark-first; light mode overrides via `[data-theme="light"]` and `@media (prefers-color-scheme: light)`. Ensure your component renders correctly in both.

### 3. Accessibility floor

Every shipped component must meet **WCAG 2.1 AA** at minimum:

- **Color contrast** — text on its background ≥ 4.5:1 for normal, ≥ 3:1 for large text. Use `text-emerald-700` floor (not `-500`/`-600`) for emerald accents on white. Run an axe-core check on your showcase before opening the PR.
- **Keyboard navigation** — every interactive control reachable via Tab, operable via Enter/Space (or component-appropriate keys). No tab traps unless inside a modal/disclosure.
- **ARIA** — use the right role and aria-* attributes. Prefer native semantics (`<button>`, `<details>`, `<dialog>`) over re-implementing with divs.
- **Focus visibility** — focus ring must be visible at default contrast. The base `Button` uses `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`; match that pattern.
- **Reduced motion** — animations respect `prefers-reduced-motion`. Use the `useReducedMotion` hook from `./hooks` or the matching media query.

Document which of these you tested in the showcase's `a11y` field (see step 5).

### 4. Tests

Component tests live in `src/__tests__/components/<Component>.test.tsx`. Use `@testing-library/react` (already a dev-dep). Required coverage:

- Renders without crashing for default props
- Each `variant` and `size` combination renders without console errors
- `asChild` (when supported) clones the child element correctly — see `Button.test.tsx` for the canonical pattern
- Disabled/loading/empty states render the right ARIA
- Keyboard interactions work (use `userEvent.tab()`, `userEvent.keyboard('{Enter}')`)

`pnpm --filter @revealui/presentation test` must pass.

### 5. Showcase

Every component needs a showcase at `apps/docs/app/showcase/<slug>.showcase.tsx`. The schema is in `apps/docs/app/components/showcase/types.ts`. Required fields:

- `slug`, `name`, `description`, `category`
- `controls` — interactive prop knobs (boolean, select, text, number, range, color)
- `render(props)` — JSX using the current control values
- `code(props)` — a string that mirrors the rendered JSX (so the Code tab works)

Optional but **strongly encouraged** for any production-bound component:

- `variantGrid` — every (variant × size) combination rendered side-by-side
- `examples[]` — common usage patterns (icon-only button, button group, etc.)
- `usage.when` / `usage.avoid` — markdown explaining when to reach for it and the alternatives
- `a11y.conformance` — list of WCAG criteria explicitly covered, e.g. `["WCAG 2.1 AA contrast", "WCAG 2.1.1 Keyboard"]`
- `a11y.keyboard` — map of key → behavior, e.g. `{"Tab": "Move focus to next item"}`
- `a11y.aria` — map of aria-* attributes the component sets or expects
- `sourceUrl` — package-relative path to the source file, e.g. `"src/components/Button.tsx"`. Auto-renders a "View source" link to GitHub.
- `related[]` — cross-links to related showcases by slug

Then add the entry to `apps/docs/app/components/showcase/registry.ts` so it appears in the sidebar (the sidebar is auto-generated from the registry — no separate hand-maintained list to update).

## Token-versioning policy

Tokens are part of the public contract. Renaming or removing a `--rvui-*` variable is a breaking change.

- **While pre-1.0** (current): breaking token changes bump the **minor** version (e.g. `0.4.x` → `0.5.0`). Document the rename in the changeset.
- **Post-1.0**: breaking token changes bump **major**. Provide a deprecation period of at least one minor release with both names exposed.
- **Adding a new token** is always a patch — no consumers break.

When you rename a token, update both `src/tokens.css` and the public reference at `apps/docs/app/components/showcase/TokensPage.tsx`.

## Versioning

Per the [repo-wide versioning rule](../../.claude/rules/versioning.md), the package starts at `0.1.0` and stays pre-1.0 until consumers + governance + token contract are stable. Don't promote to `1.0.0` casually.

Inside `0.x`, any meaningful behavior change or breaking API change bumps **minor**, not major. Use changesets (`pnpm changeset`) to record the intent — the tooling enforces version policy at release time.

**No changeset for CI-only or workflow-file changes.** Changesets are for source code changes that affect what the package emits.

## Where to ask

- Suite-wide questions → root CONTRIBUTING.md, then `#dev` in the project Discussions
- Design-system-specific decisions (token shape, accessibility tradeoffs, naming) → file an issue with the `package: presentation` label

## Quick checklist before opening a PR

- [ ] Component file lives under `src/components/` (or `src/primitives/` for primitives)
- [ ] Re-exported from `src/components/index.ts` and the appropriate `server.ts`/`client.ts`
- [ ] Uses `--rvui-*` tokens, no hardcoded design values
- [ ] Tests in `src/__tests__/components/<Component>.test.tsx` cover variants, asChild (if supported), keyboard, a11y
- [ ] Showcase at `apps/docs/app/showcase/<slug>.showcase.tsx` with controls, render, code, and `a11y` field
- [ ] Showcase registered in `apps/docs/app/components/showcase/registry.ts`
- [ ] `pnpm --filter @revealui/presentation test` passes
- [ ] `pnpm --filter @revealui/presentation typecheck` passes
- [ ] `pnpm --filter @revealui/presentation build` succeeds (artifact + type defs + tokens.css)
- [ ] Biome clean
- [ ] Changeset created via `pnpm changeset` (unless this is a docs-only or CI-only change)
