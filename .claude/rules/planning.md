# Planning Convention

## Fleet plan (canonical cross-product)

Fleet-level cross-cutting plans, lanes, gaps, and free surfaces live on the
Studio private TRACKER (not in public product repos). Day-to-day free surfaces:
`docs/TRACKER.md` in that private planning tree. Do not invent a second fleet
plan inside a public product repo.

Session plan files in `~/.claude/plans/` are ephemeral scratch — do not treat as
durable, and do not promote them into a repo's `docs/`.

## Per-product plans

Fleet product repos may keep a **product-scoped** plan at
`docs/MASTER_PLAN.md` (roadmap and residuals for that product only). Those
files are real and editable under the pre-tool-use holster allowlist (GAP-336).

Sanctioned product plan paths:

```text
~/revealfleet/{revealui,revdev,revvault,revcon,revkit,revskills,revforge,agency}/docs/MASTER_PLAN.md
```

Notes:

- **revealui** keeps a **retired public stub** at that path (2026-07-16). The
  stub is still editable so it stays an honest pointer; it is not the plan of
  record. Fleet planning for RevealUI lives on the Studio private TRACKER.
- **Other product repos** (revvault, revkit, revcon, …) keep live product-scoped
  plans. Edit them when product reality changes; do not fork fleet TRACKER work
  into them.
- **Stray** `MASTER_PLAN.md` files outside the allowlist are blocked by the
  pre-tool-use holster (rogue-copy guard).

## What not to do

- Do not create ACTION_PLAN.md / STATUS.md / TODO.md planning siblings.
- Do not treat session plans as durable.
- Do not track fleet free surfaces only in a product plan.
