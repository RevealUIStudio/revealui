---
"@revealui/config": patch
"@revealui/services": patch
---

Relocate the Stripe live/test mode classification (`mode.ts`) out of the optional Pro package `@revealui/services` into the always-bundled `@revealui/config` as `@revealui/config/stripe-mode`. `@revealui/services/stripe/mode` now re-exports from the new home, preserving the single source of truth. This lets `apps/server` import the mode helpers on its serverless cold-start path without statically referencing the externalized Pro package, fixing a production API `ERR_MODULE_NOT_FOUND: @revealui/services` cold-start crash.
