---
"revealui": patch
---

ci(deploy): make smoke-test rollback step actually roll back

`vercel rollback` with no URL argument is a status query, not an action — so on smoke-test failure the rollback step printed "Rolling back…" / "no rollback in progress" and the broken deploy stayed live. The step now pre-fetches the previous successful production deploy URL via `vercel ls --prod`, passes it to `vercel rollback <url> --yes`, verifies the alias moved post-rollback, and exits non-zero with a precise message reflecting whether the rollback succeeded, failed, or had no history. Closes GAP-128 (companion to GAP-122 which fixed the pnpm crash). Surfaced 2026-04-25 during #540 incident verification — at 06:55Z the rollback step ran cleanly (per the GAP-122 fix) but reported "no rollback in progress" while the broken deploy continued serving prod.
