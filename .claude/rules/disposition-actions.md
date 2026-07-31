# Disposition Actions — Propose, Don't Dispose

Agent work is **proposal-shaped by default**. A proposal produces an artifact
someone else can act on; a disposition consummates an outcome. Proposals never
need special authorization; dispositions always do.

## Always safe (proposal-shaped)

- Reading, grepping, auditing; empirical tests in session scratch
- Posting review or verdict comments on PRs
- Creating worktrees, committing to fresh branches, pushing feature branches
- Opening PRs, filing gaps, authoring specs and lane docs

## Disposition-shaped (requires named in-session owner authorization)

- Merging any PR the agent authored this session
- Merging any PR whose subject matter is security (design docs included)
- Applying gate-clearing labels (`sec-review:approved` and siblings)
- Deleting remote branches
- Mutating repo settings, rulesets, required checks, Actions secrets, webhooks
- Force pushes, history rewrites, removing another session's worktree

A blanket preference in memory ("merge green PRs") does **not** cover
security-classed items. Only named in-session words or a standing settings
allow rule do.

## Never bundle a disposition with anything else

One disposition action per shell command, alone. Mid-bundle blocks leave half-
executed state.

## When a PR is ready and no authorization exists

Stop at the open PR. List the exact one-line owner command under owner actions.
Do not re-send a blocked command or accomplish the disposition through another
tool.

## References

- Sibling: tracker-first, quality-over-speed, durable-solutions
- Adapter glue may deny merge/force at the permission layer; this rule is the
  policy body adapters must not re-author in full.
