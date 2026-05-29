# RevealUI Methodology

The engineering postures and coordination primitives that govern how RevFleet is built. This document is the canonical in-repo reference. Canonical rule definitions live in private repos and `~/.claude/rules/`; cross-references are provided at the end.

---

## Engineering postures

### Audit-first SDLC (M5)

Every meaningful change starts with a deep audit of existing state: file paths, line numbers, and a classification of intentional vs accidental duplication. The audit precedes the proposal, always. Skipping the audit is not an acceptable shortcut regardless of time pressure or scope.

### No-regex (M2)

Zero regex authored across the fleet. Replace with:
- AST walkers (`mdast`, Lexical, `@typescript-eslint`)
- Typed predicates and `Set`/`Map` lookups
- `Intl.Segmenter` for text segmentation
- Built-in parsers: `URL`, `JSON.parse`, `Date.parse`

Library typed APIs are acceptable (`Zod`'s `.email()`). Third-party config that requires a regex string must be marked `// REGEX-CONFIG-BOUNDARY` and minimized. The end-state is zero regex across the fleet.

### Pre-1.0 versioning (M6)

Every artifact starts at `0.1.0`. `1.0.0` is a public contract claim — "consumers can depend on this API without handholding." That claim requires real external consumers and a stable contract across at least one release cycle.

Inside `0.x`: breaking changes bump minor (not major). Promotion to `1.0` requires real external consumers + stable contract for ≥1 release cycle.

(`@revealui/contracts` was briefly published on the `1.x` line, then demoted to `0.x` to follow this rule — see the contracts-demotion ADR in `docs/decisions/`. It is now pre-1.0 like everything else.)

### Open-model AI runtime (M3)

Fleet runtime imports zero Anthropic SDK. Open-weight models (Gemma 4 / Phi-4-mini via Ollama or Ubuntu Inference Snaps) are the deployable runtime. Anthropic SDK is opt-in for agency-only flows and must never be embedded in customer-shipped artifacts.

### Revvault-first secrets (M4)

Every secret lives in `revvault`. No `.env` files as primary source. No plaintext on disk. See `docs/SECRETS.md` for the full policy and canonical path conventions.

### Verify before claiming

Never say "works" / "fixed" / "tests pass" without having run it. Explicitly say "I didn't test this" when true.

### Durable only

No tactical shortcuts. No week-scoped postures. No env-var fallbacks for secrets. If a fix degrades in 30 days it wasn't a fix.

### No risk too small

Every risk in a mitigation list gets a concrete fix. "Acceptable trade-off", "periodic review", or "reviewer-checklist line item" are not mitigations.

---

## Coordination primitives

### Per-session beacons and note.js (M9)

Each Claude Code session writes a context beacon on stop (`~/.claude/coordination/context-beacon.json`). The `note.js` CLI and `session-note` SKILL provide handoff continuity — a lightweight mechanism for leaving structured notes that surface automatically in the next session's startup block.

Hooks NEVER write to the workboard by design. The workboard is a manual coordination surface; hooks are automated side-effects — conflating the two creates race conditions.

### Workboard automation (M10)

Two scripts govern the fleet-level workboard at `~/revfleet/.jv/.claude/workboard.md`:

- `workboard-check.js` — read-only drift detector, fired on session-start. Reports stale rows and unresolved gaps without modifying the file.
- `workboard-sweep.js` — idempotent cleanup. The agent reviews the diff and commits manually; the script never auto-commits.

Hooks architecture detail: `~/.claude/rules/hooks-architecture.md` (private).

---

## Charge-readiness state (M11)

- Production runs Stripe in TEST mode; the `STRIPE_LIVE_MODE` flip is owner-gated on the billing-readiness audit closing.
- Pro-package gates are being removed via Path A: drop fake `checkXLicense` calls; normalize to FSL-1.1-MIT. Customers pay for hosted infra + support, not enforcement. Tracked in `docs/MASTER_PLAN.md`.

---

## Stack conventions (M12)

| Layer | Canonical choice |
|-------|-----------------|
| Language | TypeScript strict mode, ES Modules |
| Package manager | pnpm 10 (legacy npm only for historical packages) |
| Test runner | Vitest (not Jest) |
| Linter/formatter | Biome (not ESLint/Prettier) |
| Dev shell | Nix flakes + direnv |
| OSS license | MIT |
| Pro license | FSL-1.1-MIT (converts to MIT after 2 years) |
| Routing | `@revealui/router` (never "React Router") |

---

## Cross-references

| Topic | Canonical source |
|-------|-----------------|
| Audit-first SDLC (M5) | `RevealUIStudio/revealui-jv/.claude/rules/audit-first-sdlc.md` (private) |
| No-regex (M2) | `~/.claude/rules/` global rules |
| Versioning (M6) | `~/.claude/rules/versioning.md` |
| Secrets (M4) | `~/.claude/rules/secrets.md` + `docs/SECRETS.md` |
| Hooks architecture (M8/M9/M10) | `~/.claude/rules/hooks-architecture.md` (private) |
| 7-tier rename glossary (M1) | `RevealUIStudio/revealui-jv/docs/glossary.md` (private) |
| Charge-readiness detail (M11) | `docs/MASTER_PLAN.md` §Billing |
