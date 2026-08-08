#!/usr/bin/env bash
# Build dist/gates for lightweight pull_request_target / sparse-checkout jobs
# (security-review-gate, sec-audit-label-guard, archive-check).
#
# Constraints:
#   - Sparse checkout typically has packages/harnesses + packages/dev only
#   - No turbo.json, no @revealui/security source
#   - Full `pnpm --filter @revealui/harnesses build` DTS needs security after GAP-381
#
# Prefer build:gates when present (test tip). Fall back to tsup.gates-cjs.ts
# when the base ref is still main (or an older tip) without that script.
set -euo pipefail

pnpm install --frozen-lockfile --filter @revealui/harnesses --filter @revealui/dev

if grep -q '"build:gates"' packages/harnesses/package.json 2>/dev/null; then
  pnpm --filter @revealui/harnesses run build:gates
else
  echo "build:gates not in package.json — falling back to tsup.gates-cjs.ts"
  pnpm --filter @revealui/harnesses exec tsup --config tsup.gates-cjs.ts
fi
# Nested package type so index.js CJS loads under parent type:module
if [[ -f packages/harnesses/dist/gates/index.cjs ]]; then
  printf '%s\n' '{"type":"commonjs"}' > packages/harnesses/dist/gates/package.json
  cp -f packages/harnesses/dist/gates/index.cjs packages/harnesses/dist/gates/index.js
fi
