# @revealui/presentation

## 0.13.1

### Patch Changes

- Updated dependencies [c02e613]
  - @revealui/contracts@0.8.2

## 0.13.0

### Minor Changes

- Gate 0 themability: purge raw Tailwind palette / `dark:` theme-locks from
  components onto the `@theme` bridge and `--rvui-*` tokens.

  **Breaking (0.x minor):** Switch, Radio, Checkbox, and Progress drop the
  Catalyst 11-colorway `color` prop API for five semantic intents shared with
  Button: `'brand' | 'neutral' | 'success' | 'warning' | 'danger'`.

  **Default change (call this out):** an unstyled `<Switch>` / `<Radio>` /
  `<Checkbox>` was near-black (`dark/zinc`) and is now cobalt (`brand`). An
  unstyled `<Progress>` was palette blue and is now brand. Unchanged consumer
  code renders differently on purpose.

  Migration: `color="blue"|"indigo"|"violet"|…` → `intent="brand"`;
  `color="zinc"|"dark/zinc"|…` → `intent="neutral"`; green family → `success`;
  amber/yellow → `warning`; red family → `danger`. The legacy `color` prop
  remains as a deprecated alias through 0.15 with a one-shot dev warning.

  **Also:** focus rings consolidate on `utils/focus.ts` constants / `ring-ring`;
  new tokens `--rvui-scrim` and `--rvui-text-on-error`; apps import
  `@revealui/presentation/theme.css` instead of hand-duplicating `@theme inline`;
  `presentation-lint` hard-fails raw palette and `dark:` in the package (badge
  product-tag swatches remain as a documented exception).

## 0.12.1

### Patch Changes

- 86780ad: Fix `RenderBlocks` emitting `data-rvui-field` paths one segment short of the real draft structure (e.g. `blocks.0.title` instead of `blocks.0.data.title`). Every block component reads its fields from `block.data.*`, so a path stopping at the block index landed an edit-session patch as a sibling of `data` instead of inside it — silently corrupting the block's data on write, both in the session draft and (on publish) the live page. Attributes only appear in edit mode (`editable` + `docId`), so this does not affect any non-edit-mode rendering or visual output.
- Updated dependencies [86780ad]
  - @revealui/contracts@0.8.1

## 0.12.0

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

- 7c6432f: Export the icon set and provider/social brand marks from the main entry (previously `/server`-only), and add `XIcon` (the X, formerly Twitter, mark). Apps can now compose `GitHubIcon`, `XIcon`, `LinkedInIcon`, `IconMenu`, `IconClose`, and the rest of the icon set instead of handrolling inline SVGs.
- 1a49590: Add marketing-shaped section blocks to the canonical block union and a shared, annotatable block renderer.

  **@revealui/contracts** — three new section-level block types on the canonical `BlockSchema` union (`pages.blocks`), each with a `create*Block` factory:

  - `hero` — `{ eyebrow?, title, subtitle?, support?, links? }`
  - `ctaSection` — `{ heading, body?, links?, snippet? }` (snippet is display-only CLI text)
  - `section` — `{ eyebrow?, heading, body?, items? }`, the generic repeater covering FAQ / demo-beats / cards

  Text fields are plain strings in P1 (no Lexical serialized state). A shared `MarketingLinkSchema` (`{ label, href, variant? }`) backs the hero and cta link arrays.

  **@revealui/presentation** — a new `RenderBlocks` renderer (server-safe, render-only) that validates each block against `BlockSchema` and dispatches to per-type components (`HeroBlock`, `CtaSectionBlock`, `SectionBlock`, plus thin renderers for `text`/`heading`/`quote`/`list`/`divider`/`spacer`). Unsupported or invalid blocks render nothing with a dev-only diagnostic.

  Edit-mode annotation contract: when `editable` and a `docId` are provided, every text-bearing element carries `data-rvui-doc` and `data-rvui-field` (a dot-path into the block array, e.g. `blocks.3.title`, `blocks.3.items.2.body`). No data attributes are emitted otherwise.

- e788ba3: Add an optional `animate="print"` prop to `ReceiptCard`. When set, each `AuditLine` row and the integrity footer play a one-shot CSS entrance stagger (the receipt "prints" itself line by line), and the integrity footer's seal pulses once after its entrance. Pure CSS, no JS timeline. Disabled under `prefers-reduced-motion: reduce`. Default is unchanged (no `animate` prop = no visual change).

