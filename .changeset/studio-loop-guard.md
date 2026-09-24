---
'@revealui/ai': minor
---

Wire AgentRuntime and StreamingAgentRuntime to RevDev LoopGuard (`loop.arm`, `loop.tick`, `loop.status`) when the Studio harness socket is reachable. Omit `noopLimit` so the daemon applies 3. `session.end` and `harness.prune` reap loops. Missing or silent daemons fail open. Governed `runGovernedTask` stays a separate receipt loop.
