---
'@revealui/ai': patch
---

Fix `test_runner` leaking the test process tree on timeout.

The tool ran tests via `execSync(..., { timeout })`, whose timeout signal only reaches the immediate child (the shell). A grandchild — e.g. `pnpm test` → `node …` — was orphaned and kept running. An agent pointing `test_runner` at a hanging suite leaked a process on every timeout; in the unit suite these orphans accumulated and starved CI, flaking the timeout test and crashing sibling test files under load.

`execute` now spawns the command detached (its own process group) and, on timeout, kills the whole group via `process.kill(-pid, 'SIGKILL')` — reaping the entire tree. Output capture is byte-capped instead of throwing on overflow. Behavior is otherwise unchanged: framework detection, command building, and result parsing are identical, and a real timeout still returns `{ success: false, error: 'Tests timed out after …' }`.

Verified: full `@revealui/ai` suite passes 942/942 twice under concurrent load with zero leaked processes (previously 1 failed + 3 file-level crashes + 18 orphaned `node` processes).
