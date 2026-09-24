---
'@revealui/ai': minor
---

Wire AgentRuntime and StreamingAgentRuntime to RevDev LoopGuard (`loop.arm`, `loop.tick`, `loop.stop`) when the Studio harness socket is reachable. Missing or silent daemons fail open. Governed `runGovernedTask` stays a separate receipt loop.
