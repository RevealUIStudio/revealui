---
"@revealui/core": patch
---

Brand-token the error-handling fallback UI. The inline-hex colors in `error-handling/fallback-components.tsx` (Toast/Skeleton/error/offline/success banners) and `error-handling/error-boundary.tsx` now reference RevealUI brand tokens with the original hex retained as a literal fallback — e.g. `color: 'var(--rvui-error, #f44336)'`. Brand-aligned when the app's tokens are loaded, and still resilient (the hex fallback renders even if CSS is unavailable — the whole point of fallback UI). No API/behavior change; no new dependency (token-only: core references the CSS vars the consuming app provides, not @revealui/presentation).
