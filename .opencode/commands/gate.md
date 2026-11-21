---
description: Run the full CI gate (Biome lint, typecheck, Vitest, turbo build) before pushing. Only invoke when explicitly asked to run the gate or verify before a push.
disable-model-invocation: true
---

Run the CI gate to validate the monorepo before pushing.

Execute `pnpm gate` in the RevealUI monorepo root. This runs the full CI pipeline:
1. Biome lint check
2. TypeScript type checking across all packages
3. Vitest test suite
4. Turbo build

If the full gate takes too long, run `pnpm gate:quick` for phase 1 only (lint + typecheck).

Report any failures with the specific package and error details.
