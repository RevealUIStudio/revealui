# @revealui/editor

## 0.2.0

### Minor Changes

- 64c1bb7: Introduce @revealui/editor: the visual edit-session runtime and dashboard canvas.

  - `@revealui/editor/runtime`: a dependency-free, framework-agnostic edit-mode runtime the previewed site loads only in edit mode. It fetches read-only draft overlays with a signed preview token, hands drafts to the host page via a callback, and runs an exact-origin-pinned postMessage channel with the dashboard canvas.
  - `@revealui/editor/canvas`: React Client Components (`EditSessionCanvas`) that host the preview iframe, open a click-to-edit popover, drive debounced autosave through the authenticated session API, and surface publish/discard conflicts.

### Patch Changes

- 7d46923: Fix `initEditRuntime`'s inbound `rvui:apply-patch` handler silently dropping a patch whose docId was materialized on the session server after the runtime's initial preview fetch (the canonical case: a fresh session's first field patch, since a session doc only materializes on its own first PATCH). The handler now re-fetches the preview payload once on a doc-id miss, shared across any concurrent misses, before retrying the patch; a still-missing doc after the refetch (or a failed refetch) keeps the prior fail-quiet drop.
- Updated dependencies [5924269]
- Updated dependencies [7c6432f]
- Updated dependencies [c3c1e8f]
- Updated dependencies [1a49590]
- Updated dependencies [e788ba3]
  - @revealui/presentation@0.12.0
  - @revealui/contracts@0.8.0
