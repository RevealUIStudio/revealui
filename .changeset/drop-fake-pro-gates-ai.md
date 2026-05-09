---
'@revealui/ai': minor
---

Remove unused `checkAiLicense` export. Per the 2026-05-08 charge-readiness audit
Phase 2 Path A: the function was theater — declared but never called by any feature
code in `src/`. The FSL-1.1-MIT non-compete is the real legal protection; npm-package
DRM is a multi-week arms race that customers route around in an afternoon. Drop the
gate, strip the `[Pro]` description prefix to match enforcement reality.

The `@revealui/core` license JWT layer (`initializeLicense` / `isLicensed` /
`requireFeature`) is unchanged — it remains genuinely useful for tier-aware feature
shaping in the hosted product (revealui.com), where we control the runtime.
