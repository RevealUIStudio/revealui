# Durable Solutions

**Status:** HARDLINE every session (all harnesses). Owner 2026-07-21 (durable first),
2026-08-06 (no workaround proposals), and 2026-09-29 (no one-off solutions).

Prefer long-term durable solutions. Fix root causes in the owning layer (shared
lib, env bootstrap, policy, product primitive) so the failure class cannot
recur. Session-local patches, one-off shell recipes, machine-only overrides,
symptom suppression, and parallel operational paths are prohibited. Owner
acceptance or a registry entry does not make them acceptable fixes.

## Canonical fleet identity

Use `revealfleet` as the sole fleet identity in visible names, profiles and
paths, and `REVEALFLEET` as the configuration namespace. Reject alternate
spellings and active aliases. Migrate references through their owning source
and regenerate consumers; preserve original historical evidence for recovery.
Negative fixtures may represent rejected input without creating an active alias.
Preserve cryptographic protocols and trust anchors unless their security owners
approve and validate that separate change.

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
| Silent demotion | "We'll harden later" without a durable target and tracked work |
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

### Existing one-off debt

Inventory prior one-offs in affected source and operating instructions. For each,
record the location, behavior, owner, durable destination, and evidence needed
to remove it. The hotfix registry is an inventory of existing debt only; it
never authorizes a new one-off. Do not treat registration, a ticket, or owner
approval as a substitute for a root-cause fix.

Temporary read-only diagnostics and synthetic test fixtures may establish a
cause. They are not product fixes and must not become operational dependencies.
If an operation is needed repeatedly, implement it in the owning maintained
tool with tests and normal review.

## Rules

1. **Durable first.** Extend the real primitive; do not invent a parallel path.
2. **Never propose workarounds** (see above). Refuse; fix or block.
3. **No one-off exception.** Do not ship session, machine, env, or registry-backed
   patches that leave the failure class open.
4. **Inventory existing debt.** Track its owning path and durable replacement;
   remove it after the replacement is verified.
5. **Record blockers as durable work.** Name the owning primitive, target,
   validation, and tracked follow-up. A ticket is not a fix.

## Durable shapes

- Shared module / rule / hook / CI gate that fails closed for the class
- Supported configuration behavior with tested defaults and documented bounds,
  never a special override that bypasses the root issue
- Gaps/ADRs when the durable fix needs multi-session design
- Tests that lock the durable behavior (prove red, then green)
- A versioned migration that converts existing rows to the new correct model,
  paired with the forward fix and tested through the normal release path

## CLI (control layer)

```bash
revealui-harnesses hotfix check
revealui-harnesses hotfix list
revealui-harnesses hotfix audit [path]
# Resolve an existing entry only after its durable replacement is verified:
revealui-harnesses hotfix resolve <id> --pr <url>
```

Store: `~/.local/share/revealui/hotfixes/manifest.json` (not vendor homes).

## Fleet identity

The only fleet identity is `revealfleet`. Configuration namespaces use
`REVEALFLEET`. Preserve these exact spellings in paths, profiles, generated
output, documentation, and session communication. Abbreviations and alternate
aliases are prohibited. Rename maintained references in their owning primitive
and regenerate consumers. Preserve original historical evidence for recovery;
do not turn historical names into active aliases or repeat them in new output.

## References

- Sibling: extend-before-create, quality-over-speed, code-over-docs, adapter-only,
  disposition-actions
- GAP-405 — registry + adapter cutover; no dual Claude/Grok mirrors
