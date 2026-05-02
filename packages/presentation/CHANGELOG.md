# @revealui/presentation

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
  import { LinkBehaviorProvider, LinkButton } from '@revealui/presentation';
  import { Link } from '@revealui/router';

  <LinkBehaviorProvider component={Link} hrefProp="to">
    <App />  {/* every <LinkButton href="/x"> uses @revealui/router */}
  </LinkBehaviorProvider>
  ```

  **Per-instance polymorphic override** — escape hatch for one-off cases:

  ```tsx
  <LinkButton as={Link} to="/contact">Book a call</LinkButton>
  ```

  Supports all standard `Button` variants (`variant`, `size`, `isLoading`, `disabled`, `external`). Disabled state preserves the anchor's `href` and uses `aria-disabled="true"` + `tabIndex={-1}` + `onClick` preventDefault to enforce the disabled semantics without changing the underlying anchor contract. Loading state shows a spinner + `aria-busy="true"` + `pointer-events:none`.

  Spec: [`docs/specs/linkbutton-primitive.md`](https://github.com/RevealUIStudio/revealui-jv) (revealui-jv).

  Zero new runtime dependencies. The `LinkBehaviorProvider` is a tiny React context — `@revealui/presentation` continues to ship with React/ReactDOM as the only peer deps.

## 0.4.1

### Patch Changes

- Fix `Slot` primitive to clone children unconditionally when the child is a valid React element, instead of gating on the (often-not-forwarded) `asChild` prop. The 0.4.0 build of `Slot` only cloned when `asChild` was passed in — but `Button`/`ButtonCVA` do not forward `asChild` to `Slot` after destructuring it locally. Result: `<ButtonCVA asChild><AnyComponent /></ButtonCVA>` rendered the child unstyled inside a wrapping `<div>` carrying the button classes, instead of merging the classes onto the child as intended. This fix restores the documented `asChild` composition pattern across all CVA-styled components in the package.

  No public API change. The fix is already on `main`/`test` (Slot's runtime behavior changed to "always clone if children is a valid element"); this release just publishes that runtime to npm.

## 0.4.0

### Minor Changes

- 0e459ca: **`@revealui/presentation`** — expose 4 Catalyst-style components from the main barrel:

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