### Patch Changes

- Updated dependencies [5924269]
- Updated dependencies [c3c1e8f]
- Updated dependencies [1a49590]
  - @revealui/tokens@0.3.0
  - @revealui/contracts@0.8.0

## 0.11.0

### Minor Changes

- 35a5276: Add the product-native quartet: `StatusDot`, `VerdictChip`, `AuditLine`, and `ReceiptCard`. These are greenfield RevealUI-native components for the receipt motif. The set is a status dot with an optional reduced-motion-aware pulse, a guardrail verdict chip, a monospace audit ledger line with a copy-on-click reference, and a receipt card that composes audit lines with an integrity footer. All are styled from `--rvui-*` semantic tokens with APG-conformant labeling and zero external UI dependencies. `StatusDot` supersedes the Studio-local version.

## 0.10.0

### Minor Changes

- eb6389c: Make the Field-context form family canonical and fully consumable, brand-tokenize the field + headless-control internals.

  - Exports (additive, non-breaking): the full field-context family (`Field`/`Description`/`ErrorMessage`/`Fieldset`/`Legend`/`FieldGroup` + the context `Label`) is now reachable from the main entry and `/client`; the context-aware `Label` is the canonical bare `Label` on `/client` (mirrors the `Text`/`Heading` Catalyst precedent). The simple label is also exported everywhere as `ControlLabel`, and as `FieldLabel` (context label) from the main entry. Bare `Label` on `.`/`/server` remains the simple, server-safe label, so existing standalone `Label`/`FormLabel`/`FormField` consumers are unchanged. `FieldsetLabel` retained as a `/client` back-compat alias.
  - Tokens: `fieldset` (Legend/Label/Description/ErrorMessage) and `form-field` (description/error) + the headless control internals (`input`/`select`/`textarea`-headless) move off raw `zinc`/`blue`/`red` onto brand bridge tokens (`text-foreground`/`text-muted-foreground`/`text-destructive`/`ring`/`border`), matching the Card/Text migration.
  - Canonical form pattern is now `<Field><Label/><headless Input|Select|Textarea/><Description/><ErrorMessage/></Field>` (context-driven id/aria). The standalone `FormLabel`/`FormField` + CVA controls are kept for the styled-control path.

- eb38811: Brand-tokenize `Tab` and `Callout`, and make `Callout` usable as an inline status banner.

  - `Tab`/`TabList`: replace the hardcoded `blue-*`/`zinc-*` palette with semantic tokens (`border-primary`/`text-primary` active, `text-muted-foreground`/`border-border` rest, `outline-ring` focus), and move the consumer `className` to last in the merge so the active color can be overridden.
  - `Callout`: replace the per-variant raw palette (`blue/amber/red/green/violet`) with brand tokens (`primary`/`warning`/`error`/`success`/`accent`); title→`text-foreground`, body→`text-muted-foreground`. Add a `role` prop (`'note' | 'status' | 'alert'`, default `'note'`) so it can serve as an inline status/alert banner — the modal `Alert` remains modal-only.

## 0.9.1

### Patch Changes

- d7c871c: Fix mobile navigation on touch devices and add router scroll handling.

  presentation: add `relative` to the CVA button base so `LinkButton`'s
  `TouchTarget` hit-area expander (and the `ShineOverlay`) stay contained. Without
  a positioned ancestor on the button itself, the coarse-pointer touch-target
  overlay sized against the nearest positioned ancestor (such as a `sticky`
  header) and blanketed surrounding controls, intercepting taps. That is what
  stopped the marketing mobile hamburger (a sibling of the signup `LinkButton`)
  from opening on phones.

  router: `navigate()` now scrolls to the top on hashless client navigations
  (anchor links with a `#` are left alone), and `initClient()` sets
  `history.scrollRestoration = 'auto'` explicitly so the browser keeps restoring
  scroll on back/forward and reload. The global click handler now bails when
  `event.defaultPrevented` is already set, so it defers to the React `<Link>`
  component instead of pushing a duplicate history entry.

## 0.9.0

### Minor Changes

