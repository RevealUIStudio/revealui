# Durable Solutions

**Status:** HARDLINE every session (all harnesses). Owner 2026-07-21 (durable first);
owner 2026-08-06 (**proposing workarounds is forbidden**).

Prefer long-term durable solutions. Fix root causes in the owning layer (shared
lib, env bootstrap, policy, product primitive) so the failure class cannot
recur. Session-local patches, one-off shell recipes, and "works on my machine"
overrides are not done unless the owner accepts a **registered hotfix**.

## Proposing workarounds is forbidden

Agents must **never** propose, suggest, list as an option, or frame as interim
guidance any **workaround**: a procedure, recipe, alternate login, env-only
step, or parallel path that lets someone proceed while the real failure class
stays open.

This applies to **code, chat, handoffs, PR descriptions, and walk-throughs**.

### Forbidden shapes (non-exhaustive)

| Shape | Examples (do not say / do not ship) |
|-------|-------------------------------------|
| Interim product recipe | "Until the PR deploys, sign in with password+TOTP instead" as a solution |
| Alternate path while broken | "Use account B if account A hits the bug" as the fix |
| Env / machine only | Edit gitignored `.env` without fixing loaders; permanent `env -u` |
| Session-only | Scratch scripts the owner must re-run forever |
| Symptom patch | Catch-and-ignore; disable the gate "for now" |
| Parallel path | Second seed script / second resolver "just for this case" |
| Silent demotion | "We'll harden later" with no registry entry or GAP |
| Soften the ban | "Temporary workaround:", "for now you can…", "as a stopgap…" |

### When blocked

State the block honestly. List **only durable next actions**.

- **Blocked on:** unmerged durable PR, failed CI (name the outage), missing owner
  disposition, missing deploy, missing design decision.
- **Do:** name the owning primitive, the PR/GAP/ADR, the one-line owner command
  when disposition is needed.
- **Do not:** invent a second way to get the user unblocked that leaves the
  bug live for everyone else.

If the only honest move is "wait for GitHub Actions / deploy / owner merge",
say that and stop. Waiting is not a workaround; offering a substitute procedure is.

### Hotfixes (narrow exception — still not free-form advice)

A **registered hotfix** is allowed only when the owner **explicitly accepts**
registered debt in-session (production or peer must be unblocked *now*). Same
turn: register symptom, temporary shape, durable target, paths, optional GAP.
Unregistered hotfixes are policy violations equal to orphan temp scripts.

Proposing "just do this temporary thing" **without** owner-accepted registration
is forbidden even if a hotfix *could* be registered later.

## Rules

1. **Durable first.** Extend the real primitive; do not invent a parallel path.
2. **Never propose workarounds** (see above). Refuse; fix or block.
3. **Hotfixes are debt.** Only with named owner acceptance + same-turn register.
4. **Every hotfix has a destination.** Pending entries surface at session
   boundaries until converted.
5. **Unregistered hotfixes are policy violations.**

## Durable shapes

- Shared module / rule / hook / CI gate that fails closed for the class
- Documented escape hatches with explicit env flags (product design, not session glue)
- Gaps/ADRs when the durable fix needs multi-session design
- Tests that lock the durable behavior (prove red, then green)
- One-time **data backfill** that converts existing rows to the new correct model
  (paired with the forward fix) — not a permanent dual path

## CLI (control layer)

```bash
revealui-harnesses hotfix check
revealui-harnesses hotfix list
revealui-harnesses hotfix audit [path]
# Only if owner accepted a temporary patch (admits debt — not preferred):
revealui-harnesses hotfix register --title … --symptom … --temporary … --durable …
revealui-harnesses hotfix resolve <id> --pr <url>
```

Store: `~/.local/share/revealui/hotfixes/manifest.json` (not vendor homes).

## References

- Sibling: extend-before-create, quality-over-speed, code-over-docs, adapter-only,
  disposition-actions
- GAP-405 — registry + adapter cutover; no dual Claude/Grok mirrors
