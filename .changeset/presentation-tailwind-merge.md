---
"@revealui/presentation": minor
---

Add `tailwind-merge` (^3.3.1) for deterministic class-conflict resolution.

Previously, `cn()` could produce non-deterministic class strings when consumers passed Tailwind utilities that conflicted with a component's variant classes. `<Button className="bg-red-500">` would not reliably override the variant's `bg-primary` — the result depended on Tailwind's source order. The `cn()` utility now wraps its output with `twMerge` so the last conflicting utility wins per utility category.

This is the first runtime dependency for `@revealui/presentation`. Bundle impact: ~6 KB gzipped.
