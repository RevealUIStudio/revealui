---
"@revealui/harnesses": patch
---

Resolve terminal agent spawn backends from the harness adapter registry. The default is InferenceSnaps with the US-origin model gemma3. A missing or unknown backend is rejected, and ClaudeCode is only used when explicitly selected.
