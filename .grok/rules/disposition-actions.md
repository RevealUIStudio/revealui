# Disposition Actions — Propose, Don't Dispose

Agent work is **proposal-shaped by default**. A proposal produces an artifact
someone else can act on; a disposition consummates an outcome. Proposals never
need special authorization; dispositions always do.

## Always safe (proposal-shaped)

- Reading, grepping, auditing; empirical tests in session scratch
- Posting a *short* public verdict marker on PRs (attack writeups stay private)
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

## Owner-action `gh` form (all sessions, all harnesses)

Prefer short `-R owner/repo` over long `--repo`. Always pin the repo so the
command works from any cwd. Prefer unquoted label values when the label has no
spaces. Canonical clearance example:

```bash
gh pr edit 2482 -R RevealUIStudio/revealui --add-label sec-review:approved
```

Same shape for other owner one-liners: `gh pr merge <n> -R owner/repo …`,
`gh pr view <n> -R owner/repo …`, `gh pr checks <n> -R owner/repo`. Hooks that
print clearance commands (for example sec-review-pending) already use `-R`;
agent wrap-ups and skills must match.

## References

- Sibling: tracker-first, quality-over-speed, durable-solutions
- Adapter glue may deny merge/force at the permission layer; this rule is the
  policy body adapters must not re-author in full.