- 942c83a: New package `@revealui/tokens` (initial 0.1.0). Owns the canonical `tokens.css`, the `design-context/` brand canon (brand-meta.json, MANIFEST.sha256), and a typed semantic API at `tokens.ts` (`tokens.brand`, `tokens.surface[0..3]`, `tokens.text` including `onBrand` and `warningText`, `tokens.radius`, `tokens.type`, `tokens.status`, `tokens.shadow`, etc.). A CSS↔TS parity test asserts every `--rvui-*` declared in tokens.css is referenced in tokens.ts and vice versa, so the two cannot drift. The existing OKLab→WCAG contrast contract test moved over unchanged.

  `@revealui/presentation` 0.9.0 now depends on `@revealui/tokens`. Its build script copies `tokens.css` and `design-context/*` from the sibling package into its own `dist/`, so all existing import paths (`@revealui/presentation/tokens.css`, `@revealui/presentation/design-context/MANIFEST.sha256`, etc.) keep working. Apps, the design-system token-drift gate, and CI workflow paths require no changes. The legacy in-package generator (`scripts/build-design-context.ts`) is removed; the new canonical generator is `pnpm --filter @revealui/tokens gen:manifest`.

  Migration for downstream consumers: import from `@revealui/tokens` directly when convenient; the `@revealui/presentation` re-export shim is supported for one minor cycle.

### Patch Changes

- Updated dependencies [942c83a]
  - @revealui/tokens@0.2.0

## 0.8.0

### Minor Changes

- d861f75: Animations now honor `prefers-reduced-motion`. A new `useReducedMotion` hook is exported from `@revealui/presentation/animations`, and the `useSpring`, `useAnimation`, `useStagger`, and `usePresence` hooks collapse to their final state (no transition, no stagger, instant mount/unmount) when the user has requested reduced motion. The hook is SSR-safe and reactive to runtime changes.
- 25c93af: `PricingTable` now styles through the cobalt semantic tokens (`primary`, `success`, `card`, `secondary`, `muted-foreground`, `border`) instead of a hardcoded `blue`/`emerald`/`zinc` palette. It now adapts to light/dark themes and tenant brand on the public pricing surface. No API or behavior changes — props and markup are unchanged.

## 0.7.0

### Minor Changes

- e31a1c4: Rebrand to Cobalt + ship the committed design-context pack.

  Since 0.6.0 the canonical token file (`src/tokens.css`) changed brand identity and gained AA fixes + a new token, all under 0.6.0 with no version bump. This bumps to 0.7.0 so npm consumers (and the agency repo) receive the brand change with an explicit version + migration note instead of a silent change under the same 0.6.0.

  **Breaking — brand color:** `--rvui-brand` changed from emerald (`oklch(0.723 0.177 163.22)`) to **Cobalt ("Electric Verdigris")** — `oklch(0.36 0.190 240)` on light/paper, `oklch(0.58 0.150 240)` on dark/midnight (dark lifted to cobalt-300 for WCAG AA, 4.73:1). Surfaces consuming `--rvui-brand` — and the shadcn bridge `--primary` / `--ring`, which alias to it — now render cobalt.

  **Added — `--rvui-warning-text`:** an AA-safe warning text token, distinct from the chip-background `--rvui-warning` (which fails text contrast). `--warning-foreground` aliases to it.

  **Added — committed `design-context/` pack:** `tokens.css` (verbatim copy) + `MANIFEST.sha256` + `brand.md` + `brand-meta.json` + `README.md`, generated by `pnpm --filter @revealui/presentation gen:design-context` (also runs on `build`). It is the canonical artifact for design tooling; a CI drift gate fails the build if `tokens.css` changes without regenerating it.

  **Migration:** consumers using the token (`var(--rvui-brand)`, `bg-primary`, etc.) need no change — they simply render cobalt. Consumers that hard-coded the emerald OKLCH value should update to the cobalt value above. Rebuild the agency site to pick up the new brand.

## 0.6.0

### Minor Changes

