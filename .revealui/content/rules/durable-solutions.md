# Durable Solutions

Prefer long-term durable solutions. Fix root causes in the owning layer (shared
lib, env bootstrap, policy, product primitive) so the failure class cannot
recur. Session-local patches, one-off shell recipes, and "works on my machine"
overrides are not done unless the owner accepts a **registered hotfix**.

## Rules

1. **Durable first.** Extend the real primitive; do not invent a parallel path.
2. **Hotfixes are debt.** Allowed only when production or a peer must be
   unblocked *now*. Register the same turn with symptom, temporary shape,
   durable target, paths, and optional gap id.
3. **Every hotfix has a destination.** Pending entries surface at session
   boundaries until converted.
4. **Unregistered hotfixes are policy violations** (same class as orphan temp
   scripts).

## Non-durable shapes (register or refuse)

| Shape | Examples |
|-------|----------|
| Env / machine only | Editing gitignored `.env.local` without fixing loaders |
| Session-only | Scratch scripts left for the owner; undocumented escapes |
| Symptom patch | Catch-and-ignore without root fix |
| Parallel path | Second seed script or resolver "just for X" |
| Silent demotion | "We'll harden later" with no registry entry |

## Durable shapes

- Shared module / rule / hook / CI gate that fails closed for the class
- Documented escape hatches with explicit env flags
- Gaps/ADRs when the durable fix needs multi-session design
- Tests that lock the durable behavior (prove red, then green)

## CLI (control layer)

```bash
revealui-harnesses hotfix check
revealui-harnesses hotfix list
revealui-harnesses hotfix audit [path]
# Only if a temporary patch is unavoidable (admits debt):
revealui-harnesses hotfix register --title … --symptom … --temporary … --durable …
revealui-harnesses hotfix resolve <id> --pr <url>
```

Store: `~/.local/share/revealui/hotfixes/manifest.json` (not vendor homes).

## References

- Sibling: extend-before-create, quality-over-speed, code-over-docs, adapter-only
- GAP-405 — registry + adapter cutover; no dual Claude/Grok mirrors
