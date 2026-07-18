---
'@revealui/editor': minor
---

Introduce @revealui/editor: the visual edit-session runtime and dashboard canvas.

- `@revealui/editor/runtime`: a dependency-free, framework-agnostic edit-mode runtime the previewed site loads only in edit mode. It fetches read-only draft overlays with a signed preview token, hands drafts to the host page via a callback, and runs an exact-origin-pinned postMessage channel with the dashboard canvas.
- `@revealui/editor/canvas`: React Client Components (`EditSessionCanvas`) that host the preview iframe, open a click-to-edit popover, drive debounced autosave through the authenticated session API, and surface publish/discard conflicts.