- b463921: **Design system: bump canonical button/link vertical sizing.**

  `<Button>` (CVA) and `<LinkButton>` in `@revealui/presentation` are the design-system primitives every fleet surface consumes — marketing, docs, admin, RevDev, RevealCoin all import from here. Updating `buttonVariants.size` is therefore a design-system contract change, not a per-surface patch.

  The previous size table relied on fixed `h-*` values with no explicit vertical padding. With `text-sm` (14px) centered in `h-11` (44px), the rounded edge (`var(--rvui-radius-md, 10px)`) sat only ~12px from the text — the button read as a cramped pill rather than a deliberate rounded rectangle.

  New size contract:

  | Size      | Before              | After                    | Height (px)      |
  | --------- | ------------------- | ------------------------ | ---------------- |
  | `default` | `h-10 px-4 py-2`    | `h-11 px-4 py-2.5`       | 40 → 44          |
  | `lg`      | `h-11 rounded px-8` | `h-12 rounded px-8 py-3` | 44 → 48          |
  | `sm`      | `h-9 rounded px-3`  | `h-10 rounded px-3 py-2` | 36 → 40          |
  | `icon`    | `size-10`           | `size-11`                | 40 → 44 (square) |

  `icon` is bumped to stay square + inline-aligned with the new `default` height. Explicit `py-*` is belt-and-suspenders so spacing survives if a consumer uses `size="clear"` plus a custom height.

  **Scope notes:**

  - `LinkButton` consumes the same `buttonVariants` — no separate edit needed.
  - `button-headless.tsx` (Catalyst-style fork used in admin/RevDev) is intentionally NOT updated. The headless-vs-styled duality is a tracked design-system gap (deferred per the 2026-05-16 revenue-only posture). The CVA `<Button>` is the canonical surface this changeset speaks for.

  Minor (not patch) because the visual contract cascades uniformly to every consumer — Hero CTAs, admin form actions, doc-site nav, RevDev launcher buttons all become 4px taller in the same release.

- 5eb3c6c: Add `tailwind-merge` (^3.3.1) for deterministic class-conflict resolution.

  Previously, `cn()` could produce non-deterministic class strings when consumers passed Tailwind utilities that conflicted with a component's variant classes. `<Button className="bg-red-500">` would not reliably override the variant's `bg-primary` — the result depended on Tailwind's source order. The `cn()` utility now wraps its output with `twMerge` so the last conflicting utility wins per utility category.

  This is the first runtime dependency for `@revealui/presentation`. Bundle impact: ~6 KB gzipped.

## 0.5.0

### Minor Changes

- Add `LinkButton` component + `LinkBehaviorProvider` / `useLinkBehavior` hook for routing-library-agnostic styled CTAs.

  `LinkButton` is a button-styled element that renders as an anchor by default. It eliminates the `<ButtonCVA asChild><Link/></ButtonCVA>` composition footgun (where `asChild` + custom Link components could silently lose styling or produce nested-interactive a11y violations) and gives consumers a one-line API for "styled button that navigates."

  **Default usage** (renders `<a href>` — SSR-safe, zero deps):

  ```tsx
  import { LinkButton } from '@revealui/presentation';

  <LinkButton href="/contact">Book a call</LinkButton>
  <LinkButton href="https://docs.revealui.com" external>Docs ↗</LinkButton>
  <LinkButton href="/contact" variant="outline" size="lg">Talk to founder</LinkButton>
  ```

  **App-level routing wiring** — wrap once at the root, every downstream `LinkButton` routes via your custom Link:

  ```tsx
  import { LinkBehaviorProvider, LinkButton } from "@revealui/presentation";
  import { Link } from "@revealui/router";

  <LinkBehaviorProvider component={Link} hrefProp="to">
    <App /> {/* every <LinkButton href="/x"> uses @revealui/router */}
  </LinkBehaviorProvider>;
  ```

  **Per-instance polymorphic override** — escape hatch for one-off cases:

  ```tsx
  <LinkButton as={Link} to="/contact">
    Book a call
  </LinkButton>
  ```

  Supports all standard `Button` variants (`variant`, `size`, `isLoading`, `disabled`, `external`). Disabled state preserves the anchor's `href` and uses `aria-disabled="true"` + `tabIndex={-1}` + `onClick` preventDefault to enforce the disabled semantics without changing the underlying anchor contract. Loading state shows a spinner + `aria-busy="true"` + `pointer-events:none`.

  Spec: internal LinkButton primitive spec (private coordination hub).

  Zero new runtime dependencies. The `LinkBehaviorProvider` is a tiny React context — `@revealui/presentation` continues to ship with React/ReactDOM as the only peer deps.

