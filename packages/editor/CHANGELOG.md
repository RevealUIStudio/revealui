# @revealui/editor

## 0.2.4

### Patch Changes

- Updated dependencies [016a1a6]
- Updated dependencies [4a2569b]
  - @revealui/presentation@0.14.1

## 0.2.3

### Patch Changes

- 99115d9: Compose EditSessionCanvas field and theme hosts on presentation Input, Textarea, and Button.
- d09d3d6: Let operators switch the live preview between published marketing pages and review agent proposals from the session event log.
- Updated dependencies [0b46867]
- Updated dependencies [ebbb625]
- Updated dependencies [ff1137f]
- Updated dependencies [700413b]
- Updated dependencies [5a0fbe7]
- Updated dependencies [f917cc9]
- Updated dependencies [b1d0915]
- Updated dependencies [caf837f]
- Updated dependencies [77fbaa1]
- Updated dependencies [592982a]
- Updated dependencies [40b52b3]
- Updated dependencies [5e0ff45]
  - @revealui/presentation@0.14.0
  - @revealui/contracts@0.8.3

## 0.2.2

### Patch Changes

- Updated dependencies [c02e613]
  - @revealui/contracts@0.8.2
  - @revealui/presentation@0.13.1

## 0.2.1

### Patch Changes

- 86780ad: Land canvas defaults for a fresh edit session: resolve a published page (`home` then `products` then first) when no dirty docs exist, so the preview iframe is not stuck on bare `/`. Export `pickDefaultPreviewPageId` for the preference order.
- 86780ad: VES P2 slice: gate fleet-marketing session patches with marketing-voice Tier-1 validation, extend prose slots for contracts block shapes, and add blocks.insert/remove/move ops on the session API plus canvas block chrome.
- Updated dependencies [86780ad]
- Updated dependencies [86780ad]
  - @revealui/presentation@0.12.1
  - @revealui/contracts@0.8.1

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
