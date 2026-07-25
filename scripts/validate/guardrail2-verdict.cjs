'use strict';
// guardrail2-verdict.cjs — thin adapter (GAP-408 control-layer redesign).
//
// The real parser lives in @revealui/harnesses (packages/harnesses/src/gates/
// guardrail2-verdict.ts). This file only resolves and loads it, then
// re-exports the same public API so security-review-gate.cjs,
// sec-audit-label-decision.cjs, and the vitest suite that migrated to
// packages/harnesses/src/gates/__tests__/ keep working unchanged. There is no
// vendored copy of the parsing logic here — a guarded mirror is still a
// mirror. Resolution goes through gates-resolver.cjs (local dist, or a
// REVEALUI_HARNESSES_DIR npm install for sparse-checkout CI jobs).
//
// FAILS CLOSED: this parser gates merges. Silently falling back to "no
// verdict" when the module cannot be resolved is exactly the failure mode
// this module exists to prevent, so an unresolved module throws instead of
// returning a stub.

const { resolveGatesModule } = require('./gates-resolver.cjs');

const mod = resolveGatesModule();

if (!mod) {
  throw new Error(
    'guardrail2-verdict: could not resolve the @revealui/harnesses gates module.\n' +
      '  This parser gates merges — failing closed rather than silently treating\n' +
      '  every PR as having no recorded verdict.\n' +
      '  Fix: build it locally (pnpm --filter @revealui/harnesses build), or set\n' +
      '  REVEALUI_HARNESSES_DIR to a directory where\n' +
      '  `npm install --prefix <dir> @revealui/harnesses@<pin>` was run.\n',
  );
}

module.exports = {
  MARKER_OPEN: mod.MARKER_OPEN,
  MARKER_CLOSE: mod.MARKER_CLOSE,
  REQUEST_CHANGES: mod.REQUEST_CHANGES,
  APPROVE: mod.APPROVE,
  verdictForBody: mod.verdictForBody,
  collectVerdicts: mod.collectVerdicts,
  evaluateGuardrail2: mod.evaluateGuardrail2,
};
