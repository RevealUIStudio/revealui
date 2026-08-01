# @revealui/router

## 0.4.0-rc.6

### Patch Changes

- Phase 2.2.5: migration guide (`docs/MIGRATION-RSC.md`), D18.b runtime support
  table (`docs/RUNTIME-SUPPORT.md`), edge-safety contract tests, coverage gate
  raised to ≥80% lines/statements on dual-mode sources.

## 0.4.0-rc.5

### Minor Changes

- Phase 2.2.4: progressive form actions (`decodeFormAction` / `decodeFormState`)
  on `renderRequest`, `getRouterRedirect` for client action redirects.

## 0.4.0-rc.4

### Minor Changes

- Phase 2.2.3: RSC client soft-nav (`setRscPayloadLoader`, `useRscPayload`,
  abort token, navigation status hooks).

## 0.4.0-rc.3

### Patch Changes

- Phase 2.2 T8 packaging: `/core`, `/server` (RSC-safe), `/server-ssr` (SPA).

## 0.3.11

### Patch Changes

- Updated dependencies
  - @revealui/utils@0.3.6

## 0.3.10

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

## 0.3.9

### Patch Changes

- Updated dependencies [37952d2]
  - @revealui/utils@0.3.5

## 0.3.8

### Patch Changes

- OpenAPI Phase B with native Zod-to-OpenAPI scaffold. Pipeline gap fixes, pre-push tests, code-pattern scanner. Dependency updates and SDLC hardening.
- Updated dependencies
  - @revealui/utils@0.3.4

## 0.3.7

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

- Updated dependencies [0f195e4]
  - @revealui/utils@0.3.3

## 0.3.6

### Patch Changes

- add offline-first cache layer and sync status indicator, fix infinite type instantiation in cn utility, replace core dep with utils in router, remove Cursor IDE support from editors
- Updated dependencies
  - @revealui/utils@0.3.2

## 0.3.5

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

- Updated dependencies
  - @revealui/utils@0.3.1

## 0.3.4

### Patch Changes

- @revealui/core@0.5.2

## 0.3.3

### Patch Changes

- @revealui/core@0.5.1

## 0.3.2

### Patch Changes

- Extract Link component props to named interface
- Updated dependencies
  - @revealui/core@0.5.0

## 0.3.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/core@0.3.0

## 0.2.1

### Patch Changes

- @revealui/core@0.2.1

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI lightweight file-based router.

### Patch Changes

- Updated dependencies [4d76d68]
  - @revealui/core@0.2.0
