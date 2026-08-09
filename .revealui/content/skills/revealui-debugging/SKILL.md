---
name: RevealUI Debugging
description: "Disciplined bug diagnosis for RevealUI: build a red-capable feedback loop first, then minimise, multi-hypothesis, instrument, fix, and regression-test. Use on bugs, failures, or unexpected behavior."
---

# RevealUI Debugging Workflow

When something breaks, follow this process. Do not skip phases. Skip a phase only when you can name why.

**Redact secrets** in every command, log, and artifact shown to the user. Use `<REDACTED>`. Prefer `revvault run` / env injection so credentials never appear in argv or chat. See stream-safe secrets rules.

## Phase 1  -  Build a red-capable feedback loop

**This is the skill.** Everything else consumes the loop. If you have a **tight** pass/fail signal that goes red on **this** bug, you will find the cause. If you do not, staring at code will not save you.

Spend disproportionate effort here. Be aggressive and creative. Refuse to give up early.

### Ways to construct a loop (try roughly in this order)

1. **Failing test** at a seam that reaches the bug (unit, integration, or e2e)  -  prefer `$revealui-tdd`
2. **HTTP / curl script** against a running dev server
3. **CLI invocation** with a fixture input, diffing stdout against known-good
4. **Headless browser** (Playwright) asserting DOM, console, or network
5. **Replay** a captured payload/event through the path in isolation
6. **Throwaway harness** that exercises one code path with mocked deps
7. **Property / fuzz** when the bug is intermittent wrong output
8. **Bisection harness** when the bug appeared between two known states (`git bisect run`)
9. **Differential** old vs new version or config on the same input
10. **Human-in-the-loop script** only as last resort  -  structured steps, captured output

### Tighten the loop

- Faster (narrow scope, skip unrelated init)
- Sharper (assert the user's exact symptom, not "did not crash")
- More deterministic (pin time, seed RNG, isolate network/fs)

A 30-second flaky loop is barely better than no loop. Aim for seconds and a stable verdict.

### Non-deterministic bugs

Raise the **reproduction rate** until the bug is debuggable (loop the trigger, stress, narrow timing). A 50% flake is usable; 1% is not.

### When you cannot build a loop

Stop. List what you tried. Ask for environment access, a redacted artifact (HAR, logs), or permission for temporary instrumentation. Do **not** hypothesise without a loop.

### Completion criterion

Phase 1 is done only when you can name **one command** you have **already run** (show redacted invocation + output) that is:

- [ ] **Red-capable**  -  drives the bug path and asserts the **user's exact symptom**
- [ ] **Deterministic** (or high enough repro rate to debug)
- [ ] **Fast**  -  seconds when possible
- [ ] **Agent-runnable** without unsupervised production writes

If you catch yourself theorising before this command exists, stop.

## Phase 2  -  Reproduce and minimise

Run the loop. Watch it go red.

Confirm:

- [ ] Failure matches what the **user** described (wrong bug = wrong fix)
- [ ] Reproducible (or high enough rate)
- [ ] Exact symptom captured (message, wrong output, timing)

**Minimise:** cut inputs, callers, config, and steps one at a time; re-run after each cut. Keep only load-bearing elements. The minimised repro becomes the regression test in Phase 5.

## Phase 3  -  Hypothesise (several, ranked)

Generate **3–5 ranked, falsifiable hypotheses** before testing any.

Format: "If X is the cause, then changing Y will make the bug disappear / changing Z will make it worse."

If you cannot state the prediction, sharpen or discard the hypothesis.

Show the ranked list to the user when available (domain knowledge re-ranks cheaply). Do not block forever if they are AFK  -  proceed with your ranking.

Do not start with a single pet theory.

## Phase 4  -  Instrument

Each probe maps to a specific prediction. **Change one variable at a time.**

Preference order:

1. Debugger / REPL if available
2. Targeted logs at boundaries that distinguish hypotheses
3. Never "log everything and grep"

Tag every temporary log with a unique prefix, e.g. `[DEBUG-a4f2]`, so cleanup is one grep.

**Perf branch:** establish a baseline measurement first (timing, profiler, query plan), then bisect. Measure before "fixing."

## Phase 5  -  Fix and regression test

Write the regression test **before** the permanent fix when a **correct seam** exists (see `$revealui-tdd`).

A correct seam exercises the **real bug pattern** as it occurs at the call site. A shallow unit that cannot reproduce the chain gives false confidence.

If no correct seam exists, that is a finding: note it for architecture follow-up after the fix.

When a seam exists:

1. Turn the minimised repro into a failing test
2. Watch it fail
3. Apply the minimal fix
4. Watch it pass
5. Re-run the Phase 1 loop against the original (un-minimised) scenario

## Phase 6  -  Cleanup and post-mortem

Required before done:

- [ ] Phase 1 loop is green on the original scenario
- [ ] Regression test passes (or missing seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed (`grep` the prefix)
- [ ] Throwaway harnesses deleted or clearly marked temporary
- [ ] Correct hypothesis stated in commit / PR message

Then ask: **what would have prevented this?** If the answer is architectural (no good seam, tangled callers), file a follow-up  -  after the fix is in.

## Anti-Patterns

- Hypothesising before a red-capable loop
- Changing multiple things at once ("shotgun debugging")
- Fixing symptoms instead of root causes
- Adding try/catch to silence errors
- Increasing timeouts to hide races
- Reverting to "known good" without understanding the break
- Asking "does this fix it?" without a prediction
- Leaving untagged debug logs or secret values in logs

## Common RevealUI Debugging Paths

| Symptom | First Check |
|---------|------------|
| Import error | Package built? `pnpm --filter <pkg> build` |
| Type error across packages | `pnpm typecheck:all`  -  check `workspace:*` versions |
| Test passes alone, fails in gate | Concurrency pressure  -  see `$revealui-testing` |
| Supabase error in unexpected path | Import boundary violation  -  see `$revealui-db` |
| Biome error after edit | Run `npx biome check --write <file>` |
| Agent tool denied / unexpected auth | Tool governance / permission path in `@revealui/ai` |
| "Docs say X, runtime does Y" | Trust **code** (primary source); fix the doc after |

## Commit

- One commit for the fix when possible
- Format: `fix(scope): description of what was broken`
- Name the winning hypothesis in the body when non-obvious