## 0.4.1

### Patch Changes

- Fix `Slot` primitive to clone children unconditionally when the child is a valid React element, instead of gating on the (often-not-forwarded) `asChild` prop. The 0.4.0 build of `Slot` only cloned when `asChild` was passed in — but `Button`/`ButtonCVA` do not forward `asChild` to `Slot` after destructuring it locally. Result: `<ButtonCVA asChild><AnyComponent /></ButtonCVA>` rendered the child unstyled inside a wrapping `<div>` carrying the button classes, instead of merging the classes onto the child as intended. This fix restores the documented `asChild` composition pattern across all CVA-styled components in the package.

  No public API change. The fix is already on `main`/`test` (Slot's runtime behavior changed to "always clone if children is a valid element"); this release just publishes that runtime to npm.

## 0.4.0

### Minor Changes

- 0e459ca: **`@revealui/presentation`** — expose 4 typography + table components from the main barrel:

  - `Heading`, `Subheading` (from `./components/heading`)
  - `Link` (from `./components/link`)
  - `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `Code`, `Strong`, `Text`, `TextLink` (from `./components/text`)

  All four source files already existed but were not re-exported from `src/components/index.ts`. The documented usage in `docs/COMPONENT_CATALOG.md` expected them at the top level.

  To avoid naming collision, the CVA-style primitives previously exported as `Heading` and `Text` from `./primitives` are now aliased as `HeadingPrimitive` and `TextPrimitive`. They remain available under `./primitives` via their file paths unchanged; only the barrel re-export name changed. No internal or external consumers import the primitive-named variants from the main barrel.

  **`@revealui/core`** — expose three `./client/*` subpath imports that already exist in the source tree:

  - `@revealui/core/client/ui`
  - `@revealui/core/client/admin`
  - `@revealui/core/client/richtext`

  Previously only the top-level `./client` barrel was exported; consumers could already reach these identifiers via that barrel, but the documented imports (`@revealui/core/client/ui`, etc.) failed at the resolver.

  Drops `docs-import-drift` findings by 41 (225 -> 184). Brings `docs/COMPONENT_CATALOG.md` to zero drift.

## 0.3.6

### Patch Changes

- Charge-readiness phases A-D: billing integration, media library, bulk operations, pagination, sidebar nav, and deploy hardening.

## 0.3.5

### Patch Changes

- 0f195e4: SDLC hardening, content overhaul, and cms→admin rename.

  - Promote all CI quality checks from warn-only to hard-fail
  - Kill banned phrases across 58 files (headless CMS → agentic business runtime)
  - Rename apps/cms to apps/admin throughout the codebase
  - Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
  - Add Gmail-first email provider to MCP server (Resend deprecated)
  - Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
  - Align all coverage thresholds with actual coverage
  - Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)

## 0.3.4

### Patch Changes

- add offline-first cache layer and sync status indicator, fix infinite type instantiation in cn utility, replace core dep with utils in router, remove Cursor IDE support from editors

## 0.3.3

### Patch Changes

- fix: security hardening, CodeQL fixes, docs, and dependency cleanup

  - Replace regex with string methods across source code (CodeQL)
  - Harden CLI content pull and remove trivial conditionals
  - Fix router dependency (core → utils) to resolve DTS build OOM
  - Add migration 0006 indexes for agent_actions, crdt_operations, boards, ticket_labels
  - Remove legacy Supabase-era billing handlers from services
  - Re-export agentMemories from db schema for published @revealui/ai compat
  - Add publishConfig.registry consistency to editors, mcp, services
  - Add READMEs and JSDoc across all packages

## 0.3.2

### Patch Changes

- Frontend polish across presentation components

## 0.3.1

### Patch Changes

- 08d9acd: Upgrade build toolchain: vite 7→8, jsdom 27→29, @vitejs/plugin-react 5→6, flexsearch 0.7→0.8. Migrate rollupOptions→rolldownOptions and esbuild→oxc for Vite 8.

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI UI component library.

  - 50+ pre-wired React 19 components
  - Built with Tailwind CSS v4
  - Functional components with composable APIs
  - Server and client component exports
