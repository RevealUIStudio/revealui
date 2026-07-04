---
'@revealui/harnesses': minor
---

Add the goal harness: goal-driven agent coordination with acceptance-criteria gating. New `GoalHarness` engine (exported at the root and at `@revealui/harnesses/goals`), `goals` + `goal_criteria` daemon tables, and DaemonStore goal methods. Completion is fail-closed (every criterion needs recorded evidence, every linked task must be completed) and the surface is propose-only: goals emit claimable tasks into the existing daemon task queue and never spawn agents.
