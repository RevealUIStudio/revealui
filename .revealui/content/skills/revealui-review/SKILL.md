---
name: RevealUI Code Review
description: "Code review for RevealUI: run Standards and Spec axes in parallel before merge or \"done\". Use when reviewing code, completing a feature, checking quality, or before committing. Invoke with $revealui-review."
---

# RevealUI Code Review

Run **both axes in parallel** before claiming done or approving a PR. Do not finish on Standards alone (pretty code that fails the job) or Spec alone (works once, unmaintainable).

| Axis | Question | Verdict |
|------|----------|---------|
| **Standards** | Does this match fleet hardlines, package boundaries, and house style? | PASS / FAIL with file:line |
| **Spec** | Does this deliver the agreed behavior at the right seams? | PASS / FAIL with acceptance map |

Ship only when **both** are PASS (or FAIL items are filed as durable follow-ups with owner disposition, not silent skips).

## 0. Automated Checks (both axes feed on these)

Run and record clean/red:

```bash
pnpm lint
pnpm typecheck:all
pnpm --filter <package> test
pnpm gate:quick
```

If copy/claims touched: `pnpm validate:claims`. If harness content touched: content snapshot / freshness checks.

---

## Axis A  -  Standards (how we build)

### A1. Type safety
- [ ] No `any` (use `unknown` + guards)
- [ ] Prefer `satisfies` over casual `as`
- [ ] Exported functions have explicit return types
- [ ] `import type` for type-only imports
- [ ] No underscore-silenced unused params (`_foo`) when the honest fix is implement/remove

### A2. Code quality
- [ ] No `console.*` in product paths (use observability logger)
- [ ] No hardcoded env/config that belongs in parameterization or revvault paths
- [ ] Single responsibility per module; no drive-by unrelated rewrites
- [ ] Biome-clean; no format debt left for CI

### A3. Architecture and boundaries
- [ ] No forbidden Supabase / dual-DB imports
- [ ] Cross-package via `@revealui/<name>`, not relative into other packages
- [ ] Internal deps `workspace:*`; OSS packages do not import Pro packages
- [ ] **Deep modules:** prefer deep interfaces (small public surface, rich implementation) over shallow "pass-through" layers that leak internals
- [ ] **Locality:** change cost stays near the owning package; avoid shotgun edits across unrelated packages without a named reason

### A4. Tailwind v4 (UI)
- [ ] `bg-(--var)` not `bg-[--var]`
- [ ] `bg-red-500!` not `!bg-red-500`
- [ ] `@import "tailwindcss"` not `@tailwind`
- [ ] `@utility` not `@layer utilities`
- [ ] Prefer `gap` over `space-*`

### A5. Git and secrets
- [ ] Conventional commit: `type(scope): description`
- [ ] Subject under 72 chars, imperative
- [ ] Identity: `RevealUI Studio <43050008+joshua-v-dev@users.noreply.github.com>` (never `founder@revealui.com` on signed fleet commits)
- [ ] No secrets in tree; revvault paths only in docs/chat

### A6. Process hardlines (when applicable)
- [ ] Durable fix in owning primitive (no unregistered hotfix / workaround recipe)
- [ ] Proposal-shaped only unless owner named a disposition
- [ ] Security surfaces: recorded review before "ready to merge" language

---

## Axis B  -  Spec (what we agreed to build)

### B1. Seams and acceptance
- [ ] Behavior is specified at **public seams** (package exports, HTTP routes, CLI), not private helpers
- [ ] Acceptance criteria from gap/PR/spec map 1:1 to observable outcomes
- [ ] User-visible copy matches `copy-voice` / no em dashes on public surfaces

### B2. Correctness and proof
- [ ] Happy path and material failure paths covered
- [ ] Tests (or gate commands) prove red→green for the change class; no tautological expects
- [ ] code-over-docs: if prose and code disagree, code is truth and docs are fixed or filed

### B3. Regression and safety
- [ ] Adjacent behavior not broken (call sites, consumers, materialize consumers for harness content)
- [ ] Feature gates / entitlements / authz still fail closed
- [ ] No new poll loops or token-economy violations (prefer completion events / `events.wait`)

### B4. Depth check (design smell)
- [ ] New API is not a shallow wrapper that forces callers to know internals
- [ ] If the module is hard to test without mocking private collaborators, fix the seam (or file design follow-up) rather than shipping implementation-coupled tests

---

## Parallel workflow (how to run the review)

1. **List** the change set (PR files or `git diff origin/test...HEAD`).
2. **Standards pass**  -  walk Axis A; write FAIL as `path:line  -  rule  -  fix`.
3. **Spec pass**  -  walk Axis B; write FAIL as `criterion  -  evidence missing/broken  -  fix`.
4. **Cross-check**  -  a Standards-only green with Spec FAIL is **not** shippable; same in reverse.
5. **Verdict**  -  APPROVE only if both axes PASS (or residual is owner-dispositioned and tracked).

## Anti-patterns

- **Style theater**  -  formatting clean, wrong product behavior
- **Demo-only green**  -  works in one happy curl, no failure paths
- **Shallow module**  -  many small files that re-export each other without a real boundary
- **Testing past the seam**  -  private access to force coverage
- **Doc cosplay**  -  updating handoffs instead of code (or the reverse without reconciling)

## Related skills

- `$revealui-tdd`  -  seams, vertical slices, anti-patterns for new work
- `$revealui-debugging`  -  red-capable loop before hypothesising
- `$revealui-testing`  -  flaky/concurrency triage
- `$revealui-conventions`  -  house TypeScript/Tailwind/monorepo rules

