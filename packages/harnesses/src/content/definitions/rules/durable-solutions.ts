import type { Rule } from '../../schemas/rule.js';

/**
 * Root-cause fixes only; the registry inventories existing debt.
 * No owner-approved, session-only or registered-hotfix exception.
 */
export const durableSolutionsRule: Rule = {
  id: 'durable-solutions',
  tier: 'oss',
  name: 'Durable Solutions',
  description:
    'Root-cause fixes only; no one-off exceptions; inventory existing debt and verify its removal',
  scope: 'global',
  preambleTier: 1,
  tags: ['sdlc', 'hardline', 'hotfix', 'quality', 'no-workarounds'],
  content: `# Durable Solutions

**Status:** HARDLINE every session, product and internal change (all harnesses).
There is no one-off or hotfix exception.

## Canonical fleet identity

Use **RevealFleet** as the visible fleet name, \`revealfleet\` as its profile
and path slug, and \`REVEALFLEET\` as its configuration prefix. Reject alternate
fleet identity spellings and aliases in active names, generated content and
configuration. Migrate existing instances through their owning source and
validated consumer cutover; do not add a compatibility alias or fallback.

Necessary negative test fixtures and historical security-detection patterns
record rejected input and evidence; they do not authorize alternate active
names. A naming migration must preserve existing cryptographic protocols and
trust anchors unless their security owners approve and validate that separate
change.

Prefer long-term durable solutions. Fix root causes in the owning layer (shared
lib, env bootstrap, policy, product primitive) so the failure class cannot
recur. Session-local patches, one-off shell recipes, and "works on my machine"
overrides are prohibited. Owner acceptance or a registry entry does not make
a one-off solution acceptable.

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
| Env / machine only | Edit gitignored \`.env\` without fixing loaders; permanent \`env -u\` |
| Session-only | Scratch scripts the owner must re-run forever |
| Symptom patch | Catch-and-ignore; disable the gate "for now" |
| Parallel path | Second seed script / second resolver "just for this case" |
| Silent demotion | Promise later hardening while the failing owning primitive stays open |
| Soften the ban | "Temporary workaround:", "for now you can…", "as a stopgap…" |

### When blocked

State the block honestly. List **only durable next actions**.

- **Blocked on:** unmerged durable PR, failed CI (name the outage), missing owner
  disposition, missing deploy, missing design decision.
- **Do:** record the owning path, failing behavior, durable target, validation
  needed and tracked follow-up. Continue useful authorized work that does not
  depend on the blocker.
- **Do not:** invent a second way to get the user unblocked that leaves the
  bug live for everyone else.

When provider evidence or owner disposition is required, report that dependency
honestly. A ticket records work; it is not a fix. Do not offer a substitute
procedure that leaves the failure class open.

### Existing one-off inventory

Search affected code and operating instructions for prior exceptions. Record
each location, behavior, owner, durable destination and removal evidence. The
hotfix registry inventories existing debt; it never authorizes a new one-off.
Remove an existing exception after its owning replacement is verified.

Temporary read-only diagnostics and synthetic test fixtures may establish a
cause. They must not become product fixes or operational dependencies. Repeated
operations belong in the maintained owning tool with tests and normal review.

## Rules

1. **Durable first.** Extend the real primitive; do not invent a parallel path.
2. **Never propose workarounds** (see above). Refuse; fix or block.
3. **No exceptions.** Owner acceptance and registration do not authorize one-offs.
4. **Inventory existing debt.** Record location, owner, durable destination and
   removal evidence; pending entries remain open until verified.
5. **Blockers are durable work.** Identify the failing primitive and required
   validation while continuing unaffected authorized work.

## Durable shapes

- Shared module / rule / hook / CI gate that fails closed for the class
- Supported configuration and bootstrap fixes in the owning model
- Gaps/ADRs that track the owning fix and its validation across sessions
- Tests that lock the durable behavior (prove red, then green)
- Maintained data migrations paired with the forward model fix and verification

## CLI (control layer)

\`\`\`bash
revealui-harnesses hotfix check
revealui-harnesses hotfix list
revealui-harnesses hotfix audit [path]
# Inventory an existing exception; never use this to authorize a new one-off:
revealui-harnesses hotfix register --title … --symptom … --temporary … --durable …
revealui-harnesses hotfix resolve <id> --pr <url>
\`\`\`

Store: \`~/.local/share/revealui/hotfixes/manifest.json\` (not vendor homes).

## References

- Sibling: extend-before-create, quality-over-speed, code-over-docs, adapter-only,
  disposition-actions
- GAP-405 — registry + adapter cutover; no dual Claude/Grok mirrors
`,
};
